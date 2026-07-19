// SourcesStrip.js — LL1 Part 2: the per-metric evidence bibliography.
//
// Evidence-presentation pass (2026-07-08, display-only): the collapsed header no
// longer calls everything a "source." The old "Based on N sources" summed all five
// trust classes, counting the founder's own input and the landscape prose as
// sources — the one genuine overclaim. It now reads "What this rests on" and shows
// the evidence SHAPE at a glance (verified receipts vs. your own claim, coloured by
// trust, strongest first) while the receipts stay collapsed (pulled, not pushed).
// resolveEvidenceSources is UNCHANGED — the shared spine primitive is byte-frozen;
// Explore inherits the honest header for free.
//
// Renders a collapsed-by-default evidence strip at the foot of a
// metric card, resolving the scorer's committed evidence trail
// (_internal.predicate_commitments.*.evidence_cited + the binding-constraint
// evidence_cited fields) into receipt rows with trust markers.
//
// DISPLAY-ONLY. Reads fields already restored on the payload at final assembly
// (route.js V5.0 _internal restore). Touches no score, no prompt, no stage
// output. Same doctrine as MetricProseDetail's header features: render what
// the engine already committed; never re-derive judgment.
//
// SHARED PRIMITIVE (spine doctrine): resolveEvidenceSources is exported as a
// pure, mode-agnostic function — it takes a reference to Stage 1's shared
// evidence (the competitors array) and a committed evidence trail, and returns
// receipt rows with trust classes. Deep uses it here for the metric-card
// bibliography; Explore reuses the SAME resolver for "why this angle is
// plausible." Do NOT weld Deep-only assumptions into it. The trust grammar
// (external/verified · AI-identified · domain signal · your input · landscape
// read) is a property of the EVIDENCE, not the mode — it must read identically
// in both modes.
//
// Trust classes (derived, never asserted):
//   external  — [competitor: Name] whose Stage 1 object has a retrieval source
//               (github/tavily/exa/google). Green. Links out when url exists.
//   ai        — [competitor: Name] with source "llm" or no Stage 1 match.
//               The competitor exists as a claim, not a retrieval receipt —
//               badged honestly with the same AI tone the competitor cards use.
//   domain    — [domain_flag: X] from Stage 1's domain_risk_flags. Blue.
//   input     — [idea_description] / [user_claim]: the founder's own words.
//   landscape — [narrative_field]: Stage 1's own landscape prose. Lowest
//               trust in the locked tag space; shown dimmest, never hidden.
//
// Parse contract (verified against the June-10 run, 1391 real evidence_cited
// strings):
//   - tags appear ANYWHERE in the fact string (65% suffix) — match all, strip
//     anywhere; competitor tags are replaced by their name so multi-tag chains
//     ("[competitor: A] + [competitor: B] sustain $99-300") stay readable
//   - one competitor tag may carry a comma-list of names — split on failed
//     exact match and emit one row per name
//   - ~46% of evidence_cited strings are tagless scorer reasoning ("No trust
//     friction signal evidenced in packet") — skipped; reasoning is not a source
//   - dedupe by source identity, longest fact body wins (one row per source,
//     not per predicate — predicates repeat sources)
//
// Graceful degradation: missing _internal (pre-V5 saves, the known MD
// emission bug), no evidence_cited, no tagged strings, or a malformed shape
// -> returns null -> the strip simply does not render. No empty shells,
// never crashes. Competitor objects without source/url (old saves) degrade
// to the "ai" class with no link.
//
// Colour discipline: trust tones only (green/blue/AI/neutral). The score-band
// colour never reaches this strip — trust is a property of evidence, not of
// the score.

import React, { useState, useMemo } from "react";

// Locked 5-tag space (Stage 2a SOURCE TAGGING). Matches tags anywhere in the
// string; [1]/[2] capture valued tags (competitor/domain_flag), [3] bare tags.
const TAG_RE = /\[(competitor|domain_flag):\s*([^\]]+)\]|\[(idea_description|narrative_field|user_claim)\]/g;

// Stage 1 retrieval sources = externally verified receipts. "llm" is not.
const RETRIEVED_SOURCES = new Set(["github", "tavily", "exa", "google"]);

const humaniseFlag = (s) =>
  typeof s === "string" && s.length
    ? s.replace(/^is_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : "";

// ── SCORER-MACHINERY SCRUB (2026-07 fix) ────────────────────────────────────
// evidence_cited is an AUDIT field: the scorers routinely append their own
// bookkeeping to an otherwise-valid evidence sentence. Verified against real
// payloads, the trailing machinery takes three forms:
//
//   "...named as the binding free substitute; friction_survival=named_unresolved
//    per predicate commitment"
//   "...default first stop; md_binding_friction_named=retention_or_habit from
//    Stage 2a; ILC's end-state goal is ..."
//   "...zero friction — the strongest_negative explicitly names this as the
//    binding adoption friction"
//
// None of that is evidence; it is the scorer talking to its own validator, and
// it was reaching the user because the row picker below kept the LONGEST body
// per source — and the longest candidate is reliably the one carrying the most
// bookkeeping. So: scrub the machinery clause-wise, and prefer the CLEANEST
// candidate over the longest one.
//
// Deliberately conservative: it drops whole clauses that contain internal field
// names, stage references or enum assignments, and leaves ordinary prose alone.
// A string that scrubs to nothing is kept as a last-resort candidate (with bare
// assignments removed) so a source never silently loses its only receipt.
const MACHINERY_TOKENS = /(strongest_positive|strongest_negative|admissible_facts|unresolved_uncertainty|anchor_status|predicate commitments?|per predicate|Stage\s?1\b|Stage\s?2[abc]?\b|sub_position(_sum)?|domain_flags?|sparse_input_triggered|evidence_strength|friction_survival|_named\b|_evidenced\b|\bFP-\d|\bRule\s\d|\bSP-[ABC]\b|per the packet|in packet|from packet)/i;

// snake_case = snake_case  — an enum assignment, never user-facing prose.
const ENUM_ASSIGN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\s*=\s*[a-z][a-z0-9_]*/i;

// ── ENUM LEAK FIX (2026-07-19, carried since V51) ──────────────────────────
// The token list + assignment rule missed three decoration shapes verified in
// production evidence strings, all of which reached users:
//
//   bare inline      "adjacent_paid_substitute behavior evidenced"
//   parenthetical    "...planned compliance posture (regulatory_certification)"
//   leading label    "regulatory_certification: StateRAMP authorization ..."
//
// No token-list expansion (a list is always incomplete) — one general rule:
// a multi-word snake_case token is scorer vocabulary, never prose. Matched
// AFTER tag substitution, so the only theoretical false positive is a
// snake_cased Stage-1 competitor name; none exists in production.
const BARE_SNAKE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;
const BARE_SNAKE_G = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi;

// Decorations are stripped BEFORE the clause verdict: a parenthetical goes
// only when it contains nothing but snake tokens and separators; a leading
// label only when the entire label is one snake token followed by a colon.
// Ordinary parenthetical prose ("(agencies conduct procurements
// continuously)") is untouched.
const PAREN_ENUMS = /\(\s*[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s*[,/+&]\s*[a-z][a-z0-9]*(?:_[a-z0-9]+)+)*\s*\)/gi;
const LEAD_LABEL = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+\s*:\s*/i;

const stripEnumDecorations = (c) => c.replace(PAREN_ENUMS, "").replace(LEAD_LABEL, "");

const isMachineryClause = (c) =>
  MACHINERY_TOKENS.test(c) || ENUM_ASSIGN.test(c) || BARE_SNAKE.test(c);

// Split on the seams the scorers actually use to append bookkeeping: semicolons
// and em/en-dash asides. Keep only the clauses that read as evidence.
export function scrubMachinery(body) {
  const clauses = body.split(/\s*;\s*|\s+[—–]\s+/).filter(Boolean);
  let touched = false;
  const kept = [];
  for (const c of clauses) {
    // Strip decorative enum mentions first — they ride inside otherwise-valid
    // evidence prose, and dropping the whole clause for a parenthetical would
    // throw away the receipt with the leak.
    const undecorated = stripEnumDecorations(c);
    if (undecorated !== c) touched = true;
    if (isMachineryClause(undecorated)) {
      touched = true; // the clause itself is bookkeeping — drop it
      continue;
    }
    kept.push(undecorated);
  }
  if (!touched) return { text: body, quality: 0 };                         // clean
  if (kept.length > 0) {
    return { text: tidySeams(kept.join(" — ")), quality: 1 };              // scrubbed
  }
  // Nothing survived: strip assignments AND bare enum tokens so the row is
  // still readable without leaking vocabulary.
  return {
    text: tidySeams(
      body.replace(new RegExp(ENUM_ASSIGN, "gi"), "").replace(BARE_SNAKE_G, "")
    ),
    quality: 2,
  };
}

function tidySeams(s) {
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim()
    .replace(/^[\s\-–—:;,.+]+/, "")
    .replace(/[\s\-–—:;,+]+$/, "");
}

// Strip tags from a fact string for display: competitor tags become the bare
// name (keeps "[competitor: Vanta] + [competitor: Drata] sustain $99-300"
// readable as "Vanta + Drata sustain $99-300"); all other tags vanish. Then
// tidy the whitespace/punctuation seams the removal leaves behind.
export function stripTags(s) {
  return s
    .replace(TAG_RE, (full, kind, val) => (kind === "competitor" ? val : ""))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .trim()
    .replace(/^[\s\-–—:;,.+]+/, "")
    .replace(/[\s\-–—:;,+]+$/, "");
}

// Recursively collect every evidence_cited string under an _internal block.
// Covers all three scorers' shapes without per-metric schema knowledge:
// MD/MO/OR predicate families, binding_friction / binding_payment_constraint /
// binding_constraint, OR's secondary_subtypes + exposure checks.
function collectEvidenceStrings(node, out) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectEvidenceStrings(item, out);
    return;
  }
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (key === "evidence_cited" && typeof v === "string" && v.trim()) {
      out.push(v);
    } else if (v && typeof v === "object") {
      collectEvidenceStrings(v, out);
    }
  }
}

// ── THE SHARED RESOLVER (mode-agnostic; Explore reuses this) ────────────────
// (internal, competitors) -> array of { cls, name, text, url } rows sorted by
// trust class, or null when nothing resolves.
export function resolveEvidenceSources(internal, competitors) {
  if (!internal || typeof internal !== "object") return null;

  const strings = [];
  collectEvidenceStrings(internal, strings);
  if (strings.length === 0) return null;

  const compIndex = new Map();
  (Array.isArray(competitors) ? competitors : []).forEach((c) => {
    if (c && typeof c.name === "string" && c.name.trim()) {
      compIndex.set(c.name.trim().toLowerCase(), c);
    }
  });

  const rows = new Map();
  // CLEANEST WINS, then longest. The old rule was longest-wins, which reliably
  // selected the candidate carrying the most scorer bookkeeping (see the
  // machinery scrub above). Quality: 0 = no machinery, 1 = scrubbed, 2 = only
  // machinery survived.
  const upsert = (key, row) => {
    const prev = rows.get(key);
    if (!prev) { rows.set(key, row); return; }
    const better =
      row.quality !== prev.quality
        ? row.quality < prev.quality
        : (row.text || "").length > (prev.text || "").length;
    if (better) rows.set(key, row);
  };

  for (const s of strings) {
    const matches = Array.from(s.matchAll(TAG_RE));
    if (matches.length === 0) continue; // tagless = scorer reasoning, not a source
    const scrubbed = scrubMachinery(stripTags(s));
    const body = scrubbed.text;
    const quality = scrubbed.quality;
    if (!body) continue; // nothing readable survived — this candidate is not a receipt

    for (const m of matches) {
      if (m[1] === "competitor") {
        const rawVal = m[2].trim();
        // One tag can carry a comma-list of names; split only when the exact
        // value fails to match a Stage 1 competitor (names themselves may
        // legitimately contain commas in theory — exact match wins first).
        let names = [rawVal];
        if (!compIndex.has(rawVal.toLowerCase()) && rawVal.includes(",")) {
          names = rawVal.split(",").map((n) => n.trim()).filter(Boolean);
        }
        for (const name of names) {
          const comp = compIndex.get(name.toLowerCase()) || null;
          const retrieved = comp && RETRIEVED_SOURCES.has(comp.source);
          upsert(`competitor:${name.toLowerCase()}`, {
            cls: retrieved ? "external" : "ai",
            name,
            text: body,
            quality,
            url: (comp && comp.url) || null,
          });
        }
      } else if (m[1] === "domain_flag") {
        const flag = m[2].trim();
        upsert(`domain:${flag.toLowerCase()}`, {
          cls: "domain",
          name: humaniseFlag(flag),
          text: body,
          quality,
          url: null,
        });
      } else if (m[3] === "narrative_field") {
        upsert("landscape", { cls: "landscape", name: null, text: body, quality, url: null });
      } else {
        // idea_description + user_claim: the founder is one source.
        upsert("input", { cls: "input", name: null, text: body, quality, url: null });
      }
    }
  }

  if (rows.size === 0) return null;

  const order = { external: 0, ai: 1, domain: 2, input: 3, landscape: 4 };
  return Array.from(rows.values()).sort((a, b) => order[a.cls] - order[b.cls]);
}

// ── presentation ────────────────────────────────────────────────────────────

const ROW_FALLBACK_TEXT = {
  input: "Stated in your idea description.",
  landscape: "From the landscape analysis.",
};

export default function SourcesStrip({ internal, competitors, t, compact = false }) {
  const [open, setOpen] = useState(false); // collapsed by default — pulled, not pushed
  const rows = useMemo(
    () => resolveEvidenceSources(internal, competitors),
    [internal, competitors]
  );
  if (!rows) return null; // degrade: no trail, no strip

  const llmTone = (t.srcBadge && t.srcBadge.llm) || t.mut;
  const chips = {
    external: { color: "#34d399", bg: "rgba(16,185,129,0.10)", label: "verified competitor" },
    ai: { color: llmTone, bg: `${llmTone}1A`, label: "AI-identified" },
    domain: { color: "#60a5fa", bg: "rgba(59,130,246,0.10)", label: "domain signal" },
    input: { color: t.mut, bg: "rgba(150,150,160,0.10)", label: "your input" },
    landscape: { color: t.mut, bg: "transparent", label: "landscape read" },
  };

  const counts = {};
  rows.forEach((r) => {
    counts[r.cls] = (counts[r.cls] || 0) + 1;
  });

  // Ordered, present-only classes for the collapsed glance. Resolver order is
  // strongest-first (external → ai → domain → input → landscape), so the verified
  // receipts read first and your own claim reads last — the honest hierarchy,
  // visible before anything is expanded.
  const present = ["external", "ai", "domain", "input", "landscape"].filter((c) => counts[c]);

  // Honest summary for assistive tech: names each class for what it is and never
  // rolls "your input" / "landscape read" into a "sources" count.
  const glanceSummary = present.map((c) => `${counts[c]} ${chips[c].label}`).join(", ");

  const toggle = () => setOpen((o) => !o);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`What this read rests on: ${glanceSummary}. Activate to ${open ? "hide" : "show"} the receipts.`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          borderTop: `1px solid ${t.divider}`,
          marginTop: compact ? 14 : 22,
          paddingTop: compact ? 12 : 14,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Honest umbrella — the read rests on these; it does not call your own
            claim a "source." The old "Based on N sources" summed all five classes,
            counting the founder's input and the landscape prose as sources. */}
        <span style={{ fontSize: 11, color: t.mut, letterSpacing: "0.3px", flexShrink: 0 }}>
          What this rests on
        </span>

        {/* The evidence SHAPE, legible at a glance — verified receipts vs. your own
            claim, coloured by trust, strongest first. The receipts themselves stay
            collapsed below (pulled, not pushed): prominence, not a conclusion. */}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 }}>
          {present.map((c) => (
            <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: chips[c].color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{counts[c]}</span>
              <span style={{ color: t.mut }}>{chips[c].label}</span>
            </span>
          ))}
        </span>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={t.mut}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div style={{ marginTop: 4 }}>
          {rows.map((r, i) => {
            const chip = chips[r.cls];
            const text = r.text || ROW_FALLBACK_TEXT[r.cls] || r.name || "";
            const showNamePrefix =
              r.name &&
              text &&
              !text.toLowerCase().startsWith(r.name.toLowerCase());
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "9px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${t.divider}`,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: chip.bg,
                    color: chip.color,
                    border: r.cls === "landscape" ? `1px solid ${t.border}` : "none",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.02em",
                    marginTop: 1,
                  }}
                >
                  {chip.label}
                </span>
                <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: t.sec, minWidth: 0 }}>
                  {showNamePrefix && (
                    <>
                      <strong style={{ color: t.text, fontWeight: 600 }}>{r.name}</strong>
                      {" — "}
                    </>
                  )}
                  {text}
                </span>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      color: t.link,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      marginTop: 1,
                    }}
                  >
                    Visit →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}