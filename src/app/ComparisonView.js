"use client";

import { useState, useEffect, useRef } from "react";
import { getMainBottleneckColor, MainBottleneckIcon, getScoreColor } from "./components";
import { DeepMetricCard, DeepTcCard, KeyRisks, ExecutionReality, CompetitorGrid } from "./DeepResultParts";
import { ModeTitle } from "./ModeTitle";
import { BackLink } from "./BackLink";
import { MetaPills, Caption } from "./MetaPills";

/*
  Deep × Deep Compare — full rewrite.

  Replaces the old 6-tab tradeoffs view. Compare is Deep×Deep ONLY; both ideas
  are guaranteed to carry analysis.evaluation (the page.js selection guard makes
  that true), so there is no explore branch anywhere in here.

  Structure: an 8-screen pager —
    market_demand · monetization · originality · technical_complexity ·
    competition ("How your idea compares") · risks · execution_reality · closure

  Each of the 7 section screens shows BOTH ideas' full redesigned Deep surface
  side by side (the real DeepMetricCard / DeepTcCard / CompetitorGrid / KeyRisks /
  ExecutionReality components), bridged by a CompareConnector: a node that sits ON
  the seam between the two columns, carrying the separation glyph + lean, with the
  cross-section "read" surfacing as a floating pop-up tethered down to the node.

  The two columns render immediately from the analyses. The connector reads stream
  in when /api/compare/comparison resolves — the node shows a loading state until
  then, never blank. If comparison comes back null, the sections still show side by
  side and the connectors quietly say the read is unavailable.
*/

const NOOP = () => {};

const SECTION_KEYS = [
  "market_demand",
  "monetization",
  "originality",
  "technical_complexity",
  "competition",
  "risks",
  "execution_reality",
];

const ACCENT = {
  market_demand: "#3fc09a",
  monetization: "#6f8ff5",
  originality: "#b57ce0",
  technical_complexity: "#d9a85e",
  competition: "#6b9cf0",
  risks: "#ef6f6c",
  execution_reality: "#7e8aa8",
  closure: "#8b8fe0",
};

const A_DOT = "#6b9cf0";
const B_DOT = "#b57ce0";

const ICONS = {
  market_demand: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
  ),
  monetization: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
  ),
  originality: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
  ),
  technical_complexity: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
  ),
  competition: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
  ),
  risks: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  execution_reality: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  closure: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
  ),
  compare: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /></svg>
  ),
};

const SCREENS = [
  { key: "market_demand", label: "Market demand", subtitle: "What demand case each is, and what stands between it and adoption" },
  { key: "monetization", label: "Monetization", subtitle: "What each payment case rests on, and the wall to durable capture" },
  { key: "originality", label: "Originality", subtitle: "What protects each one — and what it is exposed to" },
  { key: "technical_complexity", label: "Technical complexity", subtitle: "The build effort each one asks of this founder" },
  { key: "competition", label: "How your idea compares", subtitle: "Where each one overlaps the field, wins, and is exposed" },
  { key: "risks", label: "Key risks", subtitle: "How each one dies, by where the threat comes from" },
  { key: "execution_reality", label: "Execution reality", subtitle: "The first wall each must clear, and what it implies" },
  { key: "closure", label: "Closure", subtitle: "What the seven reads add up to" },
];

/* ---------- separation glyph + lean phrasing ---------- */

function SeparationGlyph({ separation, leans, accent }) {
  if (separation === "winner") {
    const d = leans === "b" ? "M3 3 L9 8 L3 13" : "M11 3 L5 8 L11 13";
    return (
      <svg width="15" height="17" viewBox="0 0 14 16" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    );
  }
  if (separation === "tradeoff") {
    return (
      <svg width="19" height="17" viewBox="0 0 18 16" fill="none" stroke={accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4 L3 8 L7 12" /><path d="M11 4 L15 8 L11 12" /></svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke={accent} strokeWidth="2.1" strokeLinecap="round"><path d="M3 8 H13" /></svg>
  );
}

function leanShort(section) {
  if (!section) return "";
  if (section.separation === "winner") return "leans";
  if (section.separation === "tradeoff") return "tradeoff";
  return "even";
}

function leanLabel(section, nameA, nameB) {
  if (!section) return "";
  if (section.separation === "winner") return `Leans ${section.leans === "a" ? nameA : nameB}`;
  if (section.separation === "tradeoff") return "Two bets — a tradeoff";
  return "Even — recedes";
}

/* ---------- the connector: floating tethered pop-up + sticky seam node ---------- */

function PopHolder({ open, onClose, onReopen, section, accent, nameA, nameB, loading, t }) {
  const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
  const lean = leanLabel(section, nameA, nameB);
  const isWinner = section && section.separation === "winner";

  if (!open) {
    return (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={onReopen}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: accent, background: tint(9), border: `1px solid color-mix(in srgb, ${accent} 28%, ${t.border})`, borderRadius: 100, padding: "7px 15px", cursor: "pointer" }}
        >
          {ICONS.compare}
          <span>Reading across{lean ? ` — ${lean}` : ""}</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        className="cmpPop"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 860,
          borderRadius: 16,
          padding: "15px 22px 17px",
          background: `color-mix(in srgb, ${t.surface} 86%, transparent)`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid color-mix(in srgb, ${accent} 32%, ${t.border})`,
          boxShadow: `0 18px 50px rgba(0,0,0,0.5), 0 0 40px ${tint(13)}`,
          zIndex: 7,
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderRadius: 3, background: `linear-gradient(180deg, ${accent}, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: accent, background: tint(12) }}>{ICONS.compare}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: t.mut }}>Reading across</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: isWinner ? accent : t.text }}>{loading ? "Weighing the two sides…" : lean || "—"}</span>
          </span>
          <span style={{ marginLeft: "auto", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: t.mut }}>the walkthrough</span>
          {!loading && (
            <button onClick={onClose} aria-label="Collapse" style={{ marginLeft: 10, cursor: "pointer", color: t.mut, background: "none", border: "none", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>×</button>
          )}
        </div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 2 }}>
            <span style={{ height: 9, borderRadius: 5, width: "92%", background: t.barBg || t.border, opacity: 0.6 }} />
            <span style={{ height: 9, borderRadius: 5, width: "78%", background: t.barBg || t.border, opacity: 0.45 }} />
          </div>
        ) : section ? (
          <p style={{ fontSize: 13.5, color: t.sec, lineHeight: 1.72, margin: 0 }}>{section.read}</p>
        ) : (
          <p style={{ fontSize: 12.5, color: t.mut, lineHeight: 1.6, margin: 0 }}>The cross-read for this section is unavailable — the two sides are shown below for direct comparison.</p>
        )}
      </div>

      <svg width="40" height="26" viewBox="0 0 40 26" style={{ display: "block", margin: "-1px auto 0", zIndex: 5 }}>
        <path d="M20 0 C20 12, 20 14, 20 26" stroke={accent} strokeWidth="1.4" fill="none" strokeDasharray="2 3" opacity="0.8" />
        <circle cx="20" cy="25" r="2.4" fill={accent} />
      </svg>
    </div>
  );
}

function SeamNode({ open, onToggle, section, accent, nameA, nameB, loading, t }) {
  const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
  const lean = leanLabel(section, nameA, nameB);
  const isWinner = section && section.separation === "winner";

  const face = loading ? (
    <span style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${tint(28)}`, borderTopColor: accent, borderRadius: "50%", animation: "cmpSpin 0.8s linear infinite" }} />
  ) : section ? (
    <SeparationGlyph separation={section.separation} leans={section.leans} accent={accent} />
  ) : (
    <span style={{ color: t.mut, fontSize: 15, fontWeight: 700 }}>·</span>
  );

  return (
    <div
      className="cmpNode"
      onClick={onToggle}
      title="Reading across"
      style={{
        position: "relative",
        width: 54,
        height: 54,
        margin: "0 auto",
        borderRadius: 16,
        cursor: "pointer",
        background: t.surfAlt || t.surface,
        border: `1px solid color-mix(in srgb, ${accent} 40%, ${t.border})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 0 6px ${t.bg || "#0a0d13"}, 0 8px 30px rgba(0,0,0,0.5), 0 0 22px ${tint(30)}`,
        zIndex: 8,
      }}
    >
      {!loading && section && (
        <span style={{ position: "absolute", inset: -1, borderRadius: 16, border: `1px solid ${tint(50)}`, animation: "cmpPulse 2.4s ease-out infinite", pointerEvents: "none" }} />
      )}
      {face}
      <span style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: isWinner ? accent : t.mut, fontWeight: isWinner ? 700 : 400 }}>
        {loading ? "reading…" : leanShort(section)}
      </span>
    </div>
  );
}

/* ---------- closure: the synthesis no single section can give ---------- */

const SHAPE_LABEL = {
  convergent: "Both point the same way",
  tilted: "Tilts toward one",
  tradeoff: "A genuine tradeoff",
  shared_fate: "A shared wall",
  tiebreaker: "Down to a single axis",
};

const AXIS_SHORT = {
  market_demand: "Market demand",
  monetization: "Monetization",
  originality: "Originality",
  technical_complexity: "Technical complexity",
  competition: "How they compare",
  risks: "Key risks",
  execution_reality: "Execution reality",
};

// Break the closure's single text blob into breathing paragraphs: split on sentence
// boundaries (lookahead only, so decimals like 6.5 stay intact), then group sentences
// into ~170-char paragraphs so each stanza is a readable chunk rather than one slab.
function splitParagraphs(text) {
  if (!text) return [];
  const sents = text
    .replace(/([.!?])\s+(?=[A-Z"'(])/g, "$1\u0001")
    .split("\u0001")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  let buf = "";
  for (const s of sents) {
    buf = buf ? buf + " " + s : s;
    if (buf.length >= 170) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out.length ? out : [text];
}

// The needle tracks the two overall scores — the convergent Deep verdict. The
// closure's narrative tilt is a prose point (it lives in the beats), so the
// needle can never contradict the scores. (Earlier it was derived from section-
// lean counts across decisive_axes, which let non-scored founder axes drag the
// needle toward the LOWER-scored idea — the meter pointed the wrong way.)
function deriveLean(scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!isFinite(a) || !isFinite(b)) return { dir: null, pos: 50 };
  const gap = b - a; // positive → leans B (needle moves right)
  const dir = gap > 0.05 ? "b" : gap < -0.05 ? "a" : null;
  const pos = Math.max(12, Math.min(88, 50 + gap * 15));
  return { dir, pos };
}

const SHAPE_QUALIFIER = {
  convergent: "a clear call",
  tilted: "not conclusive",
  tradeoff: "a real tradeoff",
  shared_fate: "the wall comes first",
  tiebreaker: "a narrow tiebreak",
};

function CompareClosure({ closure, nameA, nameB, scoreA, scoreB, sections, loading, t }) {
  const accent = ACCENT.closure;
  const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "70px 20px" }}>
        <span style={{ display: "inline-block", width: 30, height: 30, border: `2.5px solid ${tint(22)}`, borderTopColor: accent, borderRadius: "50%", animation: "cmpSpin 0.8s linear infinite", marginBottom: 16 }} />
        <p style={{ fontSize: 14, color: t.mut, margin: 0 }}>Weighing the seven reads together…</p>
      </div>
    );
  }

  if (!closure) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px", maxWidth: 620, margin: "0 auto" }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: t.mut, background: t.surfAlt || t.surface, border: `1px solid ${t.border}` }}>{ICONS.closure}</div>
        <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0 }}>The closing synthesis is unavailable for this pair. Each section above stands on its own — read the connectors to see where the two separate.</p>
      </div>
    );
  }

  const axes = (closure.decisive_axes || []).map((k) => AXIS_SHORT[k] || k);
  const beats =
    Array.isArray(closure.beats) && closure.beats.length
      ? closure.beats.filter((b) => b && b.text)
      : splitParagraphs(closure.text).map((text) => ({ text }));

  const { dir, pos } = deriveLean(scoreA, scoreB);
  const leanName = dir === "a" ? nameA : dir === "b" ? nameB : null;
  const qual = SHAPE_QUALIFIER[closure.decision_shape] || "close";
  const sA = Number(scoreA || 0).toFixed(1);
  const sB = Number(scoreB || 0).toFixed(1);
  const wall = closure.shared_wall
    ? (() => {
        let s = closure.shared_wall.charAt(0).toUpperCase() + closure.shared_wall.slice(1);
        return /[.!?]$/.test(s) ? s : s + ".";
      })()
    : null;

  const COLS = "minmax(0, 340px) minmax(0, 1fr)";
  const GAP = 72;
  const hair = `1px solid ${t.border}`;
  const eyebrow = { fontSize: 12.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: accent, lineHeight: 1.4 };
  const nameCap = { fontSize: 12.5, color: t.sec, whiteSpace: "nowrap", display: "inline-flex", alignItems: "baseline", gap: 5, maxWidth: 170, overflow: "hidden" };
  const warnIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* header: icon + Closure + lean meter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: accent, background: tint(11), border: `1px solid ${tint(22)}` }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          </span>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 28, lineHeight: 1.1, margin: 0, color: t.text, letterSpacing: "-0.015em" }}>Closure</h2>
            <p style={{ fontSize: 14, color: t.mut, margin: "3px 0 0" }}>What the seven reads add up to</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "0 1 440px", minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, width: "100%" }}>
            <span style={nameCap}><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{nameA}</span><span style={{ color: t.text, fontWeight: 600 }}>{sA}</span></span>
            <div style={{ position: "relative", flex: 1, height: 16 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 7, height: 2.5, borderRadius: 2, background: `linear-gradient(90deg, ${A_DOT}, ${B_DOT})`, opacity: 0.7 }} />
              <div style={{ position: "absolute", left: "50%", top: 3.5, width: 1, height: 9, background: t.mut, opacity: 0.55, transform: "translateX(-50%)" }} />
              <div style={{ position: "absolute", left: `${pos}%`, top: 1, width: 14, height: 14, borderRadius: "50%", border: `2px solid ${accent}`, background: t.surface, transform: "translateX(-50%)", boxShadow: `0 0 9px ${tint(45)}` }} />
            </div>
            <span style={{ ...nameCap, justifyContent: "flex-end" }}><span style={{ color: t.text, fontWeight: 600 }}>{sB}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{nameB}</span></span>
          </div>
          <span style={{ fontSize: 13, color: t.mut }}>{leanName ? `Leans ${leanName} · ${qual}` : "Evenly matched"}</span>
        </div>
      </div>

      {/* the shared wall — both ideas meet it */}
      {wall && (
        <div style={{ display: "grid", gridTemplateColumns: COLS, columnGap: GAP, padding: "22px 0", borderBottom: hair }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <span style={{ color: accent, flex: "none", marginTop: 1, display: "inline-flex" }}>{warnIcon}</span>
            <span style={eyebrow}>Both meet the same wall</span>
          </div>
          <div style={{ fontSize: 17, color: t.text, lineHeight: 1.5 }}>{wall}</div>
        </div>
      )}

      {/* the numbered reads */}
      {beats.map((beat, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: COLS, columnGap: GAP, padding: "22px 0", borderBottom: hair }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: t.mut, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</div>
            {beat.marker && <div style={eyebrow}>{beat.marker}</div>}
          </div>
          <p style={{ fontSize: 16, color: t.sec, lineHeight: 1.6, margin: 0 }}>{beat.text}</p>
        </div>
      ))}

      {/* what separated them */}
      {axes.length > 0 && (
        <div style={{ padding: "22px 0 0" }}>
          <MetaPills t={t} label="What separated them" items={axes} />
        </div>
      )}

      <Caption t={t} style={{ marginTop: 30 }}>
        This weighs the two on the evidence above. The call is yours — pick the wall you'd rather spend the next year clearing.
      </Caption>
    </div>
  );
}

/* ---------- competition column: cp tri-split + competitor grid ---------- */

function CompetitionColumn({ analysis, t }) {
  const accent = ACCENT.competition;
  const ev = analysis.evaluation;
  const comps = (analysis.competition && analysis.competition.competitors) || [];
  const cp = ev && ev.competitive_position;
  const hasCp = cp && typeof cp === "object" && (cp.headline || cp.you_win || cp.overlap || cp.exposed);

  const cells = hasCp
    ? [
        { key: "overlap", label: "Overlap", color: t.mut, text: cp.overlap },
        { key: "you_win", label: "You win", color: "#34d399", text: cp.you_win },
        { key: "exposed", label: "Exposed", color: "#fbbf24", text: cp.exposed },
      ].filter((c) => c.text)
    : [];

  const cellIcon = (k) =>
    k === "you_win" ? (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    ) : k === "exposed" ? (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
    ) : (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="13" height="13" rx="2" /><rect x="8" y="8" width="13" height="13" rx="2" /></svg>
    );

  return (
    <div>
      {hasCp && (
        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 16, padding: "20px 22px 18px 24px", background: `linear-gradient(180deg, ${accent}14, ${accent}05)`, border: `1px solid ${accent}33` }}>
          <div style={{ position: "absolute", left: 0, top: 20, bottom: 20, width: 3, borderRadius: "0 3px 3px 0", background: accent, opacity: 0.6 }} />
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: accent, marginBottom: 12 }}>How your idea compares</div>
          {cp.headline && <h3 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.34, letterSpacing: "-0.01em", color: t.text, margin: "0 0 18px" }}>{cp.headline}</h3>}
          {cells.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: "0 18px", paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
              {cells.map((c) => (
                <div key={c.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, color: c.color }}>
                    {cellIcon(c.key)}
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.09em" }}>{c.label}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: t.sec, lineHeight: 1.55, margin: 0 }}>{c.text}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16, fontSize: 11.5, color: t.mut }}>
            <span>↓</span>
            <span>Drawn from the <strong style={{ color: t.sec, fontWeight: 600 }}>{comps.length} competitor{comps.length === 1 ? "" : "s"}</strong> below</span>
          </div>
        </div>
      )}
      <CompetitorGrid competitors={comps} t={t} />
    </div>
  );
}

/* ---------- one idea's column for a given section ---------- */

function IdeaTag({ side, name, t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: t.mut, marginBottom: 14 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: side === "a" ? A_DOT : B_DOT }} />
      {name}
    </div>
  );
}

function SectionColumn({ side, screenKey, analysis, name, t }) {
  const ev = analysis.evaluation;
  let body = null;

  if (screenKey === "market_demand") {
    body = (
      <DeepMetricCard
        metricKey="market_demand"
        metric={ev.market_demand}
        name="Market Demand"
        weightLabel="37.5% weight"
        notes={[ev.market_demand && ev.market_demand.geographic_note, ev.market_demand && ev.market_demand.trajectory_note]}
        competitors={analysis.competition && analysis.competition.competitors}
        t={t}
        wt={null}
        onWt={NOOP}
      />
    );
  } else if (screenKey === "monetization") {
    body = (
      <DeepMetricCard
        metricKey="monetization"
        metric={ev.monetization}
        name={(ev.monetization && ev.monetization.label) || "Monetization Potential"}
        weightLabel="31.25% weight"
        competitors={analysis.competition && analysis.competition.competitors}
        t={t}
        wt={null}
        onWt={NOOP}
      />
    );
  } else if (screenKey === "originality") {
    body = (
      <DeepMetricCard
        metricKey="originality"
        metric={ev.originality}
        name="Originality"
        weightLabel="31.25% weight"
        competitors={analysis.competition && analysis.competition.competitors}
        t={t}
        wt={null}
        onWt={NOOP}
      />
    );
  } else if (screenKey === "technical_complexity") {
    body = <DeepTcCard tc={ev.technical_complexity} t={t} wt={null} onWt={NOOP} />;
  } else if (screenKey === "competition") {
    body = <CompetitionColumn analysis={analysis} t={t} />;
  } else if (screenKey === "risks") {
    body = <KeyRisks risks={ev.failure_risks || []} t={t} wt={null} onWt={NOOP} />;
  } else if (screenKey === "execution_reality") {
    body = <ExecutionReality estimates={analysis.estimates} mbColorFn={getMainBottleneckColor} MbIcon={MainBottleneckIcon} t={t} wt={null} onWt={NOOP} />;
  }

  return body;
}

/* ---------- main view ---------- */

export default function ComparisonView({ ideaA, ideaB, onBack, authToken, t }) {
  const [cur, setCur] = useState(0);
  const [comparison, setComparison] = useState(null); // { sections, closure } | null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const nameA = ideaA.title || "Idea A";
  const nameB = ideaB.title || "Idea B";

  useEffect(() => {
    let alive = true;
    if (!authToken) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/compare/comparison", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            idea_a: { title: nameA, analysis: ideaA.analysis },
            idea_b: { title: nameB, analysis: ideaB.analysis },
          }),
        });
        if (!res.ok) {
          if (alive) setError(`request failed (${res.status})`);
          return;
        }
        const json = await res.json();
        if (alive) setComparison(json.comparison || null);
      } catch (e) {
        if (alive) setError(e && e.message ? e.message : "network error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const screen = SCREENS[cur];
  const isClosure = screen.key === "closure";
  const accent = ACCENT[screen.key];
  const tint = (pct) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;

  const sections = comparison && comparison.sections;
  const sectionRead = sections ? sections[screen.key] : null;

  const ovA = (ideaA.analysis.evaluation && (ideaA.analysis.evaluation.overall_score ?? ideaA.analysis.evaluation.weighted_overall)) || 0;
  const ovB = (ideaB.analysis.evaluation && (ideaB.analysis.evaluation.overall_score ?? ideaB.analysis.evaluation.weighted_overall)) || 0;

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 20px 80px" }}>
      <style>{`
        @keyframes cmpPulse { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.5); opacity: 0 } }
        @keyframes cmpSpin { to { transform: rotate(360deg) } }
        @keyframes cmpFade { from { opacity: 0; transform: translateY(8px) scale(.97) } to { opacity: 1; transform: none } }
        .cmpPop { animation: cmpFade .22s ease both; }
        .cmpNode:hover { transform: scale(1.06); }
        .cmpTab::-webkit-scrollbar { height: 0; }
      `}</style>

      <div style={{ padding: "10px 0 18px" }}>
        <BackLink t={t} onClick={onBack} flush>Back to My Ideas</BackLink>
      </div>

      <div style={{ marginBottom: 14 }}>
        <ModeTitle mode="compare" />
      </div>

      {/* idea strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: t.border, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {[{ n: nameA, ov: ovA, dot: A_DOT }, { n: nameB, ov: ovB, dot: B_DOT }].map((s, i) => (
          <div key={i} style={{ background: t.surface, padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: t.text }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot }} />{s.n}</span>
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 15, fontWeight: 700, color: getScoreColor(s.ov, t) }}>{Number(s.ov).toFixed(1)}</span>
          </div>
        ))}
      </div>

      {/* tab bar */}
      <div className="cmpTab" style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: `1px solid ${t.border}`, marginBottom: 22, paddingBottom: 0 }}>
        {SCREENS.map((s, i) => {
          const on = i === cur;
          const a = ACCENT[s.key];
          return (
            <button
              key={s.key}
              onClick={() => setCur(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                whiteSpace: "nowrap",
                fontSize: 12.5,
                fontWeight: on ? 600 : 500,
                color: on ? t.text : t.mut,
                background: "none",
                border: "none",
                borderBottom: on ? `2px solid ${a}` : "2px solid transparent",
                cursor: "pointer",
                padding: "10px 14px",
              }}
            >
              <span style={{ color: on ? a : t.mut, display: "flex" }}>{ICONS[s.key]}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#f87171", marginBottom: 16 }}>Cross-read unavailable: {error} — the sides are still shown for direct comparison.</div>
      )}

      {/* screen header — closure renders its own (with the lean meter) */}
      {!isClosure && (
        <div style={{ display: "flex", alignItems: "center", gap: 13, margin: "4px 2px 12px" }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: accent, background: tint(11) }}>{ICONS[screen.key]}</span>
          <div>
            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: t.text }}>{screen.label}</h2>
            <p style={{ fontSize: 12.5, color: t.mut, margin: "2px 0 0" }}>{screen.subtitle}</p>
          </div>
        </div>
      )}

      {isClosure ? (
        <CompareClosure closure={comparison && comparison.closure} nameA={nameA} nameB={nameB} scoreA={ovA} scoreB={ovB} sections={sections} loading={loading} t={t} />
      ) : (
        <div style={{ position: "relative" }}>
          {/* connector lives above + on the seam; the node is positioned by the stage below */}
          <div style={{ position: "relative", zIndex: 6 }}>
            <ConnectorStage
              screenKey={screen.key}
              section={sectionRead}
              accent={accent}
              nameA={nameA}
              nameB={nameB}
              loading={loading}
              t={t}
              left={<SectionColumn side="a" screenKey={screen.key} analysis={ideaA.analysis} name={nameA} t={t} />}
              right={<SectionColumn side="b" screenKey={screen.key} analysis={ideaB.analysis} name={nameB} t={t} />}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- stage: the two columns butted at a seam, with the connector node on it ---------- */

function ConnectorStage({ screenKey, section, accent, nameA, nameB, loading, t, left, right }) {
  const [open, setOpen] = useState(true);
  const winSide = section && section.separation === "winner" ? section.leans : null;
  const equalize = screenKey === "market_demand" || screenKey === "monetization" || screenKey === "originality";

  // soft wash on the leaning side — never a border (avoids the border/borderColor
  // shorthand clash, and the reused Deep components already carry their own chrome)
  const lift = (on) =>
    on ? { background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 7%, transparent), transparent 240px)` } : {};

  const column = (side, name, body) => (
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", borderRadius: 16, ...lift(winSide === side) }}>
      <IdeaTag side={side} name={name} t={t} />
      {equalize ? <div style={{ flex: 1, display: "grid" }}>{body}</div> : body}
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      {/* floating read, tethered down to the node */}
      <PopHolder open={open} onClose={() => setOpen(false)} onReopen={() => setOpen(true)} section={section} accent={accent} nameA={nameA} nameB={nameB} loading={loading} t={t} />

      {/* the node caps the seam and stays put at the top of the section — static, above the
          columns, so it never travels with the scroll or covers a card */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
        <SeamNode open={open} onToggle={() => setOpen((v) => !v)} section={section} accent={accent} nameA={nameA} nameB={nameB} loading={loading} t={t} />
      </div>

      {/* two ideas side by side; for metric surfaces the cards are equal-height so the
          bottom-pinned feature (DEMAND TYPE / CAPTURE CASE) lines up across both */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 56, alignItems: "stretch" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: t.divider || t.border, transform: "translateX(-50%)", pointerEvents: "none" }} />
        {column("a", nameA, left)}
        {column("b", nameB, right)}
      </div>
    </div>
  );
}