"use client";

// src/app/LineageView.js
// The genealogy canvas — horizontal lineage map (root at left, generations →).
// Drop-in: same props as before { myIdeas, targetIdeaId, t, onBack, onViewIdea,
// onStartComparison, onUpdateIdea, onDelete, loadingIdeaId }.
//
// DATA: self-fetches the authoritative family from GET /api/ideas/[id]/lineage
// (returns { root_id, target_id, nodes:[shapeNode...] }). `myIdeas` drives an
// optimistic first paint so there's no loading flash; the fetch reconciles.
//
// IDENTITY (aligned to the hub): explore = X2 dawn-blue, deep = D2 violet,
// rough = neutral. Score lives only on deep; the canvas carries shape, the
// inspector carries detail.
//
// NODE TRACKING (three-tier): click a node and its bloodline lights —
//   • SPINE (selected + ancestors to root): full bright, glowing mode-coloured
//     edges with an animated flow dash. The literal lineage.
//   • DOWNSTREAM (descendants): lit but lighter, no glow.
//   • UNRELATED: dimmed hardest.
// Selecting the root no longer washes the canvas: its spine is just itself.
//
// GESTURES: drag empty space = pan; scroll = cursor-anchored zoom; click a node
// to inspect; click empty space to deselect.

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ----------------------------------------------------------------------------
// constants
// ----------------------------------------------------------------------------
const DENS = { bW: 222, bH: 108, aW: 188, aH: 44, cR: 19, xGap: 344, yGap: 124, pad: 58 };

const MODE = {
  explore: { a: "#7FB0FF", s: "rgba(96,150,255,0.15)", b: "rgba(96,150,255,0.32)", g: "rgba(96,150,255,0.55)", d: "#1f3a78", label: "EXPLORE", full: "EXPLORE" },
  deep:    { a: "#AEA0FF", s: "rgba(150,135,250,0.15)", b: "rgba(150,135,250,0.34)", g: "rgba(150,135,250,0.55)", d: "#3a2c6e", label: "DEEP",    full: "DEEP ANALYSIS" },
  rough:   { a: "#8a93a6", s: "rgba(138,147,166,0.13)", b: "rgba(138,147,166,0.30)", g: "rgba(138,147,166,0.40)", d: "#2a3142", label: "ROUGH",   full: "ROUGH STATE" },
};

const TAUPE = "#b1a89c"; // neutral overall pill (matches hub deep)

const short = (s, n = 40) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");

// changed_dimensions is jsonb (array | object | string) — render up to 3, dot-joined.
function fmtChanged(c) {
  if (!c) return null;
  let arr = Array.isArray(c) ? c : typeof c === "object" ? Object.keys(c) : String(c).split(/[,;|]/);
  arr = arr.map((x) => String(x).trim()).filter(Boolean);
  return arr.length ? arr.slice(0, 3).join(" · ") : null;
}

// ----------------------------------------------------------------------------
// optimistic family from the flat myIdeas list
// ----------------------------------------------------------------------------
function resolveClientMode(idea) {
  const evals = idea.evaluations || [];
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  if (!evals.length) return { mode: "rough", score: null, md: null, mo: null, or: null, tc: null, has_brief: false };
  const latest = evals[0];
  const m = String(latest.mode || latest.evaluation_mode || "").toLowerCase();
  const raw = latest.weighted_overall_score;
  const hasScore = raw !== null && raw !== undefined && Number(raw) > 0;
  if (m.includes("explore")) return { mode: "explore", score: null, md: null, mo: null, or: null, tc: null, has_brief: !!latest.execution_brief_json };
  if (m === "deep" || hasScore) {
    return {
      mode: "deep",
      score: hasScore ? Number(raw) : null,
      md: num(latest.market_demand_score), mo: num(latest.monetization_score),
      or: num(latest.originality_score), tc: num(latest.technical_complexity_score),
      has_brief: !!latest.execution_brief_json,
    };
  }
  return { mode: "explore", score: null, md: null, mo: null, or: null, tc: null, has_brief: false };
}

function deriveNodesFromMyIdeas(myIdeas, targetIdeaId) {
  if (!myIdeas || !myIdeas.length || !targetIdeaId) return [];
  const byId = {};
  myIdeas.forEach((i) => (byId[i.id] = i));
  if (!byId[targetIdeaId]) return [];
  let cur = byId[targetIdeaId], hops = 0;
  while (cur && cur.parent_idea_id && byId[cur.parent_idea_id] && hops++ < 50) cur = byId[cur.parent_idea_id];
  const rootId = cur.id;
  const fam = [];
  const visit = (id) => {
    const n = byId[id];
    if (!n) return;
    const st = resolveClientMode(n);
    fam.push({
      id: n.id, parent_id: n.parent_idea_id || null, title: n.title, mode: st.mode, score: st.score,
      md: st.md, mo: st.mo, or: st.or, tc: st.tc,
      is_root: n.id === rootId, is_main: !!n.is_main_version,
      branch_reason: n.branch_reason || null, source: n.source || null,
      is_favorite: !!n.is_favorite, disposition: n.disposition || null,
      changed_dimensions: n.changed_dimensions || null,
      has_brief: st.has_brief, created_at: n.created_at,
    });
    myIdeas.filter((x) => x.parent_idea_id === id).forEach((c) => visit(c.id));
  };
  visit(rootId);
  return fam;
}

// ----------------------------------------------------------------------------
// horizontal tidy-tree layout (depth = x, leaf order = y)
// ----------------------------------------------------------------------------
function layout(nodes) {
  const P = DENS;
  const cardW = P.bW;
  const cardH = P.bH;
  const byId = {};
  nodes.forEach((n) => (byId[n.id] = { ...n, children: [] }));
  nodes.forEach((n) => { if (n.parent_id && byId[n.parent_id]) byId[n.parent_id].children.push(byId[n.id]); });
  const roots = nodes.filter((n) => !n.parent_id || !byId[n.parent_id]).map((n) => byId[n.id]);
  const sortKids = (arr) => arr.sort((a, b) => {
    const d = new Date(a.created_at || 0) - new Date(b.created_at || 0);
    return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
  });
  let leaf = 0; const yGap = P.yGap;
  const place = (node, depth) => {
    node.depth = depth;
    if (!node.children.length) { node.yy = leaf * yGap; leaf++; }
    else {
      sortKids(node.children);
      node.children.forEach((c) => place(c, depth + 1));
      node.yy = node.children[0].yy * 0.78 + node.children[node.children.length - 1].yy * 0.22;
    }
  };
  roots.forEach((r) => place(r, 0));
  const pad = P.pad;
  const out = nodes.map((n) => {
    const o = byId[n.id];
    return { ...n, depth: o.depth, x: o.depth * P.xGap + pad, y: o.yy + pad, children: o.children.map((c) => c.id) };
  });
  const posById = {};
  out.forEach((n) => (posById[n.id] = n));
  let maxX = 0, maxY = 0;
  out.forEach((n) => { maxX = Math.max(maxX, n.x + cardW); maxY = Math.max(maxY, n.y + yGap); });
  return { nodes: out, posById, cardW, cardH, yGap, boundsW: maxX + pad, boundsH: maxY + pad };
}

function ancestorsOf(posById, id) {
  const r = []; let n = posById[id]; let g = 0;
  while (n && n.parent_id && posById[n.parent_id] && g++ < 200) { r.push(n.parent_id); n = posById[n.parent_id]; }
  return r; // [parent, grandparent, ... root]
}
function descendantsOf(posById, id) {
  const out = [];
  const walk = (i) => { (posById[i]?.children || []).forEach((c) => { out.push(c); walk(c); }); };
  walk(id);
  return out;
}

// ----------------------------------------------------------------------------
// mode glyphs
// ----------------------------------------------------------------------------
function Glyph({ mode, size = 14 }) {
  if (mode === "explore")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" stroke="none" /></svg>);
  if (mode === "deep")
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="8" opacity="0.45" /><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" /></svg>);
}

function RefreshIcon() {
  return (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>);
}

// ============================================================================
// main
// ============================================================================
export default function LineageView({
  myIdeas, targetIdeaId, t, onBack, onViewIdea, onStartComparison,
  onUpdateIdea, onDelete, onAdvance, onReEvaluate, loadingIdeaId,
  compareSelected, onAddToCompare, onMakeStandalone, onViewExploredVersion,
}) {
  const [nodes, setNodes] = useState(() => deriveNodesFromMyIdeas(myIdeas, targetIdeaId));
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [renaming, setRenaming] = useState(null); // { id, draft }
  const [detail, setDetail] = useState({}); // id -> { loading, verdict, reflection }

  const vpRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const worldRef = useRef(null);
  const view = useRef({ k: 0.7, panX: 0, panY: 0 });
  const drag = useRef({ on: false, moved: false, x: 0, y: 0 });
  const toastTimer = useRef(null);
  const fetched = useRef(new Set());
  const zoomLabelRef = useRef(null);
  const asideRef = useRef(null);

  // fonts (idempotent)
  useEffect(() => {
    const id = "ilc-lineage-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=JetBrains+Mono:wght@500;600&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  // optimistic paint → reconcile with authoritative server family
  useEffect(() => {
    setNodes(deriveNodesFromMyIdeas(myIdeas, targetIdeaId));
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !targetIdeaId) return;
        const res = await fetch(`/api/ideas/${targetIdeaId}/lineage`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && Array.isArray(data.nodes)) setNodes(data.nodes);
      } catch { /* keep optimistic paint */ }
    })();
    return () => { cancelled = true; };
    // `myIdeas` is intentionally NOT a dependency. After mount, this view owns its
    // node state and applies every local mutation (lead / rename / favorite / status
    // / delete) optimistically. Re-running on each parent `myIdeas` refresh caused a
    // flash: an update's optimistic hub-list write (e.g. SET LEAD flagging the new
    // node main before the old one is cleared) would briefly re-derive a dirty family
    // — two LEAD badges — until the server reconcile landed. Reconcile only when the
    // TARGET family changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIdeaId]);

  const L = useMemo(() => layout(nodes), [nodes]);
  const posById = L.posById;

  // ---- highlight sets (three tiers) ----
  const hl = useMemo(() => {
    if (!selected || !posById[selected]) return null;
    const anc = ancestorsOf(posById, selected);
    const spine = new Set([selected, ...anc]);
    const down = new Set(descendantsOf(posById, selected));
    return { spine, down };
  }, [selected, posById]);

  const nodeTier = (id) => {
    if (!hl) return "normal";
    if (id === selected) return "self";
    if (hl.spine.has(id)) return "spine";
    if (hl.down.has(id)) return "down";
    return "dim";
  };

  // ---- transform / fit / zoom / pan ----
  const applyTransform = useCallback(() => {
    const v = view.current;
    if (worldRef.current) worldRef.current.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.k})`;
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(v.k * 100)}%`;
  }, []);

  const fit = useCallback(() => {
    const vp = vpRef.current;
    if (!vp || !L.boundsW) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    if (vw < 40 || vh < 40) return;
    const k = Math.max(0.16, Math.min(1, Math.min((vw - 80) / L.boundsW, (vh - 80) / L.boundsH)));
    view.current = { k, panX: (vw - L.boundsW * k) / 2, panY: Math.max(24, (vh - L.boundsH * k) / 2) };
    applyTransform();
  }, [L.boundsW, L.boundsH, applyTransform]);

  useLayoutEffect(() => { fit(); /* eslint-disable-next-line */ }, [targetIdeaId]);
  useLayoutEffect(() => { applyTransform(); }, [nodes, applyTransform]);

  // refit until the canvas reports a real size on first paint
  useEffect(() => {
    let fitted = false, tries = 0;
    const attempt = () => {
      if (fitted) return;
      const el = vpRef.current;
      if (el && el.clientWidth > 40 && el.clientHeight > 40) { fit(); fitted = true; }
      else if (tries++ < 30) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
    const t1 = setTimeout(attempt, 140), t2 = setTimeout(attempt, 420);
    let ro;
    if (window.ResizeObserver && vpRef.current) {
      ro = new ResizeObserver(() => { if (!fitted && vpRef.current.clientWidth > 40) { fit(); fitted = true; } });
      ro.observe(vpRef.current);
    }
    return () => { clearTimeout(t1); clearTimeout(t2); if (ro) ro.disconnect(); };
  }, [fit]);

  // full view — refit the graph when the canvas grows into / shrinks out of
  // fullscreen (the one-shot ResizeObserver above has already stopped by now),
  // and let Esc leave full view.
  useEffect(() => {
    const r = requestAnimationFrame(() => fit());
    const t = setTimeout(fit, 260);
    return () => { cancelAnimationFrame(r); clearTimeout(t); };
  }, [expanded, fit]);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      if (asideRef.current && asideRef.current.contains(e.target)) return; // let the inspector scroll
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const v = view.current, ok = v.k;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= vp.clientHeight;
      dy = Math.max(-50, Math.min(50, dy));
      const k = Math.max(0.16, Math.min(2.4, ok * Math.exp(-dy * 0.0038)));
      view.current = { k, panX: mx - (mx - v.panX) * (k / ok), panY: my - (my - v.panY) * (k / ok) };
      applyTransform();
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current.on) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      view.current.panX += dx; view.current.panY += dy;
      drag.current.x = e.clientX; drag.current.y = e.clientY;
      applyTransform();
    };
    const onUp = () => { drag.current.on = false; if (vpRef.current) vpRef.current.style.cursor = "grab"; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [applyTransform]);

  const startPan = (e) => {
    drag.current = { on: true, moved: false, x: e.clientX, y: e.clientY };
    if (vpRef.current) vpRef.current.style.cursor = "grabbing";
  };
  const onCanvasClick = () => { if (!drag.current.moved && selected) setSelected(null); };

  const zoomBtn = (factor) => {
    const vp = vpRef.current; if (!vp) return;
    const mx = vp.clientWidth / 2, my = vp.clientHeight / 2;
    const v = view.current, ok = v.k;
    const k = Math.max(0.16, Math.min(2.4, v.k * factor));
    view.current = { k, panX: mx - (mx - v.panX) * (k / ok), panY: my - (my - v.panY) * (k / ok) };
    applyTransform();
  };

  const flash = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1900); };

  // family "best" = top-scoring deep (auto). favorite = explore's user-chosen best.
  const bestId = useMemo(() => {
    let id = null, hi = -Infinity;
    nodes.forEach((n) => { if (n.mode === "deep" && n.score != null && Number(n.score) > hi) { hi = Number(n.score); id = n.id; } });
    return id;
  }, [nodes]);

  const toggleFavorite = (id) => {
    const n = posById[id]; if (!n || n.mode !== "explore") return;
    const next = !n.is_favorite;
    setNodes((ns) => ns.map((x) => (x.id === id ? { ...x, is_favorite: next } : x)));
    if (onUpdateIdea) onUpdateIdea(id, { is_favorite: next });
  };
  const setDisposition = (id, val) => {
    const v = val === "parked" || val === "killed" ? val : null;
    setNodes((ns) => ns.map((x) => (x.id === id ? { ...x, disposition: v } : x)));
    if (onUpdateIdea) onUpdateIdea(id, { disposition: v });
  };
  const setLead = (id) => {
    setNodes((ns) => ns.map((x) => ({ ...x, is_main: x.id === id })));
    if (onUpdateIdea) onUpdateIdea(id, { is_main: true });
    flash("Set as lead version");
  };

  // ---- compare → the global, cross-space tray (Deep-only) ----
  // Routes a Deep node into the page-level basket so it can be paired with a node
  // from another lineage tree or the evaluated room. Non-Deep nodes have no
  // evaluation to compare; the tray itself lives below, rendered by page.js.
  const addToCompare = (id) => {
    const node = posById[id];
    if (!node) return;
    if (node.mode !== "deep") { flash("Compare works on Deep analyses — run a Deep pass first."); return; }
    const already = (compareSelected || []).some((s) => s.ideaId === id);
    if (!already && (compareSelected || []).length >= 2) { flash("Compare is full — remove one in the tray first."); return; }
    const title = node.title || (myIdeas.find((i) => i.id === id) || {}).title || "Idea";
    onAddToCompare && onAddToCompare(id, null, { title, origin: "lineage", mode: "deep" });
    flash(already ? "Removed from compare" : "Added to compare");
  };

  // ---- rename / delete ----
  const commitRename = () => {
    if (!renaming) return;
    const v = renaming.draft.trim();
    const node = posById[renaming.id];
    if (v && node && v !== node.title) {
      setNodes((ns) => ns.map((n) => (n.id === renaming.id ? { ...n, title: v } : n)));
      onUpdateIdea(renaming.id, { title: v });
    }
    setRenaming(null);
  };
  const startRename = (id) => { const n = posById[id]; if (n) { setSelected(id); setRenaming({ id, draft: n.title }); } };
  const deleteNode = (id) => {
    if (!onDelete) return;
    const node = posById[id];
    const kids = descendantsOf(posById, id); // everything below this node
    const title = node ? short(node.title, 44) : "this idea";
    const msg = kids.length === 0
      ? `Delete “${title}”? This can't be undone.`
      : `Delete “${title}” and the ${kids.length} branch${kids.length === 1 ? "" : "es"} below it? This can't be undone.`;
    if (!window.confirm(msg)) return;
    const victims = new Set([id, ...kids]);
    setNodes((ns) => ns.filter((n) => !victims.has(n.id)));
    if (selected && victims.has(selected)) setSelected(null);
    onDelete(id);
  };

  // Make a node (and its branch) a standalone idea: it leaves this lineage and
  // becomes its own root card in the hub. Mirrors deleteNode's confirm + optimistic
  // subtree removal — the moved nodes vanish from THIS family's canvas; the server
  // (detachIdea) re-roots them, and the hub refresh surfaces the new card.
  const makeStandalone = (id) => {
    if (!onMakeStandalone) return;
    const node = posById[id];
    if (!node || node.is_root) return; // a root is already standalone
    const kids = descendantsOf(posById, id);
    const title = node ? short(node.title, 44) : "this idea";
    const msg = kids.length === 0
      ? `Make “${title}” a standalone idea? It will leave this lineage and appear in your hub as its own card.`
      : `Make “${title}” and the ${kids.length} branch${kids.length === 1 ? "" : "es"} below it a standalone idea? They'll leave this lineage as a new card.`;
    if (!window.confirm(msg)) return;
    const movers = new Set([id, ...kids]);
    setNodes((ns) => ns.filter((n) => !movers.has(n.id)));
    if (selected && movers.has(selected)) setSelected(null);
    onMakeStandalone(id);
  };

  // ---- lazy detail (verdict / reflection) for the inspector ----
  useEffect(() => {
    if (!selected) return;
    const s = posById[selected];
    if (!s || s.mode === "rough") return;
    if (fetched.current.has(selected)) return;
    fetched.current.add(selected);
    let cancel = false;
    setDetail((d) => ({ ...d, [selected]: { loading: true } }));
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { if (!cancel) setDetail((d) => ({ ...d, [selected]: { loading: false } })); return; }
        const res = await fetch(`/api/ideas/${selected}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) { if (!cancel) setDetail((d) => ({ ...d, [selected]: { loading: false } })); return; }
        const data = await res.json();
        const ev = data?.analysis?.evaluation || {};
        const verdict = ev.verdict_headline || ev.verdict_lead || ev.summary || null;
        const reflection = data?.explore?.read?.reflection || null;
        // A deep node that graduated from an explore keeps its explored read in
        // read_history (kind 'explore'). Flag it so the inspector can offer "View
        // the explored version" without opening the deep idea first.
        let hasExploreHistory = false;
        if (s.mode === "deep") {
          try {
            const hres = await fetch(`/api/ideas/${selected}/history`, { headers: { Authorization: `Bearer ${session.access_token}` } });
            if (hres.ok) {
              const hdata = await hres.json();
              hasExploreHistory = Array.isArray(hdata.reads) && hdata.reads.some((r) => r.kind === "explore");
            }
          } catch { /* leave false */ }
        }
        if (!cancel) setDetail((d) => ({ ...d, [selected]: { loading: false, verdict, reflection, hasExploreHistory } }));
      } catch { if (!cancel) setDetail((d) => ({ ...d, [selected]: { loading: false } })); }
    })();
    return () => { cancel = true; };
  }, [selected, posById]);

  const cmpSet = new Set((compareSelected || []).map((s) => s.ideaId));

  // ---- edges ----
  const edges = useMemo(() => {
    const P = DENS;
    return L.nodes.filter((n) => n.parent_id && posById[n.parent_id]).map((n) => {
      const p = posById[n.parent_id], m = MODE[n.mode];
      const x1 = p.x + L.cardW, y1 = p.y + P.yGap / 2, x2 = n.x, y2 = n.y + P.yGap / 2;
      const mx = (x1 + x2) / 2;
      const d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      let tier = "normal";
      if (hl) {
        if (hl.spine.has(n.id) && hl.spine.has(n.parent_id)) tier = "spine";
        else if (hl.down.has(n.id)) tier = "down";
        else tier = "dim";
      }
      let stroke = "rgba(125,145,185,0.34)", width = 1.4, opacity = 1, glow = false, flow = false;
      if (tier === "spine") { stroke = m.a; width = 2.4; opacity = 0.96; glow = true; flow = true; }
      else if (tier === "down") { stroke = m.a; width = 1.7; opacity = 0.62; }
      else if (tier === "dim") { stroke = "rgba(120,138,170,0.3)"; width = 1.2; opacity = 0.14; }
      return { key: n.parent_id + "-" + n.id, d, stroke, width, opacity, glow, flow, flowColor: m.a };
    });
  }, [L.nodes, posById, L.cardW, hl]);

  // edge chips: deep→deep score delta + "what changed" (changed_dimensions)
  const chips = useMemo(() => {
    const P = DENS;
    return L.nodes.filter((n) => n.parent_id && posById[n.parent_id]).map((n) => {
      const p = posById[n.parent_id];
      const x1 = p.x + L.cardW, y1 = p.y + P.yGap / 2, x2 = n.x, y2 = n.y + P.yGap / 2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      let delta = null, dir = null;
      if (n.mode === "deep" && p.mode === "deep" && n.score != null && p.score != null) {
        const dd = Math.round((Number(n.score) - Number(p.score)) * 10) / 10;
        dir = dd > 0.15 ? "up" : dd < -0.15 ? "down" : "flat"; delta = dd;
      }
      const changed = fmtChanged(n.changed_dimensions);
      if (delta === null && !changed) return null;
      let faded = false;
      if (hl) faded = !(hl.spine.has(n.id) && hl.spine.has(n.parent_id)) && !hl.down.has(n.id);
      return { key: n.id, mx, my, delta, dir, changed, faded };
    }).filter(Boolean);
  }, [L.nodes, posById, L.cardW, hl]);

  const sNode = selected && posById[selected] ? posById[selected] : null;
  const sMode = sNode ? MODE[sNode.mode] : null;
  const sParent = sNode && sNode.parent_id ? posById[sNode.parent_id] : null;
  const sDetail = selected ? detail[selected] : null;

  // empty state
  return (
    <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "0 20px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#dce3f0" }}>
      <style>{`
        @keyframes ilcLvDash{to{stroke-dashoffset:-120}}
        @keyframes ilcLvFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes ilcSpin{to{transform:rotate(360deg)}}
        @keyframes ilcShimmer{0%{opacity:0.5}50%{opacity:0.9}100%{opacity:0.5}}
        @keyframes ilcGlow{0%,100%{box-shadow:0 0 18px -4px var(--gc)}50%{box-shadow:0 0 42px 2px var(--gc)}}
      `}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, paddingTop: 4, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <h1 style={{ margin: 0, fontFamily: "'Newsreader', Georgia, serif", fontWeight: 500, fontSize: 30, letterSpacing: "-0.2px", color: "#f1f5fc" }}>Lineage</h1>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "1px", color: "#6b7689", padding: "4px 9px", border: "1px solid rgba(125,145,185,0.16)", borderRadius: 7 }}>
              {nodes.length ? `${nodes.length} idea${nodes.length !== 1 ? "s" : ""}` : "…"}
            </span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7e8aa0" }}>
            How one idea branched — re-evaluations, saved directions, and deep dives.{" "}
            <span style={{ color: "#5a647a" }}>Drag to pan · scroll to zoom · click a node to inspect.</span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: "0 0 auto", flexWrap: "wrap" }}>
          <button onClick={onBack} style={btnGhost}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to Idea Hub
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      {/* tools: mode filter + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", padding: 3, gap: 2, borderRadius: 11, background: "rgba(8,11,20,0.7)", border: "1px solid rgba(125,145,185,0.12)" }}>
          {[["all", "All", null], ["explore", "Explore", MODE.explore.a], ["deep", "Deep", MODE.deep.a], ["rough", "Rough", MODE.rough.a]].map(([key, label, dot]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", border: "none", borderRadius: 8, background: filter === key ? "linear-gradient(180deg, rgba(120,140,190,0.18), rgba(120,140,190,0.06))" : "transparent", color: filter === key ? "#eaf0fb" : "#8893a8", fontFamily: "inherit", fontSize: 12, cursor: "pointer", boxShadow: filter === key ? "0 0 0 1px rgba(120,140,190,0.25)" : "none", transition: "all .15s" }}>
              {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}{label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 10, background: "rgba(8,11,20,0.7)", border: "1px solid rgba(125,145,185,0.12)", minWidth: 210 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8893a8" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jump to an idea…"
            style={{ background: "transparent", border: "none", outline: "none", color: "#dce3f0", fontFamily: "inherit", fontSize: 12.5, width: "100%" }} />
          {query && <button onClick={() => setQuery("")} style={{ border: "none", background: "transparent", color: "#566076", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>}
        </div>
      </div>

      {/* canvas box */}
      <div
        ref={vpRef}
        onMouseDown={startPan}
        onClick={onCanvasClick}
        style={{
          overflow: "hidden", cursor: "grab", userSelect: "none", backgroundColor: "#080b14",
          ...(expanded
            ? { position: "fixed", inset: 0, height: "100vh", width: "100vw", borderRadius: 0, border: "none", zIndex: 200 }
            : { position: "relative", height: "clamp(520px, calc(100vh - 240px), 1600px)", border: "1px solid rgba(125,145,185,0.12)", borderRadius: 16 }),
        }}
      >
        {/* fixed bloom (does not pan) — blue X2 left, violet D2 right */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          background: "radial-gradient(58% 80% at 10% -6%, rgba(96,150,255,0.10), transparent 60%), radial-gradient(58% 90% at 92% 6%, rgba(150,135,250,0.12), transparent 60%)" }} />

        {!nodes.length && (
          <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: 13, color: "#8893a8" }}>Loading lineage…</span>
          </div>
        )}

        <div ref={worldRef} style={{ position: "absolute", left: 0, top: 0, width: L.boundsW, height: L.boundsH, transformOrigin: "0 0", zIndex: 1 }}>
          {/* edges */}
          <svg width={L.boundsW} height={L.boundsH} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
            {edges.map((e) => (
              <path key={e.key} d={e.d} fill="none" stroke={e.stroke} strokeWidth={e.width} strokeLinecap="round"
                style={{ opacity: e.opacity, transition: "all .25s", filter: e.glow ? `drop-shadow(0 0 5px ${e.flowColor})` : "none" }} />
            ))}
            {edges.filter((e) => e.flow).map((e) => (
              <path key={e.key + "-flow"} d={e.d} fill="none" stroke={e.flowColor} strokeWidth="1.4" strokeLinecap="round"
                style={{ strokeDasharray: "1.4 12", animation: "ilcLvDash 2.6s linear infinite", opacity: 0.95 }} />
            ))}
          </svg>

          {/* edge chips: score delta + what changed */}
          {chips.map((c) => {
            const col = c.dir === "up" ? "#8fe0b4" : c.dir === "down" ? "#e7a3a3" : "#c9b78a";
            const bd = c.dir === "up" ? "rgba(127,208,168,0.35)" : c.dir === "down" ? "rgba(231,163,163,0.3)" : "rgba(201,170,120,0.3)";
            const arrow = c.dir === "up" ? "↗" : c.dir === "down" ? "↘" : "→";
            return (
              <div key={c.key + "-chip"} style={{ position: "absolute", left: c.mx, top: c.my, transform: "translate(-50%,-50%)", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, pointerEvents: "none", opacity: c.faded ? 0.18 : 1, transition: "opacity .25s" }}>
                {c.delta !== null && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 7, background: "rgba(10,14,24,0.9)", border: `1px solid ${bd}`, color: col, backdropFilter: "blur(6px)", whiteSpace: "nowrap" }}>{c.delta > 0 ? "+" : ""}{c.delta.toFixed(1)} {arrow}</span>
                )}
                {c.changed && (
                  <span style={{ fontSize: 9.5, color: "#8893a8", background: "rgba(10,14,24,0.85)", padding: "2px 7px", borderRadius: 6, border: "1px solid rgba(125,145,185,0.12)", whiteSpace: "nowrap" }}>{c.changed}</span>
                )}
              </div>
            );
          })}

          {/* nodes */}
          {L.nodes.map((n) => {
            const m = MODE[n.mode];
            const tier = nodeTier(n.id);
            const sel = selected === n.id, hovv = hover === n.id, dim = tier === "dim", down = tier === "down";
            const op = tier === "dim" ? 0.28 : tier === "down" ? 0.72 : 1;
            const inCmp = cmpSet.has(n.id);
            const loading = n.id === loadingIdeaId;
            const cardW = DENS.bW;
            const top = n.y + (DENS.yGap - L.cardH) / 2;
            const glowBg = n.mode === "explore"
              ? "radial-gradient(118% 88% at 15% -12%, rgba(96,150,255,0.16), transparent 58%), "
              : n.mode === "deep"
              ? "radial-gradient(86% 98% at 84% 64%, rgba(150,135,250,0.18), transparent 56%), "
              : "";

            const isBest = n.id === bestId;
            const isFav = n.mode === "explore" && !!n.is_favorite;
            const killed = n.disposition === "killed";
            const parked = n.disposition === "parked";
            const faded = (filter !== "all" && n.mode !== filter) || (!!query.trim() && !String(n.title || "").toLowerCase().includes(query.trim().toLowerCase()));
            const glowOn = (isBest || isFav) && !dim && !faded;
            const statusMul = killed ? 0.5 : parked ? 0.82 : 1;
            const cardOp = (faded ? 0.16 : op) * statusMul;
            const statusFilter = killed ? "grayscale(0.6)" : "none";
            const markerOp = faded ? 0.16 : dim ? 0.32 : 1;
            const wrap = { position: "absolute", left: n.x, top, width: cardW, minHeight: L.cardH, zIndex: sel ? 40 : hovv ? 30 : 10, animation: "ilcLvFade .45s ease both" };
            const handlers = {
              onMouseDown: (e) => e.stopPropagation(),
              onClick: (e) => { e.stopPropagation(); if (loading) return; setSelected((s) => (s === n.id ? null : n.id)); },
              onMouseEnter: () => setHover(n.id),
              onMouseLeave: () => setHover((h) => (h === n.id ? null : h)),
            };

            const toolbar = (hovv || sel) && !loading ? (
              <div style={{ position: "absolute", top: -34, right: 0, display: "flex", gap: 4, padding: 4, borderRadius: 9, background: "rgba(14,20,34,0.96)", border: "1px solid rgba(125,145,185,0.2)", boxShadow: "0 10px 26px -10px rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", zIndex: 50 }}>
                <ToolBtn title="Rename" onClick={(e) => { e.stopPropagation(); startRename(n.id); }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </ToolBtn>
                {n.mode === "deep" && (
                  <ToolBtn title={inCmp ? "In compare" : "Add to compare"} active={inCmp} activeColor={m.a} activeBg={m.s} onClick={(e) => { e.stopPropagation(); addToCompare(n.id); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /></svg>
                  </ToolBtn>
                )}
                {onDelete && (
                  <ToolBtn title="Remove" danger onClick={(e) => { e.stopPropagation(); deleteNode(n.id); }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </ToolBtn>
                )}
              </div>
            ) : null;

            const spinner = loading ? (
              <div style={{ position: "absolute", inset: 0, borderRadius: 15, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,11,20,0.55)" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "ilcSpin 0.6s linear infinite" }} />
              </div>
            ) : null;

            return (
              <div key={n.id} style={wrap} {...handlers}>
                {toolbar}
                {glowOn && <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: cardW, height: DENS.bH, borderRadius: 15, zIndex: 0, pointerEvents: "none", animation: "ilcGlow 2.8s ease-in-out infinite", ["--gc"]: m.g }} />}
                <div style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", width: "100%", height: DENS.bH, boxSizing: "border-box", padding: "13px 14px", borderRadius: 15, background: (sel ? glowBg + `linear-gradient(180deg, ${m.s}, rgba(13,18,32,0.95))` : glowBg + "linear-gradient(180deg, rgba(255,255,255,0.038), rgba(13,18,32,0.84))"), border: `1px solid ${sel ? m.a : dim ? "rgba(120,138,170,0.1)" : inCmp ? m.b : "rgba(125,145,185,0.15)"}`, opacity: cardOp, filter: statusFilter, boxShadow: sel ? `0 0 0 1px ${m.a}, 0 18px 46px -14px ${m.g}, inset 0 1px 0 rgba(255,255,255,0.05)` : "0 12px 28px -18px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)", backdropFilter: "blur(7px)", transform: hovv && !sel ? "translateY(-2px)" : "none", transition: "opacity .25s, box-shadow .25s, border-color .25s, transform .2s", cursor: "pointer" }}>
                  {/* motif */}
                  {n.mode === "explore" && (
                    <svg viewBox="0 0 124 54" fill="none" style={{ position: "absolute", top: 12, right: 12, width: 124, height: 54, opacity: dim ? 0.16 : 0.5, pointerEvents: "none", color: m.a, zIndex: 1 }}>
                      <polyline points="6,34 30,15 54,33 78,11 100,27 118,40" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
                      {[[6,34],[30,15],[54,33],[78,11],[100,27],[118,40]].map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r="1.7" fill="currentColor" />)}
                    </svg>
                  )}
                  {n.mode === "deep" && (
                    <svg viewBox="0 0 100 100" fill="none" style={{ position: "absolute", top: "50%", right: -10, transform: "translateY(-44%)", width: 100, height: 100, opacity: dim ? 0.16 : 0.55, pointerEvents: "none", color: m.a, zIndex: 1 }}>
                      <circle cx="62" cy="50" r="13" stroke="currentColor" strokeWidth="1" opacity="0.7" />
                      <circle cx="62" cy="50" r="24" stroke="currentColor" strokeWidth="1" opacity="0.42" />
                      <circle cx="62" cy="50" r="35" stroke="currentColor" strokeWidth="1" opacity="0.22" />
                      <circle cx="62" cy="50" r="2.6" fill="currentColor" />
                    </svg>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: m.a, background: m.s, border: `1px solid ${m.b}` }}><Glyph mode={n.mode} size={14} /></span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "1.8px", fontWeight: 600, color: m.a, textTransform: "uppercase", marginLeft: 9 }}>{m.label}</span>
                    </div>
                  </div>
                  <div style={{ position: "relative", zIndex: 2, marginTop: "auto", fontSize: 13, lineHeight: 1.34, color: dim ? "#7e8aa0" : "#e6ecf7", fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textShadow: "0 1px 6px rgba(8,11,20,0.6)" }}>{n.title}</div>
                </div>
                {!faded && (
                  <button onClick={(e) => { e.stopPropagation(); if (!n.is_main) setLead(n.id); }} title={n.is_main ? "Lead version" : "Set as lead"}
                    style={{ position: "absolute", top: -9, left: 12, zIndex: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: "1px", fontWeight: 600, padding: "3px 7px", borderRadius: 6, cursor: "pointer", transition: "opacity .15s", opacity: n.is_main ? markerOp : hovv ? markerOp : 0, ...(n.is_main ? { background: "rgba(217,210,196,0.16)", border: "1px solid rgba(217,210,196,0.34)", color: "#e6dfce" } : { background: "rgba(10,14,24,0.92)", border: "1px solid rgba(125,145,185,0.18)", color: "#8893a8" }) }}>
                    {n.is_main ? "LEAD" : "SET LEAD"}
                  </button>
                )}
                {isBest && !faded && (
                  <span style={{ position: "absolute", top: -9, right: 12, zIndex: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: "1px", fontWeight: 600, padding: "3px 7px", borderRadius: 6, background: m.s, border: `1px solid ${m.b}`, color: m.a, opacity: markerOp }}>BEST {n.score != null ? Number(n.score).toFixed(1) : ""}</span>
                )}
                {n.mode === "explore" && !faded && (
                  <button onClick={(e) => { e.stopPropagation(); toggleFavorite(n.id); }} title={n.is_favorite ? "Favorited" : "Mark as favorite"}
                    style={{ position: "absolute", top: 11, right: 12, zIndex: 8, background: "transparent", border: "none", padding: 0, lineHeight: 0, cursor: "pointer", opacity: markerOp, color: n.is_favorite ? "#f2c14e" : "#5a647a", filter: n.is_favorite ? "drop-shadow(0 0 6px rgba(242,193,78,0.65))" : "none", transition: ".15s" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={n.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2.6l2.95 5.97 6.6.96-4.78 4.66 1.13 6.56L12 17.55 6.1 20.75l1.13-6.56L2.45 9.53l6.6-.96L12 2.6z" /></svg>
                  </button>
                )}
                {(killed || parked) && !faded && (
                  <span style={{ position: "absolute", bottom: -9, right: 12, zIndex: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: "1px", fontWeight: 600, padding: "3px 7px", borderRadius: 6, opacity: markerOp, ...(killed ? { background: "rgba(231,140,140,0.1)", border: "1px solid rgba(231,140,140,0.3)", color: "#e3a0a0" } : { background: "rgba(201,170,120,0.12)", border: "1px solid rgba(201,170,120,0.3)", color: "#d9c39a" }) }}>{killed ? "KILLED" : "PARKED"}</span>
                )}
                {spinner}
              </div>
            );
          })}
        </div>

        {/* zoom controls */}
        <div style={{ position: "absolute", left: 24, bottom: 24, display: "flex", alignItems: "center", gap: 6, padding: 5, borderRadius: 11, background: "rgba(10,14,24,0.82)", border: "1px solid rgba(125,145,185,0.14)", backdropFilter: "blur(10px)", boxShadow: "0 10px 30px -12px rgba(0,0,0,0.8)", zIndex: 30 }}>
          <CtrlBtn onClick={(e) => { e.stopPropagation(); zoomBtn(1 / 1.2); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg></CtrlBtn>
          <span ref={zoomLabelRef} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8893a8", minWidth: 42, textAlign: "center" }}>{Math.round(view.current.k * 100)}%</span>
          <CtrlBtn onClick={(e) => { e.stopPropagation(); zoomBtn(1.2); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></CtrlBtn>
          <div style={{ width: 1, height: 18, background: "rgba(125,145,185,0.16)", margin: "0 2px" }} />
          <CtrlBtn title="Fit to view" onClick={(e) => { e.stopPropagation(); fit(); }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg></CtrlBtn>
        </div>

        {/* full view toggle — bottom-right, mirrors the zoom cluster */}
        <div style={{ position: "absolute", right: 24, bottom: 24, zIndex: 30, padding: 5, borderRadius: 11, background: "rgba(10,14,24,0.82)", border: "1px solid rgba(125,145,185,0.14)", backdropFilter: "blur(10px)", boxShadow: "0 10px 30px -12px rgba(0,0,0,0.8)" }}>
          <CtrlBtn title={expanded ? "Exit full view  (Esc)" : "Full view"} onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
            {expanded
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>}
          </CtrlBtn>
        </div>

        {toast && (
          <div style={{ position: "absolute", left: "50%", bottom: 26, transform: "translateX(-50%)", padding: "9px 16px", borderRadius: 10, background: "rgba(14,20,34,0.95)", border: "1px solid rgba(125,145,185,0.2)", color: "#dce3f0", fontSize: 12.5, boxShadow: "0 12px 34px -10px rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", zIndex: 60 }}>{toast}</div>
        )}

        {/* inspector */}
        {sNode && (
          <aside style={{ position: "absolute", top: 0, right: 0, height: "100%", width: 332, display: "flex", flexDirection: "column", borderLeft: "1px solid rgba(125,145,185,0.12)", background: "linear-gradient(180deg, rgba(12,17,30,0.92), rgba(8,11,20,0.96))", backdropFilter: "blur(12px)", animation: "ilcLvFade .28s ease", overflowY: "auto", overscrollBehavior: "contain", cursor: "default", zIndex: 50 }} ref={asideRef} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(125,145,185,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1.6px", fontWeight: 600, color: sMode.a, background: sMode.s, border: `1px solid ${sMode.b}`, padding: "5px 10px", borderRadius: 7, textTransform: "uppercase" }}>{sMode.full}</span>
                <button onClick={() => setSelected(null)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 7, background: "transparent", color: "#8893a8", cursor: "pointer" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              {renaming && renaming.id === selected ? (
                <input autoFocus value={renaming.draft} onChange={(e) => setRenaming({ id: selected, draft: e.target.value })}
                  onBlur={commitRename} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                  style={{ width: "100%", marginTop: 14, fontFamily: "'Newsreader', Georgia, serif", fontSize: 19, color: "#f1f5fc", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(111,161,234,0.4)", borderRadius: 8, padding: "6px 8px", outline: "none" }} />
              ) : (
                <h2 style={{ margin: "14px 0 0", fontFamily: "'Newsreader', Georgia, serif", fontWeight: 500, fontSize: 20, lineHeight: 1.3, color: "#f1f5fc" }}>{sNode.title}</h2>
              )}
              <p style={{ margin: "9px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "#8893a8" }}>
                {!sParent ? "Root idea — where this lineage began."
                  : sNode.branch_reason ? sNode.branch_reason
                  : sNode.mode === "explore" ? `A re-evaluation branched from “${short(sParent.title)}”`
                  : sNode.mode === "deep" ? `Deep analysis of “${short(sParent.title)}”`
                  : `A rough direction surfaced while exploring “${short(sParent.title)}”`}
              </p>
              {sNode.is_main && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1px", fontWeight: 600, color: "#e6dfce", background: "rgba(217,210,196,0.12)", border: "1px solid rgba(217,210,196,0.3)", padding: "3px 9px", borderRadius: 7 }}>LEAD VERSION</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {[["active", "Active"], ["parked", "Parked"], ["killed", "Killed"]].map(([val, label]) => {
                  const cur = (sNode.disposition || "active") === val;
                  const c = val === "killed" ? "#e3a0a0" : val === "parked" ? "#d9c39a" : "#cdd5e4";
                  const bg = val === "killed" ? "rgba(231,140,140,0.1)" : val === "parked" ? "rgba(201,170,120,0.1)" : "rgba(125,145,185,0.1)";
                  const bd = val === "killed" ? "rgba(231,140,140,0.32)" : val === "parked" ? "rgba(201,170,120,0.34)" : "rgba(125,145,185,0.3)";
                  return (
                    <button key={val} onClick={() => setDisposition(selected, val === "active" ? null : val)}
                      style={{ flex: 1, padding: 6, borderRadius: 8, border: `1px solid ${cur ? bd : "rgba(125,145,185,0.12)"}`, background: cur ? bg : "rgba(255,255,255,0.02)", color: cur ? c : "#8893a8", fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: ".12s" }}>{label}</button>
                  );
                })}
              </div>
            </div>

            {/* generation + branches */}
            <div style={{ padding: "18px 22px", display: "flex", gap: 10, borderBottom: "1px solid rgba(125,145,185,0.08)" }}>
              <Stat label="GENERATION" value={`G${sNode.depth + 1}`} />
              <Stat label="BRANCHES" value={sNode.children.length === 0 ? "—" : String(sNode.children.length)} />
            </div>

            {/* eval block */}
            {sNode.mode === "deep" && (
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(125,145,185,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1.4px", color: "#566076" }}>ASSESSMENT</span>
                  {sNode.score != null && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: TAUPE, background: "rgba(177,168,156,0.12)", border: "1px solid rgba(177,168,156,0.22)", padding: "3px 9px", borderRadius: 7 }}>{Number(sNode.score).toFixed(1)}<span style={{ color: "#6b7689", fontWeight: 500 }}> /10</span></span>
                  )}
                </div>
                {sParent && sParent.mode === "deep" && sNode.score != null && sParent.score != null && (() => {
                  const dd = Math.round((Number(sNode.score) - Number(sParent.score)) * 10) / 10;
                  const dir = dd > 0.15 ? "up" : dd < -0.15 ? "down" : "flat";
                  const col = dir === "up" ? "#8fe0b4" : dir === "down" ? "#e7a3a3" : "#c9b78a";
                  const bg = dir === "up" ? "rgba(127,208,168,0.12)" : dir === "down" ? "rgba(231,163,163,0.12)" : "rgba(201,170,120,0.12)";
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 7, color: col, background: bg, border: `1px solid ${col}44` }}>{dd > 0 ? "+" : ""}{dd.toFixed(1)} vs parent {dir === "up" ? "↗" : dir === "down" ? "↘" : "→"}</span>
                    </div>
                  );
                })()}
                <MetricBar label="Market demand" v={sNode.md} color={sMode.a} />
                <MetricBar label="Monetization" v={sNode.mo} color={sMode.a} />
                <MetricBar label="Originality" v={sNode.or} color={sMode.a} />
                {sNode.tc != null && <TcLadder tc={sNode.tc} color={sMode.a} />}
                <Verdict d={sDetail} mode="deep" />
                {sParent && sParent.mode === "deep" && sNode.score != null && sParent.score != null && (Number(sNode.score) - Number(sParent.score)) <= 0.15 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, padding: "10px 12px", borderRadius: 9, background: "rgba(201,170,120,0.08)", border: "1px solid rgba(201,170,120,0.2)", color: "#d9c39a", fontSize: 11.5, lineHeight: 1.45 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
                    <span>This re-evaluation didn't raise the score. Instead of another Deep pass, try <b style={{ color: "#e6dfce" }}>Exploring</b> a different angle.</span>
                  </div>
                )}
              </div>
            )}
            {sNode.mode === "explore" && (
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(125,145,185,0.08)" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1.4px", color: "#566076", marginBottom: 12 }}>REFLECTION</div>
                <Verdict d={sDetail} mode="explore" />
              </div>
            )}

            {/* lineage path */}
            {(() => {
              const path = ancestorsOf(posById, selected).map((id) => posById[id]).reverse();
              if (!path.length) return null;
              return (
                <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(125,145,185,0.08)" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1.4px", color: "#566076", marginBottom: 12 }}>LINEAGE</div>
                  {path.map((o) => (
                    <PathRow key={o.id} title={o.title} dot={MODE[o.mode].a} />
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto", background: sMode.a, boxShadow: `0 0 8px ${sMode.a}` }} />
                    <span style={{ fontSize: 12.5, color: "#eef2fb", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{short(sNode.title, 34)}</span>
                  </div>
                </div>
              );
            })()}

            {/* branched into */}
            {sNode.children.length > 0 && (
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(125,145,185,0.08)" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "1.4px", color: "#566076", marginBottom: 12 }}>BRANCHED INTO</div>
                {sNode.children.map((id) => {
                  const k = posById[id]; if (!k) return null;
                  return (
                    <div key={id} onClick={() => setSelected(id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6, borderRadius: 9, background: "rgba(255,255,255,0.022)", border: "1px solid rgba(125,145,185,0.09)", cursor: "pointer" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", background: MODE[k.mode].a, boxShadow: `0 0 7px ${MODE[k.mode].a}` }} />
                      <span style={{ fontSize: 12, color: "#bcc6d8", lineHeight: 1.35 }}>{k.title}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* actions */}
            <div style={{ padding: "18px 22px", marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => onViewIdea(selected)} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${sMode.b}`, background: `linear-gradient(180deg, ${sMode.s}, rgba(255,255,255,0.02))`, color: "#eaf0fb", fontSize: 13, fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }}>Open this idea</button>
              <div style={{ display: "flex", gap: 8 }}>
                {sNode.mode === "deep" && (
                  <button onClick={() => addToCompare(selected)} style={btnPanelGhost}>{cmpSet.has(selected) ? "In compare" : "Add to compare"}</button>
                )}
                <button onClick={() => startRename(selected)} style={btnPanelGhost}>Edit</button>
              </div>
              {sNode.mode === "deep" && detail[selected] && detail[selected].hasExploreHistory && (
                <button onClick={() => onViewExploredVersion && onViewExploredVersion(selected)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 8px", borderRadius: 9, border: `1px solid ${MODE.explore.b}`, background: MODE.explore.s, color: MODE.explore.a, fontSize: 12.5, fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }}>
                  <span style={{ display: "flex", color: MODE.explore.a }}><Glyph mode="explore" size={13} /></span>
                  View the explored version →
                </button>
              )}
              {(() => {
                const acts = sNode.mode === "explore"
                  ? [{ action: "deep", label: "Take to Deep", ac: MODE.deep, g: "deep" }]
                  : sNode.mode === "deep"
                  ? [{ action: "reevaluate", label: "Re-evaluate", ac: MODE.deep, g: "refresh" }]
                  : [{ action: "explore", label: "Take to Explore", ac: MODE.explore, g: "explore" }, { action: "deep", label: "Take to Deep", ac: MODE.deep, g: "deep" }];
                return (
                  <>
                    <div style={{ height: 1, background: "rgba(125,145,185,0.1)", margin: "5px 0 3px" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      {acts.map((a) => (
                        <button key={a.action} onClick={() => { if (a.action === "reevaluate" && onReEvaluate) { onReEvaluate(selected); return; } if (onAdvance) onAdvance(selected, a.action); else flash(a.label + " \u2014 not wired yet"); }}
                          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 8px", borderRadius: 9, border: `1px solid ${a.ac.b}`, background: `linear-gradient(180deg, ${a.ac.s}, rgba(255,255,255,0.012))`, color: "#eef2fb", fontSize: 12.5, fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }}>
                          <span style={{ color: a.ac.a, display: "flex" }}>{a.g === "refresh" ? <RefreshIcon /> : <Glyph mode={a.g} size={13} />}</span>
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
              {!sNode.is_root && (
                <button onClick={() => makeStandalone(selected)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 13px", borderRadius: 9, cursor: "pointer", border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)", color: "#fbbf24", fontFamily: "inherit", marginTop: 2 }}>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>⌗ Make standalone idea</span>
                    <span style={{ fontSize: 10.5, color: "#566076", fontWeight: 400, marginTop: 2 }}>Moves it out of this lineage into Evaluated</span>
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 15 }}>→</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// small components
// ----------------------------------------------------------------------------
function Stat({ label, value }) {
  return (
    <div style={{ flex: 1, padding: "11px 12px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(125,145,185,0.1)" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "1px", color: "#566076" }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 15, fontWeight: 600, color: "#dce3f0" }}>{value}</div>
    </div>
  );
}

function MetricBar({ label, v, color }) {
  const has = v !== null && v !== undefined;
  const pct = has ? Math.max(0, Math.min(100, (Number(v) / 10) * 100)) : 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#9aa6bd" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: has ? "#cfd7e6" : "#566076" }}>{has ? Number(v).toFixed(1) : "—"}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: color, opacity: 0.85, transition: "width .3s" }} />
      </div>
    </div>
  );
}

function TcLadder({ tc, color }) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(tc) / 2)));
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#9aa6bd" }}>Build difficulty</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#cfd7e6" }}>{Number(tc).toFixed(1)}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < filled ? color : "rgba(255,255,255,0.07)", opacity: i < filled ? 0.85 : 1 }} />
        ))}
      </div>
    </div>
  );
}

function Verdict({ d, mode }) {
  if (!d || d.loading) {
    return (
      <div style={{ marginTop: mode === "explore" ? 0 : 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 11, width: "92%", borderRadius: 4, background: "rgba(255,255,255,0.07)", animation: "ilcShimmer 1.3s ease-in-out infinite" }} />
        <div style={{ height: 11, width: "70%", borderRadius: 4, background: "rgba(255,255,255,0.07)", animation: "ilcShimmer 1.3s ease-in-out infinite", animationDelay: "0.15s" }} />
      </div>
    );
  }
  const text = mode === "explore" ? d.reflection : d.verdict;
  if (!text) return null;
  return (
    <p style={{ margin: mode === "explore" ? 0 : "12px 0 0", fontFamily: "'Newsreader', Georgia, serif", fontSize: 13.5, lineHeight: 1.5, color: "#cdd5e4", display: "-webkit-box", WebkitLineClamp: mode === "explore" ? 4 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text}</p>
  );
}

function PathRow({ title, dot }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 auto", background: dot }} />
      <span style={{ fontSize: 12.5, color: "#9aa6bd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
    </div>
  );
}

function ToolBtn({ children, onClick, title, danger, active, activeColor, activeBg }) {
  const [h, setH] = useState(false);
  const bg = active ? activeBg : h ? (danger ? "rgba(232,120,120,0.16)" : "rgba(125,145,185,0.18)") : "transparent";
  const col = active ? activeColor : h ? (danger ? "#f0a0a0" : "#eaf0fb") : "#9aa6bd";
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 25, height: 25, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 6, background: bg, color: col, cursor: "pointer", transition: "all .15s" }}>
      {children}
    </button>
  );
}

function CtrlBtn({ children, onClick, title }) {
  const [h, setH] = useState(false);
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 8, background: h ? "rgba(125,145,185,0.16)" : "transparent", color: h ? "#eaf0fb" : "#aab4c8", cursor: "pointer", transition: "all .15s" }}>
      {children}
    </button>
  );
}

const btnGhost = {
  display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
  border: "1px solid rgba(125,145,185,0.18)", background: "rgba(255,255,255,0.02)",
  color: "#aab4c8", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", flexShrink: 0,
};
const btnPanelGhost = {
  flex: 1, padding: 9, borderRadius: 9, border: "1px solid rgba(125,145,185,0.16)",
  background: "rgba(255,255,255,0.022)", color: "#aab4c8", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
};