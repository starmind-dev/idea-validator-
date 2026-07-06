"use client";
import { useState } from "react";

// ============================================================================
// BackLink — the one quiet back control, in the rail's language.
//
// A ghost hover-pill: chevron + label, muted by default, lifting to a faint
// wash + brighter text on hover. Replaces the four scattered dialects (bare
// 12px, mono, bordered pill, and the ad-hoc divider pair).
//
//   <BackLink t={t} onClick={goToMyIdeas}>Back to My Ideas</BackLink>
//
// Two-link case (re-eval entry) — same primitive twice with a hairline:
//   <span style={{ display: "inline-flex", alignItems: "center" }}>
//     <BackLink t={t} onClick={toLineage}>Go back to the lineage</BackLink>
//     <BackLinkDivider t={t} />
//     <BackLink t={t} onClick={toAnalysis} noChevron>View the analysis</BackLink>
//   </span>
//
// Props:
//   onClick    — fn
//   t          — theme token bag
//   children   — label
//   color      — optional base color override (e.g. the read-only "bright" tone)
//   noChevron  — drop the leading chevron (for the secondary of a pair)
//   flush      — cancel the pill's left padding so the chevron aligns to the
//                container's true left edge (use when it sits above a left-edge
//                header/content column); the hover wash then hangs slightly left
//   style      — extra style
// ============================================================================

export function BackLink({ onClick, t, children, color, noChevron = false, flush = false, style }) {
  const [hover, setHover] = useState(false);
  const base = color || t.sec;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "6px 11px", borderRadius: 8,
        fontSize: 13, fontFamily: "inherit",
        color: hover ? t.text : base,
        background: hover ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none", cursor: "pointer",
        transition: "background 0.13s, color 0.13s",
        ...(flush ? { marginLeft: -11 } : null),
        ...style,
      }}
    >
      {!noChevron && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  );
}

export function BackLinkDivider({ t }) {
  return <span style={{ width: 1, height: 12, background: t.border, margin: "0 4px", display: "inline-block", verticalAlign: "middle" }} />;
}