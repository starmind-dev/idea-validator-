"use client";

// ============================================================================
// ModeTitle — the one serious title lockup for the evaluation modes and their
// two siblings. A glyph chip (the app's canonical marks) + a tracked uppercase
// label. Identical wherever a screen names itself, so launch and landing read
// the same. Each family wears its own hue:
//
//   explore  ◎ compass    · Dawn blue
//   deep     ◉ target     · violet
//   evolve   ◆ diamond    · violet (brighter — the fifth stage of Deep)
//   compare  ⊗ circle-×   · periwinkle (ACCENT.closure #8b8fe0)
//
//   <ModeTitle mode="explore" />           ->  ◎ EXPLORE MODE
//   <ModeTitle mode="deep" />              ->  ◉ DEEP ANALYSIS
//   <ModeTitle mode="evolve" />            ->  ◆ EVOLVE   (pass label="Evolve · Deep")
//   <ModeTitle mode="compare" />           ->  ⊗ COMPARE · DEEP × DEEP
//
// Pass `label` to override the text (e.g. a compact "Compare" on narrow rails);
// the glyph + hue stay tied to `mode`.
// ============================================================================

const MODES = {
  explore: { ac: "#7aa2ff", on: "#d2e0ff", line: "rgba(122,162,255,0.5)",  bg: "rgba(122,162,255,0.12)", label: "Explore Mode" },
  deep:    { ac: "#9a8fd8", on: "#cbc3ee", line: "rgba(138,130,194,0.55)", bg: "rgba(138,130,194,0.14)", label: "Deep Analysis" },
  evolve:  { ac: "#b3a7f0", on: "#d7d0f2", line: "rgba(160,150,230,0.55)", bg: "rgba(160,150,230,0.15)", label: "Evolve" },
  compare: { ac: "#8b8fe0", on: "#d3d5f5", line: "rgba(139,143,224,0.5)",  bg: "rgba(139,143,224,0.13)", label: "Compare · Deep × Deep" },
};

function ModeGlyph({ mode, size = 17 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", style: { display: "block" } };
  if (mode === "deep")
    return (<svg {...p} strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>);
  if (mode === "evolve")
    return (<svg {...p} strokeWidth="2" strokeLinejoin="round"><path d="M12 3l8.4 8.4L12 21 3.6 11.4 12 3z" /><path d="M4.6 11.4h14.8" /></svg>);
  if (mode === "compare")
    return (<svg {...p} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" /></svg>);
  return (<svg {...p} strokeWidth="2" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" stroke="none" /></svg>);
}

export function ModeTitle({ mode = "deep", label, style }) {
  const m = MODES[mode] || MODES.deep;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, ...style }}>
      <span style={{ width: 30, height: 30, flex: "0 0 30px", borderRadius: 9, display: "grid", placeItems: "center", color: m.ac, background: m.bg, border: `1px solid ${m.line}` }}>
        <ModeGlyph mode={mode} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: m.on }}>{label || m.label}</span>
    </span>
  );
}