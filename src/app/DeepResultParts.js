// DeepResultParts.js — Deep evaluation-view presentation layer (V6 redesign).
import { ChangeMarker } from "./ChangeWalkthrough";
import { ModeTitle } from "./ModeTitle";
//
// The three genuinely-new pieces of the redesigned Deep result, plus the
// "Pressure Read" verdict-first card that assembles them. Built to the geometry
// of the approved Claude Design mockup (ilc-deep-assembly-final), rendered in
// React against the live theme tokens and REAL pipeline data.
//
//   ProvenanceStrip — the "carried from Explore" lineage strip at the very top
//                     of a Deep result. Three states: branched (bet/limit from
//                     Explore), cold (straight to Deep, no Explore pass), reeval
//                     (from a prior Deep run). Cold is the only live state today;
//                     the branched state lights up once the Explore→Deep handoff
//                     routes branch_reason through.
//   OverallGauge   — the neutral score ring (taupe, NOT score-coloured: the
//                     number orients, it doesn't wound — band colour lives on the
//                     metric tiles, never on the overall ring).
//   MetricTile     — one MD/MO/OR tile beside the gauge. Identity-coloured
//                     (Fork 5 = B): colour says WHICH metric, length says the
//                     score, the number carries the value. Shows contribution
//                     (score × weight) to the overall.
//   TcLadder       — the 5-segment build-difficulty word ladder (very easy →
//                     very hard), execution-context, derived from the TC score.
//   PressureRead   — verdict-first card: the Stage-2c verdict paragraph + a
//                     confidence line (from evidence_strength) + the gauge +
//                     tiles + the TC ladder. Replaces the old number-header
//                     "summary card"; this is what moved the verdict from the
//                     bottom of the scroll to the top.
//
// DISPLAY-ONLY. Reads fields already on the payload. Touches no score.
// Identity metric colours (Fork 5 = B): colour encodes metric identity, not the
// score band. The overall ring stays neutral. getScoreColor is no longer used on
// the bars/tiles — the score is read from the number, never re-encoded as red.

import React from "react";
import SourcesStrip from "./SourcesStrip";

// ---- identity metric colours (dark + light) ----------------------------------
export const METRIC_COLORS = {
  market_demand:        { dark: "#3fc09a", light: "#1d9b78" },
  monetization:         { dark: "#6f8ff5", light: "#3b63d6" },
  originality:          { dark: "#b57ce0", light: "#8b4fc0" },
  technical_complexity: { dark: "#d9a85e", light: "#b07d2e" },
};
export const OVERALL_RING   = { dark: "#b1a89c", light: "#8a8174" };
export const PROVENANCE_BLUE = { dark: "#6b9cf0", light: "#3b6fd0" };
export const VERDICT_ACCENT  = { dark: "#8b8fe0", light: "#5b5fc0" };

const pick = (pair, t) => (t && t.mode === "light" ? pair.light : pair.dark);
export const metricColor = (key, t) =>
  METRIC_COLORS[key] ? pick(METRIC_COLORS[key], t) : (t ? t.sec : "#888");

const hex = (c, aa) => `${c}${aa}`; // c must be 6-digit hex; aa = 2-digit alpha

// ============================================================ PROVENANCE STRIP
// provenance = {
//   state: "branched" | "cold" | "reeval",
//   bet?:   string,   // Explore THE BET  (branched)
//   limit?: string,   // Explore THE LIMIT (branched)
//   changed?: string, // human summary of what changed (reeval)
//   onExplore?: () => void,  // loop edge back to the source (branched/reeval)
// }
export function ProvenanceStrip({ provenance, t }) {
  const p = provenance || { state: "cold" };
  const blue = pick(PROVENANCE_BLUE, t);
  const isLive = p.state === "branched" || p.state === "reeval";
  const spine = isLive
    ? `linear-gradient(180deg, ${blue}, ${hex(blue, "1F")})`
    : `linear-gradient(180deg, ${t.mut}, ${hex(t.mut, "20")})`;

  const exploreClickable = isLive && typeof p.onExplore === "function";
  const exploreColor = isLive ? blue : t.mut;
  const exploreIcBg = isLive ? hex(blue, "1F") : t.surfAlt;
  const exploreIcBorder = isLive ? hex(blue, "42") : t.border;

  return (
    <div style={{ position: "relative", padding: "2px 0 4px 22px", marginBottom: 28 }}>
      <div style={{ position: "absolute", left: 0, top: 5, bottom: 6, width: 2, borderRadius: 2, background: spine }} />
      {/* serious mode title leads; lineage is demoted to the sentence below */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        <ModeTitle mode="deep" />
        {exploreClickable && (
          <button
            onClick={p.onExplore}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em",
              color: exploreColor, background: "none", border: "none", padding: 0, cursor: "pointer",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-1px", marginRight: 4 }}><path d="M7 17L17 7M8 7h9v9" /></svg>from the Explore pass
          </button>
        )}
      </div>
      {/* the line */}
      <p style={{ fontSize: 15, lineHeight: 1.7, color: t.sec, margin: 0, maxWidth: 820 }}>
        {p.state === "branched" && p.bet ? (
          <>
            You branched this on the bet that <b style={{ color: t.text, fontWeight: 600 }}>{p.bet}</b>
            {p.limit ? <> — knowing the limit that <b style={{ color: t.text, fontWeight: 600 }}>{p.limit}</b></> : null}. Here it is under pressure.
          </>
        ) : p.state === "branched" ? (
          <>Branched from an Explore idea. Here it is under pressure.</>
        ) : p.state === "reeval" ? (
          <>
            Re-evaluated from a prior Deep run{p.changed ? <> — you changed <b style={{ color: t.text, fontWeight: 600 }}>{p.changed}</b></> : null}. Here it is again, under pressure.
          </>
        ) : (
          <>Taken straight to Deep — no Explore pass. Here it is under pressure.</>
        )}
      </p>
    </div>
  );
}

// ================================================================ OVERALL GAUGE
// Neutral taupe ring. score in 0..10. r=62, sw=14, circumference 389.56.
export function OverallGauge({ score, t, size = 96 }) {
  const ring = pick(OVERALL_RING, t);
  const C = 2 * Math.PI * 62; // 389.557
  const sweep = Math.max(0, Math.min(10, score)) / 10 * C;
  const trackCol = t.mode === "light" ? "rgba(80,75,65,0.10)" : "rgba(255,255,255,0.06)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 182 182">
          <circle cx="91" cy="91" r="62" fill="none" stroke={trackCol} strokeWidth="14" />
          <circle
            cx="91" cy="91" r="62" fill="none" stroke={ring} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${sweep.toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 91 91)"
            style={{ filter: `drop-shadow(0 0 6px ${hex(ring, "55")})`, transition: "stroke-dasharray 1s ease-out" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
          <span style={{ fontSize: size * 0.30, fontWeight: 700, color: t.text }}>{score.toFixed(1)}</span>
          <span style={{ fontSize: size * 0.12, color: t.mut, marginTop: 2 }}>/10</span>
        </div>
      </div>
      <span style={{ fontSize: 10.5, color: t.mut, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Overall score</span>
    </div>
  );
}

// ================================================================== METRIC TILE
// Identity-coloured. label, score (0..10), weightLabel ("37.5%"), contribution (number).
export function MetricTile({ metricKey, label, score, weightLabel, contribution, t }) {
  const c = metricColor(metricKey, t);
  const pct = Math.max(0, Math.min(10, score)) / 10 * 100;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, color: t.sec, fontWeight: 500, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </span>
        <span style={{ fontSize: 19, fontWeight: 700, color: t.text, fontFamily: "monospace", flexShrink: 0 }}>{score.toFixed(1)}</span>
      </div>
      <div style={{ height: 8, background: t.barBg, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 4, transition: "width 1s ease-out", boxShadow: `0 0 6px ${hex(c, "66")}` }} />
      </div>
      <div style={{ fontSize: 11, color: t.mut, marginTop: 7 }}>
        {weightLabel} weight{typeof contribution === "number" ? <> · +{contribution.toFixed(1)}</> : null}
      </div>
    </div>
  );
}

// =================================================================== TC LADDER
// 5-segment build-difficulty word ladder from the TC score (execution context).
const TC_WORDS = ["very easy", "easy", "moderate", "hard", "very hard"];
function tcBucket(score) {
  if (typeof score !== "number" || isNaN(score)) return -1;
  if (score < 2) return 0;
  if (score < 4) return 1;
  if (score < 6) return 2;
  if (score < 8) return 3;
  return 4;
}
export function TcLadder({ score, t }) {
  const c = metricColor("technical_complexity", t);
  const cur = tcBucket(score);
  const WrenchIcon = (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.5-.5-.5-2.5z" />
    </svg>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 190 }}>
        {WrenchIcon}
        <div>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: t.sec }}>Tech. Complexity</span>
          <span style={{ display: "block", fontSize: 10.5, color: t.mut, marginTop: 1 }}>build difficulty</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: "flex", gap: 5 }}>
          {TC_WORDS.map((_, i) => {
            const isCur = i === cur;
            const isOn = i < cur;
            return (
              <div key={i} style={{
                flex: 1, height: 8, borderRadius: 3,
                background: isCur ? c : isOn ? (t.mode === "light" ? "rgba(80,75,65,0.18)" : "rgba(255,255,255,0.13)") : t.barBg,
                boxShadow: isCur ? `0 0 6px ${hex(c, "94")}` : "none",
              }} />
            );
          })}
        </div>
        <div style={{ display: "flex", marginTop: 7 }}>
          {TC_WORDS.map((w, i) => (
            <span key={w} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: i === cur ? t.sec : t.mut, fontWeight: i === cur ? 600 : 400 }}>{w}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================================================================ PRESSURE READ
// Verdict-first card. Assembles: verdict paragraph (Stage 2c summary, honest
// degrade) + confidence line (evidence_strength) + gauge + MD/MO/OR tiles + TC
// ladder. This is the top of the Deep result — the number never appears before
// the read.
const WEIGHTS = { market_demand: 0.375, monetization: 0.3125, originality: 0.3125 };

export function PressureRead({ analysis, t, onScoreGuide, wt, onWt }) {
  const ev = analysis.evaluation;
  const es = ev.evidence_strength;
  const accent = pick(VERDICT_ACCENT, t);

  const degraded = ev.synthesis_degraded || !(typeof ev.summary === "string" && ev.summary.trim());
  const headline = typeof ev.verdict_headline === "string" ? ev.verdict_headline.trim() : "";
  const detail = typeof ev.verdict_detail === "string" && ev.verdict_detail.trim() ? ev.verdict_detail.trim() : "";
  // Option B: the card shows the compressed 3-beat lead; the modal shows the full
  // (rich) verdict. cardLead falls back to the full summary if compression is absent.
  const fullVerdict = typeof ev.summary === "string" ? ev.summary.trim() : "";
  const lead = typeof ev.verdict_lead === "string" && ev.verdict_lead.trim() ? ev.verdict_lead.trim() : "";
  const cardLead = lead || fullVerdict;
  // Show "Read the full verdict" when the modal genuinely adds something: either the
  // full verdict is richer than the compressed card lead, or a deeper detail exists.
  const hasMore = (!!lead && !!fullVerdict && fullVerdict !== lead) || !!detail;
  const [showFull, setShowFull] = React.useState(false);

  const level = es && es.level;
  const conf = level === "HIGH"
    ? { bars: 3, label: "High-confidence read" }
    : level === "MEDIUM"
    ? { bars: 2, label: "Medium-confidence read" }
    : { bars: 1, label: "Early read" };

  // MO shows the finer display_score when present.
  const moScore = typeof ev.monetization.display_score === "number" ? ev.monetization.display_score : ev.monetization.score;

  const tiles = [
    { key: "market_demand", label: "Market Demand", score: ev.market_demand.score, w: "37.5%", contrib: ev.market_demand.score * WEIGHTS.market_demand },
    { key: "monetization", label: ev.monetization.label || "Monetization", score: moScore, w: "31.25%", contrib: moScore * WEIGHTS.monetization },
    { key: "originality", label: "Originality", score: ev.originality.score, w: "31.25%", contrib: ev.originality.score * WEIGHTS.originality },
  ];

  return (
    <div style={{
      position: "relative",
      background: t.mode === "light"
        ? "linear-gradient(180deg, rgba(139,143,224,0.045), rgba(80,75,65,0.015))"
        : "linear-gradient(180deg, rgba(139,143,224,0.05), rgba(255,255,255,0.022))",
      border: `1px solid ${t.border}`, borderRadius: 18, padding: "32px 36px 30px", marginBottom: 16, overflow: "hidden",
    }}>
      {/* left accent spine */}
      <div style={{ position: "absolute", left: 0, top: 22, bottom: 22, width: 2, borderRadius: 2, background: `linear-gradient(180deg, ${accent}, transparent)`, opacity: 0.5 }} />

      {!degraded && headline ? (
        <>
          <h2 style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.015em", margin: "0 0 16px", color: t.text, display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{headline}<ChangeMarker bundle={wt && wt.verdict} onOpen={onWt} title="The verdict changed" /></h2>
          <p style={{ fontSize: 17.5, lineHeight: 1.82, color: t.text, fontWeight: 400, margin: 0, maxWidth: 900 }}>{cardLead}</p>
          {hasMore && (
            <button onClick={() => setShowFull(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, fontSize: 13.5, fontWeight: 600, color: accent, background: "none", border: "none", cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}>
              Read the full verdict
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </button>
          )}
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, opacity: 0.85 }}>The bottom line</div>
            <ChangeMarker bundle={wt && wt.verdict} onOpen={onWt} title="The verdict changed" />
          </div>
          {degraded ? (
            <p style={{ fontSize: 16, lineHeight: 1.7, color: t.sec, margin: 0, maxWidth: 900 }}>
              We couldn't generate the written verdict for this run — one synthesis step didn't complete. Your scores below are complete and unaffected. Re-running usually produces the full read.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 17.5, lineHeight: 1.82, color: t.text, fontWeight: 400, margin: 0, maxWidth: 900 }}>
                {cardLead}
              </p>
              {hasMore && (
                <button onClick={() => setShowFull(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, fontSize: 13.5, fontWeight: 600, color: accent, background: "none", border: "none", cursor: "pointer", padding: "6px 0", fontFamily: "inherit" }}>
                  Read the full verdict
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* confidence line */}
      {es && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2.5, height: 11 }}>
            {[5, 8, 11].map((h, i) => (
              <i key={i} style={{ width: 3.5, height: h, borderRadius: 1.5, background: i < conf.bars ? accent : (t.mode === "light" ? "rgba(80,75,65,0.18)" : "rgba(255,255,255,0.14)"), boxShadow: i < conf.bars ? `0 0 6px ${hex(accent, "80")}` : "none" }} />
            ))}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.sec, flexShrink: 0 }}>{conf.label}</span>
          {es.reason && (
            <span style={{ fontSize: 12, color: t.mut, lineHeight: 1.5, borderLeft: `1px solid ${t.divider}`, paddingLeft: 10 }}>{es.reason}</span>
          )}
        </div>
      )}

      {/* rule */}
      <div style={{ height: 1, background: t.divider, margin: "26px 0 24px" }} />

      {/* gauge + tiles */}
      <div style={{ display: "flex", alignItems: "center", gap: 36, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <OverallGauge score={ev.overall_score} t={t} />
          {wt && wt.overall && (
            <div style={{ position: "absolute", top: -2, left: -14, zIndex: 2 }}>
              <ChangeMarker bundle={wt.overall} onOpen={onWt} title="Overall score changed" />
            </div>
          )}
          {onScoreGuide && (
            <button onClick={onScoreGuide} aria-label="What does this score mean?" title="What does this score mean?"
              style={{ position: "absolute", top: -2, right: -10, background: "none", border: "none", cursor: "pointer", color: t.mut, fontSize: 13, padding: 2 }}>ⓘ</button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 280, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "20px 28px" }}>
          {tiles.map((tile) => (
            <MetricTile key={tile.key} metricKey={tile.key} label={tile.label} score={tile.score} weightLabel={tile.w} contribution={tile.contrib} t={t} />
          ))}
        </div>
      </div>

      {/* fence + TC ladder (execution context) */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "26px 0 20px" }}>
        <div style={{ height: "0.5px", flex: 1, background: t.divider }} />
        <div style={{ fontSize: 9, color: t.mut, letterSpacing: "1.2px", fontWeight: 600 }}>EXECUTION CONTEXT · NOT IN THE OVERALL</div>
        <div style={{ height: "0.5px", flex: 1, background: t.divider }} />
      </div>
      <TcLadder score={ev.technical_complexity.score} t={t} />

      {showFull && (fullVerdict || detail) && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowFull(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(6,7,11,0.72)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 24px", zIndex: 1000, overflowY: "auto" }}>
          <div style={{ position: "relative", background: t.mode === "light" ? t.surface : "#0e1015", border: `1px solid ${t.border}`, borderRadius: 20, maxWidth: 740, width: "100%", padding: "34px 40px 36px", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
            <div style={{ position: "absolute", left: 0, top: 26, bottom: 26, width: 2, borderRadius: 2, background: `linear-gradient(180deg, ${accent}, transparent)`, opacity: 0.55 }} />
            <button onClick={() => setShowFull(false)} aria-label="Close" style={{ position: "absolute", top: 18, right: 20, background: "none", border: "none", color: t.mut, fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px", borderRadius: 8 }}>×</button>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, opacity: 0.85, marginBottom: 12 }}>The full read</div>
            {headline && <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", color: t.text, margin: "0 0 18px" }}>{headline}</h3>}
            <p style={{ fontSize: 15.5, lineHeight: 1.8, color: t.sec, margin: 0, whiteSpace: "pre-line" }}>{ev.summary}</p>
            {detail && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: t.mut }}>The deeper read</span>
                  <span style={{ flex: 1, height: 1, background: t.divider }} />
                </div>
                <p style={{ fontSize: 15.5, lineHeight: 1.8, color: t.sec, margin: 0, whiteSpace: "pre-line" }}>{detail}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================== DEEP METRIC CARD
// The mockup's two-column metric card: a 228px identity-tinted rail (icon · name ·
// big neutral score · weight · a per-metric "feature" viz) and a body (Q→A blocks,
// the last one — "why it sits here / what moves it" — in a glowing accent box, then
// the SourcesStrip). Replaces the old single-column MetricProseDetail for MD/MO/OR
// in the Deep evaluation view. MetricProseDetail / MetricProseBody stay untouched
// for the comparison view and execution_reality.
//
// Reads the same committed fields MetricProseDetail did (_internal archetypes,
// raw prose fields, display_score) and degrades the same way.

// MD demand ladder: archetype -> tier (1..7)
const MD_ARCHETYPES = {
  speculative_need: 1,
  category_validated_entrant_unspecific: 2,
  clear_pain_weak_pull: 3,
  specific_buyer_unresolved_adoption_friction: 4,
  specific_buyer_with_active_trigger: 5,
  demonstrated_pull_with_friction_survival: 6,
  demonstrated_pull_with_capturable_density: 7,
};
const MD_TIER_LABELS = {
  1: "Speculative need", 2: "Category-validated, unspecific", 3: "Clear pain, weak pull",
  4: "Specific buyer, unresolved friction", 5: "Specific buyer, active trigger",
  6: "Demonstrated pull, friction survived", 7: "Demonstrated pull, capturable density",
};
// MO capture ladder: archetype -> rung (1..6)
const MO_ARCHETYPES = {
  insufficient_evidence: { rung: 1, label: "Insufficient payment evidence" },
  founder_articulated: { rung: 2, label: "Founder-stated model" },
  category_grounded: { rung: 3, label: "Category-level evidence" },
  partial_segment_grounded: { rung: 4, label: "Partial segment evidence" },
  direct_precedent_grounded: { rung: 5, label: "Comparable priced precedent" },
  sustained_adoption_evidenced: { rung: 6, label: "Sustained paid adoption" },
};
const OR_EXPOSURE_LABELS = {
  fast_follower_replication: "Replicable by competitors",
  job_substitution_pressure: "Substitutable by an existing tool",
  none_or_minimal: "No structural exposure named",
};
const humanize = (s) => (typeof s === "string" && s.length ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null);

const DM_QUESTIONS = {
  market_demand: [
    { q: "What demand case is this?", field: "diagnosis" },
    { q: "What stands between this buyer and adoption?", field: "binding_friction_explanation" },
    { q: "Why does it sit here, and what would move it higher?", field: "direction" },
  ],
  monetization: [
    { q: "What payment-capture case is this?", field: "diagnosis" },
    { q: "What stands between this case and durable payment capture?", field: "binding_payment_constraint_explanation" },
    { q: "Why does it sit here, and what would move it higher?", field: "direction" },
  ],
  originality: [
    { q: "What is actually different about this case?", field: "differentiation_basis_diagnosis" },
    { q: "Is that differentiation defensible?", field: "defensibility_diagnosis" },
    { q: "What primary exposure constrains the position?", field: "binding_constraint_explanation" },
    { q: "Why does it sit here, and what would move it higher?", field: "direction" },
  ],
};
const dmHas = (v) => typeof v === "string" && v.trim().length > 0;

// metric identity icons (from the mockup)
function DmIcon({ metricKey }) {
  if (metricKey === "market_demand") return (<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>);
  if (metricKey === "monetization") return (<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>);
  return (<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17.3 5.8 21.7l2.4-7.4L2 9.4h7.6z" />); // originality star
}

// ---- MD gauge-arc: semicircle, sweep = tier/7 -------------------------------
function MdArc({ tier, c, t }) {
  const ARC = Math.PI * 66; // 207.35
  const f = Math.max(0, Math.min(7, tier)) / 7;
  const sweep = f * ARC;
  const theta = Math.PI - sweep / 66; // angle of the end dot
  const dx = 105 + 66 * Math.cos(theta);
  const dy = 72 - 66 * Math.sin(theta);
  const track = t.mode === "light" ? "rgba(80,75,65,0.12)" : "rgba(255,255,255,0.08)";
  return (
    <svg width="100%" viewBox="0 0 210 84" fill="none" style={{ maxWidth: 188, display: "block" }}>
      <path d="M39 72 A 66 66 0 0 1 171 72" stroke={track} strokeWidth="7" strokeLinecap="round" />
      <path d="M39 72 A 66 66 0 0 1 171 72" stroke={c} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${sweep.toFixed(1)} ${ARC.toFixed(1)}`} style={{ filter: `drop-shadow(0 0 6px ${c}88)` }} />
      <circle cx={dx.toFixed(1)} cy={dy.toFixed(1)} r="4.5" fill={c} style={{ filter: `drop-shadow(0 0 6px ${c}66)` }} />
      <text x="105" y="60" textAnchor="middle" fill={t.sec} fontSize="11" fontWeight="600">tier {tier} / 7</text>
      <text x="35" y="82" fill={t.mut} fontSize="9">speculative</text>
      <text x="175" y="82" textAnchor="end" fill={t.mut} fontSize="9">demonstrated</text>
    </svg>
  );
}

// ---- MO bar-chart: 6 rungs, current highlighted, ahead ghosted ---------------
function MoBars({ rung, c, t }) {
  const heights = [16, 24, 32, 40, 46, 52];
  const xs = [6, 44, 82, 120, 158, 196];
  const cur = Math.max(1, Math.min(6, rung)) - 1; // index
  const baseLine = t.mode === "light" ? "rgba(80,75,65,0.25)" : "rgba(255,255,255,0.1)";
  return (
    <svg width="100%" viewBox="0 0 240 76" fill="none" style={{ maxWidth: 188, display: "block" }}>
      <line x1="2" y1="58" x2="238" y2="58" stroke={baseLine} strokeWidth="1" />
      {heights.map((h, i) => {
        const y = 58 - h;
        if (i < cur) {
          const fill = i === cur - 1 ? `${c}A8` : `${c}6E`;
          return <rect key={i} x={xs[i]} y={y} width="30" height={h} rx="3" fill={fill} />;
        }
        if (i === cur) {
          return (
            <g key={i}>
              <rect x={xs[i]} y={y} width="30" height={h} rx="3" fill={c} style={{ filter: `drop-shadow(0 0 6px ${c}80)` }} />
              <circle cx={xs[i] + 15} cy={y - 6} r="3" fill={c} />
            </g>
          );
        }
        return <rect key={i} x={xs[i]} y={y} width="30" height={h} rx="3" fill="none" stroke={`${c}48`} strokeWidth="1.4" strokeDasharray="3 3" />;
      })}
      <text x="6" y="72" fill={t.mut} fontSize="9">insufficient</text>
      <text x="234" y="72" textAnchor="end" fill={t.mut} fontSize="9">sustained</text>
    </svg>
  );
}

// ---- OR shield: exposure mark (static shape; the phrase carries the meaning) --
function OrShield({ c }) {
  return (
    <svg width="100%" viewBox="0 0 150 74" fill="none" style={{ maxWidth: 150, display: "block" }}>
      <defs><clipPath id="dmShOR"><path d="M62 6 L98 19 V44 C98 62 84 71 62 77 C40 71 26 62 26 44 V19 Z" /></clipPath></defs>
      <rect x="20" y="24" width="84" height="56" clipPath="url(#dmShOR)" fill={`${c}42`} />
      <g clipPath="url(#dmShOR)" stroke={`${c}90`} strokeWidth="1">
        <line x1="28" y1="10" x2="50" y2="32" /><line x1="44" y1="6" x2="72" y2="34" /><line x1="60" y1="6" x2="88" y2="34" /><line x1="78" y1="10" x2="98" y2="30" />
      </g>
      <path d="M62 6 L98 19 V44 C98 62 84 71 62 77 C40 71 26 62 26 44 V19 Z" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${c}88)` }} />
    </svg>
  );
}

// ---- rail feature: { lab, hl, viz } per metric -------------------------------
function DmRailFeature({ metricKey, metric, c, t }) {
  const _i = metric._internal || {};
  if (metricKey === "market_demand") {
    const tier = MD_ARCHETYPES[_i.demand_archetype];
    if (!tier) return null;
    return { lab: "Demand type", hl: MD_TIER_LABELS[tier], viz: <MdArc tier={tier} c={c} t={t} /> };
  }
  if (metricKey === "monetization") {
    const a = MO_ARCHETYPES[_i.monetization_archetype];
    if (!a) return null;
    return { lab: `Capture case · rung ${a.rung} / 6`, hl: a.label, viz: <MoBars rung={a.rung} c={c} t={t} /> };
  }
  if (metricKey === "originality") {
    const sub = _i.binding_constraint && _i.binding_constraint.primary_subtype;
    if (!dmHas(sub)) return null;
    return { lab: "Primary exposure", hl: OR_EXPOSURE_LABELS[sub] || humanize(sub), viz: <OrShield c={c} /> };
  }
  return null;
}

// Shared progressive-disclosure toggle (item 6). Keeps the wall down: punchy parts
// stay visible, dense prose collapses behind this. Frontend-only; no field changes.
function MoreToggle({ open, onClick, closed, opened, color, t, mt = 10 }) {
  const c = color || t.mut;
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: mt, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: c }}>
      {open ? (opened || "Show less") : (closed || "Show more")}
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><polyline points="6 9 12 15 18 9" /></svg>
    </button>
  );
}

export function DeepMetricCard({ metricKey, metric, name, weightLabel, notes = [], competitors = null, t, wt, onWt }) {
  const c = metricColor(metricKey, t);
  const coarse = metric.score;
  const shown = metricKey === "monetization" && typeof metric.display_score === "number" ? metric.display_score : coarse;
  const set = DM_QUESTIONS[metricKey];
  const canSplit = set && set.every(({ field }) => dmHas(metric[field]));
  const [expanded, setExpanded] = React.useState(false);
  const feature = DmRailFeature({ metricKey, metric, c, t });

  const railTint = t.mode === "light" ? `${c}0A` : `${c}09`;
  const icoBg = `${c}1F`;
  const icoBorder = `${c}33`;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "228px 1fr", border: `1px solid ${t.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 14, background: t.mode === "light" ? t.surface : "rgba(255,255,255,0.022)" }}>
      {/* rail */}
      <div style={{ padding: "24px 22px", borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 11, background: railTint }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", background: icoBg, border: `1px solid ${icoBorder}`, color: c }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><DmIcon metricKey={metricKey} /></svg>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>{name}<ChangeMarker bundle={wt && wt[metricKey]} onOpen={onWt} title={(name || "This metric") + " changed"} /></div>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: t.mode === "light" ? t.text : "#d6d8e1", display: "flex", alignItems: "baseline", gap: 4 }}>
          {shown.toFixed(1)}<span style={{ fontSize: 13, fontWeight: 600, color: t.mut }}>/10</span>
        </div>
        <div style={{ fontSize: 11, color: t.mut, marginTop: -4 }}>{weightLabel}</div>
        {feature && (
          <div style={{ marginTop: "auto", paddingTop: 12 }}>
            <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: c, opacity: 0.62 }}>{feature.lab}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, margin: "3px 0 9px", color: t.sec }}>{feature.hl}</div>
            <div>{feature.viz}</div>
          </div>
        )}
      </div>

      {/* body */}
      <div style={{ padding: "24px 28px" }}>
        {canSplit ? (
          <>
            {set.slice(0, -1).map(({ q, field }, idx) => {
              // First non-box Q stays visible (orientation); the rest collapse.
              if (idx > 0 && !expanded) return null;
              return (
                <div key={field} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={`${c}B0`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    <b style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>{q}</b>
                  </div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.62, color: t.sec, margin: 0 }}>{metric[field]}</p>
                </div>
              );
            })}
            {set.length > 2 && (
              <MoreToggle open={expanded} onClick={() => setExpanded(!expanded)} closed="Show the full read" opened="Show less" color={`${c}D0`} t={t} mt={2} />
            )}
            {/* the last question — glowing accent box, always visible */}
            {(() => {
              const last = set[set.length - 1];
              return (
                <div style={{ position: "relative", marginTop: 14, padding: "15px 18px 15px 22px", borderRadius: 13, overflow: "hidden", background: `linear-gradient(90deg, ${c}1F, ${c}0A)`, border: `1px solid ${c}38` }}>
                  <div style={{ position: "absolute", left: 0, top: 11, bottom: 11, width: 3, borderRadius: "0 3px 3px 0", background: c, boxShadow: `0 0 12px 1px ${c}52` }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 7, background: `${c}38`, color: c, flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: c }}>{last.q}</span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.62, color: t.mode === "light" ? t.sec : "#e6e8f0", margin: 0 }}>{metric[last.field]}</p>
                </div>
              );
            })()}
          </>
        ) : (
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: t.sec, margin: 0 }}>{metric.explanation}</p>
        )}

        {notes && notes.filter(Boolean).map((note, i) => (
          <p key={i} style={{ fontSize: 12, color: t.mut, marginTop: 8, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
        ))}

        <SourcesStrip internal={metric._internal} competitors={competitors} t={t} />
      </div>
    </div>
  );
}

// ============================================================ EXECUTION REALITY
// The mockup's ercard: a binding-constraint hero (kick · bottleneck name+icon ·
// diagnosis · close-call "edged out {runner_up}") beside a "what it implies" read-out
// (duration + commitment), then a 3-beat flow (what clearing it takes / how your
// profile changes it / why this timeline). All from estimates + its 4 prose
// fields (constraint_diagnosis / commitment_explanation / profile_calibration /
// position_basis), which map 1:1 onto the mockup. mbColorFn / mbIcon are passed
// in from components.js so this file stays free of that dependency.
const COMMITMENT_WORD = { "Very Hard": "Very intensive", "Hard": "Intensive", "Moderate": "Moderate", "Easy": "Light" };

export function ExecutionReality({ estimates, mbColorFn, MbIcon, t, wt, onWt }) {
  if (!estimates) return null;
  const mb = estimates.main_bottleneck;
  const mbColor = mb && mbColorFn ? mbColorFn(mb, t.mode) : null;
  const amb = estimates.mb_ambiguity;
  const isClose = amb && amb.is_close_call;
  const commitment = COMMITMENT_WORD[estimates.difficulty] || "—";

  // beat-rail / whisper accents — tinted to the binding-constraint color, neutral fallback
  const accent = (mbColor && mbColor.color) || t.sec;
  const accentSoft = (mbColor && mbColor.border) || t.divider;
  const nodeRing = t.mode === "light" ? (t.surface || t.bg) : (t.bg || "rgb(11,14,20)");

  const flow = [
    { l: "What clearing it takes", v: estimates.commitment_explanation },
    { l: "How your profile changes it", v: estimates.profile_calibration },
    { l: "Why this timeline & commitment", v: estimates.position_basis },
  ].filter((x) => dmHas(x.v));
  const [showFlow, setShowFlow] = React.useState(false);

  const railV = (l, v) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: t.mut, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 4 }}>{l}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{v}</div>
    </div>
  );

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 18, padding: "30px 34px", background: t.mode === "light" ? t.surface : "rgba(255,255,255,0.018)" }}>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* hero */}
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: t.mut, marginBottom: 10 }}>The binding constraint</div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
            {mb && mbColor && (
              <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: mbColor.bg, border: `1px solid ${mbColor.border}`, color: mbColor.color, flexShrink: 0 }}>
                {MbIcon ? <MbIcon value={mb} size={17} /> : null}
              </span>
            )}
            <h3 style={{ fontSize: 21, fontWeight: 700, color: t.text, margin: 0, letterSpacing: "-0.01em" }}>{mb || "—"}</h3>
            <ChangeMarker bundle={wt && wt.mb} onOpen={onWt} title="The binding constraint re-read" />
          </div>
          {dmHas(estimates.constraint_diagnosis) && (
            <p style={{ fontSize: 14, lineHeight: 1.66, color: t.sec, margin: "0 0 16px" }}>{estimates.constraint_diagnosis}</p>
          )}

          {/* close call */}
          {isClose && (
            <div style={{ borderRadius: 12, border: `1px solid ${t.border}`, background: t.mode === "light" ? "rgba(80,75,65,0.03)" : "rgba(255,255,255,0.02)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut, marginBottom: 10 }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18" /><path d="M5 7h14" /><path d="m5 7-3 6a3 3 0 0 0 6 0z" /><path d="m19 7-3 6a3 3 0 0 0 6 0z" /><path d="M7 21h10" /></svg>
                Close call
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: dmHas(amb.tipping_signal) ? 9 : 0 }}>
                <span style={{ fontSize: 12, color: t.mut }}>Edged out</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{amb.runner_up}</span>
              </div>
              {dmHas(amb.tipping_signal) && <p style={{ fontSize: 12.5, lineHeight: 1.55, color: t.sec, margin: 0 }}>{amb.tipping_signal}</p>}
            </div>
          )}
        </div>

        {/* whisper line — soft constraint-tinted hairline, fades top & bottom; collapses when columns stack */}
        <div aria-hidden="true" style={{ alignSelf: "stretch", width: 1, flexShrink: 0, background: `linear-gradient(180deg, transparent, ${accentSoft} 16%, ${accentSoft} 84%, transparent)` }} />

        {/* read-out */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: t.mut, marginBottom: 12 }}>What it implies</div>
          {railV("Est. duration", estimates.duration)}
          {railV("Commitment", commitment)}
        </div>
      </div>

      {flow.length > 0 && (
        <>
          <div style={{ height: 1, background: t.divider, margin: "20px 0 4px" }} />
          <MoreToggle open={showFlow} onClick={() => setShowFlow(!showFlow)} closed="What it takes to clear it" opened="Show less" color={t.sec} t={t} mt={8} />
          {showFlow && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 22 }}>
              {flow.map((it, i) => (
                <div key={i} style={{ position: "relative", paddingLeft: 28 }}>
                  {i < flow.length - 1 && (
                    <span aria-hidden="true" style={{ position: "absolute", left: 5, top: 16, bottom: -24, width: 2, background: accentSoft }} />
                  )}
                  <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 3, width: 12, height: 12, borderRadius: "50%", background: accent, border: `2px solid ${nodeRing}`, boxSizing: "border-box" }} />
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: t.mut, marginBottom: 7 }}>{it.l}</div>
                  <p style={{ fontSize: 14, lineHeight: 1.66, color: t.sec, margin: 0 }}>{it.v}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =================================================================== TC CARD
// The 4th metric card (dashed "execution context" variant): wrench rail, no
// score, the easier→harder slider showing the idea's raw build difficulty (base)
// and the profile-adjusted position, then 3 Q→A (how hard / how your profile
// changes it / simpler first version). Number stays hidden — the word carries it.
const TC_WORD_CAP = ["Very easy", "Easy", "Moderate", "Hard", "Very hard"];

export function DeepTcCard({ tc, t, wt, onWt }) {
  if (!tc) return null;
  const c = metricColor("technical_complexity", t);
  const bucket = (s) => (typeof s !== "number" || isNaN(s) ? 4 : s < 2 ? 0 : s < 4 ? 1 : s < 6 ? 2 : s < 8 ? 3 : 4);
  const word = TC_WORD_CAP[bucket(tc.score)];
  const base = typeof tc.base_score === "number" ? tc.base_score : tc.score;
  const net = typeof tc.score === "number" ? tc.score : base;
  const baseW = Math.max(0, Math.min(10, base)) / 10 * 232;
  const netW = Math.max(0, Math.min(10, net)) / 10 * 232;
  const track = t.mode === "light" ? "rgba(80,75,65,0.12)" : "rgba(255,255,255,0.08)";

  const qa = [
    { q: "How hard is this idea to build?", v: tc.base_score_explanation },
    { q: "How does your profile change that?", v: tc.adjustment_explanation },
    { q: "Is there a simpler first version?", v: tc.incremental_note },
  ].filter((x) => dmHas(x.v));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "228px 1fr", border: `1px dashed ${t.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 14, background: "transparent" }}>
      <div style={{ padding: "24px 22px", borderRight: `1px dashed ${t.border}`, display: "flex", flexDirection: "column", gap: 11, background: t.mode === "light" ? "rgba(80,75,65,0.012)" : "rgba(255,255,255,0.012)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", background: t.surfAlt, border: `1px solid ${t.border}`, color: pick(OVERALL_RING, t) }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.5-.5-.5-2.5z" /></svg>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>Technical Complexity<ChangeMarker bundle={wt && wt.technical_complexity} onOpen={onWt} title="Technical Complexity re-read" /></div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.sec, background: t.surfAlt, border: `1px solid ${t.border}`, borderRadius: 7, padding: "3px 9px", alignSelf: "flex-start" }}>Execution context</div>
        <div style={{ fontSize: 11, color: t.mut, marginTop: -4 }}>not in overall score</div>
        <div style={{ marginTop: "auto", paddingTop: 12 }}>
          <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: c, opacity: 0.62 }}>Build difficulty</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, margin: "3px 0 9px", color: t.sec }}>{word}</div>
          <svg width="100%" viewBox="0 0 240 50" fill="none" style={{ maxWidth: 188, display: "block" }}>
            <rect x="4" y="20" width="232" height="8" rx="4" fill={track} />
            <rect x="4" y="20" width={baseW.toFixed(1)} height="8" rx="4" fill={`${c}66`} />
            <rect x="4" y="20" width={netW.toFixed(1)} height="8" rx="4" fill={c} style={{ filter: `drop-shadow(0 0 6px ${c}88)` }} />
            <circle cx={(4 + baseW).toFixed(1)} cy="24" r="5" fill={t.bg || "#0a0b0f"} stroke={c} strokeWidth="2" />
            <circle cx={(4 + netW).toFixed(1)} cy="24" r="4.5" fill={c} />
            <text x="4" y="44" fill={t.mut} fontSize="9">easier</text>
            <text x="236" y="44" textAnchor="end" fill={t.mut} fontSize="9">harder</text>
          </svg>
        </div>
      </div>
      <div style={{ padding: "24px 28px" }}>
        {qa.length > 0 ? qa.map((x, i) => (
          <div key={i} style={{ marginBottom: i === qa.length - 1 ? 0 : 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={`${c}B0`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              <b style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>{x.q}</b>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.62, color: t.sec, margin: 0 }}>{x.v}</p>
          </div>
        )) : (
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: t.sec, margin: 0 }}>{tc.explanation}</p>
        )}
        <div style={{ marginTop: 20, paddingTop: 15, borderTop: `1px solid ${t.divider}`, fontSize: 11.5, color: t.mut }}>Measured from the idea and your founder profile · not part of the overall score</div>
      </div>
    </div>
  );
}

// =================================================================== KEY RISKS
// 3-slot timeline (Market & category / Trust & adoption / Founder fit), driven by
// failure_risks[].slot. Unknown/sloted-less risks fall to a generic node so older
// saved analyses still render.
const RISK_ICONS = {
  market_category: (<g><rect x="3" y="8" width="7" height="12" rx="1" /><rect x="13" y="4" width="8" height="16" rx="1" /><line x1="5.5" y1="12" x2="7.5" y2="12" /><line x1="16" y1="8" x2="18" y2="8" /></g>),
  trust_adoption: (<g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="3.5" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.5" /></g>),
  founder_fit: (<g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></g>),
  _default: (<g><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>),
};
const RISK_META = {
  market_category: { title: "Market & category", sub: "what the market does to this" },
  trust_adoption: { title: "Trust & adoption", sub: "what buyers do" },
  founder_fit: { title: "Founder fit", sub: "what your profile makes harder" },
};
const RISK_ORDER = ["market_category", "trust_adoption", "founder_fit"];

function RiskRow({ r, isLast, t, marker }) {
  const red = "#ef6f6c";
  const meta = RISK_META[r.slot];
  const [open, setOpen] = React.useState(false);
  const longText = (r.text || "").length > 150;
  const clamp = longText && !open ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {};
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: `${red}1A`, border: `1px solid ${red}38`, color: red, flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{RISK_ICONS[r.slot] || RISK_ICONS._default}</svg>
        </div>
        {!isLast && <div style={{ width: 2, background: `${red}40`, flex: 1, minHeight: 14, margin: "7px 0", borderRadius: 2 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: red, display: "flex", alignItems: "center", gap: 8 }}>{meta ? meta.title : "Risk"}{marker || null}</div>
        {meta && <div style={{ fontSize: 12, color: t.mut, marginBottom: 7 }}>{meta.sub}</div>}
        <p style={{ fontSize: 14, lineHeight: 1.62, color: t.sec, margin: meta ? "0" : "5px 0 0", ...clamp }}>{r.text}</p>
        {longText && <MoreToggle open={open} onClick={() => setOpen(!open)} closed="Show more" opened="Show less" color={`${red}C8`} t={t} mt={6} />}
      </div>
    </div>
  );
}

export function KeyRisks({ risks, t, wt, onWt }) {
  if (!Array.isArray(risks) || risks.length === 0) return null;
  const red = "#ef6f6c";
  const norm = risks.map((r) => (typeof r === "string" ? { slot: null, text: r } : { slot: r && r.slot, text: r && r.text })).filter((r) => dmHas(r.text));
  if (norm.length === 0) return null;
  // canonical order first, then any extras
  const known = RISK_ORDER.map((s) => norm.find((r) => r.slot === s)).filter(Boolean);
  const extras = norm.filter((r) => !RISK_ORDER.includes(r.slot));
  const items = [...known, ...extras];

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 18, padding: "30px 34px", background: t.mode === "light" ? t.surface : "rgba(255,255,255,0.018)" }}>
      {(() => {
        const rbundle = wt && wt.risks;
        let markIdx = -1;
        if (rbundle) {
          const ms = rbundle.changedSlot || (Array.isArray(rbundle.changedSlots) && rbundle.changedSlots[0]) || rbundle.slot || null;
          markIdx = ms != null ? items.findIndex((r) => r.slot === ms) : 0;
          if (markIdx < 0) markIdx = 0;
        }
        return items.map((r, i) => (
          <RiskRow key={i} r={r} isLast={i === items.length - 1} t={t}
            marker={rbundle && i === markIdx ? <ChangeMarker bundle={rbundle} onOpen={onWt} title="A risk re-weighed" /> : null} />
        ));
      })()}
    </div>
  );
}

// =============================================================== COMPETITOR GRID
// Grouped tile grid (Direct & adjacent / Substitutes) with favicon logos (from the
// competitor URL domain, letter fallback on error) and favicon source chips. The
// crisp one-liner ("Owns checkout, but…") now comes from comp.take (Stage 1); falls
// back to weaknesses, then a truncated description, for older saved evals.
const SOURCE_META = {
  github: { label: "GitHub", domain: "github.com", color: "#b6bac6" },
  tavily: { label: "Tavily", domain: "tavily.com", color: "#4fd1b5" },
  exa: { label: "Exa", domain: "exa.ai", color: "#a78bfa" },
  google: { label: "Google", domain: "google.com", color: "#6b9cf0" },
  llm: { label: "AI", domain: null, color: "#9698a6" },
};
const CTYPE = {
  direct: { label: "Direct", color: "#ef6f6c" },
  adjacent: { label: "Adjacent", color: "#e8a13c" },
  substitute: { label: "Substitute", color: "#4bb4d8" },
  internal_build: { label: "Internal Build", color: "#b6bac6" },
};
const STATUS_COLOR = { growing: "#46c79a", active: "#4bb4d8", acquired: "#e8a13c", failed: "#ef6f6c", shutdown: "#ef6f6c" };
const domainOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return null; } };

function FaviconLogo({ url, name, type, t, size = 34 }) {
  const [err, setErr] = React.useState(false);
  const domain = domainOf(url);
  const letter = ((name || "?").trim().charAt(0) || "?").toUpperCase();
  const tc = (CTYPE[type] && CTYPE[type].color) || t.sec;
  const inner = Math.round(size * 0.62);
  if (!domain || err) {
    return <span style={{ width: size, height: size, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.44), fontWeight: 600, background: `${tc}24`, color: tc, flexShrink: 0 }}>{letter}</span>;
  }
  return (
    <span style={{ width: size, height: size, borderRadius: 9, background: "#eef0f4", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      <img src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`} alt="" width={inner} height={inner} style={{ display: "block" }} onError={() => setErr(true)} />
    </span>
  );
}

function Chip({ color, t, children, withImg }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 6, color, background: `${color}1F`, border: `1px solid ${color}3D`, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{children}</span>;
}

function CompetitorTile({ comp, t }) {
  const ty = CTYPE[comp.competitor_type];
  const sm = SOURCE_META[comp.source];
  const stColor = STATUS_COLOR[comp.status] || "#4bb4d8";
  const oneLiner = dmHas(comp.take) ? comp.take : dmHas(comp.weaknesses) ? comp.weaknesses : comp.description;
  return (
    <div style={{ background: t.mode === "light" ? t.surface : "rgba(255,255,255,0.022)", border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <FaviconLogo url={comp.url} name={comp.name} type={comp.competitor_type} t={t} size={28} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: t.text, wordBreak: "break-word" }}>{comp.name}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {ty && <Chip color={ty.color} t={t}>{ty.label}</Chip>}
        {sm && (
          <Chip color={sm.color} t={t}>
            {sm.domain && <img src={`https://www.google.com/s2/favicons?sz=64&domain=${sm.domain}`} alt="" width="11" height="11" style={{ borderRadius: 3, display: "block" }} />}
            {sm.label}
          </Chip>
        )}
        {comp.status && <Chip color={stColor} t={t}>{comp.status}</Chip>}
      </div>
      {dmHas(oneLiner) && (
        <div style={{ fontSize: 12, color: t.sec, lineHeight: 1.5, flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{oneLiner}</div>
      )}
      {comp.url && (
        <div style={{ display: "flex", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${t.divider}` }}>
          <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: t.link, textDecoration: "none", marginLeft: "auto" }}>Visit →</a>
        </div>
      )}
    </div>
  );
}

export function CompetitorGrid({ competitors, t }) {
  if (!Array.isArray(competitors) || competitors.length === 0) return null;
  const directAdj = competitors.filter((c) => c.competitor_type === "direct" || c.competitor_type === "adjacent");
  const subs = competitors.filter((c) => c.competitor_type === "substitute" || c.competitor_type === "internal_build");
  const other = competitors.filter((c) => !["direct", "adjacent", "substitute", "internal_build"].includes(c.competitor_type));
  const grid = (list) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
      {list.map((c, i) => <CompetitorTile key={i} comp={c} t={t} />)}
    </div>
  );
  const groupHd = (icon, title, n) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "28px 0 14px" }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{title}</span>
      <span style={{ fontSize: 12, color: t.mut }}>{n}</span>
    </div>
  );
  const subsAll = [...subs, ...other];
  // if no type info at all, render one flat grid
  if (directAdj.length === 0 && subsAll.length === 0) return grid(competitors);
  return (
    <>
      {directAdj.length > 0 && (<>{groupHd("⚔️", "Direct & adjacent", directAdj.length)}{grid(directAdj)}</>)}
      {subsAll.length > 0 && (<>{groupHd("🔄", "Substitutes", subsAll.length)}{grid(subsAll)}</>)}
    </>
  );
}