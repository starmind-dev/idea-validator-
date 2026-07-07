"use client";

// src/app/HubView.js
// MY IDEAS HUB — the Claude-Design hub, realized. Three views behind one
// component (landing split-door / rough room / evaluated room), folders, search,
// All·Explored·Deep tabs, and the per-card hover PREVIEW.
//
// The hover popover is OURS: deep shows the verdict line + MD/MO/OR identity bars
// + a neutral overall pill + ◆ brief + the TC build-difficulty ladder; explore
// shows the read line + the "where it could go" mini-fan. Bars/overall/brief render
// INSTANTLY off the hub list (ideas.js widened IDEA_LIGHT_SELECT to carry the four
// metric scores); the verdict line (scoring_json) and the explore read+angles
// (explore_json) lazy-load on hover via GET /api/ideas/[id], cached by id.
//
// LIVE WIRING (page.js contract unchanged: { t, onOpenIdea, onOpenLineage, onBack }):
//   GET    /api/ideas            -> { folders, rough, ideas }   (self-fetch)
//   POST   /api/ideas            -> create a rough idea
//   POST   /api/folders          -> create a folder
//   DELETE /api/folders/[id]     -> delete a folder (un-files its cards)        [†]
//   PATCH  /api/ideas/[id]       -> { title } rename · { folder_id } move
//   DELETE /api/ideas/[id]       -> archive (subtree)
//   GET    /api/ideas/[id]       -> hover preview payload (verdict / read+angles)
//   onOpenIdea(id) / onOpenLineage(id) navigate out.
// [†] folder delete uses /api/folders/[id]; if that route isn't present yet the
//     call fails soft (card list reloads, error surfaced) — see integration note.

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { supabase } from "../lib/supabase";
import { BackLink } from "./BackLink";

/* ----------------------------- identity tokens ---------------------------- */
const MC = { md: "#3fc09a", mo: "#6f8ff5", or: "#b57ce0", tc: "#d9a85e" };
const WLAB = { md: "37.5%", mo: "31.25%", or: "31.25%" };
const W = { md: 0.375, mo: 0.3125, or: 0.3125 };
const TC_WORDS = ["very easy", "easy", "moderate", "hard", "very hard"];
const tcBucket = (s) => (s < 2 ? 0 : s < 4 ? 1 : s < 6 ? 2 : s < 8 ? 3 : 4);
const EX = { base: "#7aa2ff", bright: "#bcd2ff", line: "rgba(122,162,255,0.46)", gradA: "#fb7185", gradB: "#60a5fa" };
const SHIFT = { positioning_shift: "Positioning shift", mechanism_shift: "Mechanism shift", target_shift: "Target shift", buyer_shift: "Buyer shift", use_case_shift: "Use-case shift", distribution_shift: "Distribution shift" };
const READY = { ready_for_deep: "Ready for Deep", worth_shaping: "Worth shaping", probably_thin: "Lightly grounded" };
const COL = {
  explore: { text: "#7FB0FF", bg: "rgba(96,150,255,0.12)", bd: "rgba(96,150,255,0.26)", hb: "rgba(96,150,255,0.46)", glow: "rgba(96,150,255,0.22)" },
  deep: { text: "#AEA0FF", bg: "rgba(150,135,250,0.13)", bd: "rgba(150,135,250,0.28)", hb: "rgba(150,135,250,0.48)", glow: "rgba(150,135,250,0.22)" },
  rough: { text: "#AEB6C8", bg: "rgba(255,255,255,0.04)", bd: "rgba(255,255,255,0.14)", hb: "rgba(174,182,200,0.4)", glow: "rgba(174,182,200,0.14)" },
};

/* --------------------------------- icons ---------------------------------- */
const IExplore = ({ s = 19 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="15.6 8.4 10.6 10.6 8.4 15.6 13.4 13.4" /></svg>);
const IDeep = ({ s = 19 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.3" /><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" /></svg>);
const ILineage = ({ s = 12 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="4" x2="6" y2="20" /><circle cx="6" cy="5" r="1.6" /><circle cx="18" cy="9" r="1.6" /><path d="M18 10.5a6 6 0 0 1-6 6H6" /></svg>);
const ICompare = ({ s = 14 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /></svg>);
const HUB_NOOP = () => {};
const IDots = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>);
const IArrowR = ({ s = 17 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const IChevL = ({ s = 15 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>);
const IChevR = ({ s = 13 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>);
const ISearch = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#727A8E" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>);
const IFolder = ({ s = 13 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.4h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>);
const IPlus = ({ s = 13 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>);
const IX = ({ s = 11 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>);
const IPencil = ({ s = 15 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M13.5 6.5l3 3" /></svg>);
const ITrash = ({ s = 15 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>);
const IWrench = ({ s = 14 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={MC.tc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.5-.5-.5-2.5z" /></svg>);
const INode = ({ s = 11 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={EX.bright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.5 6.5 8 8M16 16l1.5 1.5M6.5 17.5 8 16M16 8l1.5-1.5" /></svg>);

const KEYFRAMES = `
@keyframes hub-fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes hub-popIn{from{opacity:0;transform:translateY(7px) scale(.985)}to{opacity:1;transform:none}}
@keyframes hub-twinkle{0%,100%{opacity:.2}50%{opacity:.95}}
@keyframes hub-driftY{0%{transform:translateY(-38%)}100%{transform:translateY(38%)}}
@keyframes hub-wellpulse{0%,100%{opacity:.7}50%{opacity:1}}
@keyframes hub-pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}
@keyframes hub-ring{0%{transform:scale(.7);opacity:.5}100%{transform:scale(2);opacity:0}}
@keyframes hub-sheen{0%{transform:translateX(-240%) skewX(-18deg)}55%,100%{transform:translateX(280%) skewX(-18deg)}}
.hub-scope ::-webkit-scrollbar{width:11px;height:11px}
.hub-scope ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.09);border-radius:8px;border:3px solid #0B0E15}
`;

/* =========================================================================
   HOVER POPOVER  (his frame · our body)
   ========================================================================= */
function MetricBar({ k, label, val }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#9AA3B6", fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: MC[k] }} />{label}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13.5, fontWeight: 600, color: "#EAEEF6" }}>{val.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${val * 10}%`, borderRadius: 4, background: MC[k], boxShadow: `0 0 6px ${MC[k]}66` }} />
      </div>
      <div style={{ fontSize: 9.5, color: "#5B6478", marginTop: 3 }}>{WLAB[k]} weight · +{(val * W[k]).toFixed(1)}</div>
    </div>
  );
}

function TcLadder({ tc }) {
  const cur = tcBucket(tc);
  return (
    <>
      <div style={{ borderTop: "1px dashed rgba(255,255,255,0.12)", margin: "11px 0 9px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <IWrench />
        <div><b style={{ fontSize: 11.5, fontWeight: 600, color: "#9AA3B6" }}>Tech. Complexity</b><small style={{ display: "block", fontSize: 9, color: "#5B6478", marginTop: 1 }}>build difficulty</small></div>
        <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: ".05em", textTransform: "uppercase", color: "#5B6478" }}>exec context</span>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {TC_WORDS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i === cur ? MC.tc : i < cur ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)", boxShadow: i === cur ? `0 0 6px ${MC.tc}94` : "none" }} />
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {TC_WORDS.map((w, i) => (<span key={w} style={{ flex: 1, textAlign: "center", fontSize: 8, color: i === cur ? "#9AA3B6" : "#5B6478", fontWeight: i === cur ? 600 : 400 }}>{w}</span>))}
      </div>
    </>
  );
}

function ExploreFan({ read, angles, loading }) {
  const wrapRef = useRef(null);
  const nodeRef = useRef(null);
  const cardRefs = useRef([]);
  const [paths, setPaths] = useState("");
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current, node = nodeRef.current;
    if (!wrap || !node) return;
    const wb = wrap.getBoundingClientRect(), nb = node.getBoundingClientRect();
    const x1 = nb.left + nb.width / 2 - wb.left, y1 = nb.bottom - wb.top;
    let p = "";
    cardRefs.current.filter(Boolean).forEach((c) => {
      const cb = c.getBoundingClientRect();
      const x2 = cb.left + cb.width / 2 - wb.left, y2 = cb.top - wb.top, dy = (y2 - y1) * 0.55;
      p += `<path d="M${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}" stroke="url(#exlg)" stroke-width="1.6" fill="none" filter="url(#exgl)" opacity="0.92"/><circle cx="${x2}" cy="${y2}" r="2.4" fill="${EX.gradB}"/>`;
    });
    p += `<circle cx="${x1}" cy="${y1}" r="3" fill="${EX.gradA}"/>`;
    setBox({ w: wb.width, h: wb.height });
    setPaths(p);
  }, [read, angles, loading]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} viewBox={`0 0 ${box.w} ${box.h}`}>
        <defs>
          <linearGradient id="exlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={EX.gradA} /><stop offset="1" stopColor={EX.gradB} /></linearGradient>
          <filter id="exgl" x="-40%" y="-20%" width="180%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
        </defs>
        <g dangerouslySetInnerHTML={{ __html: paths }} />
      </svg>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div ref={nodeRef} style={{ width: 172, margin: "0 auto", border: "1px solid rgba(122,162,255,0.46)", borderRadius: 11, position: "relative", padding: "11px 12px 12px", background: "radial-gradient(120% 150% at 50% 0%, rgba(122,162,255,0.12), transparent 62%), #141a28", boxShadow: "0 0 30px -12px #7aa2ff" }}>
          <div style={{ position: "absolute", left: "50%", bottom: -5, width: 8, height: 8, borderRadius: "50%", background: EX.gradA, boxShadow: `0 0 0 4px rgba(122,162,255,0.12),0 0 11px 1px ${EX.gradA}`, transform: "translateX(-50%)" }} />
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: EX.bright, display: "flex", gap: 6, alignItems: "center", marginBottom: 5 }}><INode /> your rough idea</div>
          <div style={{ fontSize: 11, color: "#E5EAF3", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{read || "…"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 46, alignItems: "stretch" }}>
          {(loading ? Array.from({ length: 3 }) : angles).map((a, i) => (
            <div key={i} ref={(el) => (cardRefs.current[i] = el)} style={{ flex: 1, minWidth: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 11px 9px", background: "#121826", display: "flex", flexDirection: "column" }}>
              {loading ? (
                <div style={{ height: 44, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7E869A", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "2px 5px", alignSelf: "flex-start", marginBottom: 8 }}>{SHIFT[a.basis] || "New angle"}</span>
                  <h4 style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, color: "#E5EAF3", margin: "0 0 8px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</h4>
                  <span style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, color: "#9AA3B6", fontWeight: 500, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "#7FB0FF" }} />{READY[a.readiness] || ""}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HoverPopover({ hover, preview }) {
  const ref = useRef(null);
  const { item, type, top, left } = hover;
  const c = COL[type];
  const pv = preview || {};

  // clamp vertically once real height is known (his openHover centers on the card)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight, pad = 14, vh = window.innerHeight;
    let t = top;
    if (t + h > vh - pad) t = Math.max(pad, vh - h - pad);
    if (t < pad) t = pad;
    el.style.top = t + "px";
  }, [top, type, preview]);

  const head = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
      <span style={{ width: 32, height: 32, flex: "none", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: c.bg, border: `1px solid ${c.bd}`, color: c.text }}>
        {type === "deep" ? <IDeep s={17} /> : <IExplore s={17} />}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: c.text }}>{type === "deep" ? "Deep analysis" : "Explored"}</span>
      {type === "deep" ? (
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {Number.isFinite(item.score) && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 7, color: "#cfc8bc", border: "1px solid rgba(177,168,156,0.5)", background: "rgba(177,168,156,0.13)" }}>{item.score.toFixed(1)}</span>
          )}
          {item.has_brief && <span title="Execution brief" style={{ color: "#a78bfa", display: "inline-flex" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ display: "block" }}><path d="M12 2l10 10-10 10L2 12z" /></svg></span>}
        </span>
      ) : (
        <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: "#5B6478", letterSpacing: ".03em" }}>fan order · not ranked</span>
      )}
    </div>
  );

  const name = (
    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: "#F1F4FA", marginBottom: 11, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
  );

  let body;
  if (type === "deep") {
    body = (
      <>
        {pv.loading ? (
          <div style={{ height: 30, borderRadius: 6, background: "rgba(255,255,255,0.05)", margin: "0 0 12px" }} />
        ) : pv.verdict ? (
          <div style={{ fontSize: 12, lineHeight: 1.4, color: "#C3CAD8", margin: "0 0 12px", paddingLeft: 10, borderLeft: "2px solid #8b8fe0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{pv.verdict}</div>
        ) : null}
        {Number.isFinite(item.md) && <MetricBar k="md" label="Market Demand" val={item.md} />}
        {Number.isFinite(item.mo) && <MetricBar k="mo" label="Monetization" val={item.mo} />}
        {Number.isFinite(item.or) && <MetricBar k="or" label="Originality" val={item.or} />}
        {Number.isFinite(item.tc) && <TcLadder tc={item.tc} />}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 10, color: "#5B6478", fontFamily: "'JetBrains Mono',monospace" }}>
          {(item.family_size || 1) > 1 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ILineage s={11} />{item.family_size} versions</span> : <span>single version</span>}
        </div>
      </>
    );
  } else {
    body = (
      <>
        {pv.loading ? (
          <div style={{ height: 34, borderRadius: 6, background: "rgba(255,255,255,0.05)", margin: "0 0 13px" }} />
        ) : (
          <div style={{ fontFamily: "'Newsreader',serif", fontSize: 14, lineHeight: 1.45, color: "#C3CAD8", fontStyle: "italic", margin: "0 0 12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{pv.read || ""}</div>
        )}
        <ExploreFan read={item.title} angles={pv.angles || []} loading={!!pv.loading} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 10, color: "#5B6478", fontFamily: "'JetBrains Mono',monospace" }}>
          {pv.angles ? `${pv.angles.length} directions` : "directions"}
          {(item.family_size || 1) > 1 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>· <ILineage s={11} />{item.family_size}</span>}
        </div>
      </>
    );
  }

  return (
    <div ref={ref} style={{ position: "fixed", zIndex: 60, width: 340, top, left, pointerEvents: "none", animation: "hub-popIn .16s ease both" }}>
      <div style={{ background: "linear-gradient(180deg,#171C28,#10141D)", border: `1px solid ${c.hb}`, borderRadius: 16, padding: 18, boxShadow: `0 28px 66px -22px rgba(0,0,0,0.92), 0 0 40px -10px ${c.glow}` }}>
        {head}{name}{body}
      </div>
    </div>
  );
}

/* =========================================================================
   CARDS  (his exact treatments)
   ========================================================================= */
function CardMenuDots({ onMenu }) {
  return (
    <div onClick={onMenu} style={{ flex: "none", width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#5B6478", cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#C2C9D6"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5B6478"; }}>
      <IDots />
    </div>
  );
}

function NameOrEdit({ card, editing, editVal, onEditChange, onEditKey, onEditBlur, accent, color }) {
  if (editing) {
    return (
      <input autoFocus value={editVal} onChange={onEditChange} onKeyDown={onEditKey} onBlur={onEditBlur}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, color: "#F1F4FA", background: "rgba(255,255,255,0.05)", border: `1px solid ${accent}`, borderRadius: 9, padding: "8px 10px", outline: "none", boxSizing: "border-box" }} />
    );
  }
  return (<div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, color: color || "#E5EAF3", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{card.title}</div>);
}

function LineagePill({ color, onClick }) {
  return (
    <div onClick={onClick} title="View the evolution tree"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, background: COL[color].bg, border: `1px solid ${COL[color].bd}`, color: COL[color].text, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.02em", cursor: "pointer" }}>
      <ILineage />Lineage
    </div>
  );
}

function EvalCard({ card, edit, onOpen, onMenu, onEnter, onLeave, onLineage }) {
  const isDeep = card.mode === "deep";
  const accent = isDeep ? "rgba(150,135,250,0.5)" : "rgba(96,150,255,0.5)";
  const base = {
    position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between",
    gap: 11, minHeight: 122, flex: 1, borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
    transition: "transform .18s ease,border-color .18s ease,box-shadow .18s ease",
  };
  const exploreBg = "radial-gradient(120% 86% at 16% 2%, rgba(96,150,255,0.20), transparent 54%),radial-gradient(1.6px 1.6px at 22% 28%,rgba(255,255,255,.55),transparent),radial-gradient(1.2px 1.2px at 72% 22%,rgba(127,176,255,.7),transparent),radial-gradient(1.6px 1.6px at 84% 66%,rgba(127,176,255,.55),transparent),radial-gradient(1.1px 1.1px at 38% 78%,rgba(255,255,255,.4),transparent),radial-gradient(1.1px 1.1px at 58% 52%,rgba(255,255,255,.35),transparent),radial-gradient(1.3px 1.3px at 12% 60%,rgba(127,176,255,.6),transparent),radial-gradient(1.1px 1.1px at 92% 38%,rgba(255,255,255,.45),transparent),radial-gradient(1.2px 1.2px at 46% 16%,rgba(127,176,255,.55),transparent),radial-gradient(1px 1px at 68% 84%,rgba(255,255,255,.35),transparent),linear-gradient(180deg,#101727,#0C1018)";
  const lift = (e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = isDeep ? "rgba(150,135,250,0.44)" : "rgba(96,150,255,0.4)"; e.currentTarget.style.boxShadow = "0 14px 32px -16px rgba(0,0,0,0.8)"; };
  const drop = (e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = isDeep ? "rgba(150,135,250,0.18)" : "rgba(96,150,255,0.14)"; e.currentTarget.style.boxShadow = "none"; };
  return (
    <div onClick={onOpen}
      onMouseEnter={(e) => { lift(e); onEnter(e); }}
      onMouseLeave={(e) => { drop(e); onLeave(); }}
      style={isDeep
        ? { ...base, padding: "15px 15px 13px", background: "radial-gradient(120% 86% at 86% 2%, rgba(150,135,250,0.17), transparent 56%), linear-gradient(180deg,#130F1E,#0B0813)", border: "1px solid rgba(150,135,250,0.18)" }
        : { ...base, padding: "15px 15px 13px", backgroundImage: exploreBg, border: "1px solid rgba(96,150,255,0.14)" }}>
      {isDeep ? (
        <>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(30% 46% at 62% 46%, rgba(150,135,250,0.26), transparent 66%)", animation: "hub-wellpulse 4.5s ease-in-out infinite", pointerEvents: "none" }} />
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 250 150" preserveAspectRatio="none">
            <g fill="none" stroke="#AEA0FF">
              <circle cx="154" cy="68" r="26" strokeOpacity="0.26" />
              <circle cx="154" cy="68" r="48" strokeOpacity="0.14" />
            </g>
            <circle cx="154" cy="68" r="2" fill="#C9B7FF" style={{ transformBox: "fill-box", transformOrigin: "center", animation: "hub-pulse 3.4s ease-in-out infinite" }} />
          </svg>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", top: "22%", left: "20%", width: 3, height: 3, borderRadius: "50%", background: "#7FB0FF", boxShadow: "0 0 8px #7FB0FF", animation: "hub-twinkle 2.4s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: "62%", left: "80%", width: 3, height: 3, borderRadius: "50%", background: "#9FC4FF", boxShadow: "0 0 9px #9FC4FF", animation: "hub-twinkle 3.1s ease-in-out infinite .6s" }} />
          <div style={{ position: "absolute", top: "40%", left: "54%", width: 2.5, height: 2.5, borderRadius: "50%", background: "#7FB0FF", boxShadow: "0 0 7px #7FB0FF", animation: "hub-twinkle 2.8s ease-in-out infinite .3s" }} />
          <div style={{ position: "absolute", top: "78%", left: "30%", width: 2.5, height: 2.5, borderRadius: "50%", background: "#BCD2FF", boxShadow: "0 0 8px #BCD2FF", animation: "hub-twinkle 3.4s ease-in-out infinite .9s" }} />
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 250 150" preserveAspectRatio="none">
            <line x1="40" y1="40" x2="98" y2="70" stroke="rgba(127,176,255,0.34)" strokeWidth="1" />
            <line x1="98" y1="70" x2="150" y2="48" stroke="rgba(127,176,255,0.30)" strokeWidth="1" />
            <line x1="98" y1="70" x2="170" y2="104" stroke="rgba(127,176,255,0.26)" strokeWidth="1" />
            <line x1="150" y1="48" x2="206" y2="72" stroke="rgba(127,176,255,0.24)" strokeWidth="1" />
            <line x1="170" y1="104" x2="206" y2="72" stroke="rgba(127,176,255,0.20)" strokeWidth="1" />
            <circle cx="40" cy="40" r="1.7" fill="#7FB0FF" />
            <circle cx="98" cy="70" r="2" fill="#7FB0FF" />
            <circle cx="150" cy="48" r="1.7" fill="#7FB0FF" />
            <circle cx="170" cy="104" r="1.7" fill="#7FB0FF" />
            <circle cx="206" cy="72" r="1.7" fill="#7FB0FF" />
          </svg>
        </>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, flex: "none", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: isDeep ? "rgba(150,135,250,0.16)" : "rgba(96,150,255,0.12)", border: `1px solid ${isDeep ? "rgba(150,135,250,0.36)" : "rgba(96,150,255,0.28)"}`, color: isDeep ? "#AEA0FF" : "#7FB0FF", backdropFilter: isDeep ? "none" : "blur(2px)" }}>
            {isDeep ? <IDeep s={17} /> : <IExplore s={17} />}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: isDeep ? "#AEA0FF" : "#7FB0FF" }}>{isDeep ? "Deep" : "Explore"}</span>
        </div>
        <CardMenuDots onMenu={onMenu} />
      </div>
      <div style={{ position: "relative" }}>
        <NameOrEdit card={card} editing={edit.editing} editVal={edit.editVal} onEditChange={edit.onChange} onEditKey={edit.onKey} onEditBlur={edit.onBlur} accent={accent} />
      </div>
      <div style={{ position: "relative", minHeight: 18 }}>
        {(card.family_size || 1) > 1 && <LineagePill color={isDeep ? "deep" : "explore"} onClick={onLineage} />}
      </div>
    </div>
  );
}

function RoughCard({ card, edit, onOpen, onMenu }) {
  const fromExplore = card.source === "explore";
  return (
    <div onClick={onOpen}
      style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 11, minHeight: 122, padding: 15, borderRadius: 14, background: "linear-gradient(180deg,#13161d,#0F1218)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "transform .18s ease,border-color .18s ease,box-shadow .18s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(174,182,200,0.3)"; e.currentTarget.style.boxShadow = "0 14px 32px -16px rgba(0,0,0,0.8)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ position: "absolute", top: "-60%", bottom: "-60%", left: 0, width: "46%", background: "linear-gradient(105deg,transparent,rgba(255,255,255,0.05),transparent)", transform: "translateX(-240%) skewX(-18deg)", animation: "hub-sheen 7s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ position: "relative", width: 7, height: 7, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(142,153,172,0.6)", animation: "hub-ring 2.6s ease-out infinite" }} />
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8E99AC" }} />
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8A93A3" }}>Rough state</span>
        </div>
        <CardMenuDots onMenu={onMenu} />
      </div>
      <div style={{ position: "relative" }}>
        <NameOrEdit card={card} editing={edit.editing} editVal={edit.editVal} onEditChange={edit.onChange} onEditKey={edit.onKey} onEditBlur={edit.onBlur} accent="rgba(174,182,200,0.5)" color="#D4DAE3" />
      </div>
      <div style={{ position: "relative", minHeight: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.04em", color: fromExplore ? "#7FB0FF" : "#727B8C" }}>
          {fromExplore ? <ILineage s={11} /> : <IPencil s={11} />}
          {fromExplore ? "From Explore" : "Added by you"}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   CONTEXT MENU
   ========================================================================= */
function ContextMenu({ menu, folders, onClose, setStep, onRename, onAskDelete, onDelete, onMove, onMoveNew, isDeep, inCompare, compareFull, onAddCompare }) {
  const { step, top, left } = menu;
  const item = (label, color, icon, onClick, extra) => (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, fontSize: 13.5, color, cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = extra || "rgba(255,255,255,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      {icon}{label}
    </div>
  );
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70 }} />
      <div style={{ position: "fixed", zIndex: 71, width: 210, top, left, background: "linear-gradient(180deg,#171C28,#10141D)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 13, padding: 6, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.9)", animation: "hub-popIn .14s ease both" }}>
        {step === "main" && (
          <>
            {isDeep && (
              inCompare
                ? item("Remove from compare", "#C9BEFF", <ICompare s={15} />, onAddCompare, "rgba(150,135,250,0.12)")
                : compareFull
                  ? <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, fontSize: 13.5, color: "#5B6478", cursor: "not-allowed" }}><ICompare s={15} />Compare is full (2)</div>
                  : item("Add to compare", "#B6AAFF", <ICompare s={15} />, onAddCompare, "rgba(150,135,250,0.12)")
            )}
            {isDeep && <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "5px 8px" }} />}
            {item("Rename", "#D2D8E4", <IPencil />, onRename)}
            <div onClick={() => setStep("move")} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, fontSize: 13.5, color: "#D2D8E4", cursor: "pointer" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <IFolder s={15} />Move to folder<span style={{ marginLeft: "auto", opacity: 0.5 }}><IChevR /></span>
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "5px 8px" }} />
            {item("Delete", "#E58B7B", <ITrash />, () => setStep("confirm"), "rgba(229,139,123,0.1)")}
          </>
        )}
        {step === "move" && (
          <>
            <div onClick={() => setStep("main")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px 7px", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.14em", textTransform: "uppercase", color: "#727A8E", cursor: "pointer" }}><IChevL s={13} />Move to</div>
            {folders.map((f) => item(f.name || "Untitled", "#D2D8E4", <IFolder s={15} />, () => onMove(f.id)))}
            {item("New folder", "#7FB0FF", <IPlus s={15} />, onMoveNew, "rgba(96,150,255,0.1)")}
          </>
        )}
        {step === "confirm" && (
          <>
            <div style={{ padding: "12px 11px 8px", fontSize: 13, color: "#D2D8E4", lineHeight: 1.45 }}>Delete this idea? This can’t be undone.</div>
            <div style={{ display: "flex", gap: 7, padding: "0 6px 6px" }}>
              <div onClick={() => setStep("main")} style={{ flex: 1, textAlign: "center", padding: 8, borderRadius: 9, fontSize: 13, color: "#C2C9D6", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}>Cancel</div>
              <div onClick={onDelete} style={{ flex: 1, textAlign: "center", padding: 8, borderRadius: 9, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", background: "rgba(220,90,75,0.85)" }}>Delete</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* =========================================================================
   SHARED CHROME (search · folder rail · tabs)
   ========================================================================= */
const BackChip = ({ onClick }) => (
  <div onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px 6px 9px", borderRadius: 9, fontSize: 13, color: "#9AA3B6", cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", marginBottom: 20 }}
    onMouseEnter={(e) => { e.currentTarget.style.color = "#EAEEF6"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#9AA3B6"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
    <IChevL />My Ideas Hub
  </div>
);

const SearchBox = ({ value, onChange, placeholder }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: 240 }}>
    <ISearch />
    <input value={value} onChange={onChange} placeholder={placeholder} style={{ background: "transparent", border: "none", outline: "none", color: "#EAEEF6", fontSize: 13.5, fontFamily: "inherit", width: "100%" }} />
  </div>
);

function FolderRail({ folders, activeFolder, counts, onPick, addingFolder, folderName, setFolderName, onNewFolder, onCommitFolder, onCancelFolder, onDeleteFolder }) {
  const chip = (active) => ({ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: `1px solid ${active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.09)"}`, background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", color: active ? "#EAEEF6" : "#9AA3B6" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#5B6478", marginRight: 3 }}>Folders</span>
      <div onClick={() => onPick(null)} style={{ ...chip(activeFolder === null), paddingRight: 13 }}>All ideas</div>
      {folders.map((f) => (
        <div key={f.id} onClick={() => onPick(f.id)} style={chip(activeFolder === f.id)}>
          <IFolder />{f.name}<span style={{ opacity: 0.5, fontSize: 11.5 }}>{counts(f.id)}</span>
          <span onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", opacity: 0.42 }} onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.95)} onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.42)}><IX /></span>
        </div>
      ))}
      {addingFolder ? (
        <input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCommitFolder(); } if (e.key === "Escape") onCancelFolder(); }} onBlur={onCommitFolder}
          placeholder="Folder name" style={{ width: 138, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "#F1F4FA", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(174,182,200,0.5)", borderRadius: 999, padding: "6px 13px", outline: "none", boxSizing: "border-box" }} />
      ) : (
        <div onClick={onNewFolder} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: "1px dashed rgba(255,255,255,0.16)", background: "transparent", color: "#9AA3B6" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)"; e.currentTarget.style.color = "#EAEEF6"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#9AA3B6"; }}>
          <IPlus />New folder
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   MAIN
   ========================================================================= */
const SerifH1 = ({ children, count }) => (
  <h1 style={{ fontFamily: "'Newsreader',serif", fontWeight: 400, fontSize: 33, lineHeight: 1, color: "#F1F4FA", display: "flex", alignItems: "center", gap: 11, margin: 0 }}>
    {children}
    {count != null && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "#8A92A6", letterSpacing: "0.04em", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "2px 9px" }}>{count}</span>}
  </h1>
);

export default function HubView({ t, onOpenIdea, onOpenLineage, onBack, compareSelected, onAddToCompare, initialView, onViewChange, isAnon = false, onSignUp }) {
  const [data, setData] = useState({ folders: [], rough: [], ideas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState(initialView || "hub"); // hub | rough | evaluated  (lineage-back opens the evaluated room directly)
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | explore | deep
  const [activeFolder, setActiveFolder] = useState(null);

  const [hover, setHover] = useState(null);            // { item, type, top, left }
  const [previews, setPreviews] = useState({});         // id -> { loading, verdict?, read?, angles? }
  const [menu, setMenu] = useState(null);               // { id, type, step, top, left }
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  // "+ Add a rough idea" inline composer (mirrors the folder-add pattern).
  const [addingRough, setAddingRough] = useState(false);
  const [roughText, setRoughText] = useState("");
  const [savingRough, setSavingRough] = useState(false);

  const hoverTimer = useRef(null);

  const authedFetch = useCallback(async (url, opts = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in.");
    return fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${session.access_token}` } });
  }, []);

  const load = useCallback(async () => {
    if (isAnon) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const res = await authedFetch("/api/ideas");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load.");
      setData({ folders: d.folders || [], rough: d.rough || [], ideas: d.ideas || [] });
    } catch (e) { setError(e.message || "Failed to load."); }
    finally { setLoading(false); }
  }, [authedFetch, isAnon]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  /* ----- lazy hover preview fetch (verdict / read+angles), cached by id ----- */
  const ensurePreview = useCallback(async (card) => {
    if (card.mode !== "deep" && card.mode !== "explore") return;
    if (previews[card.id]) return;
    setPreviews((p) => ({ ...p, [card.id]: { loading: true } }));
    try {
      const res = await authedFetch(`/api/ideas/${card.id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "x");
      if (d.state === "deep") {
        const ev = d.analysis?.evaluation || {};
        const verdict = ev.verdict_headline || ev.verdict_lead || (ev.summary ? String(ev.summary).split(/(?<=[.!?])\s/)[0] : "");
        setPreviews((p) => ({ ...p, [card.id]: { loading: false, verdict } }));
      } else if (d.state === "explore") {
        const env = d.explore || {};
        const read = env.read?.reflection ? String(env.read.reflection).split(/(?<=[.!?])\s/)[0] : "";
        const angles = (env.angles || []).slice(0, 3).map((a) => ({ basis: a.basis?.primary, title: a.title, readiness: a.readiness }));
        setPreviews((p) => ({ ...p, [card.id]: { loading: false, read, angles } }));
      } else {
        setPreviews((p) => ({ ...p, [card.id]: { loading: false } }));
      }
    } catch {
      setPreviews((p) => ({ ...p, [card.id]: { loading: false } }));
    }
  }, [authedFetch, previews]);

  const openHover = (e, card) => {
    if (menu || editingId) return;
    const r = e.currentTarget.getBoundingClientRect();
    const Wp = 340, pad = 14, vw = window.innerWidth, vh = window.innerHeight, estH = card.mode === "deep" ? 430 : 380;
    let left = r.right + 14;
    if (left + Wp > vw - pad) left = r.left - Wp - 14;
    if (left < pad) left = pad;
    let top = r.top + r.height / 2 - estH / 2;
    top = Math.max(pad, Math.min(top, vh - estH - pad));
    setHover({ item: card, type: card.mode, top, left });
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => ensurePreview(card), 120);
  };
  const closeHover = () => { clearTimeout(hoverTimer.current); setHover(null); };

  /* ----------------------------- context menu ----------------------------- */
  const openMenu = (e, card) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const Wm = 210, vw = window.innerWidth, vh = window.innerHeight, pad = 12;
    let left = r.right - Wm; if (left < pad) left = pad; if (left + Wm > vw - pad) left = vw - pad - Wm;
    let top = r.bottom + 8; if (top + 234 > vh - pad) top = Math.max(pad, r.top - 242);
    setMenu({ id: card.id, type: card.mode, step: "main", top, left }); setHover(null);
  };
  const closeMenu = () => setMenu(null);
  const setMenuStep = (step) => setMenu((m) => (m ? { ...m, step } : null));

  /* ------------------------------- mutations ------------------------------ */
  const patchIdea = async (id, body) => {
    try {
      const res = await authedFetch(`/api/ideas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Update failed."); }
    } catch (e) { setError(e.message); await load(); }
  };

  const startRename = (card) => { setEditingId(card.id); setEditName(card.title); setMenu(null); setHover(null); };
  const commitRename = async () => {
    const id = editingId, name = (editName || "").trim();
    setEditingId(null); setEditName("");
    if (!id || !name) return;
    const apply = (arr) => arr.map((c) => (c.id === id ? { ...c, title: name } : c));
    setData((d) => ({ ...d, rough: apply(d.rough), ideas: apply(d.ideas) }));
    await patchIdea(id, { title: name });
  };
  const editFor = (card) => ({
    editing: editingId === card.id,
    editVal: editName,
    onChange: (e) => setEditName(e.target.value),
    onKey: (e) => { if (e.key === "Enter") { e.preventDefault(); commitRename(); } if (e.key === "Escape") { setEditingId(null); setEditName(""); } },
    onBlur: commitRename,
  });

  const moveTo = async (id, folderId) => {
    setMenu(null);
    const apply = (arr) => arr.map((c) => (c.id === id ? { ...c, folder_id: folderId } : c));
    setData((d) => ({ ...d, rough: apply(d.rough), ideas: apply(d.ideas) }));
    await patchIdea(id, { folder_id: folderId });
  };
  const moveToNew = async (id) => {
    setMenu(null);
    try {
      const res = await authedFetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "New folder" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not create folder.");
      const fid = d.id || d.folder?.id || d.folder_id;
      await load();
      if (fid) await patchIdea(id, { folder_id: fid });
    } catch (e) { setError(e.message); }
  };

  const removeIdea = async (id) => {
    setMenu(null); setHover(null);
    const prune = (arr) => arr.filter((c) => c.id !== id);
    setData((d) => ({ ...d, rough: prune(d.rough), ideas: prune(d.ideas) }));
    try {
      const res = await authedFetch(`/api/ideas/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Delete failed."); }
      await load();
    } catch (e) { setError(e.message); await load(); }
  };

  const createRough = async (text) => {
    try {
      const res = await authedFetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw_idea_text: text, source: "manual", folder_id: activeFolder }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Could not save."); }
      await load();
    } catch (e) { setError(e.message); }
  };

  const commitFolder = async () => {
    const name = folderName.trim();
    setAddingFolder(false); setFolderName("");
    if (!name) return;
    try {
      const res = await authedFetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Could not create folder."); }
      await load();
    } catch (e) { setError(e.message); }
  };
  // Create a rough idea (0 evals) via POST /api/ideas -> createIdea, then refresh.
  // If a folder is active, the capture lands in it. Title is server-derived from text.
  const commitRough = async () => {
    const text = roughText.trim();
    if (!text) { setAddingRough(false); setRoughText(""); return; }
    setSavingRough(true);
    try {
      const res = await authedFetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_idea_text: text, ...(activeFolder ? { folder_id: activeFolder } : {}) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Could not save idea."); }
      setRoughText(""); setAddingRough(false);
      await load();
    } catch (e) { setError(e.message); }
    finally { setSavingRough(false); }
  };
  const deleteFolder = async (id) => {
    setData((d) => ({ ...d, folders: d.folders.filter((f) => f.id !== id) }));
    if (activeFolder === id) setActiveFolder(null);
    try {
      const res = await authedFetch(`/api/folders/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Could not delete folder."); }
      await load();
    } catch (e) { setError(e.message); await load(); }
  };

  /* ------------------------------- selectors ------------------------------ */
  const q = search.trim().toLowerCase();
  const matchQ = (c) => !q || (c.title || "").toLowerCase().includes(q);
  const inFolder = (c) => activeFolder === null || c.folder_id === activeFolder;
  const folderCount = (fid) => data.rough.concat(data.ideas).filter((c) => c.folder_id === fid).length;

  const roughVisible = data.rough.filter(matchQ).filter(inFolder);
  const evalAll = data.ideas.filter(matchQ).filter(inFolder);
  const evalVisible = evalAll.filter((c) => filter === "all" || c.mode === filter);

  const exploreCount = data.ideas.filter((c) => c.mode === "explore").length;
  const deepCount = data.ideas.filter((c) => c.mode === "deep").length;

  const goView = (v) => { setView(v); setSearch(""); setFilter("all"); setActiveFolder(null); setHover(null); setMenu(null); setEditingId(null); onViewChange && onViewChange(v); };

  // Compare is now the global cross-space tray. "Add to compare" toggles a Deep
  // card into the page-level basket (carrying title + origin so its chip renders);
  // membership shows as a faint violet ring + an "In compare" menu state.
  const addToCompare = (card) => { if (card && card.mode === "deep") onAddToCompare && onAddToCompare(card.id, null, { title: card.title, origin: "evaluated", mode: "deep" }); setMenu(null); };
  const inTray = (id) => (compareSelected || []).some((s) => s.ideaId === id);

  const cardHandlers = (card) => ({
    onOpen: () => { if (editingId === card.id) return; onOpenIdea && onOpenIdea(card.id, view); },
    onMenu: (e) => openMenu(e, card),
    onEnter: (e) => openHover(e, card),
    onLeave: closeHover,
    onLineage: (e) => { e.stopPropagation(); onOpenLineage && onOpenLineage(card.id); },
  });

  /* --------------------------------- views -------------------------------- */
  const Landing = () => (
    <div style={{ animation: "hub-fadeUp .45s ease" }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: "0.24em", color: "#7E869A", textTransform: "uppercase", marginBottom: 14 }}>Idea Operating System</div>
      <h1 style={{ fontFamily: "'Newsreader',serif", fontWeight: 400, fontSize: 40, lineHeight: 1, letterSpacing: "-0.01em", color: "#F1F4FA", marginBottom: 14 }}>My Ideas Hub</h1>
      <p style={{ fontSize: 14, color: "#8A92A6", maxWidth: 560, lineHeight: 1.5 }}>Two shelves, two states of mind. Rough sparks stay raw on one side; explored and deep-analyzed ideas live on the other.</p>
      <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        <div onClick={() => goView("rough")} style={{ position: "relative", display: "flex", flexDirection: "column", padding: "21px 20px 18px", borderRadius: 18, background: "linear-gradient(180deg,#151924,#0F121B)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", minHeight: 168, transition: "transform .2s,border-color .2s,box-shadow .2s" }}
          onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(174,182,200,0.28)"; e.currentTarget.style.boxShadow = "0 24px 56px -26px rgba(0,0,0,0.85)"; }} onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.2)", color: "#AEB6C8" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" /></svg>
            </div>
            <div style={{ fontFamily: "'Newsreader',serif", fontSize: 34, lineHeight: 1, color: "rgba(241,244,250,0.16)" }}>{data.rough.length}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "'Newsreader',serif", fontSize: 23, lineHeight: 1.05, color: "#F1F4FA", marginBottom: 7 }}>Rough ideas</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#828A9E", maxWidth: 300 }}>Raw sparks straight from your head — not yet explored or evaluated.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "#AEB6C8", fontSize: 12.5, fontWeight: 500 }}>Open shelf <IArrowR /></div>
        </div>

        <div onClick={() => goView("evaluated")} style={{ position: "relative", display: "flex", flexDirection: "column", padding: "21px 20px 18px", borderRadius: 18, background: "linear-gradient(180deg,#151924,#0F121B)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", minHeight: 168, transition: "transform .2s,border-color .2s,box-shadow .2s" }}
          onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(96,150,255,0.32)"; e.currentTarget.style.boxShadow = "0 24px 56px -26px rgba(0,0,0,0.85)"; }} onMouseOut={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(96,150,255,0.10)", border: "1px solid rgba(96,150,255,0.24)", color: "#7FB0FF" }}><IExplore s={20} /></div>
              <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(150,135,250,0.10)", border: "1px solid rgba(150,135,250,0.24)", color: "#AEA0FF" }}><IDeep s={20} /></div>
            </div>
            <div style={{ fontFamily: "'Newsreader',serif", fontSize: 34, lineHeight: 1, color: "rgba(241,244,250,0.16)" }}>{data.ideas.length}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: "'Newsreader',serif", fontSize: 23, lineHeight: 1.05, color: "#F1F4FA", marginBottom: 7 }}>Evaluated ideas</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#828A9E", maxWidth: 310 }}>Explored &amp; deep-analyzed — refined enough to act on.</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7FB0FF", fontSize: 12.5, fontWeight: 500 }}>Open shelf <IArrowR /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#7FB0FF" }}><IExplore s={13} />{exploreCount}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#AEA0FF" }}><IDeep s={13} />{deepCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const railProps = {
    folders: data.folders, activeFolder, counts: folderCount, onPick: setActiveFolder,
    addingFolder, folderName, setFolderName,
    onNewFolder: () => { setAddingFolder(true); setFolderName(""); }, onCommitFolder: commitFolder,
    onCancelFolder: () => { setAddingFolder(false); setFolderName(""); }, onDeleteFolder: deleteFolder,
  };

  const RoughRoom = () => (
    <div style={{ animation: "hub-fadeUp .35s ease" }}>
      <BackChip onClick={() => goView("hub")} />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <SerifH1 count={roughVisible.length}>Rough ideas</SerifH1>
          <p style={{ fontSize: 13.5, color: "#828A9E", marginTop: 10, maxWidth: 480, lineHeight: 1.5 }}>Unfiltered captures. Send one to Explore or Deep analysis when it’s ready to grow up.</p>
        </div>
        <SearchBox value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rough ideas" />
      </div>
      <FolderRail {...railProps} />
      {q && roughVisible.length === 0 ? (
        <div style={{ padding: "70px 0", textAlign: "center", color: "#5B6478", fontSize: 14.5 }}>No rough ideas match that search.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 13 }}>
          {!q && (addingRough ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 122, padding: 15, borderRadius: 14, background: "linear-gradient(180deg,#13161d,#0F1218)", border: "1px solid rgba(174,182,200,0.35)" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8A93A3" }}>New rough idea</span>
              <textarea
                autoFocus
                value={roughText}
                onChange={(e) => setRoughText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitRough(); }
                  if (e.key === "Escape") { setAddingRough(false); setRoughText(""); }
                }}
                placeholder="Capture the spark — what it does, who it's for…"
                rows={3}
                style={{ flex: 1, width: "100%", resize: "none", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "9px 11px", fontSize: 13, lineHeight: 1.5, color: "#E7EBF2", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div onClick={savingRough ? undefined : commitRough} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: savingRough ? "default" : "pointer", color: "#0C0E13", background: roughText.trim() ? "#AEB6C8" : "rgba(174,182,200,0.4)", opacity: savingRough ? 0.6 : 1, transition: "background .15s" }}>{savingRough ? "Saving…" : "Save"}</div>
                <div onClick={() => { setAddingRough(false); setRoughText(""); }} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12.5, color: "#9AA3B6", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}>Cancel</div>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setAddingRough(true)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAddingRough(true); } }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, minHeight: 122, padding: 15, borderRadius: 14, background: "transparent", border: "1px dashed rgba(255,255,255,0.16)", color: "#AEB6C8", cursor: "pointer", transition: "border-color .18s ease,background .18s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(174,182,200,0.45)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.background = "transparent"; }}
            >
              <IPlus s={16} />
              <span style={{ fontSize: 13, color: "#AEB6C8", fontWeight: 500 }}>Add a rough idea</span>
            </div>
          ))}
          {roughVisible.map((c) => { const h = cardHandlers(c); return <RoughCard key={c.id} card={c} edit={editFor(c)} onOpen={h.onOpen} onMenu={h.onMenu} />; })}
        </div>
      )}
    </div>
  );

  const tab = (label, val, count, on) => {
    const active = filter === val;
    const styles = {
      all: { bg: "rgba(255,255,255,0.08)", color: "#EAEEF6", bd: "rgba(255,255,255,0.2)" },
      explore: { bg: "rgba(96,150,255,0.14)", color: "#8FB8FF", bd: "rgba(96,150,255,0.46)" },
      deep: { bg: "rgba(150,135,250,0.14)", color: "#B6AAFF", bd: "rgba(150,135,250,0.46)" },
    }[val];
    const off = { bg: "rgba(255,255,255,0.03)", color: "#9AA3B6", bd: "rgba(255,255,255,0.09)" };
    const s = active ? styles : off;
    return (
      <div onClick={on} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: `1px solid ${s.bd}`, background: s.bg, color: s.color }}>
        {val === "explore" && <IExplore s={14} />}{val === "deep" && <IDeep s={14} />}{label}<span style={{ opacity: 0.62, fontSize: 11.5 }}>{count}</span>
      </div>
    );
  };

  const EvalRoom = () => (
    <div style={{ animation: "hub-fadeUp .35s ease" }}>
      <BackChip onClick={() => goView("hub")} />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <SerifH1 count={evalVisible.length}>Evaluated ideas</SerifH1>
          <p style={{ fontSize: 13.5, color: "#828A9E", marginTop: 10, maxWidth: 520, lineHeight: 1.5 }}>Explored and deep-analyzed ideas, side by side. Different lenses, equal weight.</p>
        </div>
        <SearchBox value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search evaluated ideas" />
      </div>
      <FolderRail {...railProps} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {tab("All", "all", evalAll.length, () => setFilter("all"))}
          {tab("Explored", "explore", exploreCount, () => setFilter("explore"))}
          {tab("Deep", "deep", deepCount, () => setFilter("deep"))}
        </div>
      </div>
      {evalVisible.length === 0 ? (
        <div style={{ padding: "70px 0", textAlign: "center", color: "#5B6478", fontSize: 14.5 }}>{q ? "No evaluated ideas match that search." : "No evaluated ideas yet."}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 13 }}>
          {evalVisible.map((c) => {
            const h = cardHandlers(c);
            const ring = inTray(c.id);
            return (
              <div key={c.id} style={{ position: "relative", display: "flex", flexDirection: "column", borderRadius: 18, outline: ring ? "2px solid rgba(150,135,250,0.6)" : "2px solid transparent", outlineOffset: 3, transition: "outline-color .15s" }}>
                <EvalCard card={c} edit={editFor(c)} {...h} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const menuFolders = data.folders;

  if (isAnon) {
    return (
      <div className="hub-scope" style={{ minHeight: "100%", background: "#0B0E15", color: "#EAEEF6", fontFamily: "'Hanken Grotesk',sans-serif" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ padding: "8px 0 90px", position: "relative" }}>
          <div style={{ position: "absolute", top: -30, left: 20, width: 580, height: 340, background: "radial-gradient(58% 60% at 28% 30%,rgba(96,150,255,0.08),transparent 72%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", maxWidth: 1160, margin: "0 auto" }}>
            <div style={{ animation: "hub-fadeUp .45s ease", maxWidth: 540, margin: "44px auto 0", textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, letterSpacing: "0.24em", color: "#7E869A", textTransform: "uppercase", marginBottom: 18 }}>My Ideas</div>
              <div style={{ fontFamily: "'Newsreader',serif", fontSize: 40, lineHeight: 1.08, color: "#F1F4FA", marginBottom: 16 }}>Your ideas live here.</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#8A92A6", maxWidth: 448, margin: "0 auto 28px" }}>
                Sign in to save an evaluation, revisit it later, branch it into new directions, and watch how it evolves. Your first run is free — no account needed to try it.
              </p>
              <button
                onClick={onSignUp}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(52,216,168,0.55)"; e.currentTarget.style.color = "#dffaf1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#e7ebf2"; }}
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", color: "#e7ebf2", background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, padding: "12px 22px", cursor: "pointer", transition: "border-color .18s,color .18s" }}
              >
                Sign in to save ideas →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-scope" style={{ minHeight: "100%", background: "#0B0E15", color: "#EAEEF6", fontFamily: "'Hanken Grotesk',sans-serif" }}>
      <style>{KEYFRAMES}</style>
      <div style={{ padding: "8px 0 90px", position: "relative" }}>
        <div style={{ position: "absolute", top: -30, left: 20, width: 580, height: 340, background: "radial-gradient(58% 60% at 28% 30%,rgba(96,150,255,0.08),transparent 72%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1160, margin: "0 auto" }}>
          {onBack && view === "hub" && (
            <BackLink t={t} flush onClick={onBack} style={{ marginBottom: 18 }}>Back</BackLink>
          )}
          {error && (
            <div style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>{error}</div>
          )}
          {loading ? (
            <p style={{ fontSize: 14, color: "#5B6478", padding: "60px 0" }}>Loading your ideas…</p>
          ) : view === "hub" ? Landing() : view === "rough" ? RoughRoom() : EvalRoom()}
        </div>
      </div>

      {hover && <HoverPopover hover={hover} preview={previews[hover.item.id]} />}
      {menu && (
        <ContextMenu menu={menu} folders={menuFolders} onClose={closeMenu} setStep={setMenuStep}
          isDeep={menu.type === "deep"}
          inCompare={inTray(menu.id)}
          compareFull={(compareSelected || []).length >= 2}
          onAddCompare={() => { const it = data.ideas.find((c) => c.id === menu.id); if (it) addToCompare(it); }}
          onRename={() => { const all = data.rough.concat(data.ideas); const it = all.find((c) => c.id === menu.id); if (it) startRename(it); }}
          onAskDelete={() => setMenuStep("confirm")} onDelete={() => removeIdea(menu.id)}
          onMove={(fid) => moveTo(menu.id, fid)} onMoveNew={() => moveToNew(menu.id)} />
      )}
    </div>
  );
}