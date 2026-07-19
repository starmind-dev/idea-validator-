"use client";

import { useState, useEffect, useRef } from "react";

import {
  Card,
  PageContainer,
  AuthModal,
} from "./components";
import DeepAnalysis from "./DeepAnalysis";
import { ChangeWalkthrough } from "./ChangeWalkthrough";
import { DirectionCard, DirectionRow } from "./DirectionCard";
import { BackLink } from "./BackLink";
import { FooterBar, FootLink } from "./FooterActions";

const WATCH_OPTS = [
  ["off", "Off"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["semiannual", "Every 6 months"],
];

// EVIDENCE WATCH dial — sets this idea's re-check cadence (PATCH /api/ideas/[id]/watch
// via onSet). On a material competitive move the watch writes a "Needs Your Move"
// signal to the Overview; acting on it runs the evidence-only re-judge. Amber ties it
// to the signal cards. Local optimistic state; the status line reflects the saved value.
function WatchDial({ t, value = "off", onSet }) {
  const [cad, setCad] = useState(value || "off");
  const [saving, setSaving] = useState(false);
  const AMBER = "#c99a3a";
  const on = cad !== "off";
  const change = async (e) => {
    const next = e.target.value;
    setCad(next);
    if (!onSet) return;
    setSaving(true);
    try { await onSet(next); } finally { setSaving(false); }
  };
  const label = (WATCH_OPTS.find((o) => o[0] === cad) || ["off", "Off"])[1];
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "12px 14px", marginBottom: 10, borderRadius: 12,
      border: `1px solid ${on ? "rgba(201,154,58,0.40)" : t.border}`,
      background: on ? "rgba(201,154,58,0.07)" : t.surface,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: on ? AMBER : t.mut }}>
          EVIDENCE WATCH
        </div>
        <div style={{ fontSize: 12, color: t.sec, marginTop: 2 }}>
          {saving
            ? "Saving…"
            : on
            ? `Re-checking the evidence landscape behind this read ${label.toLowerCase()} — you'll get a card if something material appears.`
            : "Off — turn on to periodically re-check the evidence landscape behind this read."}
        </div>
      </div>
      <select
        value={cad}
        onChange={change}
        disabled={saving}
        style={{
          flexShrink: 0, fontSize: 13, fontWeight: 600, padding: "8px 10px", borderRadius: 8,
          cursor: saving ? "wait" : "pointer",
          color: on ? AMBER : t.text,
          background: t.surfAlt,
          border: `1px solid ${on ? "rgba(201,154,58,0.40)" : t.border}`,
        }}
      >
        {WATCH_OPTS.map((o) => (
          <option key={o[0]} value={o[0]} style={{ color: "#111", background: "#fff" }}>{o[1]}</option>
        ))}
      </select>
    </div>
  );
}

// FromHerePanel — the "From here" section on a saved deep result, rendered as
// ONE unified segmented panel (B1): three lanes (Execution Brief · Evolve · Watch)
// share a single surface, each capped by its accent bar and split by a hairline.
// Replaces the old three-floating-cards row. All wiring is unchanged; the Watch
// lane still owns the cadence <select> (why this is a panel of segments, not
// DirectionCards — a <select> can't live inside DirectionCard's <button>).
function FromHerePanel({ t, briefAvailable, hasExecutionBrief, openExecutionBrief, evalsRemaining, startReEvaluation, watchCadence, onSetWatch }) {
  const [cad, setCad] = useState(watchCadence || "off");
  const [saving, setSaving] = useState(false);
  const changeWatch = async (e) => {
    const next = e.target.value;
    setCad(next);
    if (!onSetWatch) return;
    setSaving(true);
    try { await onSetWatch(next); } finally { setSaving(false); }
  };
  const evolveDisabled = evalsRemaining <= 0;
  const VIO = "#a78bfa", BLUE = "#7aa2ff", AMBER = "#fbbf24";
  const cols = briefAvailable ? 3 : 2;

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "15px 20px 14px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: VIO, flexShrink: 0 }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>From here</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {briefAvailable && (
          <FhSeg t={t} accent={VIO} first title="Execution Brief"
            desc="Turn this read into a first-move handoff — where our read stops and yours begins."
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M11.5 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v3" /><path d="M14 18h7M18 15l3 3-3 3" /></svg>}
            action={<FhLink accent={VIO} label={hasExecutionBrief ? "View brief" : "Generate"} onClick={() => openExecutionBrief && openExecutionBrief()} />} />
        )}
        <FhSeg t={t} accent={BLUE} first={!briefAvailable} title="Evolve"
          desc="Reshape the idea, keep the lineage, measure the delta."
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>}
          action={<FhLink accent={BLUE} label={evolveDisabled ? "No evals left" : "Evolve"} onClick={startReEvaluation} disabled={evolveDisabled} />} />
        <FhSeg t={t} accent={AMBER} title="Watch"
          desc="Periodically re-check the evidence landscape behind this read."
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}
          action={
            <select value={cad} onChange={changeWatch} disabled={saving}
              style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: saving ? "wait" : "pointer", color: AMBER, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.34)" }}>
              {WATCH_OPTS.map((o) => (<option key={o[0]} value={o[0]} style={{ color: "#111", background: "#fff" }}>{o[1]}</option>))}
            </select>
          } />
      </div>
    </div>
  );
}

// one lane of the From-here panel: accent bar on top, icon + title, desc, action.
function FhSeg({ t, accent, first, icon, title, desc, action }) {
  return (
    <div style={{ position: "relative", padding: "18px 17px", display: "flex", flexDirection: "column", gap: 10, minHeight: 158, borderLeft: first ? "none" : `1px solid ${t.border}` }}>
      <div style={{ position: "absolute", top: 0, left: 17, right: 17, height: 2, borderRadius: 2, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={{ width: 34, height: 34, flex: "0 0 34px", borderRadius: 9, display: "grid", placeItems: "center", color: accent, background: `${accent}1f`, border: `1px solid ${accent}40` }}>{icon}</span>
        <h4 style={{ fontSize: 15.5, fontWeight: 600, margin: 0, color: t.text }}>{title}</h4>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: t.sec, margin: "0 0 auto" }}>{desc}</p>
      {action}
    </div>
  );
}

function FhLink({ accent, label, onClick, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: disabled ? "#6b7280" : accent, background: "none", border: "none", padding: 0, cursor: disabled ? "default" : "pointer" }}>
      {label}
      {!disabled && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
    </button>
  );
}

export default function EvaluationView({
  // Screen
  screen,
  // Deep page input (V7): the idea's profile_context_json, so the founder
  // adjustment state resolves honestly (absent vs. present-and-zero).
  // readHistory is already a prop further down — do not redeclare it.
  profileContext,
  // Theme
  t,
  // Core data
  analysis,
  walkthroughData,
  evidenceSignal,
  onSetAsCurrentRead,
  onKeepOldRead,
  readDecisionBusy,
  watchCadence,
  onSetWatch,
  profile,
  user,
  // Navigation context
  viewingFromSaved,
  isBranchIdea,
  // Popups
  showScoreGuide,
  showAuthModal,
  // Save state
  saveStatus,
  saveError,
  savedIdeasCount,
  ideaName,
  currentEvaluationId,
  currentIdeaId,
  myIdeas,
  // Branch state
  branchReason,
  branchDimensions,
  // Re-eval state
  isReEvalResult,
  evalsRemaining,
  // Execution Brief (Screen 3)
  openExecutionBrief,
  hasExecutionBrief,
  // Simple setters (for inline form interactions)
  setCurrentScreen,
  setShowAuthModal,
  setShowScoreGuide,
  setUser,
  setViewingFromSaved,
  setIdeaName,
  setSaveStatus,
  setSaveError,
  setBranchReason,
  setBranchDimensions,
  setBranchSetAsMain,
  saveStandalone,
  setSaveStandalone,
  setIsReEvalResult,
  // Functions
  goToMyIdeas,
  handleSaveIdea,
  startReEvaluation,
  getStepNumber,
  // Wrapped callbacks (multi-setter operations)
  onResetAndNewIdea,
  onBackToMyIdeasCleanup,
  onDiscardReEval,
  onStartStandalone,
  // Read history — previous reads of an idea whose TEXT never changed
  // (an evidence re-read replaced the live eval in place).
  readHistory = [],
  onOpenHistoricalRead,
  readOnly = false,
  outdatedMeta,
  onBackToCurrent,
  onOpenExploredVersion,
}) {

  // V4S23 entitlement system removed. Content gating retired — all content is full.
  // PreviewBanner teaser left dormant (isPreviewUser=false) pending M5/Paddle credit wiring.
  const isGated = false;
  const isPreviewUser = false;
  const [openWT, setOpenWT] = useState(null);

  // V7 merge — results2 is retired. Anything still routed there (a restored
  // sessionStorage nav, an old deep link, the brief's "Save this idea →"
  // before page.js is updated) lands on the merged Deep page instead of a
  // blank render. Hook-level because branches cannot own effects.
  useEffect(() => {
    if (screen === "results2" && typeof setCurrentScreen === "function") {
      setCurrentScreen("results1");
    }
  }, [screen, setCurrentScreen]);

  // V7 — the naming form used to be the top of its own screen (results2); it is
  // now at the foot of a very long page. The brief's "Save this idea →" sets
  // saveStatus="naming" and routes here, so without this the user clicks save
  // and lands on movement I with no visible sign anything happened.
  //
  // rAF is load-bearing, not decoration. page.js owns a scroll-to-top effect
  // keyed on currentScreen; it is the PARENT, so its effect runs AFTER this
  // child's and would win. Deferring one frame puts our scroll last.
  const saveBlockRef = useRef(null);
  useEffect(() => {
    if (saveStatus !== "naming" || screen !== "results1") return;
    const id = requestAnimationFrame(() => {
      if (saveBlockRef.current) {
        saveBlockRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [saveStatus, screen]);
  const [histOpen, setHistOpen] = useState(false);
  const fmtHistDate = (iso) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return ""; }
  };
  const wt = walkthroughData && walkthroughData.anchors;

  // Deep provenance (V6 lineage strip). Today cold-open is the only live path,
  // so most results show the gray "straight to Deep" state. reeval and branched
  // light up as those paths route through. The bet/limit prose for branched
  // stays sparse until the Explore→Deep handoff carries branch_reason here.
  const deepProvenance = isReEvalResult
    ? { state: "reeval" }
    : isBranchIdea
    ? { state: "branched", onExplore: viewingFromSaved ? goToMyIdeas : undefined }
    : { state: "cold" };

    // The Execution Brief is offered as a card inside the closure grids (saved
    // result + re-eval decision). Same gate the standalone button used to carry.
    const briefAvailable =
      !isGated &&
      analysis.estimates.main_bottleneck !== "Specification" &&
      !analysis.evaluation.synthesis_degraded;

  // ==========================================
  // SCREEN: ANALYSIS (results1)
  // ==========================================
  if (screen === "results1") {
    return (
      <>
        <ChangeWalkthrough anchor={openWT} onClose={() => setOpenWT(null)} />
        {/* Back link. Left-aligned and on the same 1300/40px gutter as the Deep
            page below it — inside PageContainer (960, centred) it floated to
            the middle of the viewport above a left-hugging read. */}
        <div style={{ maxWidth: 1300, margin: 0, padding: "4px 40px 0" }}>
          <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
            <BackLink t={t} onClick={() => {
              if (readOnly) { onBackToCurrent && onBackToCurrent(); return; }
              if (viewingFromSaved) {
                setViewingFromSaved(false);
                goToMyIdeas();
              } else {
                setCurrentScreen("input");
              }
            }}>
              {readOnly ? "Back to current read" : (viewingFromSaved ? "Back to My Ideas" : "Back to idea")}
            </BackLink>
          </div>
        </div>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}


        <main style={{ flex: 1, paddingBottom: 64 }}>

            {/* ============================================================
                V7 — PREAMBLE REMOVED (July 2026)
                ============================================================
                Everything that used to sit above the Deep masthead was removed
                so the page opens on the design's own eyebrow + headline, as in
                Deep_v5. Removed from here:

                  · PreviewBanner        — dead code (isPreviewUser === false)
                  · ProvenanceStrip      — DUPLICATE. The design eyebrow already
                                           says "taken straight to Deep — no
                                           Explore pass".
                  · classification pill  — DUPLICATE. The design eyebrow carries
                                           "DEEP · COMMERCIAL".
                  · outdatedMeta banner  — LIVE FEATURE, readOnly historical reads
                  · evidenceSignal       — LIVE FEATURE, evidence-watch re-judge
                  · scope_warning        — LIVE FEATURE
                  · "Previous reads"     — LIVE FEATURE, deep re-read navigation
                  · "explored version"   — LIVE FEATURE, Explore->Deep lineage

                The last five have no home yet. They are preserved verbatim in
                git history at the commit before this one; they were not
                rewritten, only lifted. Re-home them deliberately (a strip under
                the masthead, or the foot beside the save block) rather than
                pushing them back above the headline.
                ============================================================ */}

            {/* ============================================================
                V7 — THE DEEP ANALYSIS PAGE (July 2026)
                ============================================================
                The old surface was two screens of titled cards: PressureRead +
                three DeepMetricCards + DeepTcCard here, then Competition, Key
                Risks and Execution Reality on results2. Both are replaced by
                one continuous page of five movements — the read, why it lands
                there, the field, build reality, the hinge — rendered by
                DeepAnalysis from a normalized model (deepPayload.js).

                results2 no longer exists as a content screen; its save /
                naming / handoff tail moved down below this block, and the
                screen itself now redirects here (see the redirect effect).
                ============================================================ */}
          <DeepAnalysis
            analysis={analysis}
            readHistory={readHistory}
            profileContext={profileContext}
            t={t}
            wt={wt}
            onWt={setOpenWT}
            onScoreGuide={() => setShowScoreGuide(true)}
          />

          <PageContainer wide>


              {/* Score Guide Popup */}
              {showScoreGuide && (
                <div
                  onClick={() => setShowScoreGuide(false)}
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: t.modalBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: 16,
                      padding: 28,
                      maxWidth: 480,
                      width: "100%",
                      maxHeight: "80vh",
                      overflowY: "auto",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, margin: 0 }}>
                        Score Guide
                      </h3>
                      <button
                        onClick={() => setShowScoreGuide(false)}
                        style={{
                          background: t.surfAlt,
                          border: `1px solid ${t.border}`,
                          borderRadius: 8,
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: t.sec,
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: "0 0 20px 0" }}>
                      This evaluator is deliberately rigorous. A 7+ is rare and means a genuinely strong startup opportunity. Most real ideas land between 5–7, and that's normal.
                    </p>

                    {[
                      {
                        range: "9 – 10",
                        color: "#10b981",
                        title: "Category Creators",
                        desc: "Ideas that redefine behavior for hundreds of millions. Think Google, iPhone, WhatsApp, Uber. Almost no idea scores here at conception — these scores are essentially theoretical.",
                      },
                      {
                        range: "8 – 9",
                        color: "#10b981",
                        title: "Exceptional Opportunities",
                        desc: "Massive proven markets with strong structural moats. Think Shopify, Stripe, Zoom. Very few ideas score here — many that became 8–9 companies would have scored 6–7 at the idea stage.",
                      },
                      {
                        range: "7 – 8",
                        color: "#3b82f6",
                        title: "Strong Startup Ideas",
                        desc: "Clear demand, real differentiation, viable revenue path. This is what a genuinely good startup idea looks like. Most successful startups began in this range.",
                      },
                      {
                        range: "6 – 7",
                        color: "#3b82f6",
                        title: "Strong Opportunity",
                        desc: "Clear demand, viable revenue path, and real challenges to solve. A score here means the idea is worth serious validation. Many successful companies started in this range.",
                      },
                      {
                        range: "5 – 6",
                        color: "#3b82f6",
                        title: "Viable but Competitive",
                        desc: "Where most decent ideas land. Real pain exists, but there's friction — competitive pressure, unclear monetization, or weak differentiation. Not a rejection — it means solve these challenges and you have something.",
                      },
                      {
                        range: "3 – 5",
                        color: "#f59e0b",
                        title: "Fundamental Issues",
                        desc: "Missing buyer clarity, saturated market, or unproven core value proposition. Needs significant pivoting or rethinking before building.",
                      },
                      {
                        range: "1 – 3",
                        color: "#ef4444",
                        title: "Critical Flaws",
                        desc: "No real demand, no viable revenue path, or depends on unproven assumptions across every dimension.",
                      },
                    ].map((tier, i) => (
                      <div key={i} style={{
                        padding: "12px 14px",
                        marginBottom: 8,
                        borderRadius: 10,
                        background: t.surface,
                        border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color: tier.color,
                            minWidth: 44,
                          }}>
                            {tier.range}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                            {tier.title}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: t.sec, lineHeight: 1.5, margin: 0 }}>
                          {tier.desc}
                        </p>
                      </div>
                    ))}

                    <p style={{ fontSize: 11, color: t.mut, lineHeight: 1.5, margin: "16px 0 0 0", textAlign: "center" }}>
                      A score of 5–6 doesn't mean "bad idea" — it means "real challenges to solve."
                    </p>
                  </div>
                </div>
              )}

              {/* Marketplace Note */}
              {analysis.evaluation.marketplace_note && (
                <Card style={{ padding: 24, marginBottom: 16, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }} t={t}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: t.link, margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Marketplace Note
                  </p>
                  <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                    {analysis.evaluation.marketplace_note}
                  </p>
                </Card>
              )}

              {/* Verdict moved to the top (PressureRead). No trailing summary card. */}

              {/* Disclaimer */}
              <p style={{ fontSize: 12, color: t.mut, textAlign: "center", margin: "16px 0 24px 0", lineHeight: 1.5 }}>
                Scores evaluate the idea's potential. Actual outcomes also depend on execution quality, distribution, timing, and market conditions.
              </p>

            {/* Execution Brief CTA (Screen 3 / step-4 handoff).
                Shown only when the brief is actually available — mirrors the
                route's 422 guard (no Specification / no degraded synthesis) so
                the user can't click into an error — and only for full-content
                users (the brief is a paid surface, not part of the blurred
                free preview). Label keys on whether a brief is already attached;
                openExecutionBrief decides display-vs-generate. */}
            {briefAvailable && !viewingFromSaved && !isReEvalResult && (
                <button
                  onClick={() => openExecutionBrief && openExecutionBrief()}
                  style={{
                    width: "100%",
                    padding: "16px 0",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    background: t.ctaBg,
                    color: t.ctaText,
                    cursor: "pointer",
                    marginBottom: 16,
                  }}
                >
                  {viewingFromSaved && hasExecutionBrief
                    ? "View Execution Brief →"
                    : hasExecutionBrief
                      ? "Continue to Execution Brief →"
                      : "Generate Execution Brief →"}
                  <span style={{ display: "block", fontSize: 12, fontWeight: 400, opacity: 0.75, marginTop: 4 }}>
                    {hasExecutionBrief
                      ? "Your handoff: the first move and what would prove it"
                      : "Turn this diagnosis into a first-move handoff — where our read stops"}
                  </span>
                </button>
              )}

            {/* Save / Decision block — shown after user has seen everything.
                The wrapper exists purely as a scroll target (see saveBlockRef);
                it adds no layout of its own. */}
            <div ref={saveBlockRef}>
            {!viewingFromSaved && (
              isPreviewUser ? (
                /* FREE PREVIEW — nudge toward credits, not content unlock */
                <Card style={{ padding: 28, textAlign: "center" }} t={t}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 6px 0" }}>
                    Want to evaluate more ideas?
                  </p>
                  <p style={{ fontSize: 13, color: t.sec, margin: "0 0 20px 0", lineHeight: 1.5 }}>
                    {evalsRemaining > 0
                      ? `You have ${evalsRemaining} free evaluation${evalsRemaining !== 1 ? "s" : ""} remaining. Buy credits to keep evaluating after that.`
                      : "You've used your free evaluations. Buy credits to keep going."}
                  </p>
                  <button style={{
                    background: t.ctaBg,
                    color: t.ctaText,
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 32px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}>
                    Get Credits
                  </button>
                </Card>
              ) : (
              <div style={{ marginBottom: 16 }}>
                {isReEvalResult ? (
                  evidenceSignal ? (
                  /* EVIDENCE RE-READ DECISION — idea text unchanged, evidence moved. Two options only. */
                  <div style={{
                    padding: "20px 24px",
                    borderRadius: 16,
                    background: "rgba(231,189,122,0.05)",
                    border: "1px solid rgba(231,189,122,0.35)",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#c99a3a", marginBottom: 8 }}>Use this read going forward?</div>
                    <div style={{ fontSize: 13, color: t.sec, lineHeight: 1.55, marginBottom: 16 }}>The idea text hasn't changed — the evidence has. Set this as the current read (the previous read moves to history, viewable anytime), or keep the old one.</div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={onSetAsCurrentRead} disabled={readDecisionBusy} style={{ flex: 1, padding: "13px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "none", cursor: readDecisionBusy ? "wait" : "pointer", background: "rgba(231,189,122,.16)", color: "#e7bd7a" }}>{readDecisionBusy ? "Saving…" : "Set as current read"}</button>
                      <button onClick={onKeepOldRead} disabled={readDecisionBusy} style={{ flex: 1, padding: "13px 0", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: `1px solid ${t.border}`, background: "transparent", color: t.sec, cursor: readDecisionBusy ? "wait" : "pointer" }}>Keep the old read</button>
                    </div>
                  </div>
                  ) : (
                  /* POST-EVALUATION DECISION BLOCK — shown for re-eval results */
                  <div style={{
                    padding: "20px 24px",
                    borderRadius: 16,
                    background: "rgba(108,99,255,0.04)",
                    border: "1px solid rgba(108,99,255,0.2)",
                  }}>
                    {saveStatus === "saved" ? (
                      <div style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "center",
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "#34d399",
                      }}>
                        ✓ Saved as branch
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a78bfa", flexShrink: 0 }} />
                          <p style={{ fontSize: 15, fontWeight: 600, color: t.text, margin: 0 }}>
                            What do you want to do with this version?
                          </p>
                        </div>
                        {saveStatus === "naming" ? (
                          saveStandalone ? (
                          <div style={{
                            padding: "16px 20px",
                            borderRadius: 12,
                            background: t.surface,
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}>
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              Name this idea
                            </label>
                            <input
                              type="text"
                              value={ideaName}
                              onChange={(e) => setIdeaName(e.target.value)}
                              placeholder="e.g., Dif Target user"
                              autoFocus
                              maxLength={80}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 12,
                              }}
                            />
                            <p style={{ fontSize: 11.5, color: t.mut, margin: "0 0 14px", lineHeight: 1.55, display: "flex", gap: 7, alignItems: "flex-start" }}>
                              <span style={{ color: "#fbbf24", display: "inline-flex", marginTop: 1 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "block" }}><rect x="4" y="4" width="16" height="16" rx="3" /></svg></span>
                              <span>Saved as its own deep card in Evaluated, separate from this lineage — it won’t appear in the tree.</span>
                            </p>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={handleSaveIdea}
                                disabled={!ideaName.trim() || saveStatus === "saving"}
                                style={{
                                  flex: 1,
                                  padding: "10px 0",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: (!ideaName.trim() || saveStatus === "saving") ? "not-allowed" : "pointer",
                                  background: (!ideaName.trim() || saveStatus === "saving") ? t.surfAlt : "rgba(245,158,11,0.2)",
                                  color: (!ideaName.trim() || saveStatus === "saving") ? t.mut : "#fbbf24",
                                }}
                              >
                                {saveStatus === "saving" ? "Saving..." : "Save standalone card"}
                              </button>
                              <button
                                onClick={() => { setSaveStatus("idle"); setIdeaName(""); setSaveStandalone(false); }}
                                style={{
                                  padding: "10px 16px",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  border: `1px solid ${t.border}`,
                                  background: "transparent",
                                  color: t.mut,
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          ) : (
                          <div style={{
                            padding: "16px 20px",
                            borderRadius: 12,
                            background: t.surface,
                            border: "1px solid rgba(108,99,255,0.3)",
                          }}>
                            {/* Branch name */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              Name this branch
                            </label>
                            <input
                              type="text"
                              value={ideaName}
                              onChange={(e) => setIdeaName(e.target.value)}
                              placeholder="e.g., B2B pivot, Enterprise focus, Narrower wedge..."
                              autoFocus
                              maxLength={80}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                              }}
                            />

                            {/* Branch reason */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              Why is this a different direction?
                            </label>
                            <input
                              type="text"
                              value={branchReason}
                              onChange={(e) => setBranchReason(e.target.value)}
                              placeholder="e.g., Narrowed to enterprise buyers for clearer revenue"
                              maxLength={200}
                              style={{
                                width: "100%",
                                background: t.inputBg,
                                border: `1px solid ${t.inputBorder}`,
                                borderRadius: 10,
                                padding: "10px 14px",
                                fontSize: 14,
                                color: t.inputText,
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                              }}
                            />

                            {/* Changed dimensions */}
                            <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                              What changed? <span style={{ fontWeight: 400, color: t.mut }}>(select at least one)</span>
                            </label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                              {[
                                { key: "target_user", label: "Target user" },
                                { key: "problem", label: "Problem" },
                                { key: "wedge", label: "Value prop / Wedge" },
                                { key: "monetization", label: "Monetization" },
                                { key: "gtm", label: "Go-to-market" },
                                { key: "core_concept", label: "Core concept" },
                              ].map((dim) => {
                                const selected = branchDimensions.includes(dim.key);
                                return (
                                  <button
                                    key={dim.key}
                                    onClick={() => {
                                      setBranchDimensions((prev) =>
                                        selected ? prev.filter((d) => d !== dim.key) : [...prev, dim.key]
                                      );
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: 8,
                                      fontSize: 12,
                                      fontWeight: 500,
                                      border: selected ? "1px solid rgba(139,92,246,0.5)" : `1px solid ${t.border}`,
                                      background: selected ? "rgba(139,92,246,0.15)" : "transparent",
                                      color: selected ? "#a78bfa" : t.sec,
                                      cursor: "pointer",
                                      transition: "all 0.15s",
                                    }}
                                  >
                                    {selected ? "✓ " : ""}{dim.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={handleSaveIdea}
                                disabled={!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0}
                                style={{
                                  flex: 1,
                                  padding: "10px 0",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  border: "none",
                                  cursor: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? "not-allowed" : "pointer",
                                  background: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? t.surfAlt : "rgba(139,92,246,0.2)",
                                  color: (!ideaName.trim() || !branchReason.trim() || branchDimensions.length === 0) ? t.mut : "#a78bfa",
                                }}
                              >
                                Save branch
                              </button>
                              <button
                                onClick={() => { setSaveStatus("idle"); setIdeaName(""); setBranchReason(""); setBranchDimensions([]); }}
                                style={{
                                  padding: "10px 16px",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 500,
                                  border: `1px solid ${t.border}`,
                                  background: "transparent",
                                  color: t.mut,
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          )
                        ) : (
                          <DirectionRow cols={2}>
                            {briefAvailable && (
                              <DirectionCard
                                skin="cta" glyph="brief" title="Execution Brief"
                                desc="Turn this read into a first-move handoff — where our read stops"
                                cue={hasExecutionBrief ? "View brief" : "Generate"}
                                onClick={() => openExecutionBrief && openExecutionBrief()} />
                            )}

                            <DirectionCard
                              skin="deep" glyph="save" title="Save as branch"
                              desc="Keep this as a new direction linked to the parent idea"
                              cue="Keep" busy={saveStatus === "saving"}
                              onClick={() => { setSaveStandalone(false); handleSaveIdea(); }} />

                            <DirectionCard
                              skin="amber" glyph="standalone" title="Save as a standalone deep card"
                              desc="A fresh, independent idea — not part of this lineage"
                              cue="Detach" disabled={saveStatus === "saving"}
                              onClick={onStartStandalone} />

                            <DirectionCard
                              skin="save" glyph="discard" title="Discard"
                              desc="This was just a test, don't save"
                              cue="Drop" arrow={false}
                              onClick={onDiscardReEval} />
                          </DirectionRow>
                        )}
                        {saveStatus === "error" && saveError && (
                          <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", marginTop: 8 }}>
                            {saveError}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  )
                ) : (
                  /* NORMAL SAVE FLOW — for first-time evaluations */
                  user ? (
                    saveStatus === "saved" ? (
                    <div style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      textAlign: "center",
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      color: "#34d399",
                    }}>
                      ✓ Saved to My Ideas
                    </div>
                  ) : saveStatus === "naming" ? (
                    <div style={{
                      padding: "16px 20px",
                      borderRadius: 12,
                      background: t.surface,
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: t.sec, display: "block", marginBottom: 8 }}>
                        Name this idea
                      </label>
                      <input
                        type="text"
                        value={ideaName}
                        onChange={(e) => setIdeaName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && ideaName.trim() && handleSaveIdea()}
                        placeholder="e.g., AI Nutrition Coach, Learning OS..."
                        autoFocus
                        maxLength={80}
                        style={{
                          width: "100%",
                          background: t.inputBg,
                          border: `1px solid ${t.inputBorder}`,
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontSize: 14,
                          color: t.inputText,
                          outline: "none",
                          boxSizing: "border-box",
                          marginBottom: 12,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleSaveIdea}
                          disabled={!ideaName.trim()}
                          style={{
                            flex: 1,
                            padding: "10px 0",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            cursor: !ideaName.trim() ? "not-allowed" : "pointer",
                            background: !ideaName.trim() ? t.surfAlt : "rgba(59,130,246,0.15)",
                            color: !ideaName.trim() ? t.mut : t.link,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setSaveStatus("idle"); setIdeaName(""); }}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 500,
                            border: `1px solid ${t.border}`,
                            background: "transparent",
                            color: t.mut,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleSaveIdea}
                        disabled={saveStatus === "saving"}
                        style={{
                          width: "100%",
                          padding: "14px 0",
                          borderRadius: 12,
                          fontSize: 14,
                          fontWeight: 600,
                          border: "1px solid rgba(59,130,246,0.4)",
                          cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
                          background: saveStatus === "saving" ? t.surfAlt : "rgba(59,130,246,0.12)",
                          color: saveStatus === "saving" ? t.mut : t.link,
                          transition: "all 0.2s",
                        }}
                      >
                        {saveStatus === "saving" ? "Saving..." : "Save to My Ideas"}
                      </button>
                      {saveStatus === "error" && saveError && (
                        <p style={{ fontSize: 12, color: "#f87171", textAlign: "center", marginTop: 8 }}>
                          {saveError}
                        </p>
                      )}
                    </>
                  )
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    style={{
                      width: "100%",
                      padding: "14px 0",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 500,
                      border: `1px solid ${t.border}`,
                      background: "transparent",
                      color: t.sec,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    Sign up to save your evaluations
                  </button>
                )
                )}
              </div>
              )
            )}
            </div>

            {viewingFromSaved ? (
              <>
                <FromHerePanel
                  key={currentIdeaId}
                  t={t}
                  briefAvailable={briefAvailable}
                  hasExecutionBrief={hasExecutionBrief}
                  openExecutionBrief={openExecutionBrief}
                  evalsRemaining={evalsRemaining}
                  startReEvaluation={startReEvaluation}
                  watchCadence={watchCadence}
                  onSetWatch={onSetWatch}
                />
                <BackLink t={t} flush onClick={onBackToMyIdeasCleanup} style={{ marginTop: 16 }}>Back to My Ideas</BackLink>
              </>
            ) : (
              <FooterBar t={t} topBorder={false}>
                <FootLink t={t} onClick={onResetAndNewIdea}>Analyze Another Idea</FootLink>
              </FooterBar>
            )}
          </PageContainer>
        </main>
      </>
    );
  }

  // ==========================================
  // SCREEN: results2 — RETIRED (V7 merge)
  // ==========================================
  // results2 was "Evidence & Reality": Competition, Key Risks and Execution
  // Reality, followed by the save / naming / handoff tail. The three content
  // sections are now movements III and IV of the single Deep page, and the
  // tail moved to the foot of results1.
  //
  // The screen is NOT deleted — it redirects. Persisted sessionStorage
  // (iv_fresh_result carries `screen`) and saved deep links both still carry
  // "results2", so a hard removal would strand anyone mid-flow on a blank
  // render. The redirect effect above sends them to results1; this branch is
  // the one-frame fallback before it fires.
  if (screen === "results2") return null;

  return null;
}