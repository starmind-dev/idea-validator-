"use client";

import { DirectionCard } from "./DirectionCard";
import { ModeTitle } from "./ModeTitle";
import { BackLink } from "./BackLink";
import { Caption } from "./MetaPills";

// ============================================================================
// ExploreView — the Explore (LL2) results screen.
//
// Sibling to EvaluationView. Renders the four locked Explore surfaces from a
// live `ll2_explore_v1` payload (see /api/analyze-explore route.js):
//
//   read       { reflection, clear[], open[], branchability{state,reason_type,reason} }
//   angles[]   { id, title, concept, branch_idea_text, basis{primary,secondary},
//                identity_guard{preserves,changes,drift_risk},
//                justification{ opening{text,evidence_refs[],trust}, bet{text,rests_on}, disconfirmer },
//                readiness, lane_ref }
//   terrain    { lanes[{id,label,status,lane_type,reference_items[{name,type}],
//                substitute_tell{exists,signal},demand_question}], firms_up_fastest{text,angle_refs[]} }
//   next_move  { dominant_uncertainty{type,text}, recommendation, primary_action,
//                targets{angle_ids,use_original_idea}, actions[{type,enabled,target_angle_ids,use_original_idea,label}] }
//
//   envelope   { mode:"explore", schema_version, idea, fan_state:"empty|thin|rich", ... }
//
// Identity = "Dawn": cornflower base, rose->blue discovery gradient on the fan
// connectors. Deliberately NOT teal/score-ramp/Deep-purple — Explore owns its
// own palette so the two modes read apart.
//
// INTEGRATION (page.js), not done here:
//   • endpoint: analyzeWithStream(idea, profile, "/api/analyze-explore")
//   • new screen: currentScreen === "explore" -> <ExploreView .../>
//   • the gate early-exit emits snake `specificity_insufficient` (Deep uses camel) —
//     handle in the shared SSE consumer's baseOf/step mapping.
// ============================================================================

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { PageContainer, AuthModal } from "./components";

// ---- Dawn identity (locked) ------------------------------------------------
const EX = {
  base: "#7aa2ff",
  bright: "#bcd2ff",
  line: "rgba(122,162,255,0.46)",
  dim: "rgba(122,162,255,0.12)",
  gradA: "#fb7185", // discovery gradient: rose, at the idea
  gradB: "#60a5fa", // sky, at each new angle
};

// Deep's locked violet, used ONLY on the cross-mode handoff affordances (the
// "take to Deep" verb at both scales, and the Deep tile in Section 4). Explore
// stays Dawn-blue everywhere else; violet appears exactly where the action
// leaves Explore and enters Deep, so the colour reads as "this hands you off".
const VIO = {
  base: "#8a82c2",
  ink: "#cbc3ee",
  line: "rgba(138,130,194,0.6)",
  wash: "rgba(138,130,194,0.13)",
  glow: "rgba(138,130,194,0.34)",
};

// ---- small SVG helpers -----------------------------------------------------
const Svg = ({ d, w = 14, sw = 1.8, fill = "none", children, style }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? "currentColor" : "none"}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0, ...style }}>
    {children || (d ? <path d={d} /> : null)}
  </svg>
);

const SectionIcon = {
  read: () => <Svg><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2M12 19v2M4.5 4.5 6 6M18 18l1.5 1.5M3 12h2M19 12h2M4.5 19.5 6 18M18 6l1.5-1.5" /></Svg>,
  dir: () => <Svg><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M12 12 5 8M12 12 6 15M12 12l4 7M12 12 20 9" /></Svg>,
  terr: () => <Svg><path d="M3 17h18" /><path d="M7 17a5 5 0 0 1 10 0" /></Svg>,
  next: () => <Svg><path d="M5 21V5l8-2v18M5 21h13M9 12h.5" /></Svg>,
  node: () => <Svg w={13}><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.5 6.5 8 8M16 16l1.5 1.5M6.5 17.5 8 16M16 8l1.5-1.5" /></Svg>,
};

const RoadIc = () => <Svg w={13} sw={2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
const BetIc = () => <Svg w={13} sw={2}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2 2" /></Svg>;
const RockIc = () => <Svg w={13} sw={2}><path d="M4 18h16M7 18l3-9 4 5 2-3 2 7" /></Svg>;
const QIc = () => <Svg w={13} sw={2}><path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 .8-1 1.7M12 17h.01" /></Svg>;
const ReadLinesIc = () => <Svg w={13} sw={2}><path d="M4 6h16M4 12h10M4 18h7" /></Svg>;
const BoltIc = () => <Svg w={15}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Svg>;
const PlusIc = () => <Svg w={12} sw={2}><path d="M12 5v14M5 12h14" /></Svg>;
const CmpIc = () => <Svg w={12} sw={2}><rect x="4" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="6" height="16" rx="1" /></Svg>;

const ReadyGlyph = {
  ready_for_deep: () => <Svg w={15}><path d="M14 4h5v16h-5" /><path d="M3 12h11M10 8l4 4-4 4" /></Svg>,
  worth_shaping: () => <Svg w={15}><path d="M5 19 16 8M14 6l4 4M12 8l-7 7v4h4" /></Svg>,
  probably_thin: () => <Svg w={15} sw={1.8}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" opacity="0.6" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" opacity="0.3" /></Svg>,
};

function StatusShape({ status }) {
  if (status === "crowded")
    return <Svg w={12} fill="var(--exmut)" style={{ color: "var(--exmut)" }}><g fill="currentColor" stroke="none"><circle cx="6" cy="7" r="2.4" /><circle cx="12" cy="7" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="9" cy="14" r="2.4" /><circle cx="15" cy="14" r="2.4" /></g></Svg>;
  if (status === "open")
    return <Svg w={12} sw={2}><circle cx="12" cy="12" r="8" strokeDasharray="3 3.2" /></Svg>;
  return <Svg w={12}><g fill="currentColor" stroke="none"><circle cx="8" cy="12" r="2.4" /><circle cx="15" cy="9" r="2.4" opacity="0.5" /></g></Svg>;
}

// ---- label maps ------------------------------------------------------------
const READY_LABEL = { ready_for_deep: "Ready for Deep", worth_shaping: "Worth shaping", probably_thin: "Lightly grounded" };

// the disconfirmer (kill) named on the card face — the wall, not just the way in
const KIND_LABEL = {
  direct_incumbent_holds: "Incumbent holds", free_substitute_floor: "Free substitute",
  demand_unproven: "Demand unproven", structural_barrier: "Structural wall", closeable_gap: "Closeable gap",
};
const KIND_DOT = {
  direct_incumbent_holds: "#d98a8a", free_substitute_floor: "#c89e6b",
  demand_unproven: "#d4b86a", structural_barrier: "#8b94a1", closeable_gap: "#7aa2ff",
};
// readiness as a glanceable triage chip (the dial that actually discriminates now)
const READY_CHIP = {
  ready_for_deep: { bg: "rgba(122,162,255,0.22)", bd: "#7aa2ff",                fg: "#d2e0ff", dot: "#d2e0ff" },
  worth_shaping:  { bg: "rgba(122,162,255,0.13)", bd: "rgba(122,162,255,0.34)", fg: "#bcd0f4", dot: "#7aa2ff" },
  probably_thin:  { bg: "rgba(204,158,107,0.13)", bd: "rgba(204,158,107,0.34)", fg: "#dab488", dot: "#c89e6b" },
};
const WALL_CLAY = "#c89e6b";
const WallIc = () => <Svg w={13} sw={1.8}><circle cx="12" cy="12" r="8.5" /><path d="M6.5 6.5l11 11" /></Svg>;

function ReadinessChip({ readiness }) {
  const c = READY_CHIP[readiness] || READY_CHIP.worth_shaping;
  return (
    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace",
      fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap",
      borderRadius: 20, padding: "3px 8px 3px 7px", background: c.bg, border: `1px solid ${c.bd}`, color: c.fg }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot }} />
      {READY_LABEL[readiness] || "Worth shaping"}
    </span>
  );
}

const SHIFT_LABEL = {
  target_shift: "Target shift", buyer_shift: "Buyer shift", mechanism_shift: "Mechanism shift",
  use_case_shift: "Use-case shift", positioning_shift: "Positioning shift", distribution_shift: "Distribution shift",
};

const LANE_TYPE_PHRASE = {
  crowded_with_gap: "Crowded — but a stated gap none of them cover.",
  crowded_free_tools: "Busy, but the crowd is free tools, not paying ones.",
  open_with_substitute: "Open — people work around it by hand today.",
  open_without_substitute: "Open — and no one's even working around it.",
  niche_with_buyer_tell: "Narrow — but a specific buyer is already paying.",
  emerging_unclear: "Still forming — too fresh to read with confidence.",
};

const ZONES = [
  ["crowded", "Crowded"],
  ["lightly_served", "Lightly served"],
  ["open", "Open"],
];

const ZONE_VIS = {
  crowded:        { dot: "#c89e6b", badge: "rgba(200,158,107,0.16)", badgeFg: "#d6ac78", fill: "linear-gradient(90deg,#c89e6b,#d6ac78)" },
  lightly_served: { dot: "#8b94a1", badge: "rgba(139,148,161,0.16)", badgeFg: "#aab2bd", fill: "#8b94a1" },
  open:           { dot: "#7aa2ff", badge: "rgba(122,162,255,0.14)", badgeFg: "#9db8f2", fill: "#7aa2ff" },
};

const BRANCH_LABEL = (state, reasonType) => {
  if (state === "branchable") return "Branchable";
  if (state === "partially_branchable") return "Partially branchable";
  if (reasonType === "already_specific") return "Ready to judge";
  if (reasonType === "evidence_too_thin") return "Too thin to branch";
  if (reasonType === "too_vague" || reasonType === "too_broad") return "Too broad to fan yet";
  return "Not branchable";
};

const TRUST_OPACITY = { strong: 1, moderate: 0.55, weak: 0.28 };

// ============================================================================
// Section eyebrow
// ============================================================================
function Eyebrow({ num, icon, title, sub, t, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%", border: `1px solid ${EX.line}`, color: EX.bright,
        fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: `0 0 0 3px ${EX.dim}, 0 0 14px -2px ${EX.base}`, alignSelf: "center",
      }}>{num}</span>
      <span style={{ display: "flex", alignItems: "center", color: EX.bright, alignSelf: "center" }}>{icon}</span>
      <span style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: t.sec }}>{title}</span>
      <span style={{ fontSize: 12.5, color: t.sec }}>{sub}</span>
      {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>{right}</div>}
    </div>
  );
}

// ============================================================================
// 1 · Our read
// ============================================================================
// first N sentences of the idea, so the seed card stays a glance not a wall of text
function firstSentences(text, n, maxChars = 320) {
  const t = String(text || "").trim();
  const parts = t.match(/[^.!?]+[.!?]+/g);
  if (parts && parts.length > n) {
    return { preview: parts.slice(0, n).join("").trim(), truncated: true };
  }
  // No usable sentence boundaries (a bulleted / punctuation-light paste, or one
  // giant run-on) — the sentence split can't shorten these, so hard-cap by
  // length. Keeps the seed card a glance; the full text stays behind "View full
  // idea". The prose path above is untouched.
  if (t.length > maxChars) {
    let cut = t.slice(0, maxChars);
    const sp = cut.lastIndexOf(" ");
    if (sp > maxChars * 0.6) cut = cut.slice(0, sp);
    return { preview: cut.trim() + "…", truncated: true };
  }
  return { preview: t, truncated: false };
}

function SeedSurface({ idea, t }) {
  const [showFull, setShowFull] = useState(false);
  if (!idea) return null;
  const { preview, truncated } = firstSentences(idea, 2);
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 4 }}>
        <div style={{ width: "100%", maxWidth: 560, border: "1px solid rgba(122,162,255,0.22)", borderRadius: 13,
          background: `linear-gradient(180deg, ${EX.dim}, ${t.surface})`, padding: "16px 20px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: EX.base, marginBottom: 9, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "flex", color: EX.base }}><PlusIc /></span> Your idea
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.58, color: "#cdd0d6" }}>{preview}</div>
          {truncated && (
            <button onClick={() => setShowFull(true)} style={{ marginTop: 11, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: EX.base, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
              View full idea <span style={{ display: "flex" }}><Svg w={13} sw={2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg></span>
            </button>
          )}
        </div>
        <div style={{ width: 1, height: 32, background: `linear-gradient(${EX.base}, transparent)` }} />
      </div>

      {showFull && (
        <div onClick={() => setShowFull(false)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,6,10,0.72)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "64px 24px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 720, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "26px 34px 34px", position: "relative", boxShadow: "0 30px 80px -20px rgba(0,0,0,0.82)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: EX.base, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", color: EX.base }}><PlusIc /></span> Your idea
              </div>
              <button onClick={() => setShowFull(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: t.mut, padding: 4, display: "flex", lineHeight: 0 }}>
                <Svg w={18} sw={1.8}><path d="M6 6l12 12M18 6 6 18" /></Svg>
              </button>
            </div>
            <div style={{ fontSize: 15.5, lineHeight: 1.72, color: "#dfe2e8" }}>{idea}</div>
          </div>
        </div>
      )}
    </>
  );
}

function ReadSurface({ read, t }) {
  if (!read) return null;
  const b = read.branchability || {};
  const open = Array.isArray(read.open) ? read.open : [];
  return (
    <section style={{ marginTop: 48 }}>
      <Eyebrow num="1" icon={<SectionIcon.read />} title="Our read" sub="What's still open is the point" t={t} />
      <div style={{
        background: `linear-gradient(90deg, ${EX.dim}, transparent 22%), ${t.surface}`,
        border: `1px solid var(--exborder-soft)`, borderRadius: 14, padding: "26px 30px 22px",
      }}>
        {read.reflection && (
          <p style={{ fontSize: 14.5, color: "#c9cdd5", lineHeight: 1.62, margin: "0 0 24px", paddingLeft: 18, borderLeft: "2px solid rgba(122,162,255,0.55)", maxWidth: 840 }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: EX.base, display: "block", marginBottom: 9, fontWeight: 600 }}>We read this as</span>
            {read.reflection}
          </p>
        )}
        {open.length > 0 && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: EX.base, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", color: EX.base }}><QIc /></span> Still open
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 38px" }}>
              {open.map((it, i) => (
                <li key={i} style={{ display: "flex", gap: 11, fontSize: 15, lineHeight: 1.52, color: "#e9ebef" }}>
                  <span style={{ flexShrink: 0, color: EX.base, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>?</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {(b.state || b.reason) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${t.divider}`, marginTop: 22, paddingTop: 16 }}>
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 20, padding: "4px 11px" }}>
              <span style={{ width: 7, height: 7, border: `1.5px solid ${EX.base}`, transform: "rotate(45deg)", display: "inline-block" }} /> {BRANCH_LABEL(b.state, b.reason_type)}
            </span>
            <span style={{ fontSize: 12.5, color: t.sec, lineHeight: 1.5 }}>{b.reason}</span>
          </div>
        )}
      </div>
    </section>
  );
}


// ============================================================================
// 2 · Where it could go — the fan
// ============================================================================
function EssenceCard({ angle, active, dimmed, onEnter, onLeave, onClick }) {
  const opening = angle.justification?.opening || {};
  const kill = angle.justification?.disconfirmer || "";
  const kind = angle.disconfirmer_kind;
  return (
    <div data-aid={angle.id} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} style={{
      flex: 1, minWidth: 0, cursor: "default", display: "flex", flexDirection: "column",
      borderRadius: 13, padding: "22px 22px 16px",
      border: `1px solid ${active ? EX.line : "var(--exborder)"}`,
      background: active ? "var(--exsurf2)" : "var(--exsurface)",
      boxShadow: active ? "0 16px 38px -22px rgba(0,0,0,0.8)" : "none",
      transform: active ? "translateY(-5px)" : "none",
      position: active ? "relative" : "static",
      zIndex: active ? 5 : "auto",
      opacity: dimmed ? 0.55 : 1,
      transition: "border-color .18s, box-shadow .25s, transform .25s, opacity .2s",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--exmut)", border: "1px solid var(--exborder-soft)", borderRadius: 5, padding: "3px 7px", whiteSpace: "nowrap" }}>
          {SHIFT_LABEL[angle.basis?.primary] || "New angle"}
        </span>
        <ReadinessChip readiness={angle.readiness} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 2px", color: "var(--extext)", letterSpacing: "0.1px", lineHeight: 1.3 }}>{angle.title}</h3>

      <div style={{ marginTop: 14, minWidth: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--exmut)", marginBottom: 5 }}>The opening</div>
        <div style={{ display: "flex", gap: 9, minWidth: 0 }}>
          <span style={{ flexShrink: 0, color: EX.base, opacity: 0.9, marginTop: 1, display: "flex" }}><RoadIc /></span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: "#cdd0d6", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opening.text}</span>
        </div>
      </div>

      {kill && (
        <div style={{ marginTop: 14, minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--exmut)", marginBottom: 5 }}>The wall</div>
          <div style={{ display: "flex", gap: 9, minWidth: 0 }}>
            <span style={{ flexShrink: 0, color: WALL_CLAY, marginTop: 1, display: "flex" }}><WallIc /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.5, color: "#b7bcc6", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{kill}</span>
          </div>
          {kind && KIND_LABEL[kind] && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontFamily: "monospace", fontSize: 8, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--exsec)", border: "1px solid var(--exborder-soft)", borderRadius: 4, padding: "2px 6px" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: KIND_DOT[kind] || EX.base }} />
              {KIND_LABEL[kind]}
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--exdivider)", paddingTop: 13 }}>
        <span style={{ flexShrink: 0, fontSize: 11.5, color: active ? EX.bright : EX.base, fontWeight: 500, whiteSpace: "nowrap" }}>look closer ›</span>
      </div>
    </div>
  );
}

function Affordance({ children, onClick }) {
  const [h, setH] = useState(false);
  return (
    <span onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ fontSize: 11.5, color: h ? "var(--exsec)" : "var(--exmut)", display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
      {children}
    </span>
  );
}

function SaveAffordance({ state, onClick }) {
  const [h, setH] = useState(false);
  const saved = state === "saved", saving = state === "saving", err = state === "error";
  const label = saved ? "saved" : saving ? "saving…" : err ? "retry" : "save as rough idea";
  // pewter — the quiet anchor, dimmer than the two coloured journeys (matches the
  // Section 4 Save tile). "as rough idea" names what the save does: a rough branch.
  const color = saved ? EX.bright : err ? "#fca5a5" : (h ? "#d7deea" : "#aab4c3");
  return (
    <span onClick={saving || saved ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ fontSize: 13.5, fontWeight: 500, color, display: "inline-flex", gap: 8, alignItems: "center", cursor: saving || saved ? "default" : "pointer", opacity: saving ? 0.7 : 1, whiteSpace: "nowrap" }}>
      {saved ? <Svg w={15} sw={2}><path d="M5 13l4 4L19 7" /></Svg> : <Svg w={15} sw={1.7}><circle cx="12" cy="5" r="1.9" /><circle cx="6" cy="19" r="1.9" /><circle cx="18" cy="19" r="1.9" /><path d="M12 6.9v4.6M6 17.1v-3a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 14.1v3" /></Svg>} {label}
    </span>
  );
}

// Per-angle "explore" — Dawn, compass glyph (Explore's identity mark, same as the
// hub + Section 4 card), arrow that slides on hover. Replaces the old per-angle "compare" (two rough idea texts have
// nothing to compare; explore is the move that widens a rough angle into its own fan).
// When this angle has ALREADY been widened into a saved exploration (doneIdeaId),
// it flips to a done-state that OPENS that exploration instead of starting a new one.
function ExploreAffordance({ onClick, doneIdeaId, onOpen }) {
  const [h, setH] = useState(false);
  const done = !!doneIdeaId;
  return (
    <span onClick={done ? () => onOpen && onOpen(doneIdeaId) : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ fontSize: 13.5, fontWeight: 500, color: EX.base, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer", whiteSpace: "nowrap", filter: h ? "brightness(1.12)" : "none", transition: "filter .16s" }}>
      {done
        ? <><Svg w={15} sw={2}><path d="M5 13l4 4L19 7" /></Svg> in explore — open</>
        : <><Svg w={15} sw={2}><circle cx="12" cy="12" r="9" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" stroke="none" /></Svg> take it to explore</>}
      <span style={{ display: "inline-flex", transform: h ? "translateX(3px)" : "none", transition: "transform .18s" }}><Svg w={14} sw={1.9}><path d="M5 12h14M13 6l6 6-6 6" /></Svg></span>
    </span>
  );
}

// Per-angle "take it to deep" — violet (the cross-mode handoff colour), concentric
// target glyph (Deep's identity mark, same as the hub + Section 4 card), arrow that
// slides on hover. #9a8fd8 is a legible lift of
// the locked Deep accent (#8a82c2) — the pale tint washed out at text size.
// When this angle has ALREADY been taken to Deep (doneIdeaId), it flips to a
// done-state that OPENS that Deep verdict instead of starting a new evaluation.
function DeepAffordance({ onClick, doneIdeaId, onOpen }) {
  const [h, setH] = useState(false);
  const done = !!doneIdeaId;
  return (
    <span onClick={done ? () => onOpen && onOpen(doneIdeaId) : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ fontSize: 13.5, fontWeight: 500, color: "#9a8fd8", display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer", whiteSpace: "nowrap", filter: h ? "brightness(1.12)" : "none", transition: "filter .16s" }}>
      {done
        ? <><Svg w={15} sw={2}><path d="M5 13l4 4L19 7" /></Svg> in deep — view verdict</>
        : <><Svg w={15} sw={2}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></Svg> take it to deep</>}
      <span style={{ display: "inline-flex", transform: h ? "translateX(3px)" : "none", transition: "transform .18s" }}><Svg w={14} sw={1.9}><path d="M5 12h14M13 6l6 6-6 6" /></Svg></span>
    </span>
  );
}

function FanSurface({ idea, angles, fanState, t, onSave, saveState, onExploreAngle, onTakeToDeep, branchReason, angleStatus, onOpenChild, readOnly }) {
  const fanRef = useRef(null);
  const nodeRef = useRef(null);
  const rowRef = useRef(null);
  const wellRef = useRef(null);
  const innerRef = useRef(null);
  const hideTimer = useRef(null);
  const dwellTimer = useRef(null);
  const hoverRef = useRef(true);
  const [paths, setPaths] = useState("");
  const [vb, setVb] = useState("0 0 0 0");
  const [activeId, setActiveId] = useState(null);
  const [panelAngle, setPanelAngle] = useState(null);
  const [wellH, setWellH] = useState(0);
  const [caretLeft, setCaretLeft] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      hoverRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    }
  }, []);

  const draw = useCallback(() => {
    const fanEl = fanRef.current, nodeEl = nodeRef.current, rowEl = rowRef.current;
    if (!fanEl || !nodeEl || !rowEl) return;
    const fan = fanEl.getBoundingClientRect();
    const nb = nodeEl.getBoundingClientRect();
    const x1 = nb.left + nb.width / 2 - fan.left, y1 = nb.bottom - fan.top;
    const any = !!activeId;
    let p = "";
    [...rowEl.children].forEach((c) => {
      const cb = c.getBoundingClientRect();
      const x2 = cb.left + cb.width / 2 - fan.left, y2 = cb.top - fan.top;
      const dy = y2 - y1, c1 = y1 + dy * 0.55, c2 = y2 - dy * 0.55;
      const bez = `M ${x1} ${y1} C ${x1} ${c1}, ${x2} ${c2}, ${x2} ${y2}`;
      const on = c.getAttribute("data-aid") === activeId;
      const o1 = on ? 0.28 : 0.2;
      const o2 = on ? 0.85 : (any ? 0.22 : 0.58);
      p += `<path d="${bez}" fill="none" stroke="url(#exlg)" stroke-width="2" opacity="${o1}" filter="url(#exgl)"/>`;
      p += `<path d="${bez}" fill="none" stroke="url(#exlg)" stroke-width="${on ? 1.3 : 1.1}" opacity="${o2}"/>`;
      p += `<circle cx="${x2}" cy="${y2}" r="6" fill="${EX.gradB}" opacity="0.16"/>`;
      p += `<circle cx="${x2}" cy="${y2}" r="${on ? 3.6 : 3}" fill="${EX.gradB}" opacity="${on ? 1 : (any ? 0.5 : 1)}"/>`;
    });
    p += `<circle cx="${x1}" cy="${y1}" r="3.5" fill="${EX.gradA}"/>`;
    setPaths(p);
    setVb(`0 0 ${fan.width} ${fan.height}`);
  }, [activeId]);

  const positionWell = useCallback(() => {
    const wellEl = wellRef.current, rowEl = rowRef.current, innerEl = innerRef.current;
    if (!wellEl || !rowEl) return;
    if (activeId) {
      const cardEl = rowEl.querySelector(`[data-aid="${activeId}"]`);
      const wr = wellEl.getBoundingClientRect();
      if (cardEl) {
        const cr = cardEl.getBoundingClientRect();
        setCaretLeft(cr.left + cr.width / 2 - wr.left);
      }
      if (innerEl) setWellH(innerEl.offsetHeight);
    } else {
      setWellH(0);
    }
  }, [activeId]);

  const cancelHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };
  const cancelDwell = () => {
    if (dwellTimer.current) { clearTimeout(dwellTimer.current); dwellTimer.current = null; }
  };
  const showActive = (id) => {
    cancelHide(); cancelDwell();
    setActiveId(id);
    setPanelAngle(angles.find((a) => a.id === id) || null);
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => { hideTimer.current = null; setActiveId(null); }, 150);
  };
  const closeNow = () => { cancelHide(); cancelDwell(); setActiveId(null); };
  const onEnter = (id) => {
    if (!hoverRef.current) return;
    cancelHide();
    if (activeId) { showActive(id); return; } // already open: switch with no dwell
    cancelDwell();
    dwellTimer.current = setTimeout(() => { dwellTimer.current = null; showActive(id); }, 120);
  };
  const onLeave = () => { if (!hoverRef.current) return; cancelDwell(); scheduleHide(); };
  const onTap = (id) => { cancelDwell(); if (activeId === id) closeNow(); else showActive(id); };

  useLayoutEffect(() => { draw(); }, [draw, fanState, angles.length]);
  useLayoutEffect(() => { positionWell(); }, [positionWell, panelAngle]);

  useEffect(() => {
    if (fanState === "empty") return;
    const onResize = () => { draw(); positionWell(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw, positionWell, fanState]);

  useEffect(() => {
    if (!activeId) return;
    const onDown = (e) => {
      const fanEl = fanRef.current, wellEl = wellRef.current;
      if (fanEl && fanEl.contains(e.target)) return;
      if (wellEl && wellEl.contains(e.target)) return;
      closeNow();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [activeId]);

  useEffect(() => () => { cancelHide(); cancelDwell(); }, []);

  const pa = panelAngle;
  const bet = pa?.justification?.bet || {};

  const node = (
    <div ref={nodeRef} style={{
      width: 252, border: `1px solid ${EX.line}`, borderRadius: 14,
      background: `radial-gradient(120% 150% at 50% 0%, ${EX.dim}, transparent 62%), ${t.surfAlt}`,
      padding: "18px 20px 20px", position: "relative", boxShadow: `0 0 46px -14px ${EX.base}`,
    }}>
      <div style={{ position: "absolute", left: "50%", bottom: -6, width: 11, height: 11, borderRadius: "50%", background: EX.gradA, boxShadow: `0 0 0 5px ${EX.dim}, 0 0 16px 2px ${EX.gradA}`, transform: "translateX(-50%)" }} />
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: EX.bright, display: "flex", gap: 7, alignItems: "center", marginBottom: 9 }}>
        <SectionIcon.node /> your rough idea
      </div>
      <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea}</div>
    </div>
  );

  const right = fanState !== "empty"
    ? <span style={{ fontSize: 11, color: t.mut, fontFamily: "monospace", letterSpacing: "0.03em" }}>fan order · not ranked</span>
    : null;

  const lead = { fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", flex: "0 0 66px", marginTop: 2 };

  return (
    <section style={{ marginTop: 48 }} className="ex-scope">
      <Eyebrow num="2" icon={<SectionIcon.dir />} title="Where it could go" sub="Directions the evidence supports" t={t} right={right} />
      {fanState === "empty" ? (
        <div style={{ display: "grid", gridTemplateColumns: "252px 1fr", gap: 30, alignItems: "center" }}>
          {node}
          <div style={{ border: `1px dashed ${t.border}`, borderRadius: 13, padding: "34px 36px", background: t.surfAlt }}>
            <p style={{ fontSize: 16, color: t.text, fontWeight: 400, lineHeight: 1.5, margin: "0 0 10px" }}>No separate roads to fan from here — and that's a finding, not a dead end.</p>
            <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: 0 }}>{branchReason || "When an idea is already this pointed, exploration has nothing to widen. The honest next move is to judge it, not to branch it."}</p>
            {!readOnly && <div onClick={() => onTakeToDeep && onTakeToDeep(null, { useOriginalIdea: true })} style={{ marginTop: 14, fontSize: 12.5, color: EX.bright, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>take it to Deep as it stands →</div>}
          </div>
        </div>
      ) : (
        <>
          {fanState === "thin" && (
            <div style={{ fontSize: 12, color: t.mut, margin: "4px 0 8px" }}>The directions the evidence supports, shown in fan order.</div>
          )}
          <div ref={fanRef} style={{ position: "relative" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} viewBox={vb}
              dangerouslySetInnerHTML={{ __html: `<defs><linearGradient id="exlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${EX.gradA}"/><stop offset="1" stop-color="${EX.gradB}"/></linearGradient><filter id="exgl" x="-40%" y="-20%" width="180%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>${paths}` }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>{node}</div>
              <div ref={rowRef} style={{ display: "flex", gap: 22, marginTop: 92, alignItems: "stretch" }}>
                {angles.map((a) => (
                  <EssenceCard key={a.id} angle={a}
                    active={a.id === activeId}
                    dimmed={!!activeId && a.id !== activeId}
                    onEnter={() => onEnter(a.id)}
                    onLeave={onLeave}
                    onClick={() => onTap(a.id)} />
                ))}
              </div>
            </div>
          </div>

          <div ref={wellRef}
            onMouseEnter={() => { if (hoverRef.current) cancelHide(); }}
            onMouseLeave={() => { if (hoverRef.current) scheduleHide(); }}
            style={{ overflow: "hidden", height: wellH, transition: "height .3s cubic-bezier(.3,.8,.35,1)" }}>
            <div ref={innerRef} style={{ paddingTop: 18 }}>
              {pa && (
                <div style={{ position: "relative", border: "1px solid var(--exborder)", borderTop: `1px solid ${EX.line}`, borderRadius: 12, background: "var(--exsurf2)", padding: "18px 24px 13px", boxShadow: "0 18px 44px -26px rgba(0,0,0,0.8)" }}>
                  <span style={{ position: "absolute", top: -6, left: caretLeft, width: 11, height: 11, background: "var(--exsurf2)", borderLeft: `1px solid ${EX.line}`, borderTop: `1px solid ${EX.line}`, transform: "translateX(-50%) rotate(45deg)" }} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 15, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 5, padding: "3px 7px" }}>{SHIFT_LABEL[pa.basis?.primary] || "New angle"}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--extext)", letterSpacing: "0.1px" }}>{pa.title}</span>
                  </div>
                  {/* The expansion COMPLETES the card: full opening + full wall
                      (the two fields the card clamps to 2 lines), then the bet as
                      the deeper read. "the wall" and the old "the limit" were the
                      same field (justification.disconfirmer) shown twice — the
                      duplicate row is dropped so clicking finishes the thought the
                      card started instead of repeating the wall. */}
                  <div style={{ display: "flex", gap: 16, marginBottom: 13 }}>
                    <span style={{ ...lead, color: EX.base }}>the opening</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.58, color: "#e3e5e9" }}>{pa.justification?.opening?.text}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 13 }}>
                    <span style={{ ...lead, color: WALL_CLAY }}>the wall</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.58, color: "var(--exsec)" }}>{pa.justification?.disconfirmer}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 13 }}>
                    <span style={{ ...lead, color: EX.bright }}>the bet</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.58, color: "#e3e5e9" }}>Works only if {bet.text}.{bet.rests_on && (
                      <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.06em", color: "var(--exmut)", border: "1px solid var(--exborder-soft)", borderRadius: 4, padding: "1px 6px", marginLeft: 7, whiteSpace: "nowrap", textTransform: "uppercase" }}>{bet.rests_on}</span>
                    )}</span>
                  </div>
                  {!readOnly && (
                  <div style={{ display: "flex", gap: 26, alignItems: "center", borderTop: "1px solid var(--exdivider)", paddingTop: 14, marginTop: 2, flexWrap: "wrap" }}>
                    <SaveAffordance state={(saveState || {})[pa.id]} onClick={() => onSave && onSave(pa)} />
                    <ExploreAffordance
                      doneIdeaId={(angleStatus && angleStatus[pa.id] && angleStatus[pa.id].explore) || null}
                      onOpen={onOpenChild}
                      onClick={() => onExploreAngle && onExploreAngle(pa)} />
                    <DeepAffordance
                      doneIdeaId={(angleStatus && angleStatus[pa.id] && angleStatus[pa.id].deep) || null}
                      onOpen={onOpenChild}
                      onClick={() => onTakeToDeep && onTakeToDeep(pa.id, { useOriginalIdea: false })} />
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================================
// 3 · Where this could fit — terrain (map + reader)
// ============================================================================
function TerrainSurface({ terrain, angles, t }) {
  const lanes = Array.isArray(terrain?.lanes) ? terrain.lanes : [];
  const firms = terrain?.firms_up_fastest || null;

  // lanes that the fastest angle(s) sit in (firms_up_fastest references angles)
  const fastLaneIds = new Set();
  if (firms && Array.isArray(firms.angle_refs)) {
    firms.angle_refs.forEach((aid) => {
      const a = angles.find((x) => x.id === aid);
      if (a?.lane_ref) fastLaneIds.add(a.lane_ref);
    });
  }

  const defaultLane = (lanes.find((l) => l.status === "open") || lanes[0] || null);
  const [selId, setSelId] = useState(defaultLane?.id || null);
  useEffect(() => { setSelId(defaultLane?.id || null); /* eslint-disable-next-line */ }, [lanes.length]);
  const sel = lanes.find((l) => l.id === selId) || defaultLane;

  if (lanes.length === 0) return null;

  // real competitor density per zone (distinct named players across its lanes)
  const zoneCounts = {};
  let maxCount = 1;
  ZONES.forEach(([zkey]) => {
    const names = new Set();
    lanes.filter((l) => l.status === zkey).forEach((l) => (l.reference_items || []).forEach((r) => { if (r && r.name) names.add(String(r.name).toLowerCase()); }));
    zoneCounts[zkey] = names.size;
    if (names.size > maxCount) maxCount = names.size;
  });

  return (
    <section style={{ marginTop: 48 }}>
      <style>{`
        @keyframes ilcPing { 0% { transform: scale(.6); opacity: .55 } 80%, 100% { transform: scale(1.85); opacity: 0 } }
        .ilc-pulse { position: relative }
        .ilc-pulse::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0; animation: ilcPing 2.4s ease-out infinite }
        @media (prefers-reduced-motion: reduce) { .ilc-pulse::after { animation: none; opacity: 0 } }
      `}</style>
      <Eyebrow num="3" icon={<SectionIcon.terr />} title="Where this could fit" sub="The market around these directions" t={t} />
      <div style={{ display: "grid", gridTemplateColumns: "296px 1fr", border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden", minHeight: 300 }}>
        <div style={{ borderRight: `1px solid ${t.divider}`, background: t.surfAlt }}>
          {ZONES.map(([zkey, zlabel], i) => {
            const inZone = lanes.filter((l) => l.status === zkey);
            const vis = ZONE_VIS[zkey] || ZONE_VIS.lightly_served;
            const count = zoneCounts[zkey] || 0;
            const fill = Math.round((count / maxCount) * 100);
            return (
              <div key={zkey} style={{ padding: "14px 16px 12px", borderTop: i === 0 ? "none" : `1px solid ${t.divider}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={{ color: t.mut, display: "flex" }}><StatusShape status={zkey} /></span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut }}>{zlabel}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 9, fontWeight: 700, borderRadius: 20, padding: "1px 7px", background: vis.badge, color: vis.badgeFg }}>{count}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, marginBottom: inZone.length ? 6 : 2, overflow: "hidden",
                  background: zkey === "open" ? "transparent" : "rgba(255,255,255,0.06)",
                  border: zkey === "open" ? "1px dashed rgba(122,162,255,0.3)" : "none" }}>
                  {zkey !== "open" && <div style={{ height: "100%", width: `${fill}%`, borderRadius: 3, background: vis.fill }} />}
                </div>
                {inZone.length ? inZone.map((l) => (
                  <LaneNode key={l.id} lane={l} selected={l.id === selId} t={t} onSelect={() => setSelId(l.id)} dotColor={vis.dot} />
                )) : (
                  <div style={{ fontSize: 12, color: t.faint, fontStyle: "italic", padding: "6px 2px 2px" }}>— {zkey === "open" ? "open ground, nothing here" : "nothing here"}</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {sel && <LaneReader lane={sel} fast={fastLaneIds.has(sel.id)} t={t} />}
        </div>
      </div>
      {firms?.text && (
        <div style={{ marginTop: 20, display: "flex", gap: 16, alignItems: "flex-start",
          border: "1px solid rgba(122,162,255,0.28)", borderRadius: 13,
          background: `linear-gradient(120deg, ${EX.dim}, transparent 64%), var(--exsurf2)`,
          padding: "20px 24px" }}>
          <span style={{ flexShrink: 0, color: EX.base, marginTop: 1 }}><BoltIc /></span>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: EX.base, marginBottom: 9 }}>Your next move · cheapest test on the board</div>
            <div style={{ fontSize: 14, color: "var(--extext)", lineHeight: 1.55, maxWidth: 800 }}>{firms.text}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function LaneNode({ lane, selected, t, onSelect, dotColor }) {
  const [h, setH] = useState(false);
  const on = selected || h;
  return (
    <button
      onClick={onSelect} onMouseEnter={() => { setH(true); onSelect(); }} onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        background: on ? "rgba(122,162,255,0.08)" : "var(--exsurface)",
        border: `1px solid ${on ? "rgba(122,162,255,0.5)" : "var(--exborder-soft)"}`,
        borderRadius: 10, padding: "11px 13px", marginTop: 7, cursor: "pointer", fontFamily: "inherit",
        boxShadow: h && !selected ? "0 8px 22px -14px rgba(122,162,255,0.5)" : "none",
        transform: h && !selected ? "translateY(-1px)" : "none",
        transition: "border-color .15s, box-shadow .2s, transform .15s, background .15s",
      }}>
      <span className="ilc-pulse" style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: dotColor || EX.base, color: dotColor || EX.base }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, color: on ? "var(--extext)" : "var(--exsec)" }}>{lane.label}</span>
      <span style={{ flexShrink: 0, color: on ? EX.base : "var(--exmut)", display: "flex", transition: "color .15s, transform .15s", transform: h ? "translateX(2px)" : "none" }}><RoadIc /></span>
    </button>
  );
}

function LaneReader({ lane, fast, t }) {
  const answered = lane.demand_question == null;
  const typePhrase = lane.lane_type ? LANE_TYPE_PHRASE[lane.lane_type] : null;
  // Crowded lane (demand_question null): lead with the lane_type read — real
  // backend content — rather than a canned sentence. Open lane: the
  // demand_question is the hero, lane_type rides under it as characterization.
  const hero = answered
    ? (typePhrase || "Demand is evidenced by the paying incumbents — the open question is how you'd differ, not whether anyone wants it.")
    : lane.demand_question;
  const refs = Array.isArray(lane.reference_items) ? lane.reference_items.map((r) => r.name).filter(Boolean) : [];
  return (
    <>
      {fast && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 20, padding: "3px 9px", marginBottom: 15, alignSelf: "flex-start" }}>
          <BoltIc /> Firms up fastest
        </span>
      )}
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase", color: t.mut, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        {answered ? <ReadLinesIc /> : <QIc />}{answered ? "The read" : "The open question"}
      </div>
      <div style={{ fontSize: 17, fontWeight: 300, lineHeight: 1.5, color: answered ? t.sec : EX.bright, letterSpacing: "0.1px" }}>{hero}</div>
      {!answered && typePhrase && (
        <div style={{ fontSize: 12.5, color: t.mut, lineHeight: 1.55, marginTop: 12, fontStyle: "italic" }}>{typePhrase}</div>
      )}
      {lane.substitute_tell?.signal && <div style={{ fontSize: 12.5, color: t.sec, lineHeight: 1.55, marginTop: 16 }}>Today, {lane.substitute_tell.signal}.</div>}
      {refs.length > 0 && <div style={{ fontSize: 12, color: t.mut, marginTop: 9 }}>Alongside {refs.join(", ")}</div>}
    </>
  );
}

// ============================================================================
// 4 · From here — the ONE surface that acts on the whole idea (idea-x).
//
// Per-angle save / explore / take-to-Deep already live on each angle's expanded
// card (Section 2). So Section 4 does NOT re-list per-angle actions — it owns the
// only thing the angle rows can't: the PARENT's three fates. Same save/explore/
// deep vocabulary as the angles, at parent scale.
//
// No recommendation, no "which angle to pick", no consequence surface. Explore is
// no score / no rank / no verdict; the narrowing is the founder's move, not ours.
// We hand back the open question (the unresolved thing, not advice) and list the
// three options. The pointer line tells them the angle-level actions exist.
//
// Palette is pinned to the approved mockup (explore-fromhere-v2): Save = grounded
// pewter (persistence, NOT a third mode), Explore = Dawn, Take-to-Deep = violet
// (the cross-mode handoff colour).
// ============================================================================
const M4 = {
  ink: "#e9eef5", ink2: "#c3ccd7", mut: "#8b94a1", mut2: "#646d79",
  line: "rgba(255,255,255,0.07)", line2: "rgba(255,255,255,0.05)",
  panelA: "rgba(255,255,255,0.028)", panelB: "rgba(255,255,255,0.018)",
};

const TILE_THEME = {
  save: {
    line: "rgba(255,255,255,0.16)", lineHi: "rgba(255,255,255,0.26)",
    bg: "rgba(255,255,255,0.045)", bgHi: "rgba(255,255,255,0.06)",
    medBg: "rgba(255,255,255,0.05)", medBgHi: "rgba(255,255,255,0.08)",
    ic: "#aab4c3", icHi: "#d7deea", title: M4.ink, cue: "#646d79", cueHi: "#8b94a1",
    shadow: "0 14px 34px rgba(0,0,0,0.34)", medGlow: "none", grad: false,
  },
  explore: {
    line: "rgba(122,162,255,0.55)", lineHi: "#7aa2ff",
    bg: "rgba(122,162,255,0.11)", bgHi: "rgba(122,162,255,0.17)",
    medBg: "rgba(122,162,255,0.11)", medBgHi: "rgba(122,162,255,0.11)",
    ic: "#7aa2ff", icHi: "#d2e0ff", title: "#d2e0ff", cue: "#7aa2ff", cueHi: "#7aa2ff",
    shadow: "0 14px 36px rgba(122,162,255,0.30)", medGlow: "0 0 18px rgba(122,162,255,0.30)", grad: true, fade: "transparent",
  },
  deep: {
    line: "rgba(138,130,194,0.6)", lineHi: "#8a82c2",
    bg: "rgba(138,130,194,0.13)", bgHi: "rgba(138,130,194,0.2)",
    medBg: "rgba(138,130,194,0.13)", medBgHi: "rgba(138,130,194,0.13)",
    ic: "#8a82c2", icHi: "#cbc3ee", title: "#cbc3ee", cue: "#8a82c2", cueHi: "#8a82c2",
    shadow: "0 14px 38px rgba(138,130,194,0.34)", medGlow: "0 0 20px rgba(138,130,194,0.34)", grad: true, fade: "rgba(138,130,194,0.02)",
  },
};

// glyphs encode the action (motion), so the founder reads what each tile does
// before the label: Save = a little family tree (parent + two children held
// together); Explore = fans up/out (diverge); Deep = mirror, converges to a
// filled point (pressure → verdict).
function GlyphSave() { return (<Svg w={15} sw={1.7}><circle cx="12" cy="5" r="1.9" /><circle cx="6" cy="19" r="1.9" /><circle cx="18" cy="19" r="1.9" /><path d="M12 6.9v4.6M6 17.1v-3a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 14.1v3" /></Svg>); }
function GlyphExplore() { return (<Svg w={15} sw={1.7}><circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none" /><path d="M12 19 5 7M12 19 12 5M12 19 19 7" /></Svg>); }
function GlyphDeep() { return (<Svg w={15} sw={1.7}><path d="M5 5 12 17M12 4 12 17M19 5 12 17" /><circle cx="12" cy="18.4" r="1.7" fill="currentColor" stroke="none" /></Svg>); }

function Tile({ variant, glyph, title, desc, cue, arrow, onClick, busy }) {
  const [h, setH] = useState(false);
  const c = TILE_THEME[variant];
  const on = h && !busy;
  return (
    <button
      onClick={busy ? undefined : onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: "relative", textAlign: "left", fontFamily: "inherit",
        cursor: busy ? "default" : "pointer",
        borderRadius: 13, padding: "13px 15px 11px", minHeight: 96,
        display: "flex", flexDirection: "column",
        border: `1px solid ${on ? c.lineHi : c.line}`,
        background: c.grad
          ? `linear-gradient(180deg, ${on ? c.bgHi : c.bg}, ${c.fade} 88%)`
          : (on ? c.bgHi : c.bg),
        boxShadow: on ? c.shadow : "none",
        transform: on ? "translateY(-2px)" : "none",
        transition: "transform .16s, border-color .16s, background .16s, box-shadow .16s",
        opacity: busy ? 0.85 : 1,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 9 }}>
        <span style={{
          width: 28, height: 28, flex: "0 0 28px", borderRadius: 8, display: "grid", placeItems: "center",
          background: on ? c.medBgHi : c.medBg, border: `1px solid ${c.line}`, color: on ? c.icHi : c.ic,
          boxShadow: on ? c.medGlow : "none", transition: ".16s",
        }}>{glyph}</span>
        <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: 0, color: c.title }}>{title}</h3>
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: M4.mut, margin: "0 0 auto" }}>{desc}</p>
      <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.1em", color: on ? c.cueHi : c.cue }}>
        {cue}
        {arrow && (
          <span style={{ display: "inline-flex", transform: on ? "translateX(3px)" : "none", transition: "transform .18s" }}>
            <Svg w={13} sw={2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
          </span>
        )}
      </span>
    </button>
  );
}

// Save is the one parent fate with state. It folds in the old SaveExploredBar's
// logic: auth-gates (logged-out → auth modal), tracks idle/saving/saved/error,
// and when the idea was reopened from the hub it already shows saved. onSave is
// idempotent on the page side — angles saved individually from their rows are NOT
// double-saved when the family is saved here.
function SaveTile({ user, viewingFromSaved, onSave, onAuth, goToMyIdeas, angleCount }) {
  const [state, setState] = useState(viewingFromSaved ? "saved" : "idle"); // idle | saving | saved | error
  const fam = angleCount > 0
    ? `and all ${angleCount} direction${angleCount === 1 ? "" : "s"}`
    : "and its directions";
  const doSave = async () => {
    if (!user) { onAuth && onAuth(); return; }
    if (state === "saving" || state === "saved" || !onSave) return;
    setState("saving");
    try { await onSave(); setState("saved"); }
    catch (e) { setState("error"); }
  };
  if (state === "saved") {
    return (
      <DirectionCard skin="save" glyph="save" title="Saved"
        desc={`Your idea ${fam}, kept together.`}
        cue="In my ideas" done onClick={() => goToMyIdeas && goToMyIdeas()} />
    );
  }
  const title = state === "saving" ? "Saving…" : state === "error" ? "Try again" : "Save";
  const desc = !user
    ? `Log in to keep your idea ${fam} together.`
    : `Keeps your idea ${fam} together in My Ideas.`;
  return (
    <DirectionCard skin="save" glyph="save" title={title} desc={desc}
      cue={state === "error" ? "Retry" : "Keeps the family"} busy={state === "saving"} onClick={doSave} />
  );
}

function NextMoveSurface({ nextMove, angleCount, t, user, viewingFromSaved, onSave, onExplore, onDeep, onAuth, goToMyIdeas }) {
  const du = (nextMove && nextMove.dominant_uncertainty) || {};
  return (
    <section style={{ marginTop: 48 }}>
      <Eyebrow num="4" icon={<SectionIcon.next />} title="From here" sub="What now — for the whole idea" t={t} />
      <div style={{ border: `1px solid ${M4.line}`, borderRadius: 14, padding: "26px 30px 22px", background: `linear-gradient(180deg, ${M4.panelA}, ${M4.panelB})` }}>

        {du.text && (
          <>
            <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", color: M4.mut2, display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
              <span style={{ color: EX.base, fontSize: 12 }}>?</span>THE OPEN QUESTION
            </div>
            <div style={{ borderLeft: `2px solid ${EX.line}`, paddingLeft: 20, marginBottom: 24 }}>
              <h2 style={{ fontWeight: 400, fontSize: 17, lineHeight: 1.5, letterSpacing: "-0.01em", color: M4.ink, margin: 0 }}>{du.text}</h2>
            </div>
            <div style={{ height: 1, background: M4.line2, margin: "24px 0 20px" }} />
          </>
        )}

        <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.2em", color: M4.mut2, display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          DO SOMETHING WITH IT
          <span style={{ fontFamily: "inherit", fontStyle: "normal", fontSize: 13, letterSpacing: "0.01em", color: M4.mut }}>
            your idea — the seed you explored
            {angleCount > 0 ? <>, with all <b style={{ color: M4.ink2, fontWeight: 500 }}>{angleCount} direction{angleCount === 1 ? "" : "s"}</b> attached</> : null}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <SaveTile user={user} viewingFromSaved={viewingFromSaved} onSave={onSave} onAuth={onAuth} goToMyIdeas={goToMyIdeas} angleCount={angleCount} />
          <DirectionCard skin="explore" glyph="explore" title="Explore again"
            desc="Re-widen into a fresh fan of directions."
            cue="Widen" onClick={() => onExplore && onExplore()} />
          <DirectionCard skin="deep" glyph="deep" title="Take to Deep"
            desc="Send the whole idea for a scored verdict."
            cue="To verdict" onClick={() => onDeep && onDeep()} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${M4.line2}`, fontSize: 13, color: M4.mut }}>
          <span style={{ color: M4.mut2, flexShrink: 0, display: "inline-flex" }}><Svg w={15} sw={1.7}><path d="M7 17 17 7M9 7h8v8" /></Svg></span>
          <span>
            Want to act on a single direction instead? Each angle above carries its own{" "}
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#aab4c3" }}>save</span> ·{" "}
            <span style={{ fontFamily: "monospace", fontSize: 11, color: EX.base }}>explore</span> ·{" "}
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9a8fd8" }}>take to Deep</span>.
          </span>
        </div>
      </div>

      <div style={{ marginTop: 30, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.05em", color: M4.mut2, textAlign: "center" }}>
        While exploring:&nbsp;&nbsp;<b style={{ color: M4.mut, fontWeight: 400 }}>open more than one path in Deep</b>&nbsp;·&nbsp;<b style={{ color: M4.mut, fontWeight: 400 }}>look for patterns across directions</b>&nbsp;·&nbsp;<b style={{ color: M4.mut, fontWeight: 400 }}>follow curiosity, not commitment.</b>
      </div>
    </section>
  );
}

// ============================================================================
// ExploreView — screen shell + the four surfaces
// ============================================================================

export default function ExploreView({
  screen,
  t,
  analysis,
  user,
  viewingFromSaved,
  showAuthModal,
  setCurrentScreen,
  setShowAuthModal,
  setUser,
  setViewingFromSaved,
  goToMyIdeas,
  // explore action handlers (all optional)
  onTakeToDeep,
  onSaveBranch,      // per-angle save (rough branch)
  onExploreAngle,    // per-angle "explore" — widen one angle into its own fan
  onExploreVariation, // parent "Explore again" — re-widen idea-x
  onSaveExplore,     // parent "Save" — keep idea-x + all angles as one family
  savedBranchTexts,  // Set of branch texts already saved under this family (page.js)
  handledAngleIds,   // Set of angle ids already taken forward (id-based, edit-proof)
  angleStatus,       // { [angleId]: { explore: ideaId, deep: ideaId } } — per-angle done targets
  onOpenChild,       // (ideaId) => open that saved child (jump to its Explore/Deep)
  // read-only viewer — a preserved explore read opened from the deep surface or Lineage
  readOnly,
  onBackToCurrent,
  outdatedMeta,
}) {
  if (!analysis || analysis.schema_version !== "ll2_explore_v1") return null;

  const { idea, fan_state: fanState, read, angles = [], terrain, next_move: nextMove } = analysis;

  const [saveState, setSaveState] = useState({}); // { [angleId]: "saving" | "saved" | "error" }
  const saveBranch = useCallback(async (ids) => {
    const list = ids && ids.length ? ids : [];
    if (!list.length || !onSaveBranch) return;
    setSaveState((s) => { const n = { ...s }; list.forEach((id) => { if (n[id] !== "saved") n[id] = "saving"; }); return n; });
    try {
      await onSaveBranch(list);
      setSaveState((s) => { const n = { ...s }; list.forEach((id) => { n[id] = "saved"; }); return n; });
    } catch (e) {
      setSaveState((s) => { const n = { ...s }; list.forEach((id) => { if (n[id] !== "saved") n[id] = "error"; }); return n; });
    }
  }, [onSaveBranch]);

  // Effective per-angle save state. Persisted handled-state (from page.js, derived
  // from the family's REAL children so it survives leaving + returning) seeds
  // "saved"; live in-session state overrides it (saving / error / just-saved).
  // An angle counts as handled by ID (origin_angle_id on any child — robust to
  // seed edits when taken to Deep/Explore) OR by branch TEXT (a rough-branch save
  // stores the angle text verbatim; kept for older rows with no id).
  const persistedSaved = {};
  (angles || []).forEach((a) => {
    const byId = handledAngleIds && handledAngleIds.has(a.id);
    const byText =
      savedBranchTexts && savedBranchTexts.has((a.branch_idea_text || "").trim());
    if (byId || byText) persistedSaved[a.id] = "saved";
  });
  const effectiveState = { ...persistedSaved, ...saveState };
  // Idempotent save: an already-saved (or in-flight) angle never re-POSTs, so the
  // same direction can't be saved twice into a pile of duplicates.
  const onSaveAngle = (a) => {
    if (!a) return;
    const st = effectiveState[a.id];
    if (st === "saved" || st === "saving") return;
    saveBranch([a.id]);
  };

  // Explore neutral surface palette — pinned to the locked mockup
  // (explore-mode-final.html), which uses faintly blue-tinted darks for cohesion
  // with Dawn. The app's generic T.dark tokens are neutral/translucent grays;
  // that mismatch is what made Section 3 (terrain nav + lanes, heavy on
  // surf2/surf3/divider) read off vs the mockup. Every surface gets xt.
  const xt = {
    ...t,
    bg: "#0a0d13", surface: "#0e1117", surfAlt: "#12161d", surf3: "#161b24",
    border: "rgba(55,55,55,0.42)", text: "#f0f0f0", sec: "#a0a0a0",
    mut: "#6b6f78", faint: "#474b54", divider: "#1d2027",
  };

  // CSS-var scope so nested cards inherit explore-aware tokens without prop drilling
  const scopeVars = {
    "--extext": xt.text, "--exsec": xt.sec, "--exmut": xt.mut, "--exfaint": xt.faint,
    "--exsurface": xt.surface, "--exsurf2": xt.surfAlt, "--exborder": xt.border,
    "--exborder-soft": "rgba(55,55,55,0.24)", "--exdivider": xt.divider,
  };

  return (
    <div style={{ background: xt.bg, color: xt.text, overflowX: "hidden", ...scopeVars }}>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal && setShowAuthModal(false)} onAuth={(u) => setUser && setUser(u)} t={t} />}

      <main style={{ flex: 1, paddingBottom: 80 }}>
        <PageContainer wide>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 22px" }}>
            <ModeTitle mode="explore" />
            <BackLink t={t} color={readOnly ? EX.bright : undefined} onClick={() => { if (readOnly) { onBackToCurrent && onBackToCurrent(); return; } if (viewingFromSaved) { setViewingFromSaved && setViewingFromSaved(false); goToMyIdeas && goToMyIdeas(); } else { setCurrentScreen && setCurrentScreen("input"); } }}>
              {readOnly ? "Back to current read" : (viewingFromSaved ? "Back to My Ideas" : "Back to idea")}
            </BackLink>
          </div>
          <SeedSurface idea={idea} t={xt} />
          {readOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "rgba(231,189,122,.06)", border: "1px solid rgba(231,189,122,.35)", borderRadius: 12, padding: "13px 16px", marginTop: 16 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e7bd7a", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "#e7bd7a", fontWeight: 600 }}>
                The explored read
                <span style={{ color: xt.sec, fontWeight: 400 }}>{outdatedMeta && outdatedMeta.superseded_at ? ` — superseded ${new Date(outdatedMeta.superseded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, when this idea was taken to deep. Kept for reference; the live read is the deep verdict.` : " — kept for reference after this idea was taken to deep. The live read is the deep verdict."}</span>
              </span>
            </div>
          )}
          <ReadSurface read={read} t={xt} />
          <FanSurface idea={idea} angles={angles} fanState={fanState} t={xt}
            onSave={onSaveAngle} saveState={effectiveState}
            onExploreAngle={(a) => onExploreAngle && onExploreAngle(a)}
            onTakeToDeep={onTakeToDeep} branchReason={read?.branchability?.reason}
            angleStatus={angleStatus} onOpenChild={onOpenChild} readOnly={readOnly} />
          <TerrainSurface terrain={terrain} angles={angles} t={xt} />
          {!readOnly && (
          <NextMoveSurface
            nextMove={nextMove}
            angleCount={angles.length}
            t={xt}
            user={user}
            viewingFromSaved={viewingFromSaved}
            onSave={onSaveExplore}
            onExplore={onExploreVariation}
            onDeep={() => onTakeToDeep && onTakeToDeep(null, { useOriginalIdea: true })}
            onAuth={() => setShowAuthModal && setShowAuthModal(true)}
            goToMyIdeas={goToMyIdeas}
          />
          )}
          <div style={{ marginTop: 30, paddingTop: 18, borderTop: `1px solid ${t.border}` }}>
            <Caption t={t} mono style={{ margin: 0, color: "#474b54" }}>EXPLORE — WIDENS A ROUGH IDEA · NO SCORE, NO RANK, NO VERDICT</Caption>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}