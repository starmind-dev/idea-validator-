"use client";
import { useState } from "react";

// ============================================================================
// FooterActions — one footer language for the end of a flow.
//
// One filled PrimaryAction, ghost FootLink pills for secondaries, wrapped in a
// FooterBar. Replaces the two mismatched systems (EvaluationView's full-width
// stacked buttons vs. ExecutionBriefView's centered pill row). The Evidence
// Watch dial keeps its own logic but adopts the FootLink look via its container.
//
//   <FooterBar t={t} align="center">
//     <PrimaryAction t={t} onClick={onBrief}>Generate Execution Brief →</PrimaryAction>
//     <FootLink t={t} onClick={onEvolve}>Evolve this idea</FootLink>
//     <FootLink t={t} onClick={onBack}>← Back to My Ideas</FootLink>
//   </FooterBar>
// ============================================================================

export function FootLink({ onClick, t, children, disabled = false, style }) {
  const [hover, setHover] = useState(false);
  const h = hover && !disabled;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: 13, fontFamily: "inherit",
        color: disabled ? t.mut : (h ? t.ctaText : t.sec),
        background: h ? t.ctaBg : "none",
        border: `1px solid ${h ? t.ctaBg : t.border}`,
        borderRadius: 10, padding: "9px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        transform: h ? "scale(1.03) translateY(-1px)" : "none",
        boxShadow: h ? "0 5px 14px rgba(124,58,237,0.42)" : "none",
        transition:
          "transform .34s cubic-bezier(.34,1.25,.64,1), box-shadow .3s ease, " +
          "background-color .25s, color .25s, border-color .25s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PrimaryAction({ onClick, t, children, disabled = false, full = false, style }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.boxShadow = "0 6px 18px rgba(124,58,237,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
      style={{
        fontSize: 14, fontWeight: 600,
        color: disabled ? t.mut : t.ctaText,
        background: disabled ? t.surfAlt : t.ctaBg,
        border: "none", borderRadius: 12, padding: "13px 26px",
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "box-shadow .2s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// A presentational shell that makes a stateful control (e.g. the Evidence Watch
// dial) match the FootLink pill. Wrap the control's trigger; keep its own logic.
export function MetaControl({ t, icon, label, value, onClick, children, style }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontSize: 12.5, color: t.sec,
        border: `1px solid ${hover ? (t.borderStrong || "rgba(255,255,255,0.15)") : t.border}`,
        borderRadius: 10, padding: "8px 13px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .15s",
        ...style,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
      {value != null && <span style={{ color: t.text, fontWeight: 600 }}>{value}</span>}
      {children}
    </div>
  );
}

export function FooterBar({ t, children, align = "center", topBorder = true, style }) {
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
        justifyContent: align === "left" ? "flex-start" : "center",
        borderTop: topBorder ? `1px solid ${t.divider}` : "none",
        paddingTop: topBorder ? 22 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}