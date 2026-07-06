"use client";

// ============================================================================
// DirectionCard — the single source of truth for every forward action.
//
// One card shell, swapped per mode via `skin`. Greyscale-identical everywhere;
// the accent color carries the mode (explore = Dawn blue, deep/re-eval = violet,
// cta = bright violet for the handoff, save = pewter, amber = standalone,
// green = set-as-main). Mode glyphs are the app's REAL marks (compass = explore,
// concentric target = deep, refresh = re-eval, doc-handoff = brief) pulled from
// LineageView's Glyph component, so a direction that points to Explore wears the
// same compass shown on every hub card.
//
// Usage:
//   <DirectionCard skin="deep" glyph="save" title="Save as branch"
//     desc="..." cue="Keep" onClick={fn} disabled={saving} />
//   <DirectionRow cols={2}>...</DirectionRow>
// ============================================================================

import { useState } from "react";

// ── Skins ───────────────────────────────────────────────────────────────────
const SKIN = {
  explore: { ac: "#7aa2ff", on: "#d2e0ff", line: "rgba(122,162,255,0.5)",  bg: "rgba(122,162,255,0.12)", bghi: "rgba(122,162,255,0.18)", glow: "rgba(122,162,255,0.30)" },
  deep:    { ac: "#9a8fd8", on: "#cbc3ee", line: "rgba(138,130,194,0.55)", bg: "rgba(138,130,194,0.14)", bghi: "rgba(138,130,194,0.21)", glow: "rgba(138,130,194,0.34)" },
  cta:     { ac: "#a78bfa", on: "#d7cffb", line: "rgba(124,92,255,0.5)",   bg: "rgba(124,92,255,0.14)", bghi: "rgba(124,92,255,0.20)", glow: "rgba(124,92,255,0.34)" },
  save:    { ac: "#aab4c3", on: "#e9eef5", line: "rgba(255,255,255,0.16)",  bg: "rgba(255,255,255,0.05)", bghi: "rgba(255,255,255,0.075)", glow: "rgba(0,0,0,0.34)" },
  amber:   { ac: "#fbbf24", on: "#fde9bf", line: "rgba(245,158,11,0.34)",   bg: "rgba(245,158,11,0.08)", bghi: "rgba(245,158,11,0.12)", glow: "rgba(245,158,11,0.22)" },
  green:   { ac: "#34d399", on: "#bff3df", line: "rgba(16,185,129,0.34)",   bg: "rgba(16,185,129,0.08)", bghi: "rgba(16,185,129,0.12)", glow: "rgba(16,185,129,0.22)" },
};

// ── Glyphs ───────────────────────────────────────────────────────────────────
// explore / deep / refresh are the REAL app marks (LineageView Glyph + RefreshIcon).
// brief / save / standalone / main / discard / check are the semantic action marks.
function Glyph({ name, size = 16 }) {
  const base = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", style: { display: "block" } };
  switch (name) {
    case "explore":
      return (<svg {...base} strokeWidth="2" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" stroke="none" /></svg>);
    case "deep":
      return (<svg {...base} strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>);
    case "refresh":
      return (<svg {...base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>);
    case "brief":
      return (<svg {...base} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="8.5" height="16" rx="1.6" /><path d="M11.5 12h8M16 8.5l3.5 3.5-3.5 3.5" /></svg>);
    case "save":
      return (<svg {...base} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.9" /><circle cx="6" cy="19" r="1.9" /><circle cx="18" cy="19" r="1.9" /><path d="M12 6.9v4.6M6 17.1v-3a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 14.1v3" /></svg>);
    case "standalone":
      return (<svg {...base} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 6H6a1.6 1.6 0 0 0-1.6 1.6V18A1.6 1.6 0 0 0 6 19.6h11A1.6 1.6 0 0 0 18.6 18v-4" /><path d="M14 4.4h5.6V10M19.6 4.4 11.4 12.6" /></svg>);
    case "main":
      return (<svg {...base} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V8M6 13l6-6 6 6M5 4h14" /></svg>);
    case "discard":
      return (<svg {...base} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6 18 18M18 6 6 18" /></svg>);
    case "check":
      return (<svg {...base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>);
    default:
      return null;
  }
}

function Arrow({ size = 13 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function DirectionCard({
  skin = "deep", glyph, title, desc, cue, arrow = true,
  done = false, compact = false, disabled = false, busy = false,
  onClick, style,
}) {
  const [h, setH] = useState(false);
  const c = SKIN[skin] || SKIN.deep;
  const clickable = !disabled && !busy;
  const on = h && clickable;
  const pewter = skin === "save";

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={disabled || busy}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: "relative", textAlign: "left", fontFamily: "inherit", width: "100%",
        cursor: clickable ? "pointer" : (busy ? "default" : "not-allowed"),
        borderRadius: 13, padding: compact ? "12px 14px 10px" : "14px 16px 12px",
        minHeight: compact ? 78 : 104, display: "flex", flexDirection: "column",
        border: `1px solid ${done ? "rgba(255,255,255,0.09)" : (on ? c.ac : c.line)}`,
        background: done
          ? "rgba(255,255,255,0.025)"
          : `linear-gradient(180deg, ${on ? c.bghi : c.bg}, transparent 90%)`,
        boxShadow: on && !done ? `0 14px 36px ${c.glow}` : "none",
        transform: on && !done ? "translateY(-2px)" : "none",
        opacity: busy ? 0.7 : 1,
        transition: "transform .16s, border-color .16s, background .16s, box-shadow .16s",
        ...style,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: compact ? 7 : 9 }}>
        <span style={{
          width: 30, height: 30, flex: "0 0 30px", borderRadius: 8, display: "grid", placeItems: "center",
          color: c.ac, background: c.bg, border: `1px solid ${c.line}`,
          boxShadow: on ? `0 0 18px ${c.glow}` : "none", transition: ".16s",
        }}>
          <Glyph name={done ? "check" : glyph} size={16} />
        </span>
        <h4 style={{ fontSize: compact ? 14.5 : 15.5, fontWeight: 600, margin: 0, color: pewter && !done ? "#e9eef5" : c.on }}>{title}</h4>
      </div>
      {desc && !compact && (
        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "#8b94a1", margin: "0 0 auto" }}>{desc}</p>
      )}
      {cue && (
        <span style={{
          display: "flex", alignItems: "center", gap: 7, marginTop: compact ? 8 : 11,
          fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
          color: pewter && !done ? "#646d79" : c.ac,
        }}>
          {busy ? "…" : cue}
          {arrow && !busy && (
            <span style={{ display: "inline-flex", transform: on ? "translateX(3px)" : "none", transition: "transform .18s" }}><Arrow /></span>
          )}
        </span>
      )}
    </button>
  );
}

// ── Row wrapper ──────────────────────────────────────────────────────────────
export function DirectionRow({ cols = 3, gap = 14, children, style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, ...style }}>{children}</div>
  );
}