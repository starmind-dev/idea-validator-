import { NextResponse } from "next/server";
import client from "../../../lib/services/anthropic-client";
import { extractKeywords } from "../../../lib/services/keywords";
import { searchGitHub } from "../../../lib/services/github";
import { searchSerper } from "../../../lib/services/serper";
import { searchTavily } from "../../../lib/services/tavily";
import { searchExa } from "../../../lib/services/exa";
import { buildCompetitorContext, buildCompetitorInstructions } from "../../../lib/services/competitors";
import { STAGE1_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage1";
import { STAGE2A_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2a";
// V5.0 NEW PIPELINE — three separate metric scorers replace the former
// two-call Stage 2b (adjudicate + score) plus the prosecutor/repair QC layer.
// Each scorer reads ONLY its own packet from Stage 2a (clean quarantine).
import { STAGE_MD_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-md";
import { STAGE_MO_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-mo";
import { STAGE_OR_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-or";
import { STAGE2C_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage2c";
import { VERDICT_LEAD_SYSTEM_PROMPT } from "../../../lib/services/prompt-verdict-lead";
import { STAGE_TC_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage-tc";
import { STAGE3_SYSTEM_PROMPT } from "../../../lib/services/prompt-stage3";
import { calculateOverallScore, computeMoDisplayScore, computeMoOverrideTrace } from "../../../lib/services/scoring";
import { validateHinge, hingeViolation } from "../../../lib/contracts/hinge";
import { createClient } from "@supabase/supabase-js";
import { assertCanRun, recordRun } from "../../../lib/services/entitlements";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================================
// VERDICT-LEAD GUARD (Option B safety net)
// ============================================================================
// The Haiku compressor makes a short lead the DEFAULT; this makes the long tail
// impossible. Haiku obeys a sentence COUNT but cannot reliably self-measure an
// 80/65-word budget, so a present-but-overlong lead can still reach the card.
// This bounds it deterministically (no second model call): a lead over the word
// ceiling is clamped to whole sentences under the ceiling rather than dropped —
// because dropping it to null lets the VIEW fall back to the full modal-length
// summary, which is the exact wall this lead exists to prevent. Truly-failed
// compression (exception / unparseable / empty) still returns null and is handled
// at the view layer (degrade to headline + score, never the full summary).
const VERDICT_LEAD_WORD_CEILING = 65;
function boundVerdictLead(lead) {
  if (typeof lead !== "string") return null;
  // Strip a leaked beat label ("Foundation: ...") the prompt bans but Haiku may emit.
  let t = lead.trim().replace(/^\s*(foundation|constraint|pivot)\s*:\s*/i, "").trim();
  if (!t) return null;
  if (t.split(/\s+/).length <= VERDICT_LEAD_WORD_CEILING) return t;
  // Overlong: keep whole sentences up to the ceiling (preserves the beat spine,
  // shedding the last beat before a mid-sentence cut).
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [];
  let kept = "";
  for (const s of sentences) {
    const candidate = (kept ? kept + " " : "") + s.trim();
    if (candidate.split(/\s+/).length > VERDICT_LEAD_WORD_CEILING && kept) break;
    kept = candidate;
  }
  // Run-on with no sentence boundaries, or a single sentence already over ceiling:
  // hard-slice to the ceiling as a last-resort backstop.
  if (!kept || kept.split(/\s+/).length > VERDICT_LEAD_WORD_CEILING) {
    kept = t.split(/\s+/).slice(0, VERDICT_LEAD_WORD_CEILING).join(" ").replace(/[\s,;:\u2014-]+$/, "") + "\u2026";
  }
  return kept;
}

// ============================================
// MAIN API HANDLER — PAID TIER CHAINED PIPELINE
// ============================================
// Orchestrates: Keywords → Search → Stage 1 (Discover) → [Stage 2a + Stage TC
// in parallel] → [Stage MD + Stage MO + Stage OR scorers in parallel] →
// Stage 2c (Synthesis) → Stage 3 (Act) → Assembly
//
// V5.0 SCORING (replaces V4S31 two-call Stage 2b + V4S32 prosecutor/repair):
// Three isolated metric scorers (MD/MO/OR) each read ONLY their own Stage 2a
// packet and emit score as a mechanical lookup[archetype][sub_position] from
// committed predicates, with prose generated after the score token. The former
// two-call adjudicate→score flow and the prosecutor+repair QC layer are removed
// entirely — the score-rationalization disease they targeted is structurally
// unreachable when score is a lookup, not a generated choice. Each scorer's
// full reasoning trail lives in a nested _internal block, stripped before
// Stage 2c/3 and restored at the final payload boundary; downstream stages
// never consume _internal.
//
// V4S28 S1+S2+S3 (Bundle B1):
// Stage 2c (NEW) sits between Stage 2b and Stage 3, sequential. It synthesizes
// summary + failure_risks from idea + profile + Stage 1 output + Stage 2a
// packets + Stage 2b scores + evidence_strength. Stage 2b no longer outputs
// summary or failure_risks — those moved to Stage 2c. Stage 3 reads
// failure_risks from the merged evaluation object (mutated in-place after
// Stage 2c completes), preserving Stage 3's risk-mitigation behavior.
//
// Sequencing rationale: 2c||3 parallel was rejected because Stage 3 reads
// failure_risks as input — under parallel design Stage 3 would lose this input.
// Sequential 2c → 3 protects Stage 3 quality at a cost of ~5-8s latency.
// See execution-plan.md S3.
//
// Graceful degradation: if Stage 2c parse fails, summary + failure_risks are
// set empty, Stage 3 proceeds without failure_risks input. Evaluation still
// produces scores.
//
// Stage TC runs in PARALLEL with Stage 2a — it receives ONLY idea + profile,
// never sees Stage 1 output. This physically prevents TC from correlating with
// competition-informed metrics (OR, MD, MO).
//
// Stage 2a extracts 3 evidence packets (MD, MO, OR) — no TC packet.
// Stage 2b adjudicates + scores 3 metrics from those packets (two calls).
// Stage 2c synthesizes interpretive output (summary + failure_risks).
// TC score is merged in during assembly.
//
// Output schema is identical to the free tier route — the frontend renders both the same way.

// ============================================
// V4S31 — SCORE-BASIS RANGE DERIVATION HELPER
// ============================================
// Mechanical mapping from Call 1's score_basis enum to the score range Call 2
// must land in. Used by code-side score clamping after Call 2: if Call 2 emits
// a score outside the derived range, the score is clamped to the range and a
// warning is logged. This is the structural enforcement of score-adjudication
// consistency — Call 1's locked score_basis defines the score range; Call 2's
// score must respect it.
//
// Returns { min, max } or null if score_basis is unrecognized (clamping skipped).
export async function POST(request) {
  try {
    const body = await request.json();
    const { idea, profile } = body;

    if (!idea || !idea.trim()) {
      return NextResponse.json(
        { error: "No idea provided" },
        { status: 400 }
      );
    }

    // ── Optional auth + entitlement gate — BEFORE the stream opens ───────────
    // Evaluating never requires an account (it's the hook; SAVING requires auth).
    // A valid token binds the run to that user's weekly allowance; without one the
    // run is anonymous — capped per IP — and, like every run, counts against the
    // global budget so this open pipeline can't be flooded.
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const { data: authData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null };
    const user = authData?.user || null;
    const clientIp = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;

    // action distinguishes a fresh Deep from a Re-evaluation (both metered).
    const action = body.action === "reeval" ? "reeval" : "deep";

    try {
      await assertCanRun(user?.id || null, action, { ip: clientIp });
    } catch (gateErr) {
      const status = gateErr.code === "CAPACITY" ? 503 : 402;
      return NextResponse.json({ error: gateErr.message, code: gateErr.code || "LIMIT" }, { status });
    }

    // ── LOCAL-ONLY TEST FAULT INJECTION (F4 harness support) ──
    // Drives runners/run-f4-failure-harness-http.js. Reads an optional
    // _test_fault directive from the request body to force the exact conditions
    // F4 handles — a transient model-call throw (recover / fatal) and a Stage 2c
    // degrade — with no real outage and no server restart.
    //
    // STRUCTURALLY INERT IN PRODUCTION: the NODE_ENV guard makes testFault null
    // whenever NODE_ENV === "production", so no request can trigger a synthetic
    // fault on the live site, regardless of what it sends. Same safety model as
    // the fixture-mode guard in keywords.js. Recognized values:
    //   "retry_recover"     — first model call throws once, recovers on retry
    //   "retry_recover_all" — every model call throws once, all recover on retry
    //   "retry_fatal"       — first model call throws on BOTH attempts (double-fail)
    //   "degrade_2c"        — Stage 2c takes its degrade branch (empty synthesis)
    const testFault =
      process.env.NODE_ENV !== "production" && typeof body._test_fault === "string"
        ? body._test_fault
        : null;

    // Generate evaluation correlation ID, surfaced in the response so the
    // frontend can use the same ID when persisting the evaluation to its own
    // table. crypto.randomUUID is available in Node 14.17+ / all Next.js
    // runtimes. (Pre-V5.0 this was also the join key for the QC-events table,
    // removed with the prosecutor/repair layer.)
    const evaluationId = crypto.randomUUID();

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE events
        function sendEvent(data) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        }

        try {
          // Helper to clean LLM JSON responses, handling:
          //   - Bare JSON: { ... }
          //   - Markdown-fenced JSON: ```json\n{ ... }\n```
          //   - JSON preceded by prose preamble: "Looking at this... 1. **HARDEST...** ```json\n{ ... }\n```"
          //   - JSON followed by trailing prose or fences
          //
          // V4S28 B9 Stage TC parse hardening (May 4, 2026):
          // Original implementation only stripped ```json fences when they
          // appeared at startsWith()/endsWith() positions. On long structured
          // inputs (e.g. "Sherpa" devex monitoring pitch — ~3.2k chars / 450
          // words with formal IDE-plugin / tutorial-vs-real-engineering
          // framing), Stage TC leaked its internal reasoning headers
          // (HARDEST TECHNICAL PROBLEM / SIMPLEST WORKING VERSION /
          // BEYOND-TUTORIAL GAP) as visible output preamble before the
          // ```json fence — breaking the startsWith() check and causing
          // JSON.parse() to fail on prose. Two consecutive Pro-pipeline runs
          // both failed identically; Standard pipeline (unified prompt) on
          // same input succeeded — confirming bug is in Stage TC's isolated
          // parser path, not the input or the model.
          //
          // This helper is shared across Stage 1, Stage 2a, Stage 2b,
          // Stage 2c, Stage 3, AND Stage TC (every parse in this route).
          // Stage TC was the first to surface the bug because its isolated-
          // call attention budget makes it more prone to preamble leak.
          // Other stages were vulnerable to the same bug; this fix covers
          // all six call sites with one helper change. Pure additive
          // upgrade — every input the old parser handled correctly still
          // parses identically; only previously-failing inputs (prose
          // preamble) now succeed.
          //
          // Stage TC reasoning logic + prompt are NOT changed by this fix
          // (off-limits per active TC monitoring directive — anchor-fixing
          // bug from B6 surfaced; TC scoring math + reasoning are locked
          // until dedicated TC fix session). Output format hardening at
          // prompt level deferred to that session.
          function cleanJsonResponse(text) {
            if (!text || typeof text !== "string") {
              return text;
            }
            const trimmed = text.trim();
            const parses = (s) => {
              try { JSON.parse(s); return true; } catch { return false; }
            };

            // (1) FENCED BLOCK FIRST, scanning from the LAST fence backward.
            //     The scorers reason in prose before emitting JSON, and that
            //     reasoning can legitimately contain curly braces — Stage MO
            //     writes archetype set notation like
            //     "(within {segment, specific_role, ...})", which made the
            //     legacy first-{ ... last-} slice start at prose instead of
            //     at the JSON and fail the run (2026-07-19). The final fenced
            //     block is the model's own declaration of where the JSON is;
            //     trust it when its content actually parses. Last-first
            //     because drafts may precede the final emission.
            const fences = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
            for (let i = fences.length - 1; i >= 0; i--) {
              const inner = fences[i][1].trim();
              if (inner.startsWith("{") && parses(inner)) return inner;
            }

            // (2) Legacy slice — first { to last }. Covers bare JSON, prose
            //     preamble without braces, and unterminated fences.
            const firstBrace = trimmed.indexOf("{");
            const lastBrace = trimmed.lastIndexOf("}");
            if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
              // No JSON object found — return trimmed input so the JSON.parse
              // call below produces the same failure shape it always did.
              // Defensive: do not mask non-JSON responses; let them surface
              // as parse errors so the existing error handling fires.
              return trimmed;
            }
            const slice = trimmed.slice(firstBrace, lastBrace + 1);
            if (parses(slice)) return slice;

            // (3) PROGRESSIVE STARTS — the backstop for prose braces with no
            //     usable fence: walk forward through each { and return the
            //     first suffix-to-lastBrace that parses. The true JSON start
            //     is reached within (prose braces + 1) attempts; the cap only
            //     bounds the genuinely-broken case, which then falls through
            //     to the original failure shape so the existing error path
            //     fires unchanged.
            let idx = trimmed.indexOf("{", firstBrace + 1);
            let attempts = 0;
            while (idx !== -1 && idx <= lastBrace && attempts < 200) {
              const candidate = trimmed.slice(idx, lastBrace + 1);
              if (parses(candidate)) return candidate;
              idx = trimmed.indexOf("{", idx + 1);
              attempts++;
            }
            return slice;
          }

          // ============================
          // F4/B — TRANSIENT-FAILURE RESILIENCE (retry-once wrapper)
          // ============================
          // Every Sonnet call in this pipeline is a network request that can
          // stumble on a transient fault — timeout, 5xx, rate-limit, connection
          // reset — that would succeed on a second attempt a moment later.
          // Before this wrapper, ANY such stumble on ANY of the eight model
          // calls threw straight to the outer catch and discarded the entire
          // ~80s / paid evaluation with a single generic "Analysis failed"
          // message. That punished a paying user for a momentary blip.
          //
          // callWithRetry makes one quiet second attempt after a short backoff.
          // When the first attempt fails it emits a CALM, NON-ERROR progress
          // event ("retry") so the live pipeline panel can show an honest
          // "hit a snag — retrying" line (the user is already watching the
          // steps tick by; silence during the extra wait would be worse than a
          // word). If the SECOND attempt also throws, the error propagates
          // UNCHANGED to the caller's existing per-stage handling / outer catch
          // — so genuine double-failures still surface exactly as before.
          //
          // SCOPE NOTE: this wraps the model CALL only (the transient-network
          // case). It does NOT retry JSON PARSE failures — those keep their
          // existing per-stage handling. A parse failure means the model
          // returned malformed JSON; at temp 0 a re-call tends to reproduce the
          // same output, so retrying it mostly just spends the user's time to
          // fail the same way. This changes failure HANDLING only — it touches
          // no prompt, no scoring, no stage output.
          const RETRY_BACKOFF_MS = 1200;

          // ── F4 harness fault flags (derived from the NODE_ENV-gated testFault;
          // all false in production). _faultTripped tracks which labels have
          // already been force-thrown this request so a single forced throw is
          // followed by a real, succeeding retry. ──
          const TEST_RETRY_RECOVER_ALL = testFault === "retry_recover_all";
          const TEST_RETRY_RECOVER = testFault === "retry_recover" || TEST_RETRY_RECOVER_ALL;
          const TEST_RETRY_FATAL = testFault === "retry_fatal";
          const TEST_DEGRADE_2C = testFault === "degrade_2c";
          const _faultTripped = new Set();
          function _shouldForceAttempt1(label) {
            if (_faultTripped.has(label)) return false;       // each label trips at most once
            if (TEST_RETRY_RECOVER_ALL) return true;          // every stage trips
            return _faultTripped.size === 0;                  // recover/fatal: first stage only
          }

          async function callWithRetry(callConfig, label) {
            try {
              // Harness: force a synthetic attempt-1 throw (no real call spent).
              if ((TEST_RETRY_RECOVER || TEST_RETRY_FATAL) && _shouldForceAttempt1(label)) {
                _faultTripped.add(label);
                throw new Error(`[TEST] forced attempt-1 fault: ${label}`);
              }
              return await client.messages.create(callConfig);
            } catch (firstError) {
              console.error(
                `${label} model call failed (attempt 1 of 2), retrying:`,
                firstError?.message || firstError
              );
              sendEvent({
                step: "retry",
                message: `${label} hit a snag — retrying, thanks for your patience.`,
              });
              await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
              // Harness: under the FATAL flag, fail the second attempt too, so the
              // double-failure path (propagate → existing error handling) is exercised.
              if (TEST_RETRY_FATAL && _faultTripped.has(label)) {
                throw new Error(`[TEST] forced attempt-2 fault: ${label}`);
              }
              // Second and final attempt. If this throws, it is intentionally
              // NOT caught here — the caller's existing error path handles it.
              return await client.messages.create(callConfig);
            }
          }

          // ============================
          // PHASE 1: EVIDENCE GATHERING
          // (Same as free tier — keywords + search)
          // ============================

          sendEvent({ step: "keywords_start", message: "Extracting keywords..." });

          const keywordsResult = await extractKeywords(idea);

          // SAFETY: extractKeywords used to gate underspecified inputs at this point
          // and return its verdict WITHOUT keywords/queries (the removed specificity
          // gate consumed that shape and returned early). With the gate gone, an input
          // that would have been flagged now arrives here with no keyword set —
          // keywords.join below, and the searches, would crash on undefined and the
          // whole run dies with a generic "Analysis failed". Guard it: when the set is
          // missing, derive a usable fallback straight from the idea so the pipeline
          // proceeds. When keywords.js returns a real set (the normal case) this is a
          // no-op — the real keywords/queries pass straight through.
          const _ideaWords = String(idea || "")
            .split(/\s+/)
            .map((w) => w.replace(/[^\w]/g, ""))
            .filter((w) => w.length > 2);
          const _fallbackQuery = _ideaWords.slice(0, 8).join(" ") || String(idea || "").slice(0, 80);
          const keywords = (Array.isArray(keywordsResult.keywords) && keywordsResult.keywords.length)
            ? keywordsResult.keywords
            : _ideaWords.slice(0, 6);
          const githubQuery1 = keywordsResult.githubQuery1 || _fallbackQuery;
          const githubQuery2 = keywordsResult.githubQuery2 || _ideaWords.slice(0, 5).join(" ") || _fallbackQuery;
          const serperQuery1 = keywordsResult.serperQuery1 || _fallbackQuery;
          const serperQuery2 = keywordsResult.serperQuery2 || _ideaWords.slice(5, 13).join(" ") || _fallbackQuery;

          sendEvent({
            step: "keywords_done",
            message: `Keywords: ${keywords.join(", ")}`,
            data: { keywords },
          });

          sendEvent({ step: "search_start", message: "Searching across GitHub, web, and semantic sources..." });

          const [
            githubResults1,
            githubResults2,
            serperResults1,
            serperResults2,
            tavilyResults1,
            tavilyResults2,
            exaResults1,
            exaResults2,
          ] = await Promise.all([
            searchGitHub(githubQuery1),
            searchGitHub(githubQuery2),
            searchSerper(serperQuery1),
            searchSerper(serperQuery2),
            searchTavily(serperQuery1),
            searchTavily(serperQuery2),
            searchExa(serperQuery1),
            searchExa(serperQuery2),
          ]);

          // Deduplicate results by URL
          const seenUrls = new Set();

          function dedup(results) {
            const unique = [];
            for (const item of results) {
              if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                unique.push(item);
              }
            }
            return unique;
          }

          const githubResults = dedup([...githubResults1, ...githubResults2]).slice(0, 7);
          const tavilyResults = dedup([...tavilyResults1, ...tavilyResults2]).slice(0, 7);
          const exaResults = dedup([...exaResults1, ...exaResults2]).slice(0, 7);
          const serperResults = dedup([...serperResults1, ...serperResults2]).slice(0, 7);

          // V4S28 P0.5 Stage 1 Fix #1: sort retrieved items by URL before injection
          // Eliminates retrieval ordering as a source of Stage 1 synthesis non-determinism.
          // Phase 0 observed Serper Jaccard 0.40-0.75 across reruns — Google's ranking
          // fluctuates on identical queries. Sorting gives Stage 1 a stable input order
          // so observed competitor-list drift is attributable to synthesis, not input.
          githubResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          tavilyResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          exaResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
          serperResults.sort((a, b) => (a.url || "").localeCompare(b.url || ""));

          // V4S28 P0: emit raw `results` arrays alongside `count` so variance
          // diagnostic can localize cascade source (retrieval vs Stage 1 synthesis).
          sendEvent({
            step: "github_done",
            message: githubResults.length > 0
              ? `GitHub: ${githubResults.length} repositories`
              : "GitHub: no matching repositories",
            data: { count: githubResults.length, results: githubResults },
          });

          sendEvent({
            step: "tavily_done",
            message: tavilyResults.length > 0
              ? `Tavily: ${tavilyResults.length} results`
              : "Tavily: no results",
            data: { count: tavilyResults.length, results: tavilyResults },
          });

          sendEvent({
            step: "exa_done",
            message: exaResults.length > 0
              ? `Exa: ${exaResults.length} results`
              : "Exa: no results",
            data: { count: exaResults.length, results: exaResults },
          });

          sendEvent({
            step: "serper_done",
            message: serperResults.length > 0
              ? `Google: ${serperResults.length} results`
              : "Google: no results",
            data: { count: serperResults.length, results: serperResults },
          });

          // Build competitor context for injection
          const { context: competitorContext, hasRealData } = buildCompetitorContext([
            {
              type: "github",
              header: "REAL COMPETITOR DATA FROM GITHUB",
              intro: "These are real, verified GitHub repositories related to this idea:",
              items: githubResults,
            },
            {
              type: "web",
              header: "REAL COMPETITOR DATA FROM WEB SEARCH (TAVILY)",
              intro: "These are real products and companies found via AI-native web search:",
              items: tavilyResults,
            },
            {
              type: "web",
              header: "REAL COMPETITOR DATA FROM SEMANTIC SEARCH (EXA)",
              intro: "These are real products and companies found via neural/semantic search — conceptually similar to the idea even if they use different wording:",
              items: exaResults,
            },
            {
              type: "web",
              header: "REAL COMPETITOR DATA FROM GOOGLE SEARCH",
              intro: "These are real products and companies found via Google:",
              items: serperResults,
            },
          ]);
          const competitorInstructions = buildCompetitorInstructions(hasRealData);

          const dataSourceMsg = hasRealData
            ? "Evidence assembled \u00b7 real market data"
            : "No verified data found — using AI knowledge base";

          sendEvent({
            step: "evidence_ready",
            message: dataSourceMsg,
            data: { hasRealData, github: githubResults.length, tavily: tavilyResults.length, exa: exaResults.length, serper: serperResults.length },
          });

          const userProfile = `
USER PROFILE:
- Coding familiarity: ${profile?.coding || "Not specified"}
- AI experience: ${profile?.ai || "Not specified"}
- Professional background: ${profile?.education || "Not specified"}`;

          // ============================
          // STAGE 1: DISCOVER
          // Competition analysis + domain risk detection
          // ============================

          sendEvent({ step: "stage1_start", message: "Stage 1: Analyzing competitive landscape..." });

          const stage1SystemPrompt = STAGE1_SYSTEM_PROMPT + competitorContext + competitorInstructions;

          // V4S28 B6 P12-S1: Stage 1 is profile-blind. Profile is NOT injected
          // into Stage 1 input. Profile-aware judgments live downstream in TC,
          // Stage 2c synthesis, and Stage 3. See prompt-stage1.js
          // PROFILE-BLINDNESS section for prompt-level contract.
          const stage1UserMessage = `USER'S AI PRODUCT IDEA:
${idea}`;

          const stage1Response = await callWithRetry({
            model: "claude-sonnet-4-6",
            max_tokens: 8000,
            temperature: 0,
            // V4S28 P0.5 Stage 1 Fix #3: sampler-level hardening.
            // Phase 0.5 Fix #1 (sort items) confirmed Stage 1 non-determinism
            // is NOT input-ordering sensitive — MAT3-insider with Serper URL
            // Jaccard 1.00 still produced competitor-list Jaccard 0.38 across
            // reruns. Anthropic docs acknowledge temp=0 alone is not fully
            // deterministic. top_k=1 forces greedy single-token selection at
            // each step; top_p=0.1 constrains nucleus to top 10% probability
            // mass as belt-and-suspenders against distribution flattening.
            // Sonnet 4 (claude-sonnet-4-6) accepts both alongside
            // temperature (the either/or restriction is Sonnet 4.5+ only).
            top_k: 1,
            system: stage1SystemPrompt,
            messages: [{ role: "user", content: stage1UserMessage }],
          }, "Competitive analysis");

          const stage1Text = stage1Response.content[0].text;

          let stage1Result;
          try {
            stage1Result = JSON.parse(cleanJsonResponse(stage1Text));
          } catch (parseError) {
            console.error("Stage 1 parse failed:", stage1Text);
            sendEvent({ step: "error", message: "Stage 1 failed to parse. Please try again." });
            controller.close();
            return;
          }

          // If ethics blocked at Stage 1, stop immediately
          if (stage1Result.ethics_blocked) {
            sendEvent({ step: "complete", data: stage1Result });
            controller.close();
            return;
          }

          const competitorCount = stage1Result.competition?.competitors?.length || 0;
          sendEvent({
            step: "stage1_done",
            message: `Stage 1 complete: ${competitorCount} competitors analyzed`,
            data: { competitorCount },
          });

          // ============================
          // STAGE 2a + STAGE TC: RUN IN PARALLEL
          // Stage 2a: Extract MD/MO/OR evidence packets from Stage 1
          // Stage TC: Score TC from idea + profile ONLY (no Stage 1 data)
          // ============================

          sendEvent({ step: "stage2a_start", message: "Stage 2a: Extracting evidence + scoring technical complexity..." });

          // V4S28 B6 (Path A — found during route audit): Stage 2a is profile-blind
          // per V4S9 architectural quarantine and NarrativeContract V3 §3.10.
          // Profile is NOT injected. Sparse-input discipline operates from idea
          // text + Stage 1 evidence only.
          const stage2aUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}`;

          const stageTcUserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}`;

          // Run Stage 2a and Stage TC in parallel
          const [stage2aResponse, stageTcResponse] = await Promise.all([
            callWithRetry({
              model: "claude-sonnet-4-6",
              max_tokens: 6000,
              temperature: 0,
              // V4S29 Bundle 2 — F1 partial cure (May 8, 2026): sampler hardening
              // on Stage 2a / 2b / TC to suppress Layer A sampler-driven near-tie
              // collapse. Mechanism + rationale identical to Stage 1's V4S28 P0.5
              // block above; applies symmetrically to all scoring/extraction calls.
              //
              // Investigation: counterfactual prompt-test sequence on 8-case bank
              // (Phase A/B → Phase 2C sampler → Phase 2A MO-tighten → Phase 2B
              // MD-loosen → Test 3 combined → Test 4 MAT2 → Test 5 dominant-signal).
              // Sampler hardening cleanly cures sampler-driven cases:
              // ARC-D2 σ(MO) 0.63→0, M3 σ(MO) 0.21→0. Two prompt-level interventions
              // tested and rejected: asymmetric MO band tightening introduced
              // cross-metric coupling (L2 MD downshift); symmetric dominant-signal
              // instruction regressed previously-cured ARC-D2 (σ 0→0.73).
              // Residuals (L2 frame-selection, MAT2-beginner cross-metric swap)
              // are interpretive-frame phenomena resistant to sampler/prompt fixes
              // at Stage 2b — scoped for future Stage 2a packeting bundle.
              // See B10a-findings.md F1 closure + Methodology Principle 7
              // (counterfactual prompt tests precede architectural change).
              //
              // Stage 2c and Stage 3 deliberately NOT hardened: they are narrative
              // synthesis stages (summary, failure_risks), not
              // scoring stages, and their stability concerns are tracked as
              // separate B10a findings outside F1 scope.
              top_k: 1,
              system: STAGE2A_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stage2aUserMessage }],
            }, "Evidence extraction"),
            callWithRetry({
              model: "claude-sonnet-4-6",
              max_tokens: 3000,
              temperature: 0,
              // V4S29 Bundle 2 — F1 sampler hardening (see Stage 2a comment above
              // for full rationale). Stage TC scores TC in isolation; same Layer A
              // suppression logic applies.
              top_k: 1,
              system: STAGE_TC_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageTcUserMessage }],
            }, "Technical complexity scoring"),
          ]);

          const stage2aText = stage2aResponse.content[0].text;
          const stageTcText = stageTcResponse.content[0].text;

          let stage2aResult;
          try {
            stage2aResult = JSON.parse(cleanJsonResponse(stage2aText));
          } catch (parseError) {
            console.error("Stage 2a parse failed:", stage2aText);
            sendEvent({ step: "error", message: "Stage 2a failed to parse. Please try again." });
            controller.close();
            return;
          }

          let stageTcResult;
          try {
            stageTcResult = JSON.parse(cleanJsonResponse(stageTcText));
          } catch (parseError) {
            console.error("Stage TC parse failed:", stageTcText);
            sendEvent({ step: "error", message: "Stage TC failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage2a_done",
            message: `Stage 2a complete: Evidence packets extracted | TC: ${stageTcResult.technical_complexity?.score || "?"}`,
          });

          // ============================
          // STAGE MD / MO / OR: THREE SEPARATE METRIC SCORERS (V5.0)
          // Replaces the former two-call Stage 2b (adjudicate + score) and the
          // prosecutor/repair QC layer. Each scorer is an isolated evaluator that
          // reads ONLY its own packet from Stage 2a — clean per-metric quarantine,
          // stricter than the old monolith which dumped the whole stage2aResult
          // into one call.
          //
          // Each scorer receives: idea + its own evidence packet (which already
          // embeds that metric's binding/component emission) + domain_flags +
          // sparse_input_triggered (context the scorers reference). No raw Stage 1,
          // no TC, no profile (MD/MO/OR are profile-blind per V4S9 quarantine).
          //
          // Each scorer emits its metric object under its own top-level key
          // (market_demand / monetization / originality) with: score (decimal from
          // lookup), prose fields (diagnosis + binding-explanation + direction;
          // OR has four prose fields), and a nested _internal audit block. The
          // score is computed mechanically from predicate commitments + the
          // archetype/sub-position lookup — no free-chosen score, no rationalization
          // surface (the disease the old two-call separation was built to fight,
          // now structurally prevented by score-then-prose ordering inside each
          // scorer).
          // ============================

          sendEvent({ step: "stage2b_start", message: "Scoring Market Demand, Monetization, and Originality..." });

          const sharedPacketContext = {
            domain_flags: stage2aResult.domain_flags,
            sparse_input_triggered: stage2aResult.sparse_input_triggered,
          };

          const stageMdUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 2a MARKET DEMAND EVIDENCE PACKET ===
${JSON.stringify({
            ...sharedPacketContext,
            evidence_packet: stage2aResult.evidence_packets?.market_demand,
          })}`;

          const stageMoUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 2a MONETIZATION EVIDENCE PACKET ===
${JSON.stringify({
            ...sharedPacketContext,
            evidence_packet: stage2aResult.evidence_packets?.monetization,
          })}`;

          const stageOrUserMessage = `USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 2a ORIGINALITY EVIDENCE PACKET ===
${JSON.stringify({
            ...sharedPacketContext,
            evidence_packet: stage2aResult.evidence_packets?.originality,
          })}`;

          // Same sampler config as all scoring calls (temp 0 / top_k 1 / top_p 0.1)
          // for determinism. max_tokens 4096 — each scorer emits prose + a full
          // nested _internal predicate-commitment block.
          const scorerCallConfig = {
            model: "claude-sonnet-4-6",
            max_tokens: 8000,
            temperature: 0,
            top_k: 1,
          };

          const [stageMdResponse, stageMoResponse, stageOrResponse] = await Promise.all([
            callWithRetry({
              ...scorerCallConfig,
              system: STAGE_MD_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageMdUserMessage }],
            }, "Market Demand scoring"),
            callWithRetry({
              ...scorerCallConfig,
              system: STAGE_MO_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageMoUserMessage }],
            }, "Monetization scoring"),
            callWithRetry({
              ...scorerCallConfig,
              system: STAGE_OR_SYSTEM_PROMPT,
              messages: [{ role: "user", content: stageOrUserMessage }],
            }, "Originality scoring"),
          ]);

          let stageMdResult, stageMoResult, stageOrResult;
          try {
            stageMdResult = JSON.parse(cleanJsonResponse(stageMdResponse.content[0].text));
          } catch (parseError) {
            console.error("Stage MD parse failed:", stageMdResponse.content[0].text);
            sendEvent({ step: "error", message: "Market Demand scoring failed to parse. Please try again." });
            controller.close();
            return;
          }
          try {
            stageMoResult = JSON.parse(cleanJsonResponse(stageMoResponse.content[0].text));
          } catch (parseError) {
            console.error("Stage MO parse failed:", stageMoResponse.content[0].text);
            sendEvent({ step: "error", message: "Monetization scoring failed to parse. Please try again." });
            controller.close();
            return;
          }
          try {
            stageOrResult = JSON.parse(cleanJsonResponse(stageOrResponse.content[0].text));
          } catch (parseError) {
            console.error("Stage OR parse failed:", stageOrResponse.content[0].text);
            sendEvent({ step: "error", message: "Originality scoring failed to parse. Please try again." });
            controller.close();
            return;
          }

          // ---- Synthesize a single .explanation per metric for the frontend ----
          // The frontend renders one explanation block per metric
          // (renderProseSection reads ev.{metric}.explanation). The V5.0 scorers
          // emit multiple prose fields instead of a single explanation. Concatenate
          // each metric's prose fields (in narrative order: situation → binding
          // limit → direction) into .explanation so none of the scorer's reasoning
          // is lost in the current single-block UI. The raw prose fields are
          // retained on the metric object too, so a future multi-field UI (esp.
          // OR's four-question layout) can render them without a pipeline change.
          const joinProse = (...parts) => parts.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(" ");

          const md = stageMdResult.market_demand || {};
          const mo = stageMoResult.monetization || {};
          const or = stageOrResult.originality || {};

          // ---- Score-shape guard ----
          // Each scorer's JSON parsed successfully, but a malformed shape (metric
          // not nested under its key, or score emitted as a non-number) would
          // surface downstream as ev.{metric}.score === undefined and crash the
          // frontend at score.toFixed(1). Fail cleanly here with a clear SSE
          // error (mirrors the parse-failure handling above) so a bad scorer
          // output produces a retry-able message, never a white-screen render
          // crash. calculateOverallScore + Stage 2c low-band logic also depend on
          // numeric scores.
          const scoreGuard = [
            ["market_demand", md],
            ["monetization", mo],
            ["originality", or],
          ];
          for (const [metricKey, metricObj] of scoreGuard) {
            if (typeof metricObj.score !== "number" || Number.isNaN(metricObj.score)) {
              console.error(
                `${metricKey} scorer returned a non-numeric score:`,
                JSON.stringify(metricObj).slice(0, 500)
              );
              sendEvent({
                step: "error",
                message: `${metricKey} scoring returned an invalid score. Please try again.`,
              });
              controller.close();
              return;
            }
          }

          md.explanation = joinProse(md.diagnosis, md.binding_friction_explanation, md.direction);
          mo.explanation = joinProse(mo.diagnosis, mo.binding_payment_constraint_explanation, mo.direction);
          or.explanation = joinProse(
            or.differentiation_basis_diagnosis,
            or.defensibility_diagnosis,
            or.binding_constraint_explanation,
            or.direction
          );

          // ---- Assemble the evaluation object ----
          // evidence_strength now comes from Stage 2a (V5.0 Option A) — the old
          // producer (Stage 2b-Adj) is removed. marketplace_note has no producer
          // in the new pipeline; emit null (frontend renders it conditionally, so
          // null simply does not render).
          const ev = {
            evidence_strength: stage2aResult.evidence_strength,
            market_demand: md,
            monetization: mo,
            originality: or,
            marketplace_note: null,
          };

          sendEvent({
            step: "stage2b_done",
            message: "Scores calculated: Market Demand, Monetization, Originality",
          });

          // ============================
          // MERGE TC INTO EVALUATION
          // The three scorers produced MD/MO/OR (assembled into ev above).
          // Stage TC scored TC in isolation. Attach it.
          // ============================

          ev.technical_complexity = stageTcResult.technical_complexity;

          // ============================
          // V4S28 B8 — THIN_DIMENSIONS DOWNSTREAM FILTER
          // Extract thin_dimensions (UI-only metadata, generated when LOW)
          // and strip it from ev.evidence_strength BEFORE Stage 2c and
          // Stage 3 see it. They receive only { level, reason }.
          //
          // Stage 2c and Stage 3 already have locked LOW-handling behavior
          // (sparse summary + Specification cascade) driven by .level alone.
          // thin_dimensions is purely a frontend-rendering signal for the
          // partnered EARLY READ callout — must not influence downstream
          // synthesis.
          //
          // Restored to ev.evidence_strength at final assembly time below
          // so the frontend payload includes the array.
          // ============================

          let preservedThinDimensions = null;
          if (
            ev.evidence_strength &&
            ev.evidence_strength.level === "LOW" &&
            Array.isArray(ev.evidence_strength.thin_dimensions)
          ) {
            const validEnum = ["target_user", "use_case", "mechanism"];
            preservedThinDimensions = ev.evidence_strength.thin_dimensions.filter(
              (d) => typeof d === "string" && validEnum.includes(d)
            );
            // Defensive: if model returned the field on HIGH/MEDIUM, also strip
            delete ev.evidence_strength.thin_dimensions;
          } else if (
            ev.evidence_strength &&
            ev.evidence_strength.thin_dimensions !== undefined
          ) {
            // Model returned thin_dimensions on a non-LOW level — strip silently
            delete ev.evidence_strength.thin_dimensions;
          }

          // ============================
          // V5.0 — _INTERNAL DOWNSTREAM FILTER (mirrors thin_dimensions B8 pattern)
          //
          // Each V5.0 scorer emits a large nested _internal audit block
          // (predicate commitments, archetype, sub-position arithmetic, binding
          // constraint). Stage 2c and Stage 3 read ONLY .score from each metric
          // (plus evidence_strength + packets) — they never consume _internal.
          // Strip _internal per metric BEFORE Stage 2c/3 to keep their input
          // context lean and prevent any accidental leakage of scorer-internal
          // enum vocabulary into the synthesis/diagnosis stages.
          //
          // Restored to each metric at final assembly time below so the payload
          // retains _internal for logging, debugging, and the verification runner
          // (the frontend ignores it; grep-confirmed zero reads).
          // ============================

          const preservedInternal = {
            market_demand: null,
            monetization: null,
            originality: null,
          };
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            if (ev[metricKey] && ev[metricKey]._internal !== undefined) {
              preservedInternal[metricKey] = ev[metricKey]._internal;
              delete ev[metricKey]._internal;
            }
          }

          // ============================
          // STAGE 2c: SYNTHESIS
          // Generate summary + failure_risks from idea + profile + Stage 1 +
          // Stage 2a packets + Stage 2b scores + evidence_strength.
          //
          // V4S28 S1+S2+S3 architectural change: summary + failure_risks moved
          // out of Stage 2b to prevent profile-aware Risk 3 contaminating the
          // profile-blind MD/MO/OR scoring (V4S7-S11 pattern). Stage 2c is
          // post-scoring interpretive — it does not change scores.
          // ============================

          sendEvent({ step: "stage2c_start", message: "Stage 2c: Synthesizing summary and failure risks..." });

          // Bundle 3 / F3: compute overall_score early so Stage 2c's HARD RULE
          // for low-band Summary openers can reference it. calculateOverallScore
          // is a pure deterministic function on the metric scores; the same
          // value is recomputed at assembly below (ev.overall_score = ...) —
          // no risk of drift, and the duplicate cost is sub-millisecond.
          // See prompt-stage2c.js HARD RULE — LOW-BAND OPENING SENTENCE block.
          const overallScoreForStage2c = calculateOverallScore(ev);

          const stage2cUserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2a EVIDENCE PACKETS ===
${JSON.stringify(stage2aResult)}

=== STAGE 2b SCORES + EVIDENCE STRENGTH ===
${JSON.stringify({
            market_demand: ev.market_demand,
            monetization: ev.monetization,
            originality: ev.originality,
            technical_complexity: ev.technical_complexity,
            evidence_strength: ev.evidence_strength,
            marketplace_note: ev.marketplace_note,
            overall_score: overallScoreForStage2c,
          })}`;

          const stage2cResponse = await callWithRetry({
            model: "claude-sonnet-4-6",
            max_tokens: 6000,
            temperature: 0,
            system: STAGE2C_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage2cUserMessage }],
          }, "Summary & risk synthesis");

          const stage2cText = stage2cResponse.content[0].text;

          // F4/A — track degrade in a LOCAL, not on ev, so the presentational
          // flag does not ride into Stage 3's input. ev.synthesis_degraded is
          // set at final assembly below (alongside overall_score / display_score
          // / _internal restore), keeping Stage 3's input byte-identical to the
          // pre-F4 pipeline. summary + failure_risks DO stay on ev here — Stage 3
          // genuinely reads failure_risks; only the flag is presentational.
          let synthesisDegraded = false;
          // Verdict labor-split (A11/A12): headline + detail are held in LOCALS like
          // the degrade flag — written to ev only at final assembly, never before
          // Stage 3, so the two NEW fields stay out of Stage 3's input. summary (the
          // lead) still stays on ev as before; its CONTENT is shorter now, but Stage 3
          // is steered away from narrative summary fields, so this is non-load-bearing.
          let verdictHeadline = "";
          let verdictDetail = null;
          // Competitive position (A13) — the tri-split for "How your idea compares".
          // Same labor pattern: held in a LOCAL, written to ev at assembly, never before
          // Stage 3. Null on thin / no-rival / degraded cases (view falls back to
          // competition.differentiation).
          let competitivePosition = null;

          // Graceful degradation per S3 lock: if Stage 2c parse fails, set
          // summary + failure_risks empty and proceed to Stage 3 with empty
          // failure_risks input. Evaluation still produces scores.
          try {
            // Harness: force the degrade branch without a real malformed response.
            if (TEST_DEGRADE_2C) {
              throw new Error("[TEST] forced Stage 2c degrade");
            }
            const stage2cResult = JSON.parse(cleanJsonResponse(stage2cText));
            ev.summary = stage2cResult.summary || "";
            ev.failure_risks = Array.isArray(stage2cResult.failure_risks)
              ? stage2cResult.failure_risks
              : [];
            // Verdict labor-split (A11/A12) — captured to locals, applied at assembly.
            verdictHeadline = typeof stage2cResult.verdict_headline === "string" ? stage2cResult.verdict_headline.trim() : "";
            verdictDetail = (typeof stage2cResult.verdict_detail === "string" && stage2cResult.verdict_detail.trim()) ? stage2cResult.verdict_detail.trim() : null;
            // Competitive position (A13) — captured to a local, applied at assembly.
            // Defensive: keep only if it's an object; trim each cell to a string.
            {
              const cp = stage2cResult.competitive_position;
              competitivePosition = (cp && typeof cp === "object" && !Array.isArray(cp))
                ? {
                    headline: typeof cp.headline === "string" ? cp.headline.trim() : "",
                    overlap: typeof cp.overlap === "string" ? cp.overlap.trim() : "",
                    you_win: typeof cp.you_win === "string" ? cp.you_win.trim() : "",
                    exposed: typeof cp.exposed === "string" ? cp.exposed.trim() : "",
                  }
                : null;
            }
            // F4/A — full synthesis present.
            synthesisDegraded = false;
            sendEvent({
              step: "stage2c_done",
              message: "Stage 2c complete: Summary and failure risks generated",
            });
          } catch (parseError) {
            console.error("Stage 2c parse failed (graceful degradation engaged):", stage2cText);
            ev.summary = "";
            ev.failure_risks = [];
            // F4/A — RELIABILITY INVARIANT: a required narrative section did not
            // generate. Mark it (via the local, applied to ev at assembly) so the
            // section cannot SILENTLY disappear. Before this flag, a degraded run
            // looked identical to a complete one (empty Summary box, vanished Key
            // Risks, no signal) and even saved as if whole. The frontend reads the
            // flag to render an honest "couldn't generate this — your scores are
            // complete" note instead. Scores are intact; only synthesis is absent.
            synthesisDegraded = true;
            sendEvent({
              step: "stage2c_done",
              message: "Stage 2c synthesis incomplete; proceeding with scores only",
            });
          }

          // ============================
          // VERDICT LEAD COMPRESSOR (Option B)
          // ============================
          // Stage 2c's `summary` is the FULL, rich verdict — it becomes the modal
          // ("Read the full verdict"). This isolated pass distills it into the short
          // 3-beat lead the card shows. A separate call has CLEAN context, so the
          // word cap binds where in-Block-A prompt rules structurally could not
          // (summary is the gravitational centre of 2c; richness wins there by design).
          // Non-fatal: a present lead is bounded by boundVerdictLead (clamped, never
          // shown raw). On hard failure verdictLead stays null; the card currently
          // falls back to the full summary at the VIEW — that fallback should degrade
          // to headline + score instead (see DeepResultParts / EvaluationView), so a
          // failed compression never drops the modal-length wall into the card slot.
          // verdict_lead is NOT a Stage 3 input — withheld like the other verdict
          // fields and applied to ev at assembly.
          let verdictLead = null;
          if (!synthesisDegraded && typeof ev.summary === "string" && ev.summary.trim()) {
            try {
              const leadResponse = await callWithRetry({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 400,
                temperature: 0,
                system: VERDICT_LEAD_SYSTEM_PROMPT,
                messages: [{ role: "user", content: `HEADLINE: ${verdictHeadline || "(none)"}\n\nVERDICT:\n${ev.summary}` }],
              }, "Verdict lead compression");
              const leadParsed = JSON.parse(cleanJsonResponse(leadResponse.content[0].text));
              // Bound the lead deterministically: a present-but-overlong lead is clamped
              // (never shown raw, never dropped to the full-summary fallback). See guard above.
              verdictLead = boundVerdictLead(leadParsed.verdict_lead);
            } catch (leadError) {
              console.error("Verdict lead compression failed (card falls back to full summary):", leadError);
              verdictLead = null;
            }
          }

          // ============================
          // STAGE 3: ACT
          // ============================

          sendEvent({ step: "stage3_start", message: "Stage 3: Building..." });

          // Stage 3 reads the evaluation object (now mutated to include TC,
          // summary, and failure_risks from Stage 2c). The Stage 3 prompt expects
          // failure_risks under evaluation.failure_risks — satisfied by the
          // in-place mutation of ev above. _internal is stripped at this point
          // (restored at assembly), so Stage 3 sees clean metric objects.
          const stage3UserMessage = `${userProfile}

USER'S AI PRODUCT IDEA:
${idea}

=== STAGE 1 RESULTS: COMPETITION ANALYSIS ===
${JSON.stringify(stage1Result)}

=== STAGE 2 RESULTS: SCORING ===
${JSON.stringify({ evaluation: ev })}`;

          const stage3Response = await callWithRetry({
            model: "claude-sonnet-4-6",
            // V4S28 B8 hotfix (May 1, 2026): bumped from 4096 → 8192. Stage 3
            // generates estimates. Elaborate inputs (~5000 char idea text) consistently
            // produced 5500-6500 tokens of output, hitting the old ceiling and
            // causing mid-string JSON truncation in estimates.explanation.
            max_tokens: 8192,
            temperature: 0,
            system: STAGE3_SYSTEM_PROMPT,
            messages: [{ role: "user", content: stage3UserMessage }],
          }, "Action plan");

          const stage3Text = stage3Response.content[0].text;

          let stage3Result;
          try {
            stage3Result = JSON.parse(cleanJsonResponse(stage3Text));
          } catch (parseError) {
            console.error("Stage 3 parse failed:", stage3Text);
            sendEvent({ step: "error", message: "Stage 3 failed to parse. Please try again." });
            controller.close();
            return;
          }

          sendEvent({
            step: "stage3_done",
            message: "Stage 3 complete",
          });

          // ---- Synthesize estimates.explanation from the four Execution-Reality
          // prose fields (mirrors the per-metric joinProse above). Stage 3 emits the
          // labelled fields (constraint_diagnosis / commitment_explanation /
          // profile_calibration / position_basis); we join them into a single
          // .explanation so the gated teaser, older saved analyses, and any non-split
          // UI still read naturally. The raw fields are retained on the estimates
          // object so MetricProseDetail can render the four-question split. Sparse
          // (Specification) cases emit fewer fields and/or .explanation directly —
          // the join is applied only when it produces non-empty prose, so the
          // model's own sparse explanation is preserved.
          if (stage3Result && stage3Result.estimates) {
            const est = stage3Result.estimates;
            const joinedExec = [
              est.constraint_diagnosis,
              est.commitment_explanation,
              est.profile_calibration,
              est.position_basis,
            ].filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(" ");
            if (joinedExec) est.explanation = joinedExec;

            // ---- HINGE CONTRACT (shared module — never repair) ----
            // Validate against the committed directions + evidence level +
            // the bottleneck Stage 3 itself just selected. Any violation
            // drops the WHOLE field: the UI renders the committed-nothing
            // degrade. deepPayload runs the same validator on saved
            // payloads, so server and client cannot drift.
            if (est.hinge !== undefined) {
              // One context object feeds BOTH the validator and the violation
              // reporter — they wrap the same internal logic path (hinge.js
              // firstViolation), so the logged reason can never disagree with
              // the rejection. The full payload is logged unsliced: the field
              // is deleted on the next line, so this log line is the only
              // record the emission ever existed. (The 400-char slice this
              // replaces destroyed the evidence for the 2026-07-20 10:03 drop.)
              const hingeCtx = {
                metricDirections: {
                  market_demand: ev.market_demand && ev.market_demand.direction,
                  monetization: ev.monetization && ev.monetization.direction,
                  originality: ev.originality && ev.originality.direction,
                },
                evidenceLevel: ev.evidence_strength && ev.evidence_strength.level,
                mainBottleneck: est.main_bottleneck,
              };
              const validated = validateHinge(est.hinge, hingeCtx);
              if (!validated) {
                console.warn(
                  "[hinge] dropped —",
                  hingeViolation(est.hinge, hingeCtx),
                  "| payload:",
                  JSON.stringify(est.hinge)
                );
                delete est.hinge;
              }
            }
          }

          // ============================
          // ASSEMBLY: Combine all stages into unified output
          // Must match the same JSON schema as free tier
          // ============================

          sendEvent({ step: "scoring", message: "Calculating final scores..." });

          ev.overall_score = calculateOverallScore(ev);

          // F4/A — apply the degrade flag HERE (assembly), not in the Stage 2c
          // branches, so it never entered Stage 3's input. Pure presentational
          // metadata for the frontend's honest "synthesis didn't complete" note.
          ev.synthesis_degraded = synthesisDegraded;

          // Verdict labor-split (A11/A12) — apply HERE (assembly), like the degrade
          // flag, so the two new fields never entered Stage 3's input. On degrade both
          // stay "" / null. Frontend reads verdict_headline for the card lead-in and
          // renders "Read the full verdict" only when verdict_detail is present.
          ev.verdict_headline = verdictHeadline;
          ev.verdict_detail = verdictDetail;
          // Verdict lead (Option B) — the short 3-beat card lead, compressed from the
          // full summary in an isolated pass. Card shows this; modal shows ev.summary.
          // Null when compression failed or degraded → card falls back to ev.summary.
          ev.verdict_lead = verdictLead;

          // Competitive position (A13) — apply at assembly, withheld from Stage 3 like
          // the verdict fields. Frontend reads ev.competitive_position for the "How your
          // idea compares" tri-split, falling back to competition.differentiation.
          ev.competitive_position = competitivePosition;

          // V4S28 B8 — restore thin_dimensions for frontend rendering
          // (was stripped before Stage 2c/3 to prevent downstream contamination;
          // now safe to attach back since all Sonnet calls are complete).
          if (preservedThinDimensions !== null) {
            ev.evidence_strength.thin_dimensions = preservedThinDimensions;
          }

          // V5.0 — restore _internal per metric for the payload (stripped before
          // Stage 2c/3 to keep their context lean; now safe to reattach since all
          // Sonnet calls are complete). Frontend ignores it; retained for logging,
          // debugging, and the verification runner.
          for (const metricKey of ["market_demand", "monetization", "originality"]) {
            if (preservedInternal[metricKey] && ev[metricKey]) {
              ev[metricKey]._internal = preservedInternal[metricKey];
            }
          }

          // V5.10 — MO FINE DISPLAY SCORE (code-side, frontend-only)
          // Computed HERE, at final assembly: AFTER overall_score, AFTER Stage 2c,
          // AFTER Stage 3, AFTER the _internal restore above. It is therefore a
          // pure final decoration — it cannot reach calculateOverallScore, Stage
          // 2c's overall_score band gates, or Stage 3's "low MD or MO < 5.0"
          // modifier, all of which read mo.score (left untouched). The model
          // commits MO judgment (archetype + SP levels) and prose; code computes
          // the finer monetization number from those committed predicates. Falls
          // back to mo.score on override / arithmetic-inconsistency / missing
          // _internal (see computeMoDisplayScore). Frontend renders
          // display_score ?? score. MD and OR are intentionally NOT fine-scored
          // (MD is multi-axis; OR is an honest-equivalence floor).
          if (ev.monetization) {
            ev.monetization.display_score = computeMoDisplayScore(ev.monetization);
          }

          // V5.9 (12b) — EXPLICIT MO OVERRIDE TRACE (code-side, into _internal)
          // When a bucket-changing override fired (PRIORITY_PULL / GLOBAL_SP_CAP),
          // record it explicitly in _internal.override_applied so the override is
          // TRACEABLE rather than a silent score move the validator reads as
          // off-lookup, and so the explain-difference feature can surface WHY the
          // bucket moved. Computed from committed SP values only — it does NOT read
          // or rewrite the model's declared sub_position (no silent relabeling);
          // downstream reads effective_bucket = override_applied?.final_bucket ??
          // sub_position. null when no override fired or _internal is absent. Same
          // override logic as the display score (shared computeMoOverrideTrace), so
          // the two can never disagree.
          if (ev.monetization && ev.monetization._internal) {
            ev.monetization._internal.override_applied =
              computeMoOverrideTrace(ev.monetization);
          }

          // SANITY CHECK REMOVED (V5.0): the old heuristic flagged
          // score/explanation contradictions by keyword-matching the explanation
          // prose against the score band. The V5.0 scorers compute score
          // mechanically from predicate commitments and generate prose AFTER the
          // score is locked, so the score-vs-prose contradiction the heuristic
          // guarded against is structurally prevented. The keyword heuristic would
          // also misfire on the new synthesized .explanation (which concatenates
          // diagnosis + binding-limit + direction). Each scorer's own internal
          // self-check enforces score/prose coherence.

          // Raw retrieval set — persisted into evidence_json (server-only) as the
          // diff baseline a future evidence-watch replays the stored queries against.
          // These arrays are already gathered above for the competitor context; this
          // only captures their {source, url, name}. Deliberately NOT added to _meta
          // (that rides the hot idea-open payload and stays lean). Engine untouched:
          // nothing new is gathered or scored — existing results are merely persisted.
          const rawResults = {};
          for (const [k, arr] of Object.entries({
            github: githubResults, tavily: tavilyResults, exa: exaResults, serper: serperResults,
          })) {
            rawResults[k] = (arr || []).map((r) => ({ source: r.source, url: r.url, name: r.name || r.title || null }));
          }

          // Assemble final analysis in the same schema as free tier
          const analysis = {
            classification: stage1Result.classification,
            scope_warning: stage1Result.scope_warning,
            competition: stage1Result.competition,
            estimates: stage3Result.estimates,
            evaluation: ev,
            // Pro-tier exclusive fields
            _pro: {
              evaluation_mode: "paid_chained",
              evaluation_id: evaluationId,
              domain_risk_flags: stage1Result.domain_risk_flags,
              stage1_competitor_count: competitorCount,
              evidence_packets: stage2aResult.evidence_packets,
              // Derived signals from Stage 2a, exposed for the verification runner
              // and downstream visibility. The three metric scorers consume these
              // via their per-packet user messages; this _pro exposure is purely
              // for runner/debugging visibility.
              sparse_input_triggered: stage2aResult.sparse_input_triggered,
              domain_flags: stage2aResult.domain_flags,
              tc_isolated: true,
            },
            // Raw retrieval URL set — server-only, lands in evidence_json (the save
            // route maps this; meta_json stays lean). The diff baseline for the watch.
            raw_results: rawResults,
            _meta: {
              github_results: githubResults.length,
              tavily_results: tavilyResults.length,
              exa_results: exaResults.length,
              serper_results: serperResults.length,
              data_source: hasRealData ? "verified" : "llm_generated",
              keywords_used: keywords,
              queries: { githubQuery1, githubQuery2, serperQuery1, serperQuery2 },
              evaluation_mode: "paid_chained",
            },
          };

          sendEvent({ step: "complete", message: "Pro evaluation complete", data: analysis });
          // Anonymous runs record here (logged-in runs record client-side via
          // /api/eval-usage). Either way the row feeds the global budget guard.
          if (!user) {
            try { await recordRun(null, action, { ip: clientIp }); }
            catch (e) { console.error("anon recordRun failed (non-fatal):", e); }
          }
          controller.close();
        } catch (error) {
          console.error("SSE Pipeline Error:", error);
          sendEvent({ step: "error", message: "Analysis failed. Please try again." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Analysis failed. Please check your API key and try again." },
      { status: 500 }
    );
  }
}