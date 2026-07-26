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
//                justification{ opening{text,evidence_refs[{type,label,why_relevant,
//                receipt?{name,url,source,evidence_strength,data_source}}],trust},
//                bet{text,rests_on}, disconfirmer },
//                readiness (routing plumbing — NOT rendered; see label-maps note), lane_ref }
//   terrain    { lanes[{id,label,status,lane_type,reference_items[{name,type,
//                receipt?{...}}], substitute_tell{exists,signal},demand_question}],
//                firms_up_fastest{text,angle_refs[]} }
//   `receipt` is route-hydrated (slice 1) from validated Stage 1 items; absent
//   on payloads saved before the hydration shipped — every receipt render is
//   subtractive, so old payloads simply show unlinked chips or no row.
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

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
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


// ---- label maps ------------------------------------------------------------
// (removed) The readiness chip. The enum compressed three axes into one word —
// evidence footing, commercial condition, and workflow routing — and the
// compression lied in the dangerous direction: probably_thin fires on a
// STRONGLY-evidenced direction blocked by an incumbent, and any grounding-
// flavored display word ("Lightly grounded" was the worst offender) misreads
// that as weak evidence. The atoms already carry the card honestly and
// single-axis each: the wall's KIND badge (below) is the commercial condition;
// the receipts row is the evidence footing. readiness stays in the payload as
// routing plumbing; it is no longer a visible grade.

// the disconfirmer (kill) named on the card face — the wall, not just the way in
const KIND_LABEL = {
  direct_incumbent_holds: "Incumbent holds", free_substitute_floor: "Free substitute",
  demand_unproven: "Demand unproven", structural_barrier: "Structural wall", closeable_gap: "Closeable gap",
};
// (removed) KIND_DOT. The wall-kind moved up into the comparison rail, and the
// rail is deliberately colorless: a red dot on "incumbent holds" vs blue on
// "closeable gap" is a grade in miniature — exactly what the rail exists to
// avoid. The kind differentiates by its words.
const WALL_CLAY = "#c89e6b";
const WallIc = () => <Svg w={13} sw={1.8}><circle cx="12" cy="12" r="8.5" /><path d="M6.5 6.5l11 11" /></Svg>;

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

// (removed) ZONES + ZONE_DOT + StatusShape — the zone-grouped lane rail they
// served was retired with the two-pane terrain. The colorless-density ruling
// they encoded survives in the transect: position comes from the status enum,
// the axis legend is one neutral value, and blue stays an interaction colour.

// (currently unrendered) branchability display was retired with the Observatory
// read — the section ends on the dark-patches caption. Helper kept: restoring
// the chip is one JSX line and this mapping is the vocabulary for it.
const BRANCH_LABEL = (state, reasonType) => {
  if (state === "branchable") return "Branchable";
  if (state === "partially_branchable") return "Partially branchable";
  if (reasonType === "already_specific") return "Ready to judge";
  if (reasonType === "evidence_too_thin") return "Too thin to branch";
  if (reasonType === "too_vague" || reasonType === "too_broad") return "Too broad to fan yet";
  return "Not branchable";
};

// ---- receipts --------------------------------------------------------------
// The evidence an angle or lane visibly rests on — rendered in DEEP'S evidence
// idiom, not a new one. Evidence is the single spine both modes share (same
// Stage 1, same retrieval, same receipts), so it wears one visual language:
// the TYPE carries the color, exactly the typeBadge tokens Deep's field uses
// (components.js, dark theme) — direct red, adjacent amber, substitute blue,
// model-only gray — and the name links out when a receipt url exists, same as
// Deep's roster rows. Prose-fact refs (landscape_fact / barrier) have no named
// item behind them: hollow dot, no link. Fully subtractive on older payloads:
// no receipt → an uncolored, unlinked chip; no refs → no row.
// ONE EVIDENCE INK (variant A of the evidence-ink mockup, Emre's call):
// every named receipt — prose and chips alike — wears a single light
// steel-dawn. The signal is single and learnable: "this is a named, reachable
// receipt." Deep's semantic type palette stays Deep's: on Explore's surface,
// coloring a direct competitor red is a threat grade — a quiet verdict in the
// no-verdict mode (the freight eval, all-direct, painted the whole page red).
// Type and source live in the tooltip; grounding lives in the link itself.
const EVIDENCE_INK = "#9fc0e7";
const PROSE_REF_TYPES = new Set(["landscape_fact", "barrier"]);

function ReceiptChip({ r }) {
  const [h, setH] = useState(false);
  const label = r.label || r.name || "";
  const rc = r.receipt || null;
  const proseRef = PROSE_REF_TYPES.has(r.type);
  const ctype = rc?.competitor_type || null;
  const title = [r.why_relevant, ctype ? ctype : null, rc?.source ? `source: ${rc.source}` : null,
    rc?.evidence_strength ? `trust: ${rc.evidence_strength}` : null]
    .filter(Boolean).join(" · ");
  const inner = (
    <span
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "monospace", fontSize: 10, letterSpacing: "0.03em",
        color: h && rc?.url ? "#e4ebf8" : "#aeb6c4",
        border: "1px solid rgba(148,163,200,0.14)", borderRadius: 5, padding: "3px 8px",
        whiteSpace: "nowrap", cursor: rc?.url ? "pointer" : "default",
        transition: "color .14s, border-color .14s",
        borderColor: h && rc?.url ? "rgba(148,163,200,0.3)" : "rgba(148,163,200,0.14)",
      }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: proseRef ? "transparent" : EVIDENCE_INK,
        border: proseRef ? "1px solid var(--exmut)" : "none",
      }} />
      {label}
      {rc?.url && <span style={{ fontSize: 9, color: "#79818f" }}>↗</span>}
    </span>
  );
  return rc?.url
    ? <a href={rc.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>
    : inner;
}

function ReceiptRow({ refs, lead }) {
  const list = (Array.isArray(refs) ? refs : []).filter((r) => r && (r.label || r.name));
  if (!list.length) return null;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", flex: "0 0 72px", marginTop: 4, color: "#79818f" }}>{lead}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 7 }}>
        {list.map((r, i) => <ReceiptChip key={i} r={r} />)}
      </span>
    </div>
  );
}

// ---- evidence names IN PROSE ----------------------------------------------
// Deep's signature move: evidence names are colored and linked inside the
// prose itself — "the case" reads with the actors lit up in place. Explore
// inherits the same behavior so the two modes visibly share one evidence
// spine: any name the canonical index knows (route-hydrated receipts on angle
// refs + lane reference_items) gets colored wherever it appears in Explore's
// prose, and links out when a receipt url exists. One ink for all of it —
// EVIDENCE_INK above — per the evidence-ink mockup decision (variant A). Old
// payloads have no receipts → the entity list is empty → all prose renders
// exactly as before (subtractive, like every receipt surface).
function buildEvidenceEntities(analysis) {
  const seen = new Map();
  const add = (name, rc) => {
    if (!name || typeof name !== "string") return;
    const key = name.toLowerCase().trim();
    if (key.length < 3 || seen.has(key)) return;
    seen.set(key, { name, key, url: rc?.url || null, color: EVIDENCE_INK,
      type: rc?.competitor_type || null, source: rc?.source || null });
  };
  for (const a of analysis?.angles || []) {
    for (const r of a?.justification?.opening?.evidence_refs || []) {
      if (r?.receipt) add(r.receipt.name || r.label, r.receipt);
    }
  }
  for (const l of analysis?.terrain?.lanes || []) {
    for (const r of l?.reference_items || []) {
      if (r?.receipt) add(r.receipt.name || r.name, r.receipt);
      else if (r?.name) add(r.name, null); // sorter-named, un-hydrated: colored, unlinked
    }
  }
  // longest first so "Tyler Munis attachment" wins over "Tyler"
  return [...seen.values()].sort((a, b) => b.key.length - a.key.length);
}

const isWordChar = (ch) => /[A-Za-z0-9]/.test(ch || "");

function segmentProse(text, entities) {
  const lower = text.toLowerCase();
  const out = [];
  let pos = 0, plain = 0;
  while (pos < text.length) {
    let hit = null;
    for (const e of entities) {
      if (lower.startsWith(e.key, pos)
        && !isWordChar(text[pos - 1])
        && !isWordChar(text[pos + e.key.length])) { hit = e; break; }
    }
    if (hit) {
      if (plain < pos) out.push({ t: text.slice(plain, pos) });
      out.push({ t: text.slice(pos, pos + hit.key.length), e: hit });
      pos += hit.key.length; plain = pos;
    } else pos++;
  }
  if (plain < text.length) out.push({ t: text.slice(plain) });
  return out;
}

function EntitySpan({ seg }) {
  const [h, setH] = useState(false);
  const e = seg.e;
  const inner = (
    <span
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={[e.type, e.source ? `source: ${e.source}` : null].filter(Boolean).join(" \u00b7 ") || undefined}
      style={{ color: e.color, textDecoration: h && e.url ? "underline" : "none",
        textUnderlineOffset: 2, cursor: e.url ? "pointer" : "inherit" }}>
      {seg.t}
    </span>
  );
  return e.url
    ? <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>
    : inner;
}

// Drop-in prose renderer: <Prose text={...} entities={entities} /> in place of
// {text}. No entities or no text -> plain passthrough.
function Prose({ text, entities }) {
  // (angle_N) is an internal angle id the engine sometimes references in
  // firms_up_fastest prose. It is not reader vocabulary; scrubLeaks upstream
  // does not cover it (known residual). Stripping the token is display-side
  // sanitisation, not authorship — no words are added, the committed sentence
  // just stops carrying an internal name.
  if (typeof text === "string") text = text.replace(/\s*\(angle_\d+\)/g, "");
  if (typeof text !== "string" || !text || !entities?.length) return text ?? null;
  const segs = segmentProse(text, entities);
  if (segs.length === 1 && !segs[0].e) return text;
  return <>{segs.map((sg, i) => (sg.e ? <EntitySpan key={i} seg={sg} /> : <span key={i}>{sg.t}</span>))}</>;
}

// ============================================================================
// Section eyebrow
// ============================================================================
function Eyebrow({ num, icon, title, sub, t, right, mb = 28 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: mb }}>
      <span style={{
        width: 24, height: 24, borderRadius: "50%", border: `1px solid ${EX.line}`, color: EX.bright,
        fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: `0 0 0 3px rgba(122,162,255,0.1), 0 0 14px -2px ${EX.base}`,
      }}>{num}</span>
      <span style={{ display: "flex", color: EX.bright }}>{icon}</span>
      <span style={{ fontFamily: "monospace", fontSize: 13.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "#eef2f8", fontWeight: 600, whiteSpace: "nowrap" }}>{title}</span>
      <span style={{ fontSize: 13.5, color: "#8f98a6", minWidth: 0 }}>{sub}</span>
      <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(148,163,200,0.18), transparent)", marginLeft: 10 }} />
      {right && <span style={{ display: "flex", alignItems: "center", gap: 16, whiteSpace: "nowrap" }}>{right}</span>}
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
        <div style={{ width: "100%", maxWidth: 560, border: "1px solid rgba(122,162,255,0.22)", borderRadius: 14,
          background: "linear-gradient(180deg, rgba(122,162,255,0.1), #0e1219)", padding: "18px 22px",
          boxShadow: "0 22px 50px -34px rgba(0,0,0,0.9)" }}>
          <div style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: EX.base, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "flex", color: EX.base }}><PlusIc /></span> Your idea
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.62, color: "#d3d8e1" }}>{preview}</div>
          {truncated && (
            <button onClick={() => setShowFull(true)} style={{ marginTop: 12, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: EX.base, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}>
              View full idea <span style={{ display: "flex" }}><Svg w={13} sw={2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg></span>
            </button>
          )}
        </div>
        <div style={{ width: 1, height: 36, background: `linear-gradient(${EX.base}, transparent)` }} />
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

// EXPLORE_FULL_V2 VERBATIM. Reflection at display (21/300/1.66, -0.004em,
// #eef3fa, 1000 max), a labelled "still dark" rule at 56, the open questions
// as a plain 2-col field (52x130 gap, 15.5/1.68 #bdc6d4, dawn ?), the mono
// caption closing at 48. The Observatory void-patches are gone — the v2 page
// carries the darkness in spacing, not in painted patches.
// clear[] stays unrendered (unchanged reasoning; still in the payload).
// branchability stays unrendered — the section ends on the caption. Helper
// BRANCH_LABEL kept above; restoring the chip is one JSX line.
function ReadSurface({ read, t, entities }) {
  if (!read) return null;
  const open = Array.isArray(read.open) ? read.open : [];
  return (
    <section style={{ marginTop: 88 }}>
      <Eyebrow num="1" mb={32} icon={<SectionIcon.read />} title="Our read" sub="What's lit — and what's still dark" t={t} />
      {read.reflection && (
        <p style={{ fontSize: 21, fontWeight: 300, lineHeight: 1.66, letterSpacing: "-0.004em", color: "#eef3fa", margin: 0, maxWidth: 1000, textWrap: "pretty" }}>
          <Prose text={read.reflection} entities={entities} />
        </p>
      )}
      {open.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 56 }}>
            <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: "#7f8794", whiteSpace: "nowrap" }}>
              <span style={{ color: EX.base }}>?</span>&nbsp; still dark — the open questions
            </span>
            <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(148,163,200,0.12), transparent)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "52px 130px", marginTop: 36 }}>
            {open.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 13, fontSize: 15.5, lineHeight: 1.68, color: "#bdc6d4" }}>
                <span style={{ color: EX.base, fontWeight: 700, flex: "0 0 12px" }}>?</span>
                <span style={{ minWidth: 0 }}><Prose text={it} entities={entities} /></span>
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#565c68", marginTop: 48 }}>
        the dark patches are the unlit parts of the idea
      </div>
    </section>
  );
}


// ============================================================================
// 2 · Where it could go — the fan
// ============================================================================
// DE-CARDED. The four directions keep every element and the whole fan geometry
// — seed node, gradient connectors, the room that opens beneath — but they stop
// being cards: no border, no surface, no radius, no shadow, no hover lift. A
// column of text separated from its neighbours by a hairline and space. The
// selected state can no longer be "the box lights up", so it moves to a top
// rule in dawn (the connector landing on the column), the title brightening,
// and the existing sibling dimming. Nothing moves on selection, so the
// connector geometry stops re-drawing under the cursor.
function EssenceCard({ angle, active, dimmed, first, onEnter, onLeave, onClick, entities }) {
  const opening = angle.justification?.opening || {};
  const kill = angle.justification?.disconfirmer || "";
  const kind = angle.disconfirmer_kind;
  const restsOn = angle.justification?.bet?.rests_on || null;
  return (
    <div data-aid={angle.id} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} style={{
      flex: 1, minWidth: 0, cursor: "default", display: "flex", flexDirection: "column",
      padding: first ? "18px 20px 14px 0" : "18px 0 14px 22px",
      borderTop: `2px solid ${active ? EX.base : "transparent"}`,
      borderLeft: first ? "none" : "1px solid rgba(148,163,200,0.1)",
      opacity: dimmed ? 0.5 : 1,
      transition: "border-color .18s, opacity .2s",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "#8b94a1", border: "1px solid rgba(148,163,200,0.14)", borderRadius: 5, padding: "3px 7px", whiteSpace: "nowrap" }}>
          {SHIFT_LABEL[angle.basis?.primary] || "New angle"}
        </span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 2px", color: active ? "#f2f5fa" : "#c3cad6", letterSpacing: "-0.01em", lineHeight: 1.35, transition: "color .18s" }}>{angle.title}</h3>

      {/* THE COMPARISON RAIL (angle-cards mockup, variant A — Emre's call):
          two single-axis atoms in the SAME slots on every card — the bet's
          rests_on (what must become true; the fit axis) and the wall's kind
          (what presently pushes back; the condition axis). The glaze the
          readiness chip used to fake, rebuilt from honest parts: the eye
          column-compares across the fan, no card wears a grade. Degrades
          per-token — an old payload without atoms simply shows no rail. */}
      {(restsOn || (kind && KIND_LABEL[kind])) && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
            {restsOn && (
              <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", border: "1px solid rgba(148,163,200,0.12)", borderRadius: 4, padding: "3px 7px" }}>
                <span style={{ color: "#6a7280" }}>bet · </span>
                <span style={{ color: active ? "#dfe5ee" : "#b6bdc9", fontWeight: 600, transition: "color .18s" }}>{String(restsOn).replace(/_/g, " ")}</span>
              </span>
            )}
            {kind && KIND_LABEL[kind] && (
              <span style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", border: "1px solid rgba(148,163,200,0.12)", borderRadius: 4, padding: "3px 7px" }}>
                <span style={{ color: "#6a7280" }}>wall · </span>
                <span style={{ color: active ? "#dfe5ee" : "#b6bdc9", fontWeight: 600, transition: "color .18s" }}>{KIND_LABEL[kind]}</span>
              </span>
            )}
          </div>
          <div style={{ height: 1, background: "rgba(148,163,200,0.1)", margin: "14px 0 0" }} />
        </>
      )}

      <div style={{ marginTop: 15, minWidth: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#7f8794", marginBottom: 7 }}>The opening</div>
        <div style={{ display: "flex", gap: 9, minWidth: 0 }}>
          <span style={{ flexShrink: 0, color: EX.base, opacity: 0.9, marginTop: 1, display: "flex" }}><RoadIc /></span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.6, color: active ? "#d6dbe4" : "#aeb6c4", transition: "color .18s", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><Prose text={opening.text} entities={entities} /></span>
        </div>
      </div>

      {kill && (
        <div style={{ marginTop: 15, minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#7f8794", marginBottom: 7 }}>The wall</div>
          <div style={{ display: "flex", gap: 9, minWidth: 0 }}>
            <span style={{ flexShrink: 0, color: WALL_CLAY, marginTop: 1, display: "flex" }}><WallIc /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.6, color: active ? "#b7bcc6" : "#9aa3b1", transition: "color .18s", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><Prose text={kill} entities={entities} /></span>
          </div>
        </div>
      )}

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(148,163,200,0.08)", paddingTop: 13 }}>
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

function FanSurface({ idea, angles, fanState, t, onSave, saveState, onExploreAngle, onTakeToDeep, branchReason, angleStatus, onOpenChild, readOnly, entities }) {
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
      const o2 = on ? 0.85 : (any ? 0.38 : 0.58);
      p += `<path d="${bez}" fill="none" stroke="url(#exlg)" stroke-width="2" opacity="${o1}" filter="url(#exgl)"/>`;
      p += `<path d="${bez}" fill="none" stroke="url(#exlg)" stroke-width="${on ? 1.3 : 1.1}" opacity="${o2}"/>`;
      p += `<circle cx="${x2}" cy="${y2}" r="6" fill="${EX.gradB}" opacity="0.16"/>`;
      p += `<circle cx="${x2}" cy="${y2}" r="${on ? 3.6 : 3}" fill="${EX.gradB}" opacity="${on ? 1 : (any ? 0.6 : 1)}"/>`;
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
      background: `radial-gradient(120% 150% at 50% 0%, ${EX.dim}, transparent 62%), #12161f`,
      padding: "18px 20px 20px", position: "relative", boxShadow: `0 0 46px -14px ${EX.base}`,
    }}>
      <div style={{ position: "absolute", left: "50%", bottom: -6, width: 11, height: 11, borderRadius: "50%", background: EX.gradA, boxShadow: `0 0 0 5px ${EX.dim}, 0 0 16px 2px ${EX.gradA}`, transform: "translateX(-50%)" }} />
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: EX.bright, display: "flex", gap: 7, alignItems: "center", marginBottom: 9 }}>
        <SectionIcon.node /> your rough idea
      </div>
      <div style={{ fontSize: 13, color: "#eef2f8", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea}</div>
    </div>
  );

  const right = fanState !== "empty"
    ? <span style={{ fontSize: 11, color: "#79818f", fontFamily: "monospace", letterSpacing: "0.03em" }}>fan order · not ranked</span>
    : null;

  const lead = { fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", flex: "0 0 72px", marginTop: 2 };

  return (
    <section style={{ marginTop: 104 }} className="ex-scope">
      <Eyebrow num="2" mb={36} icon={<SectionIcon.dir />} title="Where it could go" sub="Directions the evidence supports" t={t} right={right} />
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
                {angles.map((a, i) => (
                  <EssenceCard key={a.id} angle={a} entities={entities}
                    first={i === 0}
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
                <div style={{ position: "relative", border: "1px solid rgba(148,163,200,0.14)", borderTop: `1px solid ${EX.line}`, borderRadius: 12, background: "linear-gradient(180deg, rgba(122,162,255,0.04), rgba(255,255,255,0.012) 120px), #10141d", padding: "22px 28px 16px", boxShadow: "0 24px 54px -32px rgba(0,0,0,0.85)" }}>
                  <span style={{ position: "absolute", top: -6, left: caretLeft, width: 11, height: 11, background: "#131926", borderLeft: `1px solid ${EX.line}`, borderTop: `1px solid ${EX.line}`, transform: "translateX(-50%) rotate(45deg)", transition: "left .3s cubic-bezier(.3,.8,.35,1)" }} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 5, padding: "3px 7px" }}>{SHIFT_LABEL[pa.basis?.primary] || "New angle"}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "#f0f3f9", letterSpacing: "-0.01em" }}>{pa.title}</span>
                  </div>
                  {/* The expansion COMPLETES the card: full opening + full wall
                      (the two fields the card clamps to 2 lines), then the bet as
                      the deeper read. "the wall" and the old "the limit" were the
                      same field (justification.disconfirmer) shown twice — the
                      duplicate row is dropped so clicking finishes the thought the
                      card started instead of repeating the wall. */}
                  <div style={{ display: "flex", gap: 18, marginBottom: 15 }}>
                    <span style={{ ...lead, color: EX.base }}>the opening</span>
                    <span style={{ flex: 1, minWidth: 0, maxWidth: 900, fontSize: 13.5, lineHeight: 1.68, color: "#e3e7ee" }}><Prose text={pa.justification?.opening?.text} entities={entities} /></span>
                  </div>
                  <div style={{ display: "flex", gap: 18, marginBottom: 15 }}>
                    <span style={{ ...lead, color: WALL_CLAY }}>the wall</span>
                    <span style={{ flex: 1, minWidth: 0, maxWidth: 900, fontSize: 13, lineHeight: 1.68, color: "#b2bac7" }}><Prose text={pa.justification?.disconfirmer} entities={entities} /></span>
                  </div>
                  <div style={{ display: "flex", gap: 18, marginBottom: 15 }}>
                    <span style={{ ...lead, color: EX.bright }}>the bet</span>
                    <span style={{ flex: 1, minWidth: 0, maxWidth: 900, fontSize: 13.5, lineHeight: 1.68, color: "#e3e7ee" }}>Works only if <Prose text={bet.text} entities={entities} />.{bet.rests_on && (
                      <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.06em", color: "#8b94a1", border: "1px solid rgba(148,163,200,0.14)", borderRadius: 4, padding: "1px 6px", marginLeft: 7, whiteSpace: "nowrap", textTransform: "uppercase" }}>{String(bet.rests_on).replace(/_/g, " ")}</span>
                    )}</span>
                  </div>
                  {/* what this angle visibly rests on — the receipts the opening
                      was read from, hydrated route-side. Absent on older
                      payloads → the row simply doesn't render. */}
                  <div style={{ marginBottom: 15 }}>
                    <ReceiptRow refs={pa.justification?.opening?.evidence_refs} lead="rests on" />
                  </div>
                  {!readOnly && (
                  <div style={{ display: "flex", gap: 28, alignItems: "center", borderTop: "1px solid rgba(148,163,200,0.1)", paddingTop: 15, marginTop: 4, flexWrap: "wrap" }}>
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
// ── THE GROUND ──────────────────────────────────────────────────────────────
// A single density curve across the whole width, three equal territories under
// it, one dot per named actor scattered in the field, and a magnify-on-hover
// overlay that names them. Click, or the look-closer link, selects the lane and
// drives the reader below.
//
// TWO THINGS THIS RENDER ASSERTS, BOTH WORTH KNOWING:
//
// 1. CURVE HEIGHT COMES FROM HOW MANY ACTORS A LANE NAMES. Stage 2a caps
//    `members` at five per field and calls the list "illustrative, not
//    exhaustive", so this is the size of the retrieved sample, not the size of
//    the field. The count is printed under every lane, which is the only reason
//    it is defensible: the reader can see the number the shape came from. Set
//    CURVE_FROM = "status" to drive it off the density word instead.
// 2. STATUS TINT IS OFF. Amber-for-crowded shading to green-for-open is a
//    verdict gradient — it reads "go where it's empty", which is the advice the
//    mode exists to refuse, and it is the one thing the terrain ruling locks by
//    name. The hook is here; flip STATUS_TINT to the commented map to turn it on.
const CHART_H = 160;
const CURVE_PEAK = 0.88;
const SIGMA = 0.155;
const CURVE_FROM = "actors"; // "actors" | "status"
const STATUS_WEIGHT = { crowded: 1, lightly_served: 0.45, open: 0.12 };
const STATUS_TINT = null;
// const STATUS_TINT = { crowded: "#c9a227", lightly_served: "#8b94a1", open: "#5fbf8f" };
const STATUS_WORD = { crowded: "crowded", open: "open" }; // lightly served prints no word
const BAND_ORDER = ["crowded", "lightly_served", "open"];

function seeded(seed) {
  let a = 0;
  for (let i = 0; i < String(seed).length; i++) a = (a * 31 + String(seed).charCodeAt(i)) | 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tint = (status) => (STATUS_TINT && STATUS_TINT[status]) || null;
const refsOf = (l) => (Array.isArray(l?.reference_items) ? l.reference_items : []);

// sum of one gaussian per territory, sampled across the width and normalised
function densityCurve(lanes) {
  const n = lanes.length, N = 200;
  const amp = lanes.map((l) => CURVE_FROM === "status"
    ? (STATUS_WEIGHT[l?.status] ?? STATUS_WEIGHT.lightly_served)
    : refsOf(l).length);
  const max = Math.max(...amp, 1);
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    let h = 0;
    for (let k = 0; k < n; k++) {
      const d = (x - (k + 0.5) / n) / SIGMA;
      h += (amp[k] / max) * Math.exp(-(d * d) / 2);
    }
    pts.push(h);
  }
  const peak = Math.max(...pts, 1e-4);
  return pts.map((h) => h / peak);
}
const curveY = (norm) => CHART_H - norm * CHART_H * CURVE_PEAK;

// one dot per named actor, seeded and spaced so they never sit on top of each
// other. Placement is relative to the CURVE at that dot's own x — the middle
// of the filled area, not a fixed band — so a dot never hugs the ground line
// and never floats above the fill where it runs shallow at the open end.
function actorDots(lane, i, n, norm) {
  const r = seeded((lane.id || lane.label) + "|dots");
  const N = norm.length - 1;
  const left = (i / n) * 100, w = 100 / n;
  const out = [];
  refsOf(lane).forEach(() => {
    let x, y, ok = false;
    for (let k = 0; k < 40 && !ok; k++) {
      x = left + w * (0.14 + r() * 0.72);
      const top = curveY(norm[Math.round((x / 100) * N)]);
      y = top + (CHART_H - top) * (0.26 + r() * 0.5);
      ok = !out.some((p) => Math.abs(p.y - y) < 11 && Math.abs(p.x - x) < w * 0.15);
    }
    out.push({ x, y });
  });
  return out;
}

// CONTAINED. Chips wrap horizontally inside the band instead of stacking out
// of it, so nothing can ever reach the section header above. Width is capped at
// 48% of the territory, which forces at least two per row and pins five chips
// to three rows at any lane count — the height budget is 97px for chips (160
// band, less 20 padding, less 43 for the count line, the link and the gaps),
// and three rows is 84. A name past the cap ellipses and carries the full
// string in `title`; the receipt link is untouched.
//
// The cap that makes this hold is Stage 2a's: at most five members per field.
// If that ever rises, this budget is what breaks first.
function TerritoryChip({ r, tight }) {
  const [h, setH] = useState(false);
  const name = typeof r === "string" ? r : (r?.name || "");
  const url = typeof r === "string" ? null : (r?.receipt?.url || null);
  const outer = { display: "inline-flex", maxWidth: "48%", minWidth: 0, textDecoration: "none" };
  const body = (
    <span title={name} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: "inline-flex", alignItems: "center", gap: tight ? 7 : 8, minWidth: 0, maxWidth: "100%",
      padding: tight ? "5px 9px" : "6px 11px", borderRadius: tight ? 6 : 7,
      border: `1px solid ${h ? EX.line : "rgba(148,163,200,0.16)"}`,
      background: h ? "rgba(122,162,255,0.10)" : "rgba(16,20,28,0.9)",
      fontFamily: "monospace", fontSize: tight ? 10 : 10.5, letterSpacing: "0.01em",
      color: h ? "#e4ebf8" : "#cfd8e8", transition: "border-color .15s, background .15s, color .15s",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: EX.base, flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{name}</span>
      {url && <span style={{ opacity: 0.5, fontSize: 9, flexShrink: 0 }}>↗</span>}
    </span>
  );
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={outer}>{body}</a>
    : <span style={outer}>{body}</span>;
}

function TerrainSurface({ terrain, angles, t, entities }) {
  const lanes = Array.isArray(terrain?.lanes) ? terrain.lanes : [];
  const firms = terrain?.firms_up_fastest || null;
  const [selId, setSelId] = useState(null);
  const [hovId, setHovId] = useState(null);

  if (lanes.length === 0) return null;

  const ordered = [...lanes].sort((a, b) => {
    const ia = BAND_ORDER.indexOf(a?.status), ib = BAND_ORDER.indexOf(b?.status);
    return (ia < 0 ? 1 : ia) - (ib < 0 ? 1 : ib);
  });
  const sel = ordered.find((l) => l.id === selId) || ordered[0];
  const n = ordered.length;
  const norm = densityCurve(ordered);
  const N = norm.length - 1;

  let line = "", i = 0;
  for (; i <= N; i++) line += `${i ? " L" : "M"} ${(i / N) * 1000} ${curveY(norm[i]).toFixed(2)}`;
  const fill = `${line} L 1000 ${CHART_H} L 0 ${CHART_H} Z`;

  return (
    <section style={{ marginTop: 104 }}>
      <style>{`
        @keyframes ilcPing { 0% { transform: scale(.6); opacity: .5 } 80%, 100% { transform: scale(1.7); opacity: 0 } }
        .ilc-pulse { position: relative }
        .ilc-pulse::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0; animation: ilcPing 2.6s ease-out infinite }
        @media (prefers-reduced-motion: reduce) { .ilc-pulse::after { animation: none; opacity: 0 } }
      `}</style>
      <Eyebrow num="3" mb={28} icon={<SectionIcon.terr />} title="Where this could fit" sub="The ground, and who already stands on it" t={t} />

      <div style={{ display: "flex", justifyContent: "flex-end", fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#79818f", marginBottom: 10 }}>
        ⌖ hover a territory to magnify
      </div>

      <div onMouseLeave={() => setHovId(null)}>
      <div style={{ position: "relative", height: CHART_H }}>
        <svg viewBox={`0 0 1000 ${CHART_H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: CHART_H }}>
          <defs>
            <linearGradient id="exgrd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(122,162,255,0.15)" />
              <stop offset="100%" stopColor="rgba(122,162,255,0.012)" />
            </linearGradient>
          </defs>
          <path d={fill} fill="url(#exgrd)" />
          <path d={line} fill="none" stroke="rgba(122,162,255,0.5)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* actor dots — one per named actor, in every territory at once */}
        {ordered.map((lane, li) => actorDots(lane, li, n, norm).map((p, k) => (
          <span key={`${lane.id}-${k}`} style={{
            position: "absolute", left: `${p.x}%`, top: p.y, width: 6, height: 6, borderRadius: "50%",
            transform: "translate(-50%,-50%)", background: "#aab8e0",
            opacity: hovId && hovId !== lane.id ? 0.3 : 0.9, transition: "opacity .18s",
          }} />
        )))}

        {/* territories */}
        {ordered.map((lane, li) => {
          const on = lane.id === hovId;
          const refs = refsOf(lane);
          const word = STATUS_WORD[lane.status];
          const c = tint(lane.status);
          return (
            <div key={lane.id}
              onMouseEnter={() => setHovId(lane.id)}
              onClick={() => setSelId(lane.id)}
              style={{
                position: "absolute", top: 0, height: CHART_H, left: `${(li / n) * 100}%`, width: `${100 / n}%`,
                cursor: "pointer", zIndex: on ? 6 : 1,
                background: on ? "radial-gradient(62% 95% at 50% 58%, rgba(122,162,255,0.11), transparent 78%)" : "transparent",
                transition: "background .25s",
              }}>
              {on && (
                <div style={{
                  position: "absolute", left: 0, right: 0, top: 10, bottom: 10, padding: "0 10px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: c || "#8b94a1" }}>
                    {refs.length} {refs.length === 1 ? "actor" : "actors"}{word ? ` · ${word}` : ""}
                  </span>
                  {refs.length > 0 && (
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: "100%" }}>
                      {refs.map((r, k) => <TerritoryChip key={k} r={r} tight={refs.length >= 4} />)}
                    </span>
                  )}
                  {refs.length === 0 && (
                    <span style={{ fontFamily: "monospace", fontSize: 10.5, color: "var(--exfaint, #4d5560)" }}>
                      unclaimed in the retrieved set
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: EX.base }}>look closer ›</span>
                </div>
              )}
            </div>
          );
        })}

        {/* the ground line */}
        <div style={{ position: "absolute", left: 0, right: 0, top: CHART_H, height: 1, background: "rgba(255,255,255,0.14)" }} />
        {ordered.map((lane, li) => {
          const on = lane.id === sel?.id;
          return (
            <span key={`d-${lane.id}`} className={on ? "ilc-pulse" : undefined} style={{
              position: "absolute", left: `${((li + 0.5) / n) * 100}%`, top: CHART_H,
              transform: "translate(-50%,-50%)", borderRadius: "50%",
              width: on ? 11 : 8, height: on ? 11 : 8,
              background: on ? "#dbe4f6" : "#6d7684", color: EX.base,
              boxShadow: on ? "0 0 13px 3px rgba(122,162,255,0.45)" : "none",
              transition: "width .15s, height .15s, background .15s", pointerEvents: "none",
            }} />
          );
        })}
      </div>

      {/* lane names under the line */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, marginTop: 18 }}>
        {ordered.map((lane) => {
          const on = lane.id === sel?.id;
          return (
            <button key={`n-${lane.id}`} onClick={() => setSelId(lane.id)}
              onMouseEnter={() => setHovId(lane.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "0 16px",
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
              }}>
              <span style={{ fontSize: 15, lineHeight: 1.4, color: on ? "#f0f3f8" : "#aeb6c4", transition: "color .15s" }}>{lane.label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#79818f" }}>
                {refsOf(lane).length} {refsOf(lane).length === 1 ? "actor" : "actors"}
              </span>
            </button>
          );
        })}
      </div>

      {/* the scale — it names the axis, not a population */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span style={{ color: tint("crowded") || "#7f8b9e" }}>⋮⋮ crowded</span>
        <span style={{ color: tint("open") || "#7f8b9e" }}>·· open ground</span>
      </div>
      </div>

      {sel && <LaneReader lane={sel} idx={ordered.indexOf(sel)} n={n} t={t} entities={entities} />}

      {/* firms_up_fastest — the terrain's yield. The committed shape is
          { text, angle_refs[] }: the cheapest clarity, and which fan angles
          hinge on it. So the block renders as the section's hot line — the
          page's labelled-rule grammar (§1) inked in dawn — with the previously
          orphaned angle_refs resolved to angle titles as a bridge row back to
          the fan. The old floating 220px bar (decoration, no meaning) is gone.
          Chips are non-interactive: naming the dependency, not ranking it. */}
      {firms?.text && (() => {
        const refIds = Array.isArray(firms.angle_refs) ? firms.angle_refs : [];
        const refTitles = refIds
          .map((id) => (Array.isArray(angles) ? angles.find((a) => a?.id === id) : null))
          .filter(Boolean).map((a) => a.title);
        return (
          <div style={{ marginTop: 72 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              <span style={{ color: EX.base, display: "flex" }}><BoltIc /></span>
              <span style={{ color: EX.base, fontWeight: 500, whiteSpace: "nowrap" }}>Firms up fastest</span>
              <span style={{ color: "#8b94a1", whiteSpace: "nowrap" }}>— where clarity is cheapest to buy</span>
              <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(122,162,255,0.35), transparent)", marginLeft: 8 }} />
            </div>
            <div style={{ fontSize: 16.5, fontWeight: 300, color: "#d9dee7", lineHeight: 1.68, maxWidth: 1000, textWrap: "pretty", marginTop: 18 }}><Prose text={firms.text} entities={entities} /></div>
            {refTitles.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
                <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "#79818f" }}>angles</span>
                {refTitles.map((title, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.02em", color: "#aeb6c4", border: "1px solid rgba(148,163,200,0.14)", borderRadius: 5, padding: "3px 8px" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: EX.base, flexShrink: 0 }} />
                    {title}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}

// The reader for the selected lane — the §2 panel grammar with the walls
// removed. A full-width dawn topline carries a caret that tracks the selected
// lane's territory center (same kinetic as §2's panel caret); below it, the
// head NAMES the selection (lane title + ground/standing chips — both facts
// already rendered on the chart, humanized enum verbatim), and the readout
// runs in §2's lead-gutter rows: the question / the read / today. No border
// box, no background, no shadow — the topline + caret carry the attachment,
// the open ground carries the reading. The lead label "today" replaces the
// old prose lead-in "Today, …", which also retires the mid-sentence-capital
// and double-period residue that lead-in produced. ALONGSIDE stays retired.
function LaneReader({ lane, idx = 0, n = 1, t, entities }) {
  const answered = lane.demand_question == null;
  const typePhrase = lane.lane_type ? LANE_TYPE_PHRASE[lane.lane_type] : null;
  const caretLeft = `${(((idx + 0.5) / Math.max(n, 1)) * 100).toFixed(2)}%`;
  const actorCount = refsOf(lane).length;
  const signal = lane.substitute_tell?.signal;
  const lead = { fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", flex: "0 0 92px", marginTop: 3 };
  const chip = { fontFamily: "monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap", border: "1px solid rgba(148,163,200,0.12)", borderRadius: 4, padding: "3px 7px" };
  return (
    <div style={{ position: "relative", marginTop: 44 }}>
      <div style={{ height: 1, background: EX.line }} />
      {/* caret ground = T.dark.bg — it sits on open page ground, not a surface */}
      <span style={{ position: "absolute", top: -5, left: caretLeft, width: 11, height: 11, background: "#0a0d13", borderLeft: `1px solid ${EX.line}`, borderTop: `1px solid ${EX.line}`, transform: "translateX(-50%) rotate(45deg)", transition: "left .3s cubic-bezier(.3,.8,.35,1)" }} />
      <div style={{ paddingTop: 26, maxWidth: 1000 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#f0f3f9", letterSpacing: "-0.01em" }}>{lane.label}</span>
          {lane.status && (
            <span style={chip}><span style={{ color: "#6a7280" }}>ground · </span><span style={{ color: "#dfe5ee", fontWeight: 600 }}>{String(lane.status).replace(/_/g, " ")}</span></span>
          )}
          <span style={chip}><span style={{ color: "#6a7280" }}>standing · </span><span style={{ color: "#dfe5ee", fontWeight: 600 }}>{actorCount} {actorCount === 1 ? "actor" : "actors"}</span></span>
        </div>
        {!answered && (
          <div style={{ display: "flex", gap: 18, marginBottom: 15 }}>
            <span style={{ ...lead, color: EX.base }}>the question</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 300, lineHeight: 1.68, letterSpacing: "-0.002em", color: "#e3e7ee", textWrap: "pretty" }}><Prose text={lane.demand_question} entities={entities} /></span>
          </div>
        )}
        {(typePhrase || answered) && (
          <div style={{ display: "flex", gap: 18, marginBottom: 15 }}>
            <span style={{ ...lead, color: "#79818f" }}>the read</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: answered ? 15 : 13, fontWeight: answered ? 300 : 400, lineHeight: 1.68, color: answered ? "#e3e7ee" : "#8f98a6", fontStyle: answered ? "normal" : "italic", textWrap: "pretty" }}>
              {typePhrase || "Payment is named in this field's evidence — the open question is differentiation."}
            </span>
          </div>
        )}
        {signal && (
          <div style={{ display: "flex", gap: 18 }}>
            <span style={{ ...lead, color: EX.bright }}>today</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.68, color: "#b2bac7" }}><Prose text={signal} entities={entities} />{/^[.!?]$/.test(String(signal).trim().slice(-1)) ? "" : "."}</span>
          </div>
        )}
      </div>
    </div>
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
  ink: "#e9eef6", ink2: "#c3ccd7", mut: "#8b94a1", mut2: "#79818f",
  line: "rgba(148,163,200,0.12)", line2: "rgba(148,163,200,0.08)",
  panelA: "rgba(255,255,255,0.028)", panelB: "rgba(255,255,255,0.014)",
};

const TILE_THEME = {
  save: {
    line: "rgba(255,255,255,0.16)", lineHi: "rgba(255,255,255,0.26)",
    bg: "rgba(255,255,255,0.045)", bgHi: "rgba(255,255,255,0.06)",
    medBg: "rgba(255,255,255,0.05)", medBgHi: "rgba(255,255,255,0.08)",
    ic: "#aab4c3", icHi: "#d7deea", title: M4.ink, cue: "#79818f", cueHi: "#8b94a1",
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
        borderRadius: 13, padding: "14px 16px 12px", minHeight: 96,
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
      <p style={{ fontSize: 13, lineHeight: 1.58, color: "#939caa", margin: "0 0 auto" }}>{desc}</p>
      <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: on ? c.cueHi : c.cue }}>
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

function NextMoveSurface({ nextMove, angleCount, t, user, viewingFromSaved, onSave, onExplore, onDeep, onAuth, goToMyIdeas, entities }) {
  const du = (nextMove && nextMove.dominant_uncertainty) || {};
  return (
    <section style={{ marginTop: 104 }}>
      <Eyebrow num="4" mb={28} icon={<SectionIcon.next />} title="From here" sub="What now — for the whole idea" t={t} />

      {/* HORIZON treatment (mockup D, Jul 26). The enclosing panel is gone — the
          question stands on open ground at display size, and a full-width dawn
          ground line (the terrain's motif) divides thought from action: reading
          above the line, everything actionable below it. The anchor dot marks
          where the idea stands; the graduation ticks are cartography, not data.
          Two-enclosure doctrine: the DirectionCards are now §4's only boxes. */}
      {du.text && (
        <p style={{ fontSize: 20, fontWeight: 300, lineHeight: 1.64, letterSpacing: "-0.004em", color: M4.ink, margin: "10px 0 0", maxWidth: 1000, textWrap: "pretty" }}><Prose text={du.text} entities={entities} /></p>
      )}

      <div style={{ position: "relative", marginTop: du.text ? 56 : 10, height: 2, background: "linear-gradient(90deg, rgba(122,162,255,0.65), rgba(122,162,255,0.18) 55%, rgba(122,162,255,0.04))" }}>
        <span style={{ position: "absolute", left: 0, top: -3, width: 8, height: 8, borderRadius: "50%", background: EX.base, boxShadow: "0 0 12px 2px rgba(122,162,255,0.55)" }} />
        <span style={{ position: "absolute", left: "25%", top: 2, width: 1, height: 7, background: "rgba(148,163,200,0.3)" }} />
        <span style={{ position: "absolute", left: "50%", top: 2, width: 1, height: 7, background: "rgba(148,163,200,0.3)" }} />
        <span style={{ position: "absolute", left: "75%", top: 2, width: 1, height: 7, background: "rgba(148,163,200,0.3)" }} />
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: M4.mut2, display: "flex", alignItems: "baseline", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        DO SOMETHING WITH IT
        <span style={{ fontFamily: "inherit", fontStyle: "normal", fontSize: 13, letterSpacing: "0.01em", textTransform: "none", color: M4.mut }}>
          your idea — the seed you explored
          {angleCount > 0 ? <>, with all <b style={{ color: M4.ink2, fontWeight: 500 }}>{angleCount} direction{angleCount === 1 ? "" : "s"}</b> attached</> : null}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 20 }}>
        <SaveTile user={user} viewingFromSaved={viewingFromSaved} onSave={onSave} onAuth={onAuth} goToMyIdeas={goToMyIdeas} angleCount={angleCount} />
        <DirectionCard skin="explore" glyph="explore" title="Explore again"
          desc="Re-widen into a fresh fan of directions."
          cue="Widen" onClick={() => onExplore && onExplore()} />
        <DirectionCard skin="deep" glyph="deep" title="Take to Deep"
          desc="Send the whole idea for a scored verdict."
          cue="To verdict" onClick={() => onDeep && onDeep()} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 26, fontSize: 13, color: M4.mut }}>
        <span style={{ color: M4.mut2, flexShrink: 0, display: "inline-flex" }}><Svg w={15} sw={1.7}><path d="M7 17 17 7M9 7h8v8" /></Svg></span>
        <span>
          Want to act on a single direction instead? Each angle above carries its own{" "}
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#aab4c3" }}>save</span> ·{" "}
          <span style={{ fontFamily: "monospace", fontSize: 11, color: EX.base }}>explore</span> ·{" "}
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9a8fd8" }}>take to Deep</span>.
        </span>
      </div>

      <div style={{ marginTop: 40, fontFamily: "monospace", fontSize: 11, letterSpacing: "0.05em", color: M4.mut2, textAlign: "center" }}>
        While exploring:&nbsp;&nbsp;<b style={{ color: "#9aa3b1", fontWeight: 400 }}>open more than one path in Deep</b>&nbsp;·&nbsp;<b style={{ color: "#9aa3b1", fontWeight: 400 }}>look for patterns across directions</b>&nbsp;·&nbsp;<b style={{ color: "#9aa3b1", fontWeight: 400 }}>follow curiosity, not commitment.</b>
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
  // Hooks BEFORE the guard — hooks must run unconditionally on every render
  // (the entities memo briefly sat below this return: a real conditional-hook
  // bug, caught in the lint pass). buildEvidenceEntities is null-safe.
  const entities = useMemo(() => buildEvidenceEntities(analysis), [analysis]);
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
    border: "rgba(148,163,200,0.14)", text: "#f0f0f0", sec: "#a0a0a0",
    mut: "#6b6f78", faint: "#474b54", divider: "rgba(148,163,200,0.08)",
  };

  // CSS-var scope so nested cards inherit explore-aware tokens without prop drilling
  const scopeVars = {
    "--extext": xt.text, "--exsec": xt.sec, "--exmut": xt.mut, "--exfaint": xt.faint,
    "--exsurface": xt.surface, "--exsurf2": xt.surfAlt, "--exborder": xt.border,
    "--exborder-soft": "rgba(148,163,200,0.13)", "--exdivider": xt.divider,
  };

  // NO ambient layer. The standalone's dawn pools were tried here twice and
  // both times produced the giant-card effect: this root spans only the
  // content area, so any background it paints — opaque base or clipped glow —
  // reads as an inset rectangle against DashboardShell's flat chrome. If the
  // atmosphere returns, it must live in the shell (a whole-viewport layer),
  // not in this component. Root paints nothing; Explore sits on the same
  // ground as Deep.
  return (
    <div style={{ color: xt.text, overflowX: "hidden", ...scopeVars }}>
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal && setShowAuthModal(false)} onAuth={(u) => setUser && setUser(u)} t={t} />}

      <main style={{ flex: 1, paddingBottom: 80 }}>
        <PageContainer xwide>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 26px" }}>
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
          <ReadSurface read={read} t={xt} entities={entities} />
          <FanSurface idea={idea} angles={angles} fanState={fanState} t={xt} entities={entities}
            onSave={onSaveAngle} saveState={effectiveState}
            onExploreAngle={(a) => onExploreAngle && onExploreAngle(a)}
            onTakeToDeep={onTakeToDeep} branchReason={read?.branchability?.reason}
            angleStatus={angleStatus} onOpenChild={onOpenChild} readOnly={readOnly} />
          <TerrainSurface terrain={terrain} angles={angles} t={xt} entities={entities} />
          {!readOnly && (
          <NextMoveSurface
            entities={entities}
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
          <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid rgba(148,163,200,0.1)", textAlign: "center" }}>
            <Caption t={t} mono style={{ margin: 0, color: "#565c68", fontSize: 10.5, letterSpacing: "0.18em" }}>EXPLORE — WIDENS A ROUGH IDEA · NO SCORE, NO RANK, NO VERDICT</Caption>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}