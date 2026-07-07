"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ============================================
// THEME SYSTEM (V4S24b) — role tokens (premium substrate pass)
// ============================================
// Mode-agnostic tokens shared by both themes: the type stacks, the radius
// scale, the CTA glow, the lighter on-accent violet, and the four per-mode
// accent hues (the ONE place deep/explore/evolve/closure violets are defined).
const FONT_SANS  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif";
const FONT_MONO  = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const FONT_SERIF = "'Newsreader', Georgia, 'Times New Roman', serif";
const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16, full: 999 };
const SHARED = {
  fontSans: FONT_SANS, fontMono: FONT_MONO, fontSerif: FONT_SERIF,
  radius: RADIUS,
  ctaOn: "#a78bfa",                      // lighter violet: text-on-accent, hover, highlighted card
  glow: "0 6px 18px rgba(124,92,255,0.42)",
  acExplore: "#7aa2ff",                  // Explore — Dawn blue
  acDeep:    "#9a8fd8",                  // Deep — violet
  acEvolve:  "#b3a7f0",                  // Evolve / re-eval — brighter violet
  acClosure: "#8b8fe0",                  // Compare / closure — periwinkle
};

export const T = {
  light: {
    ...SHARED,
    mode: "light",
    bg: "#f4f2ef", surface: "#faf9f7", surfAlt: "#eceae5",
    border: "rgba(80,75,65,0.1)", borderStrong: "rgba(80,75,65,0.2)",
    text: "#171919", sec: "#4d5258", mut: "#8c9196", faint: "#a8adb2",
    shadow: "0 2px 8px rgba(50,55,60,0.06), 0 1px 2px rgba(50,55,60,0.03)",
    headerBg: "#f4f2ef", headerBorder: "rgba(80,75,65,0.12)",
    scoreRing: "#4d5258", scoreGlow: false,
    barBg: "rgba(80,75,65,0.07)",
    stepDone: "#16a34a", stepCurrent: "#171919", stepCurrentText: "#faf9f7",
    stepCurrentBorder: "#171919", stepCurrentShadow: "0 4px 12px rgba(0,0,0,0.08)",
    stepFutureBg: "rgba(80,75,65,0.06)", stepFutureText: "#8c9196", stepFutureBorder: "rgba(80,75,65,0.12)",
    stepLabel: "#4d5258", stepLabelMuted: "#8c9196",
    stepConnectorDone: "rgba(22,163,74,0.5)", stepConnectorFuture: "rgba(80,75,65,0.12)",
    stepBorder: "#2563eb",
    phaseNum: { bg: "rgba(37,99,235,0.06)", color: "#1d4ed8", border: "rgba(37,99,235,0.16)" },
    riskNum: "#dc2626",
    toolDesc: "rgba(37,99,235,0.75)",
    ctaBg: "#171919", ctaText: "#faf9f7",
    lockBg: "#2563eb",
    zoneLine: "rgba(80,75,65,0.1)", zoneText: "#8c9196",
    insightBorder: "#2563eb",
    srcBadge: { google: "#1d4ed8", github: "#6d28d9", llm: "#8c9196" },
    typeBadge: { direct: "#dc2626", adjacent: "#b45309", substitute: "#1d4ed8" },
    hubCard: "#faf9f7", hubCardBorder: "rgba(80,75,65,0.1)",
    inputBg: "#faf9f7", inputBorder: "rgba(80,75,65,0.18)", inputText: "#171919",
    link: "#2563eb",
    accentBar: false,
    modalBg: "#faf9f7", modalBorder: "rgba(80,75,65,0.14)",
    divider: "rgba(80,75,65,0.1)",
    streamOverlay: "rgba(244,242,239,0.85)", streamBg: "#faf9f7",
    streamBorder: "rgba(80,75,65,0.14)", streamDivider: "rgba(80,75,65,0.1)",
    streamShadow: "0 24px 64px rgba(50,55,60,0.1), 0 0 0 1px rgba(80,75,65,0.06)",
  },
  dark: {
    ...SHARED,
    mode: "dark",
    // Unified substrate (premium pass): one navy black, a navy surface set,
    // white-alpha borders, three cool muted-text steps that harmonize with navy.
    bg: "#0a0d13", surface: "#10141d", surfAlt: "#171c28",
    border: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.14)",
    text: "#eceff5", sec: "#9aa3b4", mut: "#6b7280", faint: "#4a5160",
    shadow: "0 2px 8px rgba(0,0,0,0.4)",
    headerBg: "rgba(10,13,19,0.97)", headerBorder: "rgba(255,255,255,0.08)",
    scoreRing: "#eab308", scoreGlow: true,
    barBg: "rgba(35,35,35,0.9)",
    stepDone: "#34d399", stepCurrent: "#ffffff", stepCurrentText: "#0a0a0a",
    stepCurrentBorder: "#ffffff", stepCurrentShadow: "0 4px 12px rgba(255,255,255,0.1)",
    stepFutureBg: "rgba(38,38,38,0.6)", stepFutureText: "#525252", stepFutureBorder: "rgba(64,64,64,0.5)",
    stepLabel: "#d4d4d4", stepLabelMuted: "#525252",
    stepConnectorDone: "rgba(16,185,129,0.5)", stepConnectorFuture: "#262626",
    stepBorder: "#eab308",
    phaseNum: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.2)" },
    riskNum: "#f87171",
    toolDesc: "rgba(96,165,250,0.8)",
    ctaBg: "#7c5cff", ctaText: "#fff",
    lockBg: "linear-gradient(135deg, #7c5cff, #6d28d9)",
    zoneLine: "rgba(255,255,255,0.06)", zoneText: "#555555",
    insightBorder: "#60a5fa",
    srcBadge: { google: "#60a5fa", github: "#a78bfa", llm: "#808080" },
    typeBadge: { direct: "#f87171", adjacent: "#fbbf24", substitute: "#60a5fa" },
    hubCard: "#10141d", hubCardBorder: "rgba(255,255,255,0.08)",
    inputBg: "#171c28", inputBorder: "rgba(255,255,255,0.12)", inputText: "#eceff5",
    link: "#7aa2ff",
    accentBar: false,
    modalBg: "#10141d", modalBorder: "rgba(255,255,255,0.1)",
    divider: "rgba(255,255,255,0.06)",
    streamOverlay: "rgba(0,0,0,0.75)", streamBg: "#0a0d13",
    streamBorder: "rgba(255,255,255,0.08)", streamDivider: "rgba(255,255,255,0.05)",
    streamShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
  },
};

export function getTheme(mode) {
  return T[mode] || T.dark;
}

// ============================================
// LAST-OPENED IDEA — the Overview "continue where you left off" marker.
// Per-browser, no backend. Matches the existing iv_ localStorage idiom
// (iv_profile / iv_eval_timestamps). recordLastIdea is called from the single
// open chokepoint (routeLoadedIdea in page.js); the Overview reads it post-mount
// to pick WHICH family is the resume target (it then renders from the authoritative
// /api/ideas card, falling back to the newest idea when no marker / no match).
// ============================================
export function recordLastIdea(id) {
  try {
    if (!id) return;
    localStorage.setItem("iv_last_idea", JSON.stringify({ id, ts: Date.now() }));
  } catch {}
}

export function getLastIdea() {
  try {
    return JSON.parse(localStorage.getItem("iv_last_idea") || "null");
  } catch {
    return null;
  }
}

export function clearLastIdea() {
  try {
    localStorage.removeItem("iv_last_idea");
  } catch {}
}

// ============================================
// HUB SWR CACHE — the last GET /api/ideas payload, per user. Lets the Overview
// (and later the Hub) paint instantly on repeat loads from cache, then refresh
// in the background — sidesteps the cross-region fetch latency. Scoped by userId
// so a different account on the same browser never reads a stale set.
// ============================================
export function readHubCache(userId) {
  try {
    const c = JSON.parse(localStorage.getItem("iv_hub_cache") || "null");
    if (!c || c.userId !== userId) return null;
    return { rough: c.rough || [], ideas: c.ideas || [] };
  } catch {
    return null;
  }
}

export function writeHubCache(userId, rough, ideas) {
  try {
    localStorage.setItem("iv_hub_cache", JSON.stringify({ userId, rough, ideas, ts: Date.now() }));
  } catch {}
}

// Shared functional colors — same in both themes
//
// V4S28 B8 (April 30, 2026): Updated palette + boundaries to "Mix B" lock.
// Existing amber and blue preserved verbatim from prior product UI; red and
// green updated to vivid signal-bearing values matching their saturation.
//
// MD / MO / OR boundaries (rubric measures HOW GOOD):
//   < 3.0          → red    (#ef4444) — rare, real warning
//   3.0 to 4.5     → amber  (#f59e0b) — middling, common
//   > 4.5 to < 6.5 → blue   (#3b82f6) — viable, most common
//   >= 6.5         → green  (#10b981) — strong, rare
//
// Boundaries are exclusive at the upper end (4.5 → amber, NOT blue;
// 5.0/5.5/6.0 → blue; 6.5 → green) to give amber its proper share of the
// middling zone and reserve green for genuinely strong outcomes.
//
// TC uses inverted direction + shifted boundaries because TC distribution is
// shifted high (most builds land 6.0-8.0 — see audit findings, V4S28 B8 design).
// Same color semantic across all four metrics: green/blue = good, amber/red =
// signal of difficulty. Only the threshold + direction change.
//
// TC boundaries (rubric measures HOW HARD; inverted color direction):
//   1 to < 4       → green  (#10b981) — easy build, when this fires it's real
//   4 to < 6.5     → blue   (#3b82f6) — moderate build
//   6.5 to < 8     → amber  (#f59e0b) — hard build, worth understanding
//   >= 8           → red    (#ef4444) — very hard build, rare

export const getScoreColor = (s) => {
  if (s >= 6.5) return "#10b981";  // green
  if (s > 4.5) return "#3b82f6";   // blue
  if (s >= 3) return "#f59e0b";    // amber
  return "#ef4444";                // red
};

export const getTcColor = (s) => {
  if (s >= 8) return "#ef4444";    // red — very hard
  if (s >= 6.5) return "#f59e0b";  // amber — hard
  if (s >= 4) return "#3b82f6";    // blue — moderate
  return "#10b981";                // green — easy
};

// ============================================
// MAIN BOTTLENECK COLOR TAXONOMY (V4S28 B3 — Section 4)
// ============================================
// 8 enum values mapped to categorical colors. Both themes.
// Selected to NOT collide with existing severity colors (red / amber / blue /
// green are reserved for Difficulty pills, score colors, TC inverted colors,
// step indicators). The taxonomy is purely categorical — Trust/credibility is
// not "worse than" Buyer access, etc.
//
// Final mapping (locked April 26, 2026):
//   Technical build      → indigo
//   Buyer access         → purple
//   Trust/credibility    → teal
//   Compliance           → slate (cool, institutional)
//   Distribution         → pink
//   Data acquisition     → cyan
//   Capital/runway       → amber (resource/funding)
//   Specification        → stone (warm gray; muted edge state for sparse input)
//
// Each entry returns {bg, color, border} for the chip rendering.
export const MAIN_BOTTLENECK_COLORS = {
  "Technical build": {
    dark:  { bg: "rgba(99,102,241,0.14)",  color: "#a5b4fc", border: "rgba(99,102,241,0.32)" },
    light: { bg: "rgba(99,102,241,0.10)",  color: "#4338ca", border: "rgba(99,102,241,0.28)" },
  },
  "Buyer access": {
    dark:  { bg: "rgba(139,92,246,0.14)",  color: "#c4b5fd", border: "rgba(139,92,246,0.32)" },
    light: { bg: "rgba(139,92,246,0.10)",  color: "#6d28d9", border: "rgba(139,92,246,0.28)" },
  },
  "Trust/credibility": {
    dark:  { bg: "rgba(20,184,166,0.14)",  color: "#5eead4", border: "rgba(20,184,166,0.32)" },
    light: { bg: "rgba(20,184,166,0.10)",  color: "#0f766e", border: "rgba(20,184,166,0.28)" },
  },
  "Compliance": {
    dark:  { bg: "rgba(100,116,139,0.18)", color: "#cbd5e1", border: "rgba(100,116,139,0.36)" },
    light: { bg: "rgba(100,116,139,0.10)", color: "#334155", border: "rgba(100,116,139,0.28)" },
  },
  "Distribution": {
    dark:  { bg: "rgba(236,72,153,0.14)",  color: "#f9a8d4", border: "rgba(236,72,153,0.32)" },
    light: { bg: "rgba(236,72,153,0.10)",  color: "#be185d", border: "rgba(236,72,153,0.28)" },
  },
  "Data acquisition": {
    dark:  { bg: "rgba(6,182,212,0.14)",   color: "#67e8f9", border: "rgba(6,182,212,0.32)" },
    light: { bg: "rgba(6,182,212,0.10)",   color: "#0e7490", border: "rgba(6,182,212,0.28)" },
  },
  "Capital/runway": {
    dark:  { bg: "rgba(245,158,11,0.14)",  color: "#fcd34d", border: "rgba(245,158,11,0.32)" },
    light: { bg: "rgba(245,158,11,0.10)",  color: "#b45309", border: "rgba(245,158,11,0.28)" },
  },
  "Specification": {
    dark:  { bg: "rgba(168,162,158,0.14)", color: "#d6d3d1", border: "rgba(168,162,158,0.32)" },
    light: { bg: "rgba(168,162,158,0.10)", color: "#57534e", border: "rgba(168,162,158,0.28)" },
  },
};

// Returns {bg, color, border} for a Main Bottleneck chip given its enum value
// and the current theme's mode ("light" | "dark"). Falls back to Specification
// stone-gray for unknown / null values (older saved evaluations from before B3).
export function getMainBottleneckColor(value, themeMode) {
  const mode = themeMode === "light" ? "light" : "dark";
  const palette = MAIN_BOTTLENECK_COLORS[value];
  if (!palette) {
    return MAIN_BOTTLENECK_COLORS["Specification"][mode];
  }
  return palette[mode];
}

// ============================================
// MAIN BOTTLENECK ICONS — one small line-glyph per enum, rendered inside the MB
// chip (and beside the "binding constraint" prose beat). DISPLAY-ONLY. The glyph
// inherits the chip's MB colour via stroke="currentColor", so it reads as one unit
// with the pill, never as a bolted-on mark. Stroke style matches the existing
// inline shield SVG in MetricProseDetail. Unknown / null values fall back to the
// Specification glyph, mirroring getMainBottleneckColor.
//
//   Technical build   → wrench        Distribution      → share nodes
//   Buyer access      → key           Data acquisition  → database
//   Trust/credibility → award badge   Capital/runway    → coins
//   Compliance        → clipboard ✓   Specification     → described file
const MAIN_BOTTLENECK_ICON_PATHS = {
  "Technical build": (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  "Buyer access": (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </>
  ),
  "Trust/credibility": (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </>
  ),
  "Compliance": (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  "Distribution": (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="m15.41 6.51-6.82 3.98" />
    </>
  ),
  "Data acquisition": (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </>
  ),
  "Capital/runway": (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-.71.71" />
    </>
  ),
  "Specification": (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
};

// Returns an <svg> glyph for an MB enum value. size in px (default 14). Colour
// comes from the parent via currentColor — set the chip's `color` and the icon
// follows. Falls back to the Specification glyph for unknown / null values.
export function MainBottleneckIcon({ value, size = 14 }) {
  const inner = MAIN_BOTTLENECK_ICON_PATHS[value] || MAIN_BOTTLENECK_ICON_PATHS["Specification"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      {inner}
    </svg>
  );
}

// ============================================
// MB CLOSE-CALL AFFORDANCE — surfaces estimates.mb_ambiguity. When the Stage 3
// selection was a genuine tiebreaker between two substantively-held candidates,
// the single MB pick stays authoritative (the full chip is unchanged) and this
// renders a SUBTLE secondary affordance beneath it: a "CLOSE CALL" label + a
// ghosted dashed runner-up chip + a link that opens a pop-up explaining the
// second framing. DISPLAY-ONLY — reads the committed mb_ambiguity payload, never
// recomputes anything, never touches the pick.
//
// Renders nothing unless is_close_call === true AND a runner_up enum is present,
// so the (large majority of) clean single-pick cases show the chip row exactly
// as before. The pop-up shell mirrors the existing alternatives modal in page.js.
export function MbCloseCallAffordance({ ambiguity, primary, t }) {
  const [open, setOpen] = useState(false);
  if (!ambiguity || ambiguity.is_close_call !== true || !ambiguity.runner_up) return null;

  const runnerUp = ambiguity.runner_up;
  const rationale = ambiguity.runner_up_rationale;
  const tip = ambiguity.tipping_signal;
  const primaryColor = getMainBottleneckColor(primary, t.mode);
  const runnerColor = getMainBottleneckColor(runnerUp, t.mode);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`This was a close call with ${runnerUp}. See the reasoning.`}
        style={{
          background: "none", border: "none", padding: 0, marginTop: 9, cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10.5, color: t.mut, letterSpacing: "0.04em" }}>CLOSE CALL ·</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 400,
            padding: "3px 10px", borderRadius: 9999, background: "transparent",
            color: runnerColor.color, border: `1px dashed ${runnerColor.border}`, opacity: 0.9,
          }}>
            <MainBottleneckIcon value={runnerUp} size={12} />
            {runnerUp}
          </span>
        </span>
        <span style={{ fontSize: 11.5, color: t.link }}>see the reasoning →</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000, padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: `linear-gradient(rgba(124,140,240,0.06), rgba(124,140,240,0.06)), ${t.modalBg}`,
              border: `1px solid rgba(124,140,240,0.35)`, borderRadius: 16,
              padding: 24, maxWidth: 440, width: "100%", maxHeight: "80vh", overflowY: "auto",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b93e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
                  <path d="M21 17h-8l-3.5-5h-6.5" />
                  <path d="M21 7h-8l-3.495 5" />
                  <path d="M18 10l3-3l-3-3" />
                  <path d="M18 20l3-3l-3-3" />
                </svg>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: t.text, margin: 0 }}>Why this was a close call</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", color: t.mut, fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: t.sec, margin: "0 0 16px", lineHeight: 1.5 }}>
              This case sat between two valid framings of the binding constraint. The one on the left is what the report committed to.
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150, border: `1px solid ${primaryColor.border}`, background: primaryColor.bg, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: t.mut, letterSpacing: "0.06em", marginBottom: 7 }}>SELECTED</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: primaryColor.color }}>
                  <MainBottleneckIcon value={primary} size={14} />{primary}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 150, border: `1px dashed ${runnerColor.border}`, background: "transparent", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: t.mut, letterSpacing: "0.06em", marginBottom: 7 }}>RUNNER-UP</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: runnerColor.color }}>
                  <MainBottleneckIcon value={runnerUp} size={14} />{runnerUp}
                </span>
              </div>
            </div>

            {rationale && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 5 }}>Why {runnerUp} could bind instead</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: t.sec, margin: 0 }}>{rationale}</p>
              </div>
            )}
            {tip && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 5 }}>What would tip it the other way</div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: t.sec, margin: 0 }}>{tip}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// STEP PROGRESS BAR
// ============================================
export function StepProgress({ currentStep, savedMode, branchMode, t }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Deep arc (V6 redesign). Profile is folded into the Idea step (edited inline
  // in DeepInputView), so it's no longer its own node. Step 5 always shows: on a
  // first run it sits in the future/dimmed state as an onboarding affordance
  // ("this is where it goes once you save it"); on a saved view it's live
  // (Evolve), and on a branch view it's Delta.
  const steps = [
    { number: 1, label: "Idea", short: "Idea" },
    { number: 2, label: "Deep Analysis", short: "Analysis" },
    { number: 3, label: "Evidence & Reality", short: "Evidence" },
    { number: 4, label: "Handoff", short: "Handoff" },
    ...(branchMode
      ? [{ number: 5, label: "Delta", short: "Delta" }]
      : [{ number: 5, label: "Evolve", short: "Evolve" }]),
  ];

  const circleSize = isMobile ? 28 : 40;
  const circleFontSize = isMobile ? 11 : 14;
  const connectorWidth = isMobile ? 28 : 80;
  const connectorMargin = isMobile ? "0 4px" : "0 12px";
  const labelFontSize = isMobile ? 9 : 12;
  const labelMarginTop = isMobile ? 5 : 8;
  const containerPadding = isMobile ? "20px 8px" : "32px 0";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: containerPadding }}>
      {steps.map((step, index) => (
        <div key={step.number} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: circleFontSize,
                fontWeight: 600,
                transition: "all 0.3s",
                flexShrink: 0,
                ...(currentStep > step.number
                  ? { background: `${t.stepDone}33`, color: t.stepDone, border: `2px solid ${t.stepDone}80` }
                  : currentStep === step.number
                  ? { background: t.stepCurrent, color: t.stepCurrentText, border: `2px solid ${t.stepCurrentBorder}`, boxShadow: t.stepCurrentShadow }
                  : { background: t.stepFutureBg, color: t.stepFutureText, border: `2px solid ${t.stepFutureBorder}` }),
              }}
            >
              {currentStep > step.number ? "✓" : step.number}
            </div>
            <span
              style={{
                fontSize: labelFontSize,
                marginTop: labelMarginTop,
                fontWeight: 500,
                color: currentStep >= step.number ? t.stepLabel : t.stepLabelMuted,
                whiteSpace: "nowrap",
              }}
            >
              {isMobile ? step.short : step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              style={{
                width: connectorWidth,
                height: 2,
                margin: connectorMargin,
                marginBottom: isMobile ? 18 : 24,
                borderRadius: 2,
                background: currentStep > step.number ? t.stepConnectorDone : t.stepConnectorFuture,
                transition: "all 0.3s",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// STATUS BADGE (functional colors — same in both themes)
// ============================================
export function StatusBadge({ status }) {
  const colorMap = {
    growing: { bg: "rgba(16,185,129,0.15)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
    active: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
    acquired: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
    failed: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
    shutdown: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
  };
  const c = colorMap[status] || colorMap.active;

  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 10px",
        borderRadius: 9999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ============================================
// SCORE BAR
// ============================================
export function ScoreBar({ name, score, explanation, weight, notes, t, gated }) {
  const percentage = (score / 10) * 100;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
          {name}
          {weight && <span style={{ fontSize: 11, fontWeight: 400, color: t.mut, marginLeft: 8 }}>{weight}</span>}
        </span>
        <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 600, color: getScoreColor(score) }}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <div style={{ width: "100%", height: 8, background: t.barBg, borderRadius: 9999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: getScoreColor(score),
            width: `${percentage}%`,
            transition: "width 1s ease-out",
          }}
        />
      </div>
      {!gated && (
        <>
          <p style={{ fontSize: 12, color: t.sec, marginTop: 8, lineHeight: 1.5 }}>{explanation}</p>
          {notes && notes.map((note, i) => (
            <p key={i} style={{ fontSize: 11, color: t.mut, marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
          ))}
        </>
      )}
    </div>
  );
}

// ============================================
// SECTION HEADER
// ============================================
export function SectionHeader({ icon, title, subtitle, t, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: accent ? `${accent}1A` : t.surfAlt,
          border: `1px solid ${accent ? `${accent}38` : t.border}`,
          color: accent || "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: t.text, margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 14, color: t.sec, margin: "4px 0 0 0" }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================
// CARD WRAPPER
// ============================================
export function Card({ children, style = {}, t }) {
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: 24,
        boxSizing: "border-box",
        overflow: "hidden",
        boxShadow: t.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// PAGE CONTAINER - ensures padding on ALL screens
// ============================================
export function PageContainer({ children, wide = false }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: wide ? 960 : 640,
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: isMobile ? 16 : 32,
        paddingRight: isMobile ? 16 : 32,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// AUTH MODAL
// ============================================
// MOVED → ./AuthModal.js (the redesigned login/sign-up modal). Re-exported here
// so existing importers that pull it from "./components" (EvaluationView,
// ExploreView, and any others) keep resolving against the single new source —
// no per-file import rewrites needed. page.js imports it directly from ./AuthModal.
export { AuthModal } from "./AuthModal";
// ============================================
// CONTENT GATING COMPONENTS (V4S25)
// ============================================

// Lock CTA button — shown below gated sections
export function GateCTA({ text, t }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 4px 0" }}>
      <button style={{
        background: t.lockBg,
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "10px 24px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        letterSpacing: "0.01em",
        transition: "opacity 0.2s",
      }}
        onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
        onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
      >
        <span style={{ fontSize: 13 }}>🔒</span> {text}
      </button>
    </div>
  );
}

// Blur gate — shows first sentence(s) of text, blurs the rest
export function BlurGate({ isGated, text, t }) {
  if (!isGated || !text) {
    return <p style={{ fontSize: 14, color: t.sec, textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>{text}</p>;
  }

  // Split into sentences — match period/question/exclamation followed by space or end
  const sentences = text.match(/[^.!?]+[.!?]+[\s]?/g) || [text];
  const firstSentence = sentences[0] || "";
  const restText = sentences.slice(1).join("");

  return (
    <div>
      <p style={{ fontSize: 14, color: t.sec, textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
        {firstSentence}
      </p>
      {restText && (
        <div style={{
          position: "relative",
          maxHeight: 60,
          overflow: "hidden",
          marginTop: 4,
        }}>
          <p style={{
            fontSize: 14,
            color: t.sec,
            textAlign: "center",
            lineHeight: 1.6,
            maxWidth: 560,
            margin: "0 auto",
            filter: "blur(4px)",
            opacity: 0.5,
            userSelect: "none",
          }}>
            {restText}
          </p>
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: `linear-gradient(transparent, ${t.surface})`,
          }} />
        </div>
      )}
    </div>
  );
}

// Preview banner — informational, shown at top of free preview evaluation screens
export function PreviewBanner({ t, evalsRemaining }) {
  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: "12px 20px",
      marginBottom: 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
    }}>
      <p style={{ fontSize: 13, color: t.sec, margin: 0 }}>
        <span style={{ fontWeight: 600, color: t.text }}>Free Preview</span> — {evalsRemaining != null ? `${evalsRemaining} of 2 evaluations remaining` : "limited evaluations"}
      </p>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: t.mut,
      }}>
        Get more with credits →
      </span>
    </div>
  );
}

// ============================================
// SPECIFICITY GATE (V4S28 B7 → B9)
// ============================================
// Renders the inline panel shown when the Haiku layer determines the input
// is too underspecified to evaluate honestly. Sits between the textarea and
// the Evaluate button on the input screen. The textarea above and Evaluate
// button below are owned by the parent; this component only renders the
// missing-element cards.
//
// V4S28 B9 redesign (May 2026):
// - Always show all 3 slots with state (passed = green check / muted; missing
//   = colored top border + suggestion). Removes the "moving goalposts" feel
//   of the prior B7 design which only rendered missing slots.
// - Complete-example footer below the cards (D2 reversed — parts first,
//   assembled example last).
//
// Locked design: execution-plan-v4-3-7.md Section 13 / Item 7 + pre-B10a
// Haiku calibration revisit (May 4, 2026).
// `missing_elements` is a coarse 3-value enum: target_user / use_case / mechanism.
// Unknown values are filtered. Empty array falls back to "all 3 missing"
// (defensive — should not happen if gate fired correctly).
//
// Enum semantics (locked May 4, 2026):
// - target_user = adoption unit (not necessarily literal payer)
// - use_case    = job/pain/task/workflow under one umbrella
// - mechanism   = how the product intervenes (feature/process/automation/method)
//
// Per-slot accent colors (1.5px top border) signal the dimension each card
// represents — Pink (audience), Teal (use case), Purple (mechanism).
// Light-mode hex = ramp 600 stop, dark-mode hex = ramp 200 stop, per the
// design system's "light = 600 stroke, dark = 200 stroke" convention.
const SLOT_ORDER = ["target_user", "use_case", "mechanism"];

const MISSING_ELEMENT_CARDS = {
  target_user: {
    title: "Who is it for?",
    passedTitle: "Target user",
    example: "solo professionals · small clinics · enterprise teams",
    accent: { light: "#993556", dark: "#ED93B1" }, // Pink 600 / 200
  },
  use_case: {
    title: "What does it help with?",
    passedTitle: "Use case",
    example: "scheduling appointments · drafting documents · tracking inventory",
    accent: { light: "#0F6E56", dark: "#5DCAA5" }, // Teal 600 / 200
  },
  mechanism: {
    title: "How does it work?",
    passedTitle: "Mechanism",
    example: "automates reminders · turns chat into tasks · drafts from templates",
    accent: { light: "#534AB7", dark: "#AFA9EC" }, // Purple 600 / 200
  },
};

// Locked B8 palette green (also used by getScoreColor). Single source of truth
// for the "passed slot" affordance — a green check mark + green top border.
const PASSED_GREEN = "#10b981";

// Complete-example footer text — shows the full assembled shape of a good
// input below the parts. Locked copy (D2 reversed).
const COMPLETE_EXAMPLE =
  "AI scheduling assistant for dental receptionists that drafts patient follow-ups.";

export function SpecificityGate({ gate, t }) {
  if (!gate) return null;

  // Filter to known missing_elements; empty array falls back to "all 3 missing"
  const validKeys = SLOT_ORDER;
  const requested = Array.isArray(gate.missing_elements) ? gate.missing_elements : [];
  const missingSet = new Set(requested.filter((k) => validKeys.includes(k)));
  // Defensive fallback — if gate fired but missing_elements is empty/garbage,
  // treat all 3 as missing rather than rendering an empty grid.
  const effectiveMissing = missingSet.size > 0 ? missingSet : new Set(validKeys);

  const themeMode = t?.mode === "dark" ? "dark" : "light";

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        marginBottom: 14,
      }}>
        {SLOT_ORDER.map((key) => {
          const card = MISSING_ELEMENT_CARDS[key];
          const isMissing = effectiveMissing.has(key);
          const accentColor = isMissing ? card.accent[themeMode] : PASSED_GREEN;

          return (
            <div key={key} style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderTop: `1.5px solid ${accentColor}`,
              borderRadius: 8,
              padding: "12px 14px",
              opacity: isMissing ? 1 : 0.65,
              transition: "opacity 200ms ease",
            }}>
              {isMissing ? (
                <>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    marginBottom: 6,
                  }}>
                    {card.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: t.sec,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}>
                    {card.example}
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    <span style={{ color: PASSED_GREEN, fontSize: 13, lineHeight: 1 }}>✓</span>
                    {card.passedTitle}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: t.sec,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                  }}>
                    Covered
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete-example footer (D2 reversed — parts first, assembled example last) */}
      <div style={{
        fontSize: 12,
        color: t.sec,
        lineHeight: 1.5,
        padding: "10px 4px 0 4px",
      }}>
        <span style={{ fontWeight: 500, color: t.text }}>Example: </span>
        <span style={{ fontStyle: "italic" }}>{COMPLETE_EXAMPLE}</span>
      </div>
    </div>
  );
}