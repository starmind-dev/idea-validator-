"use client";
import { useState } from "react";

// ============================================================================
// MetaPills — a rail-style eyebrow label + a row of quiet chips.
// Caption   — one muted line; centered by default, mono variant for terse strips.
//
//   <MetaPills t={t} label="What separated them" items={axes} />
//   <Caption t={t}>This weighs the two on the evidence above…</Caption>
//   <Caption t={t} mono>EXPLORE — WIDENS A ROUGH IDEA · NO VERDICT</Caption>
// ============================================================================

function Chip({ children, t }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: 13,
        color: hover ? t.text : t.sec,
        background: t.surfAlt || t.surface,
        border: `1px solid ${hover ? (t.borderStrong || "rgba(255,255,255,0.15)") : t.border}`,
        borderRadius: 100, padding: "5px 14px",
        transition: "border-color .15s, color .15s",
      }}
    >
      {children}
    </span>
  );
}

export function MetaPills({ label, items = [], t, style }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, ...style }}>
      {label && (
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut, marginRight: 3 }}>
          {label}
        </span>
      )}
      {items.map((it, i) => <Chip key={i} t={t}>{it}</Chip>)}
    </div>
  );
}

export function Caption({ children, t, align = "center", mono = false, style }) {
  return (
    <p
      style={{
        fontSize: mono ? 11 : 12.5,
        color: t.mut,
        textAlign: align,
        lineHeight: 1.6,
        maxWidth: align === "center" ? 560 : "none",
        margin: align === "center" ? "16px auto 0" : "16px 0 0",
        fontFamily: mono ? "ui-monospace, Menlo, monospace" : "inherit",
        letterSpacing: mono ? "0.04em" : "normal",
        ...style,
      }}
    >
      {children}
    </p>
  );
}