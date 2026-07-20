// DeepAnalysis.js — the Deep evaluation surface: five movements, one page.
//
// Replaces the old two-screen Deep body: ProvenanceStrip / PressureRead /
// DeepMetricCard x3 / DeepTcCard (results1) and CompetitorGrid /
// ExecutionReality (results2). KeyRisks has no home yet — `model.risks` is
// normalized and deliberately unplaced.
//
// This component RENDERS. It does not decide states — deepPayload.js does, and
// every state it resolves carries an `authority`. If a field is absent, the
// figure that depends on it does not render. Nothing is drawn empty "for
// symmetry"; nothing is inferred to make a figure work.
//
// The hinge is the one conditional debt — it renders its DEGRADE state, never
// the target state, until a committed mapping is in the payload. The platform
// keystone (field_shape) is NOT a debt: it is a parked, condition-triggered
// candidate (reclassified July 19, 2026 — see deepPayload.js). The page is
// complete without it; `platformRenderable` stays false until a V10-line
// decision commits the field.
//
// WALKTHROUGH: `wt` / `onWt` are threaded through every movement. Two markers
// are mounted (verdict -> I headline, overall -> I composite). The other five
// anchors have named mount points marked WT-MOUNT below — each is a one-line
// change once their homes are decided. See WT_ANCHORS in deepPayload.js.

import React, { useEffect, useMemo, useRef, useState } from "react";
import normalizeDeep from "./deepPayload";
import { resolveEvidenceSources, scrubMachinery, stripTags } from "./SourcesStrip";
import { ChangeMarker } from "./ChangeWalkthrough";

/* ============================================================== scroll spy ==
   One observer, two consumers (II's navrail, IV's beat index). Clicking
   scrolls; observation highlights. No panel is ever hidden. */
function useScrollSpy(ids, rootMargin = "-45% 0px -50% 0px") {
  const key = ids.join("|");
  const [active, setActive] = useState(ids[0] || null);
  useEffect(() => {
    if (!ids.length || typeof IntersectionObserver === "undefined") return;
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (vis.length) setActive(vis[0].target.id);
      },
      { rootMargin, threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key, rootMargin]);
  return active;
}

const scrollToId = (id) => {
  const el = typeof document !== "undefined" && document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* ================================================================== labels ==
   Enum -> plain phrase. Transcribed from the scorer prompts; unmapped values
   fall back to humanised snake_case rather than rendering a raw enum. */
const FRICTION_LABELS = {
  workflow_switching: "Workflow switching",
  trust_displacement: "Trust displacement",
  regulatory_acceptance: "Regulatory acceptance",
  procurement_cycle: "Procurement cycle",
  liquidity_bootstrap: "Liquidity bootstrap",
  retention_or_habit: "Retention and habit",
  build_or_free_substitute: "Build-it or free substitute",
  integration_or_data_access: "Integration and data access",
  none_or_minimal: "No specific friction named",
};

const PAYMENT_LABELS = {
  free_substitute_pressure: "Free substitute pressure",
  regulated_payment_friction: "Regulated payment friction",
  incumbent_capture_pressure: "Incumbent capture pressure",
  price_defensibility_gap: "Price defensibility gap",
  payment_authority_split: "Payer and user are different people",
  conversion_economics_unproven: "Conversion economics unproven",
  low_frequency_payment_mismatch: "Low-frequency payment mismatch",
  marketplace_cold_start: "Marketplace cold start",
  none_or_minimal: "No specific constraint named",
};

const EXPOSURE_LABELS = {
  fast_follower_replication: "Replicable by competitors",
  job_substitution_pressure: "Substitutable by an existing tool or workaround",
  none_or_minimal: "No structural exposure named",
};

const LABEL_SETS = {
  market_demand: FRICTION_LABELS,
  monetization: PAYMENT_LABELS,
  originality: EXPOSURE_LABELS,
};

const humanise = (s) =>
  typeof s === "string" && s.length
    ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : null;

const labelFor = (metricKey, subtype) =>
  (subtype && (LABEL_SETS[metricKey] || {})[subtype]) || humanise(subtype) || "—";

/* ---- entity marks (approved: entity-links-mockup.html, July 19) ----------
   Competitor/substitute names inside committed prose render in the HOST's
   accent — a location echo, never a claim about the competitor. Receipt
   honesty rides on brightness and behaviour: a name whose Stage 1 object
   carries a url renders full-strength, underlines on hover, and opens the
   source; a name without one (LLM-identified) renders dimmed with no link —
   a link would promise a receipt that does not exist. The matcher is
   deterministic and committed-only: names from the Stage 1 array, longest
   first, boundary-guarded manually (no lookbehind — names carry slashes and
   dots, and older Safari must not lose the whole page over a regex). */
const ENTITY_CACHE = new WeakMap();
function entityMatcher(competitors) {
  if (!Array.isArray(competitors) || !competitors.length) return null;
  const hit = ENTITY_CACHE.get(competitors);
  if (hit !== undefined) return hit;
  const entries = [];
  const seen = new Set();
  for (const c of competitors) {
    const name = c && typeof c.name === "string" ? c.name.trim() : "";
    if (name.length < 3) continue; // 1-2 char names would mark noise
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ name, url: typeof c.url === "string" && c.url ? c.url : null });
  }
  let m = null;
  if (entries.length) {
    entries.sort((a, b) => b.name.length - a.name.length); // longest wins
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    m = {
      re: new RegExp(entries.map((e) => esc(e.name)).join("|"), "gi"),
      byKey: new Map(entries.map((e) => [e.name.toLowerCase(), e])),
    };
  }
  ENTITY_CACHE.set(competitors, m);
  return m;
}

const ALNUM = /[A-Za-z0-9]/;
function Linked({ text, competitors }) {
  const m = entityMatcher(competitors);
  if (!m || typeof text !== "string" || !text) return text ?? null;
  const parts = [];
  let last = 0, k = 0, match;
  m.re.lastIndex = 0;
  while ((match = m.re.exec(text)) !== null) {
    const s0 = match.index, e0 = s0 + match[0].length;
    // manual word boundaries: a name may not sit inside a larger word,
    // and a dot gluing two alphanumeric runs is NOT a boundary — otherwise
    // "ideaone" would mark inside "ideaone.com". Interior dots in a name
    // ("RFP360.ai") and sentence-ending dots are unaffected.
    if (s0 > 0 && ALNUM.test(text[s0 - 1])) continue;
    if (e0 < text.length && ALNUM.test(text[e0])) continue;
    if (s0 > 1 && text[s0 - 1] === "." && ALNUM.test(text[s0 - 2])) continue;
    if (e0 + 1 < text.length && text[e0] === "." && ALNUM.test(text[e0 + 1])) continue;
    const ent = m.byKey.get(match[0].toLowerCase());
    if (!ent) continue;
    if (s0 > last) parts.push(text.slice(last, s0));
    parts.push(
      ent.url ? (
        <a key={k++} className="cm" href={ent.url} target="_blank" rel="noopener noreferrer">
          {match[0]}
        </a>
      ) : (
        <span key={k++} className="cm cm-dim">{match[0]}</span>
      )
    );
    last = e0;
  }
  if (!parts.length) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const MC = { market_demand: "var(--md)", monetization: "var(--mo)", originality: "var(--or)" };
const SHORT = { market_demand: "md", monetization: "mo", originality: "or" };
const NAME = { market_demand: "Market demand", monetization: "Monetization", originality: "Originality" };
// Short forms used only by the hinge touch strip, per the design.
const SHORT_LABEL = { market_demand: "demand", monetization: "payment", originality: "position" };
const WEIGHT = { market_demand: 37.5, monetization: 31.25, originality: 31.25 };
const num = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : "—");

/* ================================================================= styles == */
const CSS = `
.ilc-deep{font-size:15.5px;line-height:1.7;-webkit-font-smoothing:antialiased;
  --bg:#0a0d13;--surface:#10141d;--surf2:#171c28;
  --border:rgba(255,255,255,.08);--border-str:rgba(255,255,255,.14);
  --text:#eceff5;--sec:#9aa3b4;--mut:#6b7280;--faint:#4a5160;
  --divider:rgba(255,255,255,.06);
  --md:#46c79a;--mo:#5b8def;--or:#8a82c2;--build:#7fb0c4;--amber:#d9a86c;--risk:#d9736c;
  --serif:'Newsreader',Georgia,serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15.5px;line-height:1.7}
/* The mockup's base reset, scoped. Without margin/padding zeroing, app-global
   button and typography rules leak in, inflate the legend rows, and the join
   curves (fixed geometry, tuned against the mockup's compact rows) end in a
   void instead of at the ring. */
.ilc-deep *{box-sizing:border-box;margin:0;padding:0}
.ilc-deep button{font:inherit;line-height:inherit;color:inherit}
.ilc-deep a{color:#9db4e8;text-decoration:none}
.ilc-deep .nx{max-width:1300px;margin:0;padding:22px 40px 110px}  /* margin:0, not auto — the design's .nx sits in a grid column starting right after the 260px rail, so it reads as left-hugging. This app's main area is far wider, and auto margins pushed the whole read toward the centre. */


.ilc-deep .sx{display:flex;align-items:center;gap:14px;margin:56px 0 22px;scroll-margin-top:90px}
.ilc-deep .sx .num{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--bg);background:var(--sec);width:30px;height:30px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
.ilc-deep .sx h2{font-family:var(--serif);font-weight:500;font-size:25px;letter-spacing:-.01em;margin:0}
.ilc-deep .sx .line{flex:1;height:1px;background:var(--divider)}
.ilc-deep .sx .tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;color:var(--faint)}

/* ── Edge navigator (edge-navigator-mockup.html, approved July 20) ──────────
   Right-edge movement rail. Chrome, not content: colour carries STATE only —
   never a score, never a metric identity. Inactive rests at --faint like the
   .sx .tag family; hover lifts to --sec; active is --text plus a longer tick.
   Type floor 10px (size before colour). No progress %, no checkmarks —
   position, nothing else (anti-scold).
   Below 1100px (the page's own breakpoint) the LABELS fold and the ticks
   remain — the rail is never display:none at any width. */
.ilc-deep .enav{position:fixed;right:0;top:50%;transform:translateY(-50%);
  display:flex;flex-direction:column;gap:18px;align-items:flex-end;
  padding:10px 0;z-index:40}
.ilc-deep .enav a{display:flex;align-items:center;gap:10px;text-decoration:none;
  font-family:var(--mono);font-size:10px;letter-spacing:.16em;
  color:var(--faint);transition:color .15s ease}
.ilc-deep .enav a .lbl{transform:translateY(1px)}
.ilc-deep .enav a .tick{width:18px;height:1px;background:currentColor;
  transition:width .18s ease;flex-shrink:0}
.ilc-deep .enav a:hover{color:var(--sec)}
.ilc-deep .enav a[aria-current="true"]{color:var(--text)}
.ilc-deep .enav a[aria-current="true"] .tick{width:34px}
.ilc-deep .enav a:focus-visible{outline:1px solid var(--border-str);outline-offset:3px;color:var(--sec)}
@media(max-width:1100px){
  .ilc-deep .enav{gap:14px}
  .ilc-deep .enav a .lbl{display:none}
  .ilc-deep .enav a .tick{width:14px}
  .ilc-deep .enav a[aria-current="true"] .tick{width:26px}
}
@media(max-width:560px){
  .ilc-deep .enav{gap:12px}
}

/* I */
.ilc-deep .nx-head{max-width:1000px;margin-top:8px}
.ilc-deep .nx-eyebrow{display:flex;gap:9px;flex-wrap:wrap;align-items:center;font-family:var(--mono);font-size:10px;letter-spacing:.09em;color:var(--mut);margin-bottom:20px}
.ilc-deep .nx-eyebrow .pill{border:1px solid var(--border);border-radius:5px;padding:2px 9px;color:var(--sec)}
.ilc-deep .nx-title{font-family:var(--serif);font-weight:500;font-size:52px;line-height:1.08;letter-spacing:-.015em;margin-bottom:22px;max-width:16ch}
.ilc-deep .nx-title .wtm{margin-left:12px;vertical-align:middle}
.ilc-deep .nx-lead{font-size:17px;line-height:1.75;color:#c3c9d4;max-width:60ch;margin:0}
.ilc-deep .thin{margin-top:12px;font-size:12px;color:var(--amber);border-left:2px solid rgba(217,168,108,.5);padding-left:12px}

/* II */
.ilc-deep .navitem.on{border-left-color:var(--mc)}
.ilc-deep .navitem.on .fillline{opacity:1}
.ilc-deep .anchor-flag{margin-top:14px;font-size:12.5px;line-height:1.6;color:var(--amber);border-left:2px solid rgba(217,168,108,.5);padding-left:12px;max-width:62ch}
.ilc-deep .mnote{margin-top:12px;font-size:12.5px;line-height:1.6;color:var(--mut);max-width:62ch}

/* III */
.ilc-deep .fdegrade{margin-top:22px;font-size:14px;line-height:1.7;color:var(--sec);max-width:82ch;border-left:2px solid var(--divider);padding-left:16px}
/* ── What could break this — the risk ledger (risks-ledger-final.html,
   approved July 19). Rows, not cards — the hinge keeps the dossier-card
   grammar to itself. Rust (--risk) is reserved for this field ALONE and
   rides only the row markers; no colored borders, nothing reads as an
   alert, no hover (the rows are printed, not interactive). ── */
.ilc-deep .rk-head{display:flex;align-items:baseline;gap:14px;margin:48px 0 0}
.ilc-deep .rk-title{font-family:var(--serif);font-weight:500;font-size:22px;letter-spacing:-.005em}
.ilc-deep .rk-tag{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;color:var(--faint)}
.ilc-deep .rledger{margin-top:18px;border-bottom:2px solid rgba(255,255,255,.14)}
.ilc-deep .rrow{display:grid;grid-template-columns:172px minmax(0,1fr);gap:26px;padding:20px 0 22px;border-top:1px solid var(--divider)}
.ilc-deep .rrow:first-child{border-top:2px solid rgba(255,255,255,.14)}
.ilc-deep .rrail .no{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;color:var(--risk);font-weight:600}
.ilc-deep .rrail .slot{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--sec);margin-top:5px}
.ilc-deep .rprose{max-width:74ch}
.ilc-deep .rprose .lead{font-size:15px;line-height:1.72;color:var(--text)}
.ilc-deep .rprose .cont{font-size:14px;line-height:1.72;color:var(--mut);margin-top:6px}
.ilc-deep .rfoot{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--faint);margin-top:12px}

/* IV */
.ilc-deep .spec{border-left:2px solid var(--amber);padding-left:16px;font-size:14.5px;line-height:1.7;color:var(--sec);max-width:62ch;margin-top:22px}

/* V */
.ilc-deep .hsub{font-size:14px;line-height:1.7;color:var(--mut);max-width:64ch;margin:0}
.ilc-deep .hgap{display:grid;grid-template-columns:170px minmax(0,1fr);gap:22px;padding:16px 0;border-top:1px solid var(--divider);align-items:start}
.ilc-deep .hgap .gk{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--mc)}
.ilc-deep .hgap .gv{font-size:14px;line-height:1.7;color:var(--sec)}

@media(max-width:1100px){
  .ilc-deep .lands,.ilc-deep .brsteps,.ilc-deep .readout,.ilc-deep .br-head,.ilc-deep .rrow{grid-template-columns:1fr}
  .ilc-deep .rrow{gap:8px}
  .ilc-deep .rrail{display:flex;align-items:baseline;gap:12px}
  .ilc-deep .rrail .slot{margin-top:0}
  .ilc-deep .navrail,.ilc-deep .bs-nav{position:static;padding-right:0;margin-bottom:22px}
  .ilc-deep .bs-pane{padding-left:0}
  .ilc-deep .br-fact+.br-fact{border-left:none;padding-left:0;border-top:1px solid var(--divider)}
  .ilc-deep .clear,.ilc-deep .hgap{grid-template-columns:1fr;gap:6px}
  .ilc-deep .hzgrid{grid-template-columns:1fr !important}
  .ilc-deep .hzaudit .row{grid-template-columns:1fr;gap:4px}
  .ilc-deep .cc2{grid-template-columns:1fr}
  .ilc-deep .cc+.cc{border-left:none;border-top:1px solid var(--divider)}
  .ilc-deep .nx{padding-left:20px;padding-right:20px}
  .ilc-deep .nx-title{font-size:34px}
}

/* ---- Ⅰ THE READ — ported verbatim from Deep_v5 design ---- */
.ilc-deep .nx-full-btn{margin-top:20px;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;color:#9db4e8;background:transparent;border:1px solid var(--border);border-radius:20px;cursor:pointer;padding:7px 16px;display:inline-flex;align-items:center;gap:8px;transition:border-color .2s}
.ilc-deep .nx-full-btn:hover{border-color:var(--border-str)}
.ilc-deep .nx-full-btn .ar{transition:transform .25s}
.ilc-deep .nx-full-btn.open .ar{transform:rotate(180deg)}
.ilc-deep .nx-full{max-height:0;overflow:hidden;transition:max-height .4s ease}
.ilc-deep .nx-full.open{max-height:600px}
.ilc-deep .nx-full .inner{margin-top:18px;font-size:15px;line-height:1.82;color:var(--sec);max-width:70ch;padding:18px 22px;border:1px solid var(--divider);border-radius:14px;background:var(--surface)}
.ilc-deep .readout{display:grid;grid-template-columns:minmax(0,1.5fr) 74px minmax(0,1fr);margin-top:38px;border-top:1px solid var(--border-str);border-bottom:1px solid var(--divider)}
/* The join svg is ABSOLUTE so it can never contribute to the row's height.
   When it participated in layout, its measured-height viewBox fed back into
   the row height it was measuring — each observer pass grew the row, which
   grew the svg, which grew the row: the giant void above GROUNDING. */
.ilc-deep .ro-join{align-self:stretch;padding:0;position:relative}
.ilc-deep .ro-join svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ilc-deep .ro-comp{border-left:none !important}
.ilc-deep .ro-col{padding:22px 30px}
.ilc-deep .ro-col:first-child{padding-left:0}
.ilc-deep .ro-col+.ro-col{border-left:1px solid var(--divider)}
.ilc-deep .ro-k{font-family:var(--mono);font-size:9px;letter-spacing:.22em;color:var(--faint);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.ilc-deep .ro-k .rep{margin-left:auto}
.ilc-deep .comp-row{margin-top:35px}
.ilc-deep .comp-shift{display:flex;gap:20px;align-items:center}
.ilc-deep .comp-ring{flex-shrink:0}
.ilc-deep .ro-big{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
.ilc-deep .ro-big .v{font-family:var(--mono);font-size:44px;font-weight:500;line-height:.8;letter-spacing:-.03em;color:var(--text)}
.ilc-deep .ro-big .u{font-family:var(--mono);font-size:13px;color:var(--faint)}
.ilc-deep .comp-lab{font-size:14.5px;font-weight:600;color:var(--text);margin-bottom:6px}
.ilc-deep .ro-note{font-size:11.5px;line-height:1.5;color:var(--mut);max-width:26ch}
.ilc-deep .ro-hist{margin-top:18px;padding-top:14px;border-top:1px solid var(--divider)}
.ilc-deep .ro-hist .hk{font-family:var(--mono);font-size:9px;letter-spacing:.22em;color:var(--faint);margin-bottom:10px}
.ilc-deep .ro-hist .hv{font-family:var(--mono);font-size:13px;color:var(--sec);display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.ilc-deep .ro-hist .hv .ar{color:var(--faint)}
.ilc-deep .ro-hist .hv .cur{color:var(--md);font-size:10.5px;letter-spacing:.08em}
.ilc-deep .ro-hist .hn{font-family:var(--mono);font-size:9.5px;color:var(--mut);margin-top:8px}
.ilc-deep .stackbar{display:flex;height:10px;overflow:hidden;margin-bottom:16px;gap:2px;background:transparent}
.ilc-deep .stackbar .seg{position:relative;cursor:pointer;transition:opacity .15s;border-radius:2px;display:block;margin-bottom:0}
.ilc-deep .stackbar .seg:hover{opacity:.82}
.ilc-deep .rlegend{display:flex;flex-direction:column;gap:0}
.ilc-deep .rleg{background:none;border:none;font:inherit;color:inherit;text-align:left;width:100%;display:grid;grid-template-columns:9px 1fr 54px 30px;gap:12px;align-items:center;padding:9px 0;border-top:1px solid var(--divider);cursor:pointer;transition:transform .16s}
.ilc-deep .rleg:first-child{border-top:none}
.ilc-deep .rleg:hover{transform:translateX(3px)}
.ilc-deep .rleg .d{width:8px;height:8px;border-radius:2px}
.ilc-deep .rleg .nm{font-size:13px;color:var(--sec)}
.ilc-deep .rleg:hover .nm{color:var(--text)}
.ilc-deep .rleg .wt{font-family:var(--mono);font-size:10px;color:var(--mut);text-align:right}
.ilc-deep .rleg .sc{font-family:var(--mono);font-size:15px;font-weight:600;text-align:right}
.ilc-deep .ro-ground{display:flex;flex-direction:column}
.ilc-deep .grd-head{display:flex;align-items:center;gap:13px;margin-bottom:13px}
.ilc-deep .grd-ico{flex-shrink:0}
.ilc-deep .grd-lab{font-family:var(--serif);font-size:19px;font-weight:500;letter-spacing:-.01em;color:var(--text);line-height:1.05}
.ilc-deep .grd-sub{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--md);margin-top:4px}
.ilc-deep .grd-body{font-size:15px;line-height:1.75;color:var(--text)}
@keyframes ringspin{to{transform:rotate(360deg)}}
.ilc-deep .ring-anim{transform-origin:48px 48px;animation:ringspin 14s linear infinite}
@media(prefers-reduced-motion:reduce){.ilc-deep .ring-anim{animation:none}.ilc-deep .tav{animation:none}.ilc-deep .thalo{animation:none;opacity:0}}

/* ---- Ⅱ WHY IT LANDS HERE — ported verbatim from Deep_v5 design ---- */
.ilc-deep .lands{display:grid;grid-template-columns:312px minmax(0,1fr);gap:52px;align-items:start}
.ilc-deep .navrail{position:sticky;top:88px;display:flex;flex-direction:column}
.ilc-deep .nrk{font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:var(--faint);margin-bottom:6px}
.ilc-deep .navitem{position:relative;display:block;width:100%;text-align:left;background:none;border:none;border-top:1px solid var(--divider);cursor:pointer;padding:20px 6px 20px 20px}
.ilc-deep .navitem:last-child{border-bottom:1px solid var(--divider)}
.ilc-deep .navitem::before{content:"";position:absolute;left:0;top:-1px;bottom:-1px;width:2px;background:var(--mc);opacity:0;transition:opacity .22s}
.ilc-deep .navitem.on::before{opacity:1}
.ilc-deep .navitem:hover .ni-nm{color:var(--text)}
.ilc-deep .ni-top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:15px}
.ilc-deep .ni-nm{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--sec);transition:color .2s}
.ilc-deep .navitem.on .ni-nm{color:var(--text)}
.ilc-deep .ni-sc{font-family:var(--mono);font-size:21px;font-weight:600;color:var(--mc);opacity:.55;transition:opacity .2s}
.ilc-deep .navitem.on .ni-sc{opacity:1}
.ilc-deep .ruler{position:relative;height:16px;margin-bottom:10px}
.ilc-deep .ruler .base{position:absolute;left:0;right:0;top:7px;height:1px;background:rgba(255,255,255,.13)}
.ilc-deep .ruler .fillline{position:absolute;top:7px;left:0;height:1px;background:var(--mc);opacity:.55}
.ilc-deep .navitem.on .ruler .fillline{opacity:1}
.ilc-deep .ruler .tick{position:absolute;top:4px;width:1px;height:7px;background:rgba(255,255,255,.15);transform:translateX(-50%)}
.ilc-deep .ruler .cap{position:absolute;top:1px;height:14px;border-left:1px dashed rgba(217,168,108,.55)}
.ilc-deep .ruler .hatch{position:absolute;top:4.5px;height:6px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.06),rgba(255,255,255,.06) 3px,transparent 3px,transparent 6px);border-radius:2px}
.ilc-deep .ruler .nxt{position:absolute;top:7px;width:9px;height:9px;border-radius:50%;border:1px dashed var(--amber);background:var(--bg);transform:translate(-50%,-50%)}
.ilc-deep .ruler .mk{position:absolute;top:7px;width:9px;height:9px;border-radius:50%;background:var(--mc);transform:translate(-50%,-50%);box-shadow:0 0 0 3px var(--bg),0 0 10px var(--mc)}
.ilc-deep .ni-meta{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--faint)}
.ilc-deep .ni-meta .a{color:var(--amber)}
.ilc-deep .ni-state{font-size:12px;line-height:1.5;color:var(--mut);margin-top:11px}
.ilc-deep .navitem.on .ni-state{color:var(--sec)}
.ilc-deep .readpane{min-width:0;max-width:70ch}
.ilc-deep .rp{scroll-margin-top:100px;--ec:var(--mc)}
.ilc-deep .cm{color:var(--ec,var(--build));font-weight:600;text-decoration:none}
.ilc-deep a.cm:hover{text-decoration:underline dotted;text-underline-offset:3px}
.ilc-deep .cm-dim{opacity:.62}
.ilc-deep #mv-3{--ec:var(--build)}
.ilc-deep #mv-5{--ec:var(--build)}
.ilc-deep .rledger .rrow{--ec:var(--risk)}
.ilc-deep .rp+.rp{margin-top:56px;border-top:1px solid var(--border-str);padding-top:26px}
.ilc-deep .rp-eye{display:flex;align-items:center;gap:12px;padding-bottom:18px;margin-bottom:30px;border-bottom:1px solid var(--divider)}
.ilc-deep .rp-eye .dot{width:7px;height:7px;border-radius:50%;background:var(--mc);flex-shrink:0}
.ilc-deep .rp-eye .nm{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.ilc-deep .rp-eye .rr{font-family:var(--mono);font-size:10px;letter-spacing:.02em;color:var(--mut);margin-left:auto;text-align:right}
.ilc-deep .rp .blk{margin-bottom:30px}
.ilc-deep .rp .gapc{margin:30px 0}
.ilc-deep .rp .rests{margin-top:30px}
.ilc-deep .blk{margin-bottom:24px}
.ilc-deep .blk:last-child{margin-bottom:0}
.ilc-deep .q{font-size:13px;font-weight:600;margin-bottom:8px;display:flex;gap:9px;align-items:baseline}
.ilc-deep .q .k{font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--mc);flex-shrink:0;border:1px solid;border-color:color-mix(in oklab,var(--mc) 40%,transparent);border-radius:4px;padding:2px 6px}
.ilc-deep .body{font-size:15px;line-height:1.75;max-width:62ch}
.ilc-deep .qual{color:var(--sec)}
.ilc-deep .entity{color:#5fd4b0;border-bottom:1px solid rgba(95,212,176,.35)}
.ilc-deep .pd2{margin-top:12px;font-family:var(--mono);font-size:10px;color:var(--mo);border:1px solid rgba(91,141,239,.3);border-radius:6px;padding:5px 11px;display:inline-block}
.ilc-deep .tb{margin-top:14px;border:1px solid var(--border);border-radius:12px;overflow:hidden;max-width:62ch}
.ilc-deep .tb .tbh{font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--faint);padding:8px 15px;border-bottom:1px solid var(--divider)}
.ilc-deep .tb .wbind{padding:14px 15px 13px}
.ilc-deep .tb .wbind .n{font-size:13.5px;font-weight:600;color:var(--text)}
.ilc-deep .tb .wbind .s{font-family:var(--mono);font-size:9px;letter-spacing:.1em;font-weight:600;margin:3px 0 8px}
.ilc-deep .tb .wbind p{font-size:12.5px;line-height:1.65;color:var(--sec);margin:0}
.ilc-deep .tb .wbind .wdeg{color:var(--mut);font-style:italic}
.ilc-deep .tb .wsubs{padding:10px 15px;border-top:1px solid var(--divider);font-family:var(--mono);font-size:9.5px;letter-spacing:.06em}
.ilc-deep .tb .wsubs .k{color:var(--faint);letter-spacing:.12em}
.ilc-deep .tb .wsubs .m{color:var(--sec)}
.ilc-deep .gapc{border:1px solid rgba(217,168,108,.35);border-radius:12px;background:linear-gradient(180deg,rgba(217,168,108,.07),transparent);padding:15px 16px;margin-bottom:20px}
.ilc-deep .gapc .k{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--amber);font-weight:600;margin-bottom:9px}
.ilc-deep .gapc .k .rq{font-weight:400;color:rgba(217,168,108,.7)}
.ilc-deep .gapc p{font-size:13.5px;line-height:1.62}
.ilc-deep .gapc p b{font-weight:600}
.ilc-deep .gapc .pos{margin-top:8px;font-size:12.5px;color:var(--sec)}
.ilc-deep .gapc .adm{margin-top:11px;padding-top:9px;border-top:1px dashed rgba(217,168,108,.28);font-size:12px;color:var(--sec)}
.ilc-deep .gapc .adm b{font-family:var(--mono);color:var(--amber)}
.ilc-deep .rests .rh{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--faint);margin-bottom:10px}
.ilc-deep .rests .rests-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer;user-select:none}
.ilc-deep .rests .rchip{font-family:var(--mono);font-size:8.5px;letter-spacing:.04em;padding:2px 8px;border-radius:999px}
.ilc-deep .rests .rcaret{font-family:var(--mono);font-size:9px;letter-spacing:.06em;color:var(--faint);margin-left:auto}
.ilc-deep .rests .rests-line:hover .rcaret{color:var(--sec)}
.ilc-deep .rests .rests-body{margin-top:12px;padding:2px 0 14px 16px;border-left:2px solid var(--divider);border-bottom:1px solid var(--divider)}
.ilc-deep .rests .rests-body .r:first-child{border-top:none}
.ilc-deep .rests .tags{display:flex;flex-direction:column;gap:4px;flex-shrink:0}
.ilc-deep .rests .r{display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--divider);font-size:12.5px;color:var(--sec);line-height:1.5}
.ilc-deep .rests .t{flex-shrink:0;font-family:var(--mono);font-size:8.5px;padding:2px 7px;border-radius:4px;height:fit-content;margin-top:1px}
.ilc-deep .rests b{color:var(--text)}

/* ---- Ⅲ THE FIELD — ported verbatim from Deep_v5 design ---- */
.ilc-deep .field-h3{font-family:var(--serif);font-weight:500;font-size:24px;letter-spacing:-.01em;margin-bottom:20px}
.ilc-deep .freads3{display:grid;grid-template-columns:repeat(3,1fr);gap:36px;margin-bottom:26px;max-width:1000px}
.ilc-deep .freads3 .k{font-family:var(--mono);font-size:12px;letter-spacing:.14em;margin-bottom:11px;font-weight:600}
.ilc-deep .freads3 p{font-size:15px;line-height:1.66;color:#c3c9d4}
.ilc-deep .freads3 p b{color:var(--text)}
.ilc-deep .terrain{position:relative;border:1px solid var(--border);border-radius:16px;background:var(--surface);padding:12px 16px 6px;max-width:1000px}
.ilc-deep .terrain svg{width:100%;height:auto;display:block}
.ilc-deep .tnode{cursor:pointer}
.ilc-deep .tnode circle{transition:stroke .15s}
.ilc-deep .tnode:hover circle{stroke:rgba(255,255,255,.45);stroke-width:1.5}
.ilc-deep .tnode.sel circle{stroke:#eceff5;stroke-width:2}
/* ── actor pulse (terrain-actor-pulse-v2, approved July 20) ─────────────────
   One shared breath: every actor swells together (1 → 1.12, 2.8s) and a
   neutral halo blooms off each avatar at the peak. Judgment-free by
   construction: identical motion on every actor — direct, adjacent, and
   baseline breathe the same; the field inhales as one organism. Labels sit
   OUTSIDE the animated group and never move. Hover/selection replaces the
   breath with a steady 1.16 lift — intent beats ambience.
   transform-box:fill-box makes each avatar scale around its own centre
   (SVG transforms otherwise pivot on the canvas origin). */
.ilc-deep .tav{transform-box:fill-box;transform-origin:center;
  animation:tpulse 2.8s ease-in-out infinite;will-change:transform}
.ilc-deep .thalo{transform-box:fill-box;transform-origin:center;
  animation:thalo 2.8s ease-in-out infinite;pointer-events:none;opacity:0}
.ilc-deep .tnode:hover .tav,.ilc-deep .tnode.sel .tav{animation:none;transform:scale(1.16)}
.ilc-deep .tnode:hover .thalo,.ilc-deep .tnode.sel .thalo{animation:none;opacity:0}
@keyframes tpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes thalo{0%,100%{transform:scale(1);opacity:0}45%{opacity:.5}50%{transform:scale(1.55);opacity:.32}70%{transform:scale(1.9);opacity:0}}
.ilc-deep .tinspect{border-top:1px solid var(--divider);margin-top:4px;padding:14px 8px 8px;min-height:62px}
.ilc-deep .tinspect .empty{font-family:var(--mono);font-size:12px;color:var(--mut)}
/* the selected actor's avatar, echoed at the head of its dossier line —
   same favicon the terrain node carries, same circular treatment. Fallback
   (no url) is the actor's initial in the same chip; no icon is invented. */
.ilc-deep .tinspect .aav{display:inline-grid;place-items:center;width:26px;height:26px;
  border-radius:50%;background:var(--surf2);border:1px solid var(--border-str);
  vertical-align:-7px;margin-right:10px;overflow:hidden;flex-shrink:0}
.ilc-deep .tinspect .aav img{width:17px;height:17px;border-radius:50%;display:block}
.ilc-deep .tinspect .aav span{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--sec)}
.ilc-deep .tinspect .anm{font-size:15px;font-weight:600}
.ilc-deep .tinspect .aty{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--sec);margin-left:12px}
.ilc-deep .tinspect .atake{font-size:13px;line-height:1.6;color:var(--sec);margin-top:8px;max-width:82ch}
.ilc-deep .fc-verdict{margin-top:26px;font-weight:500;font-size:17px;line-height:1.62;letter-spacing:-.005em;color:var(--text);padding-left:18px;border-left:2px solid var(--amber);max-width:82ch}
.ilc-deep .fc-verdict .entity{color:#5fd4b0;border-bottom:1px solid rgba(95,212,176,.35)}
.ilc-deep .fc-verdict .needs{vertical-align:2px}
.ilc-deep .fc-panel{margin-top:26px;max-width:1000px;border:1px solid var(--border);border-top:2px solid rgba(217,168,108,.55);border-radius:14px;background:var(--surface);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);overflow:hidden}
.ilc-deep .fc-side{padding:24px 28px}
.ilc-deep .fc-side+.fc-side{border-left:1px solid var(--divider)}
.ilc-deep .fc-h{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:9.5px;letter-spacing:.15em;color:var(--sec);margin-bottom:16px}
.ilc-deep .fc-h svg{flex-shrink:0}
.ilc-deep .fc-lead{font-size:13.5px;line-height:1.68;color:#c3c9d4}
.ilc-deep .fc-lead .rep{margin-left:2px}
.ilc-deep .fc-risk{margin-top:18px;border-radius:10px;background:rgba(217,168,108,.055);border:1px solid rgba(217,168,108,.24);padding:14px 16px}
.ilc-deep .fc-risk .rk{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--amber);margin-bottom:8px}
.ilc-deep .fc-risk p{font-size:13px;line-height:1.64;color:#c3c9d4}
.ilc-deep .fc-q{display:grid;grid-template-columns:26px 1fr;gap:13px;padding:15px 0;border-top:1px solid var(--divider);align-items:start}
.ilc-deep .fc-q:first-of-type{border-top:none;padding-top:2px}
.ilc-deep .fc-qn{font-family:var(--mono);font-size:15px;font-weight:600;color:var(--qc);line-height:1.1}
.ilc-deep .fc-qtag{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--qc);border:1px solid;border-color:color-mix(in oklab,var(--qc) 45%,transparent);border-radius:4px;padding:2px 7px;display:inline-block;margin-bottom:7px}
.ilc-deep .fc-qtxt{font-size:13px;line-height:1.62;color:#c3c9d4}
.ilc-deep .fc-qtxt .rep{margin-left:2px}
/* ---- Ⅳ BUILD REALITY — ported verbatim from Deep_v5 design ---- */
.ilc-deep .br{max-width:1000px}
.ilc-deep .br-head{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1.35fr);border-top:1px solid var(--border-str);border-bottom:1px solid var(--divider)}
.ilc-deep .br-fact{padding:22px 30px}
.ilc-deep .br-fact:first-child{padding-left:0}
.ilc-deep .br-fact+.br-fact{border-left:1px solid var(--divider)}
.ilc-deep .br-fk{font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:var(--faint);margin-bottom:14px;display:flex;align-items:center;gap:9px}
.ilc-deep .br-fk .ext{font-size:8.5px;letter-spacing:.08em;padding:2px 7px;border-radius:4px;border:1px solid rgba(127,176,196,.4);color:var(--build)}
.ilc-deep .brf-num{display:flex;align-items:baseline;gap:9px;margin-bottom:11px}
.ilc-deep .brf-num .v{font-family:var(--mono);font-size:50px;font-weight:500;line-height:.8;letter-spacing:-.03em;color:var(--build)}
.ilc-deep .brf-num .tier{font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;color:var(--sec)}
.ilc-deep .breq{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;color:var(--mut)}
.ilc-deep .breq b{color:var(--sec);font-weight:600}
.ilc-deep .breq .op{color:var(--faint)}
.ilc-deep .brf-big{font-family:var(--serif);font-size:26px;font-weight:500;letter-spacing:-.01em;color:var(--text);line-height:1.05;margin-bottom:8px}
.ilc-deep .brf-meta{font-family:var(--mono);font-size:11px;color:var(--sec)}
.ilc-deep .br-verdict{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:22px 0 6px}
.ilc-deep .br-vchip{font-family:var(--mono);font-size:10px;letter-spacing:.1em;font-weight:600;color:var(--build);border:1px solid rgba(127,176,196,.5);border-radius:6px;padding:5px 11px}
.ilc-deep .br-vtxt{font-family:var(--serif);font-size:17px;color:var(--text);letter-spacing:-.005em}
.ilc-deep .br-excl{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:var(--mut);margin-bottom:2px}
.ilc-deep .brsteps{display:grid;grid-template-columns:256px minmax(0,1fr);margin-top:34px;align-items:start}
.ilc-deep .bs-nav{position:sticky;top:78px;padding-right:30px}
.ilc-deep .bs-nk{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--faint);margin-bottom:12px}
.ilc-deep .bs-list{border-left:1px solid var(--divider);display:flex;flex-direction:column}
.ilc-deep .bs-item{display:flex;gap:12px;align-items:baseline;text-align:left;background:none;border:none;border-left:2px solid transparent;margin-left:-1px;padding:11px 0 11px 16px;cursor:pointer;color:var(--mut);transition:color .15s,border-color .15s,transform .18s}
.ilc-deep .bs-item:hover{transform:translateX(4px)}
.ilc-deep .bs-item .n{font-family:var(--mono);font-size:10px;color:var(--faint);flex-shrink:0}
.ilc-deep .bs-item .t{font-size:13.5px;line-height:1.45;color:inherit}
.ilc-deep .bs-item.on{border-left-color:var(--build);color:var(--text)}
.ilc-deep .bs-item.on .n{color:var(--build)}
.ilc-deep .bs-item.alt.on{border-left-color:var(--amber)}
.ilc-deep .bs-item.alt.on .n{color:var(--amber)}
.ilc-deep .bs-pane{padding-left:46px}
.ilc-deep .bs-panel{display:block}
.ilc-deep .bs-item.pinned .n::after{content:" ·";color:var(--build)}
.ilc-deep .bs-hint{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--faint);margin-top:14px}
.ilc-deep .bk{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--build);font-weight:600;margin-bottom:16px;display:flex;align-items:baseline;gap:12px}
.ilc-deep .bk .step{color:var(--faint);font-weight:400}
.ilc-deep .bk.amber{color:var(--amber)}
.ilc-deep .bp{font-size:15px;line-height:1.8;color:#c3c9d4;max-width:60ch}
.ilc-deep .bp b{color:var(--text);font-weight:600}
.ilc-deep .bp+.bp{margin-top:12px}
.ilc-deep .baside{margin-top:20px;border-left:2px solid rgba(217,168,108,.4);padding:3px 0 3px 18px;font-size:13px;line-height:1.7;color:var(--sec);max-width:58ch}
.ilc-deep .baside b{color:var(--text)}
.ilc-deep .bs-next{margin-top:26px;font-family:var(--mono);font-size:10px;letter-spacing:.09em;color:var(--build);background:none;border:1px solid rgba(127,176,196,.35);border-radius:18px;padding:7px 16px;cursor:pointer;transition:border-color .2s}
.ilc-deep .bs-next:hover{border-color:var(--build)}
.ilc-deep .cc2{margin-top:20px;display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--divider);border-radius:12px;overflow:hidden;max-width:62ch}
.ilc-deep .cc2 .ccl{font-family:var(--mono);font-size:8.5px;letter-spacing:.11em;color:var(--faint);grid-column:1/-1;padding:9px 16px 0}
.ilc-deep .cc{padding:14px 16px}
.ilc-deep .cc.sel{background:rgba(127,176,196,.05)}
.ilc-deep .cc+.cc{border-left:1px solid var(--divider)}
.ilc-deep .cc-n{font-size:13.5px;font-weight:600;margin-bottom:4px}
.ilc-deep .cc-s{font-family:var(--mono);font-size:9px;letter-spacing:.08em;margin-bottom:7px}
.ilc-deep .cc-p{font-size:12.5px;line-height:1.6;color:var(--sec)}
.ilc-deep .cc-tip{grid-column:1/-1;border-top:1px solid var(--divider);padding:12px 16px;font-size:13px;line-height:1.62;color:#c3c9d4}
.ilc-deep .cc-tip b{color:var(--build)}
.ilc-deep .clears{max-width:62ch}
.ilc-deep .clear{display:grid;grid-template-columns:158px 1fr;gap:22px;padding:14px 0;border-top:1px solid var(--divider);align-items:start}
.ilc-deep .clear:first-child{border-top:none;padding-top:2px}
.ilc-deep .clear .cq{font-family:var(--mono);font-size:10.5px;letter-spacing:.02em;color:var(--build)}
.ilc-deep .clear .ca{font-size:13.5px;line-height:1.64;color:#c3c9d4}
.ilc-deep .clear .ca b{color:var(--text)}
.ilc-deep .branchbox{border:1px dashed rgba(127,176,196,.42);border-radius:12px;padding:18px 22px;background:rgba(127,176,196,.03);max-width:62ch}
.ilc-deep .branch-k{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--build);margin-bottom:9px}
.ilc-deep .branch-k .from{color:var(--mut)}
.ilc-deep .branchbox p{font-size:13.5px;line-height:1.7;color:#c3c9d4}
.ilc-deep .branchbox p b{color:var(--text)}
/* ---- Ⅴ THE HINGE — ported verbatim from Deep_v5 design ---- */
.ilc-deep .hinge{max-width:1000px;border-top:2px solid rgba(217,168,108,.5);padding-top:30px}
.ilc-deep .hserif{font-family:var(--serif);font-weight:500;font-size:26px;line-height:1.34;letter-spacing:-.005em;margin:0 auto 8px;max-width:28ch;text-align:center}
.ilc-deep .hserif em{font-style:italic;color:var(--amber)}
.ilc-deep .htag{margin:12px 0 20px}
.ilc-deep .collect{max-width:780px;margin:18px auto 30px}
.ilc-deep .collect svg{width:100%;height:auto;display:block;overflow:visible}
.ilc-deep .hbody{font-size:15px;line-height:1.8;color:var(--sec);margin:0 auto 24px;max-width:76ch}
.ilc-deep .hbody b{color:var(--text)}
.ilc-deep .touch{font-family:var(--mono);font-size:10.5px;color:var(--mut);display:flex;gap:16px;flex-wrap:wrap;padding-top:18px;border-top:1px solid var(--divider)}
.ilc-deep .touch .lbl{color:var(--faint)}
.ilc-deep .touch b{font-weight:600}
.ilc-deep .hclose{font-family:var(--serif);font-style:italic;font-size:19px;line-height:1.5;color:var(--text);margin:28px 0 26px}
.ilc-deep .doors-k{font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:var(--faint);margin-bottom:14px}
.ilc-deep .doors{display:flex;gap:0;border-top:1px solid var(--divider)}
.ilc-deep .doors a{position:relative;flex:1;min-width:170px;padding:22px 22px 20px;color:var(--text);transition:background .2s}
.ilc-deep .doors a::before{content:"";position:absolute;left:0;right:0;top:-1px;height:2px;background:var(--dc);opacity:.35;transition:opacity .22s}
.ilc-deep .doors a:hover::before{opacity:1}
.ilc-deep .doors a+a{border-left:1px solid var(--divider)}
.ilc-deep .doors a:hover{background:rgba(255,255,255,.02)}
.ilc-deep .doors .dn{font-family:var(--mono);font-size:9px;letter-spacing:.15em;color:var(--dc);opacity:.8;margin-bottom:12px}
.ilc-deep .doors .t{font-size:14.5px;font-weight:600;margin-bottom:4px}
.ilc-deep .doors .d{font-size:11.5px;color:var(--mut);line-height:1.5;max-width:34ch}
.ilc-deep .doors .go{font-family:var(--mono);font-size:10px;margin-top:14px;letter-spacing:.06em;color:var(--dc)}
/* ---- Ⅴ hinge hybrid — AUTHORED, not ported. Node treatment (halo + dashed
   ring + dot + fused curves) transcribed from the Deep_v5 Render A single
   case; the dossier ledger and k>1 layouts have no mockup and are built
   from the ported variables only. One grammar for every mapped state -
   only its intensity varies. ---- */
.ilc-deep .hzsub{font-size:13.5px;line-height:1.7;color:var(--mut);text-align:center;max-width:66ch;margin:6px auto 0}
.ilc-deep .hzgrid{display:grid;gap:14px;margin-top:22px}
.ilc-deep .hzcard{background:var(--surface);border:1px solid var(--border);border-top-width:2px;border-radius:10px;padding:16px 18px 14px}
.ilc-deep .hzcard .dk{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;margin-bottom:10px;color:var(--amber)}
.ilc-deep .hzcard.solo .dk{color:var(--sec)}
.ilc-deep .hzchips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.ilc-deep .hzchip{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;padding:3px 9px;border-radius:999px;border:1px solid;background:transparent}
.ilc-deep .hzfact{font-size:14.5px;line-height:1.55;color:var(--text);font-weight:600;margin-bottom:8px}
.ilc-deep .hzbody{font-size:13px;line-height:1.65;color:var(--sec)}
.ilc-deep .hzreq{font-size:13px;line-height:1.65;color:var(--sec)}
.ilc-deep .hzrungs{font-family:var(--mono);font-size:10px;color:var(--faint);margin-top:11px;padding-top:9px;border-top:1px solid var(--divider)}
.ilc-deep .hzaudit{max-width:560px;margin:18px auto 0}
.ilc-deep .hzaudit .row{display:grid;grid-template-columns:220px 1fr;gap:16px;padding:11px 0;border-top:1px solid var(--divider);align-items:baseline}
.ilc-deep .hzaudit .row:first-child{border-top:none}
.ilc-deep .hzaudit .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;color:var(--sec)}
.ilc-deep .hzaudit .v{font-family:var(--mono);font-size:10.5px;color:var(--amber)}
`;

/* ============================================================ I · THE READ == */
function MvRead({ read, findings, onJump, wt, onWt, onScoreGuide }) {
  const [open, setOpen] = useState(false);

  /* JOIN CURVES — measured, not fixed. The mockup hardcodes the curve
     geometry (padding-top:84px, endpoint y=79) tuned against its own row
     rhythm, and hides the whole join column below 1080px — which is why
     the miss was never visible in the design tool. Real layout differs,
     so the curves are drawn from the measured centers of the legend rows
     to the measured center of the composite ring. Pure presentation of
     the same committed relationship; nothing is authored. */
  const roRef = useRef(null);
  const [join, setJoin] = useState(null);
  useEffect(() => {
    const el = roRef.current;
    if (!el) return;
    const measure = () => {
      const joinEl = el.querySelector(".ro-join");
      const ring = el.querySelector(".comp-ring");
      const compRow = el.querySelector(".comp-row");
      const rows = el.querySelectorAll(".rleg");
      if (!joinEl || !ring || !rows.length) return setJoin(null);
      const jb = joinEl.getBoundingClientRect();
      if (!jb.width || !jb.height) return setJoin(null); // hidden ≤ 1080px
      const rb = ring.getBoundingClientRect();
      const ys = Array.from(rows).map((r) => {
        const b = r.getBoundingClientRect();
        return b.top + b.height / 2 - jb.top;
      });
      // The design's alignment: the ring's centre sits ON the middle row's
      // line, so the middle curve is straight and the fan is symmetric.
      // The shift is computed against the UNTRANSFORMED .comp-row box (the
      // transform lives on the inner .comp-shift wrapper; a child transform
      // never changes the parent's rect), so repeated measurements return
      // the same value — idempotent, no accumulation, no render race.
      // align-items:center makes the ring's base centre = the row's centre.
      const mid = ys[Math.floor((ys.length - 1) / 2)];
      const crb = compRow ? compRow.getBoundingClientRect() : rb;
      const ringCenterBase = crb.top + crb.height / 2 - jb.top;
      const shift = Math.max(-80, Math.min(80, mid - ringCenterBase));
      setJoin({
        h: jb.height,
        ys,
        end: mid,
        shift,
        ringLeft: rb.left - jb.left, // connector target; > 74 is fine, overflow is visible
      });
    };
    measure();
    const raf = requestAnimationFrame(measure); // second pass after layout settles
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) {
      ro.observe(el);
      const ring = el.querySelector(".comp-ring");
      const leg = el.querySelector(".rlegend");
      if (ring) ro.observe(ring);
      if (leg) ro.observe(leg);
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [findings.length]);
  const g = read.grounding;
  const groundLabel = g.level
    ? { HIGH: "High grounding", MEDIUM: "Medium grounding", LOW: "Low grounding" }[g.level] || g.level
    : null;
  // The sub-line under the grounding label states WHY the level is what it is.
  // Derived from anchor_status, not authored — it must not editorialise.
  const groundSub = g.level === "HIGH"
    ? "ALL THREE PACKETS ANCHORED"
    : g.level === "LOW"
      ? "NO QUALIFIED ANCHOR"
      : g.level === "MEDIUM"
        ? "PARTIAL ANCHORING"
        : null;

  // ---- composite ring geometry -------------------------------------------
  // r=41 => C=2*pi*41=257.61. Each arc is its weight's share of C, less a 3px
  // gap, offset by the cumulative share before it. This reproduces the design's
  // hardcoded dasharrays exactly (md 93.6/164, mo 77.5/180.1 @ -96.6,
  // or 77.5/180.1 @ -177.1) while staying driven by WEIGHT.
  const R = 41;
  const C = 2 * Math.PI * R;
  const GAP = 3;
  let cum = 0;
  const arcs = findings.map((f) => {
    const share = (C * WEIGHT[f.key]) / 100;
    const a = { key: f.key, len: share - GAP, rest: C - (share - GAP), off: -cum };
    cum += share;
    return a;
  });

  // Two-line headline fit. perLine ~= half the characters, +2 slack so the
  // break lands after a word rather than mid-phrase.
  const hl = read.headline || "";
  const titleStyle = {
    maxWidth: `${Math.ceil(hl.length / 2) + 2}ch`,
    ...(hl.length > 62 ? { fontSize: 38 } : hl.length > 48 ? { fontSize: 44 } : null),
  };

  const complete = read.compositeState === "complete";

  return (
    <section className="nx-head" id="mv-1" data-movement="read">
      <div className="nx-eyebrow">
        <span className="pill">
          DEEP{read.ideaType ? ` \u00b7 ${String(read.ideaType).toUpperCase()}` : ""}
        </span>
        {read.synthesisDegraded && <span>synthesis degraded — headline from scores</span>}
      </div>

      <div className="nx-hero2">
        <div>
          {read.headline && (
            /* The design's 16ch measure is tuned to its own 41-char example.
               A longer headline sets to three lines against it. Rather than
               clamp (which would hide words the read depends on), the measure
               is derived: half the string plus slack puts the break near the
               middle, and very long headlines step the size down so the line
               never outruns the column. Nothing is truncated. */
            <h1 className="nx-title" style={titleStyle}>
              {read.headline}
              {/* wrapped rather than passed className — ChangeMarker's prop
                  surface is not guaranteed to forward it. */}
              <span className="wtm">
                <ChangeMarker bundle={wt && wt.verdict} onOpen={onWt} title="The verdict changed" />
              </span>
            </h1>
          )}
          {(read.lead || read.summary) && <p className="nx-lead">{read.lead || read.summary}</p>}

          {read.summary && read.lead && read.summary !== read.lead && (
            <>
              <button
                className={"nx-full-btn" + (open ? " open" : "")}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                <span>Read the full read</span> <span className="ar">↓</span>
              </button>
              <div className={"nx-full" + (open ? " open" : "")}>
                <div className="inner">
                  {read.summary}
                  {read.detail ? " " + read.detail : ""}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="readout" ref={roRef}>
        {/* ---------- left: three positions ---------- */}
        <div className="ro-col">
          <div className="ro-k">THREE POSITIONS · CONTRIBUTION BY WEIGHT</div>

          <div className="stackbar">
            {findings.map((f) => (
              <button
                key={f.key}
                type="button"
                className="seg"
                onClick={() => onJump(f.key)}
                title={`${NAME[f.key]} · ${WEIGHT[f.key]}%`}
                aria-label={`Jump to ${NAME[f.key]}`}
                style={{ flex: WEIGHT[f.key], background: MC[f.key] }}
              />
            ))}
          </div>

          <div className="rlegend">
            {findings.map((f) => (
              <button key={f.key} type="button" className="rleg" onClick={() => onJump(f.key)}>
                <span className="d" style={{ background: MC[f.key] }} />
                <span className="nm">{NAME[f.key]}</span>
                <span className="wt">{WEIGHT[f.key]}%</span>
                <span className="sc" style={{ color: MC[f.key] }}>
                  {num(f.displayScore ?? f.score)}
                </span>
              </button>
            ))}
          </div>


        </div>

        {/* ---------- middle: the join ----------
            Three lines converging on one point. Purely structural: it says the
            composite is a RESOLUTION of the three, not a fourth measurement.
            Hidden under 1080px by the design's own media query. */}
        <div className="ro-join" aria-hidden="true">
          {join && (
            <svg viewBox={`0 0 74 ${Math.max(1, Math.round(join.h))}`} preserveAspectRatio="none">
              {join.ys.map((y, i) => (
                <path
                  key={i}
                  d={`M0 ${y.toFixed(1)} C40 ${y.toFixed(1)} 44 ${join.end.toFixed(1)} 74 ${join.end.toFixed(1)}`}
                  fill="none"
                  stroke={MC[(findings[i] || {}).key] || "var(--md)"}
                  strokeWidth="1.3"
                  vectorEffect="non-scaling-stroke"
                  opacity=".55"
                />
              ))}
              {/* the faded connector carries the convergence into the ring */}
              {typeof join.ringLeft === "number" && join.ringLeft > 74 && (
                <path
                  d={`M74 ${join.end.toFixed(1)} H${join.ringLeft.toFixed(1)}`}
                  fill="none"
                  stroke="rgba(236,239,245,.45)"
                  strokeWidth="1.3"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <circle cx="74" cy={join.end.toFixed(1)} r="3" fill="#eceff5" />
            </svg>
          )}
        </div>

        {/* ---------- right: composite ---------- */}
        <div className="ro-col ro-comp">
          <div className="ro-k">→ RESOLVES TO · COMPOSITE</div>

          {complete ? (
            <div className="comp-row">
            <div className="comp-shift" style={join && join.shift ? { transform: `translateY(${join.shift.toFixed(1)}px)` } : undefined}>
              <svg
                className="comp-ring"
                width="124"
                height="124"
                viewBox="0 0 96 96"
                role="img"
                aria-label={`Composite ${num(read.composite)} of 10`}
              >
                <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="2" />
                <g className="ring-anim">
                  <g transform="rotate(-90 48 48)">
                    {arcs.map((a) => (
                      <circle
                        key={a.key}
                        cx="48"
                        cy="48"
                        r={R}
                        fill="none"
                        stroke={MC[a.key]}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeDasharray={`${a.len.toFixed(1)} ${a.rest.toFixed(1)}`}
                        strokeDashoffset={a.off ? a.off.toFixed(1) : undefined}
                        opacity=".85"
                      />
                    ))}
                  </g>
                </g>
                <text
                  x="48"
                  y="51"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="'JetBrains Mono',monospace"
                  fontSize="25"
                  fontWeight="500"
                  fill="#eceff5"
                >
                  {num(read.composite)}
                </text>
              </svg>
              <div>
                <div className="comp-lab">
                  Composite · / 10
                  <ChangeMarker bundle={wt && wt.overall} onOpen={onWt} title="Overall score changed" />
                </div>
                <div className="ro-note">
                  A weighted mean of the three positions — the least doctrinally important number here.
                </div>
                {onScoreGuide && (
                  <button
                    onClick={onScoreGuide}
                    aria-label="What does this score mean?"
                    style={{
                      marginTop: 10, background: "none", border: "none", padding: 0,
                      cursor: "pointer", fontFamily: "var(--mono)", fontSize: 10,
                      letterSpacing: ".06em", color: "var(--mut)",
                    }}
                  >
                    what does this mean?
                  </button>
                )}
              </div>
            </div>
            </div>
          ) : (
            /* Never reweight, never zero, never show a stale composite. */
            <div className="ro-note" style={{ maxWidth: "34ch", color: "var(--amber)" }}>
              {read.compositeState === "partial_not_scored"
                ? "Not all three positions scored — no composite is computed. The positions above stand on their own."
                : "Composite unavailable."}
            </div>
          )}

          {read.history && read.history.length > 0 && (
            <div className="ro-hist">
              <div className="hk">READ HISTORY</div>
              <div className="hv">
                {read.history.map((h, i) => (
                  <React.Fragment key={i}>
                    {num(h)} <span className="ar">→</span>{" "}
                  </React.Fragment>
                ))}
                {num(read.composite)} <span className="cur">current</span>
              </div>
              <div className="hn">
                {read.history.length} prior read{read.history.length === 1 ? "" : "s"} · you changed
                nothing; the evidence moved.
              </div>
            </div>
          )}
        </div>

          {groundLabel && (
            <div
              className="ro-ground"
              style={{ gridColumn: "1/-1", padding: "22px 0 24px", borderTop: "1px solid var(--divider)", maxWidth: 1000 }}
            >
              <div className="ro-k">GROUNDING</div>
              <div className="grd-head">
                <svg className="grd-ico" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
                  <line x1="15" y1="3" x2="15" y2="14" stroke="#46c79a" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                  <path d="M15 14 l-3.4 -3.4 M15 14 l3.4 -3.4" fill="none" stroke="#46c79a" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                  <rect x="7" y="15" width="16" height="2.6" rx="1" fill="#46c79a" />
                  <rect x="9" y="20" width="12" height="2.6" rx="1" fill="#46c79a" opacity=".62" />
                  <rect x="11" y="25" width="8" height="2.6" rx="1" fill="#46c79a" opacity=".34" />
                </svg>
                <div>
                  <div className="grd-lab">{groundLabel}</div>
                  {groundSub && <div className="grd-sub">{groundSub}</div>}
                </div>
              </div>
              {g.reason && (
                <div className="grd-body" style={{ maxWidth: "none" }}>
                  {g.reason}
                </div>
              )}
              {/* thin_dimensions is emitted only at LOW — the early-read callout. */}
              {g.thinDimensions.length > 0 && (
                <div className="grd-body" style={{ marginTop: 10, color: "var(--amber)" }}>
                  Not identifiable from what you wrote:{" "}
                  {g.thinDimensions.map((d) => d.replace(/_/g, " ")).join(", ")}.
                </div>
              )}
            </div>
          )}
      </div>
    </section>
  );
}

/* ================================================== II · WHY IT LANDS HERE == */
/* The highest REACHABLE rung. The ladder admits one further rung per committed
   defensibility component, so the cap is committed+2. Shared by the ruler and
   the rail meta — they must never disagree about what is reachable. */
function capRungOf(rung, cap) {
  if (!rung || !cap || cap.committed >= cap.of) return null;
  return Math.min(cap.committed + 2, rung.of);
}

function Ruler({ rung, cap, mc }) {
  if (!rung || rung.of < 2) return null;
  const pct = (n) => ((n - 1) / (rung.of - 1)) * 100;
  const here = pct(rung.n);

  // The cap admits one further rung per committed component; everything above
  // is unreachable until a component turns real.
  const capRung = capRungOf(rung, cap);

  // The cap line sits at the MIDPOINT AFTER the capped rung, not on it — it
  // reads "rung N is reachable, rung N+1 is not". This reproduces the design's
  // hardcoded 50% for a cap of 3 on a 6-rung ladder.
  const capPct = capRung !== null ? ((capRung - 0.5) / (rung.of - 1)) * 100 : null;
  const capped = capPct !== null && capPct < 100;

  // Ticks stop at the cap. A tick past it would draw a rung that cannot be
  // occupied — the instrument must not offer positions the evidence forbids.
  const lastTick = capRung !== null ? capRung : rung.of;

  // "next" is only meaningful if it is actually reachable.
  const nextRung = rung.n < rung.of ? rung.n + 1 : null;
  const next = nextRung !== null && (capRung === null || nextRung <= capRung) ? pct(nextRung) : null;

  return (
    <div className="ruler">
      <div className="base" />
      <div className="fillline" style={{ width: `${here}%`, background: mc }} />
      {capped && <div className="hatch" style={{ left: `${capPct}%`, width: `${100 - capPct}%` }} />}
      {Array.from({ length: lastTick }, (_, i) => (
        <span key={i} className="tick" style={{ left: `${pct(i + 1)}%` }} />
      ))}
      {capped && <div className="cap" style={{ left: `${capPct}%` }} />}
      {next !== null && <span className="nxt" style={{ left: `${next}%` }} />}
      <span className="mk" style={{ left: `${here}%`, background: mc }} />
    </div>
  );
}

function Duel({ duel, metricKey, mc, competitors }) {
  if (!duel || !duel.binding || !duel.binding.subtype) return null;
  const subs = (duel.subordinates || []).filter((s) => s.subtype);
  const total = 1 + subs.length;

  // FIX PASS July 19 (approved: deep-fixpass-mockup.html, panel A/B/C).
  // The binding objects carry TWO prose fields with opposite audiences.
  // `why_binding`/`why_primary` is AUDIT prose BY CONTRACT — "one sentence
  // explaining the tiebreaker resolution" (MD) / "the 4-step selection
  // hierarchy resolution" (MO) / "which step resolved the selection" (OR) —
  // rule references in 76-100% of production rows are that field working as
  // designed, and rendering it verbatim was the frontend borrowing an audit
  // field as body copy. `evidence_cited` (34/34 present, ZERO rule refs) is
  // the user-grade sentence: what establishes the wall. So the body is the
  // scrubbed evidence line; the audit sentence renders NOWHERE in the core
  // read and stays in the payload as AUDIT-depth material for the planned
  // depth tabs. Metric prompts untouched.
  const evidenceBody = (() => {
    const raw = duel.binding.evidenceCited;
    if (!raw) return null;
    const scrubbed = scrubMachinery(stripTags(raw));
    return scrubbed.text || null;
  })();

  return (
    <div className="tb">
      <div className="tbh">
        INSPECTING THE WALL — {total > 1 ? `${total} FIRED, ONE BINDS` : "ONE MECHANISM FIRED"}
      </div>
      <div className="wbind">
        <div className="n">{labelFor(metricKey, duel.binding.subtype)}</div>
        <div className="s" style={{ color: mc }}>BINDING</div>
        {evidenceBody ? (
          <p><Linked text={evidenceBody} competitors={competitors} /></p>
        ) : (
          <p className="wdeg">
            Named as the binding mechanism — the evidence line for it did not survive this read.
          </p>
        )}
      </div>
      {/* Enum-only upstream: the engine commits the NAME of a subordinate
          mechanism, never a rationale. One compact strip matches that
          commitment's footprint — no empty cells. */}
      {subs.length > 0 && (
        <div className="wsubs">
          <span className="k">ALSO FIRED — NOT BINDING&nbsp;&nbsp;</span>
          <span className="m">{subs.map((x) => labelFor(metricKey, x.subtype)).join("  ·  ")}</span>
        </div>
      )}
    </div>
  );
}

/* The design renders the evidence trail as a flat "WHAT THIS RESTS ON" list
   (.rests / .rh / .r / .t), not the collapsible disclosure SourcesStrip draws.
   SourcesStrip is a SHARED primitive — Explore renders it too — so its
   presentation is left alone and only its resolver is reused here. Same
   committed strings, same scrubbing, design's markup. */
const REST_TAG = {
  external:  { label: "verified",      color: "#34d399", bg: "rgba(16,185,129,.12)" },
  ai:        { label: "AI-identified", color: "#c9a2e0", bg: "rgba(201,162,224,.14)" },
  domain:    { label: "domain signal", color: "#60a5fa", bg: "rgba(59,130,246,.12)" },
  input:     { label: "your input",    color: "var(--mut)", bg: "rgba(150,150,160,.12)" },
  landscape: { label: "landscape read",color: "var(--mut)", bg: "rgba(150,150,160,.12)" },
};

function Rests({ internal, competitors }) {
  // FIX PASS July 19: collapsed by default — pulled, not pushed. The always-
  // open list crowded the reading pane; the collapsed line now carries the
  // SHAPE of the evidence (class counts, strongest first, trust colors) so
  // the glance still says what the read rests on, and the receipt rows are
  // one click away, unchanged. Same pattern SourcesStrip has always used;
  // this pane opted out on July 18 and opts back in here.
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () => resolveEvidenceSources(internal, competitors),
    [internal, competitors]
  );
  if (!rows || rows.length === 0) return null;

  // FOOTER FIX July 19 (approved: rests-footer-fix.html). One evidence string
  // tagged with two competitors resolves to one row PER SOURCE, each carrying
  // the full shared body — correct trust accounting, but it rendered as a
  // copy-pasted sentence. Display-level grouping: named rows with an
  // IDENTICAL body merge into one row — names joined, every member's trust
  // badge stacked (merging must not blur that one source is verified and the
  // other AI-identified), body once, first member's url. Unnamed rows
  // (your input / landscape) never merge. The shared resolver is untouched;
  // the glance counts stay per-source — they count sources, not rows.
  const grouped = [];
  {
    const byText = new Map();
    for (const r of rows) {
      const key = r.name && r.text ? r.text : null;
      const prev = key && byText.get(key);
      if (prev) {
        prev.names.push(r.name);
        if (!prev.clsList.includes(r.cls)) prev.clsList.push(r.cls);
        if (!prev.url && r.url) prev.url = r.url;
      } else {
        const g = { ...r, names: r.name ? [r.name] : [], clsList: [r.cls] };
        grouped.push(g);
        if (key) byText.set(key, g);
      }
    }
  }

  const counts = {};
  rows.forEach((r) => { counts[r.cls] = (counts[r.cls] || 0) + 1; });
  const present = ["external", "ai", "domain", "input", "landscape"].filter((c) => counts[c]);
  const chipText = (c) => {
    // input/landscape dedupe to a single row by construction — the bare
    // label is the accurate count.
    if (c === "input") return "your input";
    if (c === "landscape") return "landscape read";
    return `${counts[c]} ${REST_TAG[c].label}`;
  };
  const glance = present.map(chipText).join(", ");
  const toggle = () => setOpen((o) => !o);

  return (
    <div className="rests">
      <div
        className="rests-line"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`What this rests on: ${glance}. Activate to ${open ? "hide" : "show"} the receipts.`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        }}
      >
        <span className="rh" style={{ marginBottom: 0 }}>WHAT THIS RESTS ON</span>
        {present.map((c) => (
          <span key={c} className="rchip" style={{ background: REST_TAG[c].bg, color: REST_TAG[c].color }}>
            {chipText(c)}
          </span>
        ))}
        <span className="rcaret">{open ? "FOLD ↑" : "SEE THE RECEIPTS ↓"}</span>
      </div>
      {open && (
        <div className="rests-body">
      {grouped.map((r, i) => {
        return (
          <div className="r" key={i}>
            <span className="tags">
              {r.clsList.map((c) => {
                const tag = REST_TAG[c] || REST_TAG.landscape;
                return (
                  <span key={c} className="t" style={{ background: tag.bg, color: tag.color }}>
                    {tag.label}
                  </span>
                );
              })}
            </span>
            <span>
              {r.names.length > 0 && <b>{r.names.join(" · ")}</b>}
              {r.names.length > 0 && r.text ? " — " : ""}
              {r.text}
              {r.url && (
                <>
                  {" "}
                  <a href={r.url} target="_blank" rel="noopener noreferrer">Visit →</a>
                </>
              )}
            </span>
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}

function ReadingPane({ f, competitors }) {
  const mc = MC[f.key];
  const isOR = f.key === "originality";
  const rungLine = f.rung ? `standing on rung ${f.rung.n} of ${f.rung.of} · ${f.rung.label}` : null;

  const caseQ = isOR
    ? "What is actually different about this case?"
    : f.key === "monetization"
    ? "What payment-capture case is this?"
    : "What demand case is this?";
  const wallQ = isOR
    ? "What primary exposure constrains the position?"
    : f.key === "monetization"
    ? "What stands between this case and durable payment capture?"
    : "What stands between this buyer and adoption?";

  return (
    <div className="rp" id={`rp-${SHORT[f.key]}`} style={{ "--mc": mc }}>
      <div className="rp-eye">
        <span className="dot" />
        <span className="nm">{NAME[f.key]}</span>
        {/* WT-MOUNT {f.key} — home undecided; the rail item is a scroll target,
            so a marker there competes with the click. Mount here or on the
            navitem once decided:
            <ChangeMarker bundle={wt && wt[f.key]} onOpen={onWt} title={NAME[f.key] + " changed"} /> */}
        {rungLine && <span className="rr">{rungLine}</span>}
      </div>

      {f.prose.case ? (
        <>
          {/* OR reads as two movements — what is different, then whether that
              difference is defensible — so its chips are numbered rather than
              named. MD and MO have one case block and take THE CASE. */}
          <div className="blk">
            <div className="q">
              <span className="k">{isOR ? "MOVEMENT 1" : "THE CASE"}</span>
              {caseQ}
            </div>
            <p className="body"><Linked text={f.prose.case} competitors={competitors} /></p>
          </div>

          {isOR && f.prose.defensibility && (
            <div className="blk">
              <div className="q">
                <span className="k">MOVEMENT 2</span>
                Is that differentiation defensible?
              </div>
              <p className="body"><Linked text={f.prose.defensibility} competitors={competitors} /></p>
            </div>
          )}

          {f.prose.wall && (
            <div className="blk">
              <div className="q"><span className="k">THE WALL</span>{wallQ}</div>
              <p className="body"><Linked text={f.prose.wall} competitors={competitors} /></p>
              <Duel duel={f.duel} metricKey={f.key} mc={mc} competitors={competitors} />
            </div>
          )}
        </>
      ) : (
        /* degrade: raw prose fields absent (pre-V5 saves) -> the joined paragraph */
        f.prose.joined && <p className="body"><Linked text={f.prose.joined} competitors={competitors} /></p>
      )}

      {f.prose.direction && (
        <div className="gapc">
          <div className="k">
            {f.rung && f.rung.n < f.rung.of ? `TO REACH RUNG ${f.rung.n + 1} ` : "WHAT WOULD MOVE IT "}
            <span className="rq">· stated on the instrument</span>
          </div>
          <p><Linked text={f.prose.direction} competitors={competitors} /></p>
          {f.cap && f.cap.committed < f.cap.of && (
            <div className="adm">
              Higher rungs stay hatched because this ladder admits only on defensibility
              components — named here <b>{f.cap.committed} / {f.cap.of}</b>.
            </div>
          )}
        </div>
      )}

      {/* UNANCHORED IS NOT LOW. Never softened. */}
      {f.anchorStatus === "no_qualified_anchor" && (
        <div className="anchor-flag">
          This position rests on no qualified anchor — the score stands, but nothing
          high-trust supports it.
        </div>
      )}
      {f.anchorStatus === "weak" && (
        <div className="anchor-flag">
          This position rests on a weak anchor — the supporting fact is your own claim or
          the landscape read, not a retrieved receipt.
        </div>
      )}

      {f.notes.map((n, i) => (
        <p className="mnote" key={i}>{n}</p>
      ))}

      {/* The committed evidence trail. Renders nothing when it cannot resolve. */}
      <Rests internal={f.internal} competitors={competitors} />
    </div>
  );
}

function MvLands({ findings, competitors }) {
  const ids = useMemo(() => findings.map((f) => `rp-${SHORT[f.key]}`), [findings]);
  const active = useScrollSpy(ids);
  if (!findings.length) return null;

  return (
    <section id="mv-2" data-movement="findings">
      <div className="sx">
        <span className="num">02</span><h2>Why it lands here</h2>
        <span className="line" />
        <span className="tag">EACH FINDING RESTS ON A LADDER OF EVIDENCE STATES</span>
      </div>

      <div className="lands">
        <div className="navrail">
          <div className="nrk">{findings.length === 3 ? "THREE FINDINGS" : "FINDINGS"} · SELECT TO READ</div>
          {findings.map((f) => {
            const id = `rp-${SHORT[f.key]}`;
            return (
              <button
                key={f.key}
                className={`navitem${active === id ? " on" : ""}`}
                style={{ "--mc": MC[f.key] }}
                onClick={() => scrollToId(id)}
              >
                <div className="ni-top">
                  <span className="ni-nm">{NAME[f.key]}</span>
                  <span className="ni-sc">{num(f.displayScore ?? f.score)}</span>
                </div>
                <Ruler rung={f.rung} cap={f.cap} mc={MC[f.key]} />
                {(() => {
                  // Mirrors the ruler exactly: the cap shown here is the highest
                  // REACHABLE rung, and NEXT is suppressed when the next rung is
                  // above it — the rail must never promise a rung the ruler bars.
                  const capRung = capRungOf(f.rung, f.cap);
                  const nextRung = f.rung && f.rung.n < f.rung.of ? f.rung.n + 1 : null;
                  const nextOk = nextRung !== null && (capRung === null || nextRung <= capRung);
                  return (
                    <div className="ni-meta">
                      <span>
                        {f.rung ? `RUNG ${f.rung.n} / ${f.rung.of}` : "POSITION UNPLACED"}
                        {capRung !== null ? ` · CAP ${capRung}` : ""}
                      </span>
                      {nextOk && <span className="a">NEXT → {nextRung}</span>}
                    </div>
                  );
                })()}
                {f.rung && <div className="ni-state">{f.rung.label}.</div>}
              </button>
            );
          })}
        </div>

        <div className="readpane">
          {findings.map((f) => (
            <ReadingPane key={f.key} f={f} competitors={competitors} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ III · THE FIELD */
/* ---------------------------------------------------------------- TERRAIN
   Ported from Deep_v5's terrain SVG. Every constant — grid pattern, band
   y-positions (95/205/345), radius tiers, glyph scale (r/8) and stroke
   width (12/r), label offsets/sizes/fills, drop-shadow filter, baseline —
   is the mockup's own hardcoded value. Only x-distribution and per-actor
   content are computed, because real data varies in count.

   ICONS: the mockup's per-actor glyphs were hand-authored per actor — no
   data field carries them. Deterministic equivalent: the actor's favicon,
   derived from its committed `url`, clipped into the node circle. When no
   url exists (real substitutes: "Spreadsheets", consultants), a fixed
   per-band glyph from the mockup's own set (direct = target, adjacent =
   magnifier, substitute = person). Nothing per-actor is invented.

   RADIUS: band base (direct 14 / adjacent 9 / substitute 10), +1 when
   importance === "high", −2 with faded fill when source === "llm" — the
   mockup's own verified-vs-AI-identified size distinction, driven by the
   committed fields.

   WALLS: demand / payment / position are the three scorers' binding
   constraints — committed in every scored eval — drawn with the mockup's
   curve character, colors and labels, each landing SEPARATELY on the
   baseline ("what the buyer stands on today") beneath its own label.
   DE-CONVERGED July 19, 2026: the mockup drew all three into one point,
   which visually claimed exactly the convergence Movement V's hinge
   contract refuses to infer without a committed mapping (anti-manufacture)
   and doctrine forbids the frontend to author. Wall EXISTENCE is committed;
   wall CONVERGENCE is not. If the parked field_shape candidate is ever
   committed, the convergence snaps to that actor's x and the node gets the
   mockup's emphasis treatment (r19, ring, bold) — target state, gated on
   `platformRenderable`, never drawn by default. */
function Terrain({ field }) {
  const [sel, setSel] = useState(null);
  const { direct, adjacent, substitute } = field.competitors;
  if (!direct.length && !adjacent.length && !substitute.length) return null;

  const faviconOf = (u) => {
    try {
      const h = new URL(u).hostname;
      return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=64` : null;
    } catch {
      return null;
    }
  };

  // Fixed per-band fallback glyphs — path data verbatim from the mockup.
  const GLYPH = {
    direct: (
      <>
        <circle r="4.2" />
        <circle r="1" fill="#39404f" stroke="none" />
      </>
    ),
    adjacent: (
      <>
        <circle cx="-1.2" cy="-1.2" r="3.2" />
        <line x1="1.1" y1="1.1" x2="4.6" y2="4.6" />
      </>
    ),
    substitute: (
      <>
        <circle cy="-2.4" r="1.9" />
        <path d="M-3.6 4.6C-3.6 1 3.6 1 3.6 4.6" />
      </>
    ),
  };

  const band = (list, y, baseR, fill, fs, labelFill, labelDy, glyphKey) =>
    list.map((c, i) => {
      const x = 140 + (i + 1) * (800 / (list.length + 1));
      const llm = c.source === "llm";
      const r = Math.max(7, baseR + (c.importance === "high" ? 1 : 0) - (llm ? 2 : 0));
      const fav = c.url ? faviconOf(c.url) : null;
      const clipId = `tclip-${Math.round(x)}-${y}`;
      const name = c.name || "";
      const label = name.length > 18 ? name.slice(0, 17) + "…" : name;
      const labelFs = list.length > 5 ? Math.max(9.5, fs - 1.5) : fs;
      return (
        <g key={`${name || i}-${i}`} className={"tnode" + (sel === c ? " sel" : "")} onClick={() => setSel(c)}>
          {/* breathing halo — blooms at the pulse peak; steady-hidden on hover/select */}
          <circle className="thalo" cx={x} cy={y} r={r} fill="none" stroke="rgba(255,255,255,.35)" vectorEffect="non-scaling-stroke" />
          {/* the animated avatar group — the label below is OUTSIDE it and never moves */}
          <g className="tav">
          <circle cx={x} cy={y} r={r} fill={fill} fillOpacity={llm ? 0.9 : 1} filter="url(#tsoft)" />
          {fav ? (
            <>
              <defs>
                <clipPath id={clipId}>
                  <circle cx={x} cy={y} r={r * 0.62} />
                </clipPath>
              </defs>
              <image
                href={fav}
                x={x - r * 0.62}
                y={y - r * 0.62}
                width={r * 1.24}
                height={r * 1.24}
                clipPath={`url(#${clipId})`}
                pointerEvents="none"
              />
            </>
          ) : (
            <g
              transform={`translate(${x} ${y}) scale(${(r / 8).toFixed(3)})`}
              fill="none"
              stroke="#39404f"
              strokeWidth={(12 / r).toFixed(2)}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            >
              {GLYPH[glyphKey]}
            </g>
          )}
          </g>
          <text
            x={x}
            y={y + labelDy}
            textAnchor="middle"
            fontFamily="'JetBrains Mono',monospace"
            fontSize={labelFs}
            fill={labelFill}
          >
            {label}
          </text>
        </g>
      );
    });

  return (
    <div className="terrain">
      <svg
        viewBox="0 0 1000 400"
        role="img"
        aria-label="The competitive field: direct rivals, adjacent rivals, and the substitutes the buyer stands on today."
      >
        <defs>
          <pattern id="tgrid" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M46 0H0V46" fill="none" stroke="rgba(255,255,255,.045)" strokeWidth="1" />
          </pattern>
          <filter id="tsoft" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor="#000" floodOpacity=".45" />
          </filter>
        </defs>
        <rect x="20" y="48" width="960" height="312" fill="url(#tgrid)" />
        {direct.length > 0 && (
          <>
            <text x="30" y="99" fontFamily="'JetBrains Mono',monospace" fontSize="10" letterSpacing="1.5" fill="#4a5160">DIRECT</text>
            {band(direct, 95, 14, "#d3d8e2", 12, "#eceff5", 34, "direct")}
          </>
        )}
        {adjacent.length > 0 && (
          <>
            <text x="30" y="211" fontFamily="'JetBrains Mono',monospace" fontSize="10" letterSpacing="1.5" fill="#4a5160">ADJACENT</text>
            {band(adjacent, 205, 9, "#c4cbd6", 10.5, "#9aa3b4", 27, "adjacent")}
          </>
        )}
        {substitute.length > 0 && (
          <>
            <text x="60" y="322" fontFamily="'JetBrains Mono',monospace" fontSize="9.5" letterSpacing="1.2" fill="#6b7280">
              WHAT THE BUYER STANDS ON TODAY
            </text>
            <line x1="40" y1="345" x2="960" y2="345" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
            {band(substitute, 345, 10, "#9aa3b4", 10, "#6b7280", 28, "substitute")}
          </>
        )}
        {/* Wall layer — exact mockup paths/colors/labels. Renders only the
            walls whose metric committed, and only when the baseline exists
            for them to land on. */}
        {substitute.length > 0 && field.walls && (
          <>
            {field.walls.demand && (
              <>
                <path d="M300 34 C312 180 292 250 300 328" fill="none" stroke="#46c79a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".42" />
                <text x="300" y="24" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="10" fill="#46c79a" opacity=".8">demand wall</text>
              </>
            )}
            {field.walls.payment && (
              <>
                <path d="M500 34 C505 180 500 250 500 328" fill="none" stroke="#5b8def" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".42" />
                <text x="500" y="24" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="10" fill="#5b8def" opacity=".8">payment wall</text>
              </>
            )}
            {field.walls.position && (
              <>
                <path d="M700 34 C688 180 708 250 700 328" fill="none" stroke="#8a82c2" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".42" />
                <text x="700" y="24" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="10" fill="#8a82c2" opacity=".8">position wall</text>
              </>
            )}
          </>
        )}
      </svg>
      <div className="tinspect">
        {sel ? (
          <>
            {/* avatar echo — the exact favicon the terrain node shows, via the
                same resolver; initial-letter fallback when no url is committed */}
            <span className="aav" aria-hidden="true">
              {sel.url && faviconOf(sel.url) ? (
                <img src={faviconOf(sel.url)} alt="" />
              ) : (
                <span>{(sel.name || "?").trim().charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="anm">{sel.name}</span>
            <span className="aty">
              {[
                sel.type,
                sel.source === "llm" ? "AI-identified" : sel.source ? "verified competitor" : null,
                sel.status || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {(sel.take || sel.description || sel.note) && (
              <p className="atake">
                {sel.take || sel.description || sel.note}
                {sel.url && (
                  <>
                    {" "}
                    <a
                      href={sel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: "var(--mono)", fontSize: 11 }}
                    >
                      Visit →
                    </a>
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <div className="empty">
            Select any actor to inspect what the evidence says — its read and its source class.
          </div>
        )}
      </div>
    </div>
  );
}

/* ── The risk ledger — one flat schedule, all three threat agents, closing
   movement III (risks-ledger-final.html, approved July 19). Committed array
   order, never re-sorted; the number is a count, not a rank. Slot labels are
   DISPLAY VOCABULARY quoted from B1's own threat-agent definitions ("market
   structure" / "what BUYERS do" / "the founder profile") — not authored, and
   never per-slot colored (slot->metric mapping is not committed; hue would
   paint it). The archetype enum never renders. No folds: the whole committed
   text always shows; lead/cont is typographic two-tone only. One global
   footnote replaces any founder-only disclaimer — all rows share the
   post-scoring property. */
const RISK_SLOT_LABEL = {
  market_category: "MARKET STRUCTURE",
  trust_adoption: "BUYER BEHAVIOR",
  founder_fit: "FOUNDER PROFILE",
};

function RiskLedger({ risks, competitors }) {
  if (!risks || !risks.hasAny) return null;
  return (
    <>
      <div className="rk-head">
        <span className="rk-title">What could break this</span>
        <span className="rk-tag">NAMED FAILURE RISKS · AI-GENERATED</span>
      </div>
      <div className="rledger">
        {risks.all.map((r) => (
          <div className="rrow" key={`${r.slot || "none"}:${r.idx}`}>
            <div className="rrail">
              <div className="no">RISK {String(r.idx + 1).padStart(2, "0")}</div>
              {RISK_SLOT_LABEL[r.slot] && <div className="slot">{RISK_SLOT_LABEL[r.slot]}</div>}
            </div>
            <div className="rprose">
              <p className="lead"><Linked text={r.lead} competitors={competitors} /></p>
              {r.rest && <p className="cont"><Linked text={r.rest} competitors={competitors} /></p>}
            </div>
          </div>
        ))}
      </div>
      <p className="rfoot">READ FROM THE SAME EVIDENCE, AFTER SCORING. NO RISK MOVES ANY SCORE.</p>
    </>
  );
}

function MvField({ field, risks, competitors }) {
  const { direct, substitute, all } = field.competitors;
  const hasRisks = risks && risks.hasAny;
  if (!all.length && !field.position && !hasRisks) return null;

  return (
    <section id="mv-3" data-movement="field">
      <div className="sx">
        <span className="num">03</span><h2>The field</h2>
        <span className="line" />
        <span className="tag">AI-GENERATED · DIRECTIONAL GUIDE</span>
      </div>

      {field.position && field.position.headline && (
        <h3 className="field-h3">{field.position.headline}</h3>
      )}

      {/* The OVERLAP / YOU WIN / EXPOSED tri-split. The mockup tagged these
          UNMAPPED and the first handoff called them impossible — both wrong:
          Stage 2c commits all three as separate ≤14-word cells (A13), and
          every object-shaped row in production carries all four keys. Each
          cell renders only if committed; nothing is authored here. */}
      {field.position &&
        (field.position.overlap || field.position.youWin || field.position.exposed) && (
          <div className="freads3">
            {field.position.overlap && (
              <div>
                <div className="k" style={{ color: "var(--or)" }}>◫ OVERLAP</div>
                <p><Linked text={field.position.overlap} competitors={competitors} /></p>
              </div>
            )}
            {field.position.youWin && (
              <div>
                <div className="k" style={{ color: "var(--md)" }}>↳ YOU WIN</div>
                <p><Linked text={field.position.youWin} competitors={competitors} /></p>
              </div>
            )}
            {field.position.exposed && (
              <div>
                <div className="k" style={{ color: "var(--amber)" }}>↔ EXPOSED</div>
                <p><Linked text={field.position.exposed} competitors={competitors} /></p>
              </div>
            )}
          </div>
        )}

      <Terrain field={field} />

      {/* DIRECT band omitted, not drawn empty — and the honest line about who
          the rival actually is when no direct competitor was identified. */}
      {!direct.length && substitute.length > 0 && (
        <p className="fdegrade">
          No direct rival was identified. What this competes with is the buyer's current
          behaviour — <Linked text={substitute.map((c) => c.name).filter(Boolean).join(", ")} competitors={competitors} />.
        </p>
      )}
      {!all.length && (
        <p className="fdegrade">No competitor evidence was retrieved for this read.</p>
      )}

      {/* The movement closes on the ledger — all three threat agents in one
          schedule, then IV opens clean. */}
      <RiskLedger risks={risks} competitors={competitors} />
    </section>
  );
}

/* ======================================================== IV · BUILD REALITY */

function MvBuild({ build, wt, onWt }) {
  const b = build;

  const beats = [];
  // The design names the score in the first beat ("WHY THE BUILD IS AN 8.0").
  // Deterministic interpolation of the committed effective score; falls back
  // to the generic header when the score is absent. Article by leading digit:
  // only 8 takes "an" in the 1–10 range.
  const effStr = b.effective !== null && b.effective !== undefined ? num(b.effective) : null;
  const art = effStr && /^8/.test(effStr) ? "an" : "a";
  if (b.beats.whyThisScore)
    beats.push({
      id: "bs-why",
      k: effStr ? `WHY THE BUILD IS ${art.toUpperCase()} ${effStr}` : "WHY THE BUILD SCORES HERE",
      t: effStr ? `Why the build is ${art} ${effStr}` : "Why the build scores here",
      body: b.beats.whyThisScore, aside: b.beats.adjustmentReason,
    });
  if (b.beats.blocker)
    beats.push({
      id: "bs-blocker", k: "WHAT THE BLOCKER ACTUALLY IS", t: "What the blocker actually is",
      body: b.beats.blocker,
    });
  if (b.relationship !== "indeterminate")
    beats.push({
      id: "bs-rel",
      k: b.relationship === "same" ? "WHY BURDEN AND BLOCKER ARE ONE WALL" : "WHY THE BUILD IS NOT THE WALL",
      t: b.relationship === "same" ? "Why burden and blocker are one wall" : "Why the build is not the wall",
      rel: true,
    });
  if (b.beats.clearing || b.beats.profile || b.beats.timeline)
    beats.push({ id: "bs-clear", k: "WHAT IT TAKES TO CLEAR IT", t: "What it takes to clear it", clears: true });
  if (b.branch)
    beats.push({ id: "bs-branch", k: "A SIMPLER FIRST VERSION", t: "A simpler first version", branch: true, alt: true });

  // FIX PASS July 19 (approved: deep-fixpass-mockup.html, fix 3): one beat
  // shown at a time, the pointer drives it. Hover switches the pane in place
  // and the counter follows; click PINS (same affordance serves touch and
  // keyboard), hovering while pinned does nothing until released. Scroll-spy
  // removed here — II's finding selector keeps its own. Beat ids stay on the
  // pane so nothing external that targets them breaks; the .doors decision
  // is not being made here.
  const [activeIdx, setActiveIdx] = useState(0);
  const [pinnedIdx, setPinnedIdx] = useState(null);
  const shown = beats[Math.min(activeIdx, Math.max(beats.length - 1, 0))];

  return (
    <section id="mv-4" data-movement="build">
      <div className="sx">
        <span className="num">04</span><h2>Build reality</h2>
        <span className="line" />
        <span className="tag">EXECUTION CONTEXT · NOT IN THE READ'S NUMBER</span>
      </div>

      <div className="br">
        <div className="br-head">
          <div className="br-fact">
            <div className="br-fk">
              TECHNICAL COMPLEXITY <span className="ext">BURDEN</span>
              {/* WT-MOUNT technical_complexity — home undecided (IV merges the TC
                  readout and the bottleneck into one object; two anchors, one host).
                  <ChangeMarker bundle={wt && wt.technical_complexity} onOpen={onWt} title="Technical Complexity re-read" /> */}
            </div>
            {/* The design's .brf-num is a composite: 50px .v + a .tier
                annotation. A flat span matched neither child rule, so the
                number rendered at body size. The tier is the committed
                est.difficulty (nulled upstream in Specification mode) —
                lowercased into the design's register, not authored. */}
            <div className="brf-num">
              <span className="v">{num(b.effective)}</span>
              {b.difficulty && <span className="tier">{b.difficulty.toLowerCase()} tier</span>}
            </div>
            {/* Profile absent must never render as "− 0". And UNKNOWN must not
                render as absent: when the field was never measured we show the
                arithmetic without characterising the founder either way. */}
            <div className="breq">
              {b.profileState === "unknown" ? (
                <>
                  <b>{num(b.effective)}</b> effective difficulty
                </>
              ) : b.profileState === "absent" ? (
                <span style={{ color: "var(--amber)" }}>
                  founder-relative adjustment unavailable — base difficulty shown without
                  personal calibration
                </span>
              ) : (
                <>
                  <b>{num(b.base)}</b> base <span className="op">−</span>{" "}
                  <b>{b.adjustment === null ? "—" : Math.abs(b.adjustment)}</b> founder adj{" "}
                  <span className="op">=</span> <b>{num(b.effective)}</b> effective
                </>
              )}
            </div>
          </div>

          <div className="br-fact">
            <div className="br-fk">
              WHAT STOPS PROGRESS FIRST
              {/* Deterministic: TECHNICAL only when the bottleneck IS the
                  build (relationship "same"). No chip otherwise — naming a
                  class for the seven external walls would invent vocabulary
                  the engine does not commit. */}
              {b.relationship === "same" && <span className="ext">TECHNICAL</span>}
              {/* WT-MOUNT mb — see note above.
                  <ChangeMarker bundle={wt && wt.mb} onOpen={onWt} title="The binding constraint re-read" /> */}
            </div>
            <div className="brf-big">{b.bottleneck || "—"}</div>
            {/* Specification mode: the engine emits no numbers. Do not invent chips. */}
            {/* difficulty moved up to the .tier slot beside the number —
                the design's position for it. The meta line keeps the duration
                (prefixed est. — it is one) and the enum-space line. */}
            {!b.specification && b.duration && (
              <div className="brf-meta">
                est. {b.duration} · one of eight blocker types
              </div>
            )}
          </div>
        </div>

        {b.specification ? (
          <p className="spec">
            {b.bottleneckExplanation ||
              "The idea is not specified enough to estimate a build. Refine the target user, the workflow, or the core mechanism."}
          </p>
        ) : (
          <>
            {b.relationship !== "indeterminate" && (
              <div className="br-verdict">
                <span className="br-vchip">
                  {b.relationship === "same" ? "SAME WALL" : "DIFFERENT WALLS"}
                </span>
                <span className="br-vtxt">
                  {b.relationship === "same"
                    ? "The bottleneck sits inside the technical burden."
                    : "The bottleneck sits beside the build — the build is not what stops you first."}
                </span>
              </div>
            )}
            <div className="br-excl">
              TC is excluded from the overall score — it measures effort, not whether the idea
              is worth building.
            </div>

            {beats.length > 0 && (
              <div className="brsteps">
                <div className="bs-nav">
                  <div className="bs-nk">
                    THE REASONING · {["ONE","TWO","THREE","FOUR","FIVE"][beats.length - 1] || beats.length} BEAT{beats.length === 1 ? "" : "S"}
                  </div>
                  <div className="bs-list">
                    {beats.map((x, i) => (
                      <button
                        key={x.id}
                        className={`bs-item${x.alt ? " alt" : ""}${i === activeIdx ? " on" : ""}${i === pinnedIdx ? " pinned" : ""}`}
                        aria-pressed={i === pinnedIdx}
                        onMouseEnter={() => { if (pinnedIdx === null) setActiveIdx(i); }}
                        onClick={() => {
                          if (pinnedIdx === i) { setPinnedIdx(null); }
                          else { setPinnedIdx(i); setActiveIdx(i); }
                        }}
                      >
                        <span className="n">{String(i + 1).padStart(2, "0")}</span>
                        <span className="t">{x.t}</span>
                      </button>
                    ))}
                  </div>
                  <div className="bs-hint">
                    {pinnedIdx === null ? "HOVER TO READ · CLICK TO PIN" : "PINNED — CLICK AGAIN TO RELEASE"}
                  </div>
                </div>

                <div className="bs-pane">
                  {[shown].filter(Boolean).map((x) => {
                    const i = activeIdx;
                    return (
                    <div className="bs-panel" id={x.id} key={x.id}>
                      <div className={`bk${x.alt ? " amber" : ""}`}>
                        {x.k} <span className="step">· {i + 1} / {beats.length}</span>
                      </div>

                      {x.body && <p className="bp">{x.body}</p>}
                      {x.aside && <div className="baside">{x.aside}</div>}

                      {x.rel && (
                        <>
                          <p className="bp">
                            {b.relationship === "same"
                              ? "The bottleneck is technical, so it names the same layer the effective difficulty is built from. Had it been external — buyer access, compliance, distribution — it would sit beside the burden, and the honest line would be that the build is not what stops you first."
                              : `The bottleneck is ${b.bottleneck}, which sits beside the technical burden rather than inside it. The build is real work, but it is not the first thing that stops progress.`}
                          </p>
                          {/* is_close_call false => no duel is drawn at all */}
                          {b.closeCall && (
                            <div className="cc2">
                              <div className="ccl">CLOSE CALL — TWO WALLS CONTENDED</div>
                              <div className="cc">
                                <div className="cc-n">{b.bottleneck}</div>
                                <div className="cc-s" style={{ color: "var(--build)" }}>SELECTED</div>
                              </div>
                              <div className="cc">
                                <div className="cc-n">{b.closeCall.runnerUp}</div>
                                <div className="cc-s" style={{ color: "var(--mut)" }}>EDGED OUT</div>
                                {/* Unlike II's subordinate card, this rationale IS committed. */}
                                {b.closeCall.rationale && <p className="cc-p">{b.closeCall.rationale}</p>}
                              </div>
                              {b.closeCall.tippingSignal && (
                                <div className="cc-tip">
                                  <b>The tiebreaker:</b> {b.closeCall.tippingSignal}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {x.clears && (
                        <div className="clears">
                          {b.beats.clearing && (
                            <div className="clear">
                              <div className="cq">what clearing it takes</div>
                              <div className="ca">{b.beats.clearing}</div>
                            </div>
                          )}
                          {b.beats.profile && (
                            <div className="clear">
                              <div className="cq">how your profile changes it</div>
                              <div className="ca">{b.beats.profile}</div>
                            </div>
                          )}
                          {b.beats.timeline && (
                            <div className="clear">
                              <div className="cq">why this timeline</div>
                              <div className="ca">{b.beats.timeline}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {x.branch && (
                        <div className="branchbox">
                          <div className="branch-k">
                            A CUT THAT REMOVES THE WALL · branches off technical complexity
                          </div>
                          <p style={{ margin: 0 }}>{b.branch}</p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* degrade: no per-beat fields (older saves) -> the joined paragraph */}
            {beats.length === 0 && b.beats.joined && <p className="spec">{b.beats.joined}</p>}
          </>
        )}
      </div>
    </section>
  );
}

/* ============================================================= V · THE HINGE */
/* THE HYBRID SYSTEM — one grammar, intensity varies with the state.

   The graphic never branches on `state`: `single` can hold a SOLO door
   (fact/body exactly null), and a {1,1,1} partition becomes `clustered`
   the moment the wall joins one door. What the drawing keys on is
   doors.length and per-door `merged` (precomputed in deepPayload from the
   contract's own predicate). The same idea can commit single one run and
   clustered the next - the visual language must not change between states,
   only its intensity, or a re-run reads as a redesign.

   NODE TREATMENT (transcribed from Deep_v5 Render A): member curves FUSE
   at the door - the fusion is the drawing of the claim - into a soft halo
   disc + dashed amber ring + bright dot, label beneath, never text inside
   the shape. Solo doors are termini: colored stem into a grey bar. A ring
   means two or more members entered it; nothing else ever gets one.

   PROSE distinguishes what the graphic cannot: a validated all-solo
   mapping is a POSITIVE commitment (no shared causal door) - not the
   absence of one. Headlines are fixed strings keyed on counts; numbers
   substitute mechanically, words never do. Amber italic carries only the
   causal claim - committed-distributed has no amber anywhere, which is
   itself information. Distributed claims no shared door - NOT resolution
   order. Insufficient claims the MAP is unsupported - not that the
   directions are absent (LOW forces insufficient over directions that
   exist).
   VERB DISCIPLINE (July 19, 2026): findings "OPEN ON" a shared fact —
   the contract's own verb (hinge.js: "these waits open on the same
   fact"). Never "wait on": a direction may be disjunctive (an OR route),
   so waiting-on overclaims necessity; the commitment is that the fact
   would move the finding, not that nothing else could. The BUILD alone
   may "wait on" — main_bottleneck is committed as the singular first
   blocker, no disjunction exists. Not "could move" either: hedge
   vocabulary. This page states or refuses; it does not hedge. */

const HZ_ORDER = ["market_demand", "monetization", "originality"];
const HZ_WORD = { 1: "one", 2: "two", 3: "three" };
const hzWord = (n) => HZ_WORD[n] || String(n);
const hzCap = (w) => w.replace(/^./, (c) => c.toUpperCase());
const GAP_LABEL = { market_demand: "demand gap", monetization: "payment gap", originality: "position gap" };

function hingeCopy({ k, merged, wallJoins, metricCount }) {
  if (merged > 0) {
    if (k === 1) {
      return wallJoins
        ? {
            head: <>One fact carries {hzWord(metricCount)} findings — <em>and the build.</em></>,
            sub: null,
          }
        : {
            head: <>One fact carries <em>all {hzWord(metricCount)} findings.</em></>,
            sub: null,
          };
    }
    if (merged >= 2) {
      return {
        head: <>{hzCap(hzWord(k))} doors — <em>each carries more than one wait.</em></>,
        sub: null,
      };
    }
    // exactly one merged door among several
    if (wallJoins && k >= 3) {
      return {
        head: <>{hzCap(hzWord(k))} separate doors — <em>the build waits on one of them.</em></>,
        sub: null,
      };
    }
    if (wallJoins) {
      return {
        head: <>{hzCap(hzWord(metricCount - 1))} findings <em>and the build</em> open on the same missing fact.</>,
        sub: null,
      };
    }
    return {
      head: <>{hzCap(hzWord(2))} findings open on <em>the same missing fact.</em> {k === 2 ? "One stands" : `${hzCap(hzWord(k - 1))} stand`} apart.</>,
      sub: null,
    };
  }
  // zero rings, k doors: committed distribution (or a lone solo door)
  if (k > 1) {
    return {
      head: <>{hzCap(hzWord(k))} requirements, no shared causal door.</>,
      sub: "This read finds no single fact that would move more than one finding.",
    };
  }
  return {
    head: <>One finding, one gap — <em>its own next threshold.</em></>,
    sub: null,
  };
}

/* ---- the collect: fused curves into Render-A nodes -------------------- */
const HZ_W = 860;

function HingeCollect({ doors, wallJoinsDoor, wallLabel }) {
  const metrics = HZ_ORDER.filter((key) => doors.some((d) => d.metricWaits.includes(key)));
  const hasWall = !!wallJoinsDoor;
  const originCount = metrics.length + (hasWall ? 1 : 0);
  if (!originCount) return null;

  const anyMerged = doors.some((d) => d.merged);
  const NODE_Y = anyMerged ? 178 : 130;
  const H = anyMerged ? 268 : 190;
  const ox = (i) => (HZ_W * (i + 1)) / (originCount + 1);
  const nx = (j) => (HZ_W * (j + 1)) / (doors.length + 1);

  // Fused arrival: every member curve of a merged door ends at (almost) the
  // same point just above the ring - the strands visibly meet, which is the
  // Render A read. Solo curves end above their terminal bar.
  const path = (originX, doorX, doorMerged, strand) => {
    const endY = doorMerged ? NODE_Y - 24 : NODE_Y - 12;
    const ex = doorMerged ? doorX + strand * 3 : doorX;
    const d = endY - 46;
    return `M${originX.toFixed(1)} 46 C${originX.toFixed(1)} ${(46 + d * 0.55).toFixed(1)}, ${ex.toFixed(1)} ${(endY - d * 0.4).toFixed(1)}, ${ex.toFixed(1)} ${endY.toFixed(1)}`;
  };

  const doorIx = (id) => doors.findIndex((d) => d.id === id);
  const doorOfMetric = (key) => doors.findIndex((d) => d.metricWaits.includes(key));

  // Strand offsets so fused curves read as strands, not one line: spread the
  // members of each door across [-1, 0, 1].
  const strandOf = {};
  doors.forEach((d, j) => {
    const members = [...d.metricWaits];
    if (wallJoinsDoor === d.id) members.push("__wall__");
    members.forEach((m, i) => {
      strandOf[`${j}:${m}`] = i - (members.length - 1) / 2;
    });
  });

  const mergedCount = doors.filter((d) => d.merged).length;
  const aria =
    `${doors.length} ${doors.length === 1 ? "door" : "doors"}, ` +
    (mergedCount === 0 ? "none shared" : `${mergedCount} shared`) +
    (hasWall ? `, the build joining one` : "");

  return (
    <div className="collect">
      <svg viewBox={`0 0 ${HZ_W} ${H}`} role="img" aria-label={aria}>
        <title>How the gaps relate</title>

        {/* build curve first - beneath the metric curves; a left-door join
            crosses them and the crossing is drawn, not reordered away */}
        {hasWall && doorIx(wallJoinsDoor) >= 0 && (
          <path
            d={path(ox(metrics.length), nx(doorIx(wallJoinsDoor)), true, strandOf[`${doorIx(wallJoinsDoor)}:__wall__`] || 0)}
            fill="none" stroke="var(--build)" strokeWidth="1.5" opacity="0.85"
          />
        )}

        {metrics.map((key, i) => {
          const j = doorOfMetric(key);
          if (j < 0) return null;
          return (
            <path key={`c-${key}`}
              d={path(ox(i), nx(j), doors[j].merged, strandOf[`${j}:${key}`] || 0)}
              fill="none" stroke={MC[key]} strokeWidth="1.5" opacity="0.9"
            />
          );
        })}

        {metrics.map((key, i) => (
          <text key={`o-${key}`} x={ox(i).toFixed(1)} y="30" textAnchor="middle"
            fontFamily="'JetBrains Mono',monospace" fontSize="12" letterSpacing="0.04em" fill={MC[key]}>
            {GAP_LABEL[key]}
          </text>
        ))}
        {hasWall && (
          <text x={ox(metrics.length).toFixed(1)} y="30" textAnchor="middle"
            fontFamily="'JetBrains Mono',monospace" fontSize="12" letterSpacing="0.04em" fill="var(--build)">
            {(wallLabel || "the build").toLowerCase()}
          </text>
        )}

        {doors.map((d, j) => {
          const x = nx(j);
          const soloColor = d.members.length === 1 ? MC[d.members[0].origin] : "var(--mut)";
          const waits = d.metricWaits.length + (wallJoinsDoor === d.id ? 1 : 0);
          return (
            <g key={`n-${d.id}`}>
              {d.merged ? (
                <>
                  {/* Render A node: halo disc + dashed ring + bright dot.
                      Text never enters the shape - the fact lives in the
                      dossier, said once. */}
                  <circle cx={x.toFixed(1)} cy={NODE_Y} r="46" fill="rgba(236,239,245,.03)" />
                  <circle cx={x.toFixed(1)} cy={NODE_Y} r="20" fill="none"
                    stroke="var(--amber)" strokeWidth="1.6" strokeDasharray="5 5" />
                  <circle cx={x.toFixed(1)} cy={NODE_Y} r="5" fill="#eceff5" />
                  <text x={x.toFixed(1)} y={NODE_Y + 74} textAnchor="middle"
                    fontFamily="'JetBrains Mono',monospace" fontSize="13" letterSpacing="0.12em" fill="var(--text)">
                    {d.label}
                  </text>
                  <text x={x.toFixed(1)} y={NODE_Y + 92} textAnchor="middle"
                    fontFamily="'JetBrains Mono',monospace" fontSize="10" fill="var(--mut)">
                    {waits} waits · one door
                  </text>
                </>
              ) : (
                <>
                  <line x1={x.toFixed(1)} y1={NODE_Y - 12} x2={x.toFixed(1)} y2={NODE_Y - 2}
                    stroke={soloColor} strokeWidth="1.5" opacity="0.9" />
                  <line x1={(x - 22).toFixed(1)} y1={NODE_Y} x2={(x + 22).toFixed(1)} y2={NODE_Y}
                    stroke={soloColor} strokeWidth="2.5" />
                  <text x={x.toFixed(1)} y={NODE_Y + 24} textAnchor="middle"
                    fontFamily="'JetBrains Mono',monospace" fontSize="11" fill={soloColor}>
                    {d.label}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---- the ledger: dossiers attached beneath the topology --------------- */
function HingeDossiers({ doors, wallJoinsDoor, wallLabel, competitors }) {
  const cols =
    doors.length === 1 ? "minmax(0,1fr)"
    : doors.length === 2 && doors.some((d) => d.merged) && !doors.every((d) => d.merged)
      ? (doors[0].merged ? "2fr 1fr" : "1fr 2fr")
      : `repeat(${doors.length}, minmax(0,1fr))`;

  return (
    <div className="hzgrid" style={{ gridTemplateColumns: cols }}>
      {doors.map((d) => {
        const soloColor = d.members.length === 1 ? MC[d.members[0].origin] : "var(--mut)";
        return (
          <div key={d.id}
            className={"hzcard" + (d.merged ? "" : " solo")}
            style={{ borderTopColor: d.merged ? "var(--amber)" : soloColor }}>
            <div className="dk">{d.merged ? d.label : d.label}</div>
            <div className="hzchips">
              {d.members.map((m) => (
                <span key={m.origin} className="hzchip"
                  style={{ color: MC[m.origin], borderColor: MC[m.origin] }}>
                  {NAME[m.origin].toUpperCase()}
                  {m.rung ? ` · RUNG ${m.rung.n}${d.merged ? "" : ` → ${Math.min(m.rung.n + 1, m.rung.of)}`}` : ""}
                </span>
              ))}
              {wallJoinsDoor === d.id && (
                <span className="hzchip" style={{ color: "var(--build)", borderColor: "var(--build)" }}>
                  {(wallLabel || "THE BUILD").toUpperCase()}
                </span>
              )}
            </div>
            {d.merged ? (
              <>
                <div className="hzfact"><Linked text={d.fact} competitors={competitors} /></div>
                {d.body && <div className="hzbody"><Linked text={d.body} competitors={competitors} /></div>}
              </>
            ) : (
              /* Solo doors: fact and body are exactly null by contract. The
                 scorer owns this text; it renders verbatim, never restated. */
              <div className="hzreq">{d.members.length ? <Linked text={d.members[0].requirement} competitors={competitors} /> : null}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HingeTouch({ hinge }) {
  const mergedMembers = (hinge.doors || [])
    .filter((d) => d.merged)
    .flatMap((d) => d.members);
  return (
    <div className="touch">
      {mergedMembers.length > 0 ? (
        <>
          <span className="lbl">RESOLVING IT TOUCHES</span>
          {mergedMembers.map((m) => (
            <span key={m.origin} style={{ color: MC[m.origin] }}>
              <b>{SHORT_LABEL[m.origin]}</b>
              {m.rung ? ` · rung ${m.rung.n}` : ""}
            </span>
          ))}
        </>
      ) : (
        <span className="lbl">WHAT WOULD MOVE EACH</span>
      )}
      {!hinge.wallJoinsDoor && hinge.wallLabel && (
        <span style={{ color: "var(--build)" }}>
          {hinge.wallLabel} — stands apart · in Build Reality
        </span>
      )}
    </div>
  );
}

function HingeShell({ children }) {
  return (
    <section id="mv-5" data-movement="hinge">
      <div className="sx"><span className="num">05</span><h2>The hinge</h2><span className="line" /></div>
      <div className="hinge">{children}</div>
    </section>
  );
}

function MvHinge({ hinge, competitors }) {
  // INSUFFICIENT FIRST, ABOVE ANY GAP GUARD - it is forced under LOW
  // evidence / Specification, exactly where scorers may commit no
  // direction, so an early `!gaps.length` return would delete the refusal
  // in the population it was written for. Rendered as an audit of what the
  // map needs: unresolved, not failed - and it claims the MAP, never that
  // the directions are absent.
  if (hinge.insufficient) {
    return (
      <HingeShell>
        <p className="hserif">The current evidence cannot support <em>a dependency map.</em></p>
        <div className="hzaudit">
          <div className="row"><span className="k">Requirement specificity</span><span className="v">unresolved</span></div>
          <div className="row"><span className="k">Causal dependency</span><span className="v">unresolved</span></div>
          <div className="row"><span className="k">Wall relation</span><span className="v">unresolved</span></div>
        </div>
        <p className="hzsub">
          Mapping how the gaps relate needs evidence this read does not have. Committing
          nothing here is the map being honest — not the map failing.
        </p>
        <p className="hclose">
          The read stops here. The facts are checkable — and the next move is yours to make.
        </p>
      </HingeShell>
    );
  }

  if (!hinge.doors || !hinge.doors.length) {
    if (!hinge.gaps.length) return null;

    // UNCOMMITTED - the debt state, byte-preserved. Not a distributed claim
    // in either direction: "none of them resolves another" would itself BE
    // a commitment, and this payload carries none.
    const n = hinge.gaps.length;
    return (
      <HingeShell>
        <p className="hserif">
          {n} {n === 1 ? "finding" : "findings"}, {n} {n === 1 ? "gap" : "gaps"} — each one
          checkable on its own.
        </p>
        <p className="hsub" style={{ margin: "0 auto", textAlign: "center" }}>
          Each gap below names the evidence that would move its own finding. Whether they
          converge on a single fact is not something this read commits.
        </p>
        <div style={{ margin: "22px 0" }}>
          {hinge.gaps.map((g) => (
            <div className="hgap" key={g.origin} style={{ "--mc": MC[g.origin] }}>
              <div className="gk">
                {NAME[g.origin]}
                {g.rung ? ` · rung ${g.rung.n} → ${Math.min(g.rung.n + 1, g.rung.of)}` : ""}
              </div>
              <div className="gv">{g.requirement}</div>
            </div>
          ))}
        </div>
        <p className="hclose">
          The read stops here. The facts are checkable — and the next move is yours to make.
        </p>
      </HingeShell>
    );
  }

  // MAPPED - one grammar. Copy keys on counts, never on `state`.
  const k = hinge.doors.length;
  const merged = hinge.mergedCount;
  const metricCount = hinge.doors.reduce((n, d) => n + d.metricWaits.length, 0);
  const { head, sub } = hingeCopy({
    k, merged, wallJoins: !!hinge.wallJoinsDoor, metricCount,
  });

  return (
    <HingeShell>
      <p className="hserif">{head}</p>
      {sub && <p className="hzsub">{sub}</p>}
      {merged > 0 && (
        <HingeCollect
          doors={hinge.doors}
          wallJoinsDoor={hinge.wallJoinsDoor}
          wallLabel={hinge.wallLabel}
          competitors={competitors}
        />
      )}
      <HingeDossiers
        doors={hinge.doors}
        wallJoinsDoor={hinge.wallJoinsDoor}
        wallLabel={hinge.wallLabel}
        competitors={competitors}
      />
      <HingeTouch hinge={hinge} />
      <p className="hclose">
        The read stops here. The facts are checkable — and the next move is yours to make.
      </p>
    </HingeShell>
  );
}

/* ============================================================ edge navigator =
   Right-edge movement rail (edge-navigator-mockup.html, approved July 20).
   Third consumer of useScrollSpy — same observer pattern as II's navrail and
   IV's beat index. Clicking scrolls; observation highlights. Labels are the
   sections' own data-movement names, uppercased; nothing here is invented.
   The rail renders only sections that exist: MvHinge can return null (a
   payload with no doors AND no gaps — pre-direction saves), and a rail item
   pointing at an absent section would be a false affordance. `showHinge`
   mirrors MvHinge's own render condition exactly, so the two cannot drift. */
const MOVEMENTS = [
  { id: "mv-1", label: "READ" },
  { id: "mv-2", label: "FINDINGS" },
  { id: "mv-3", label: "FIELD" },
  { id: "mv-4", label: "BUILD" },
  { id: "mv-5", label: "HINGE" },
];

function EdgeNav({ showHinge }) {
  const items = showHinge ? MOVEMENTS : MOVEMENTS.filter((m) => m.id !== "mv-5");
  const active = useScrollSpy(items.map((m) => m.id));
  return (
    <nav className="enav" aria-label="Movements">
      {items.map((m) => (
        <a
          key={m.id}
          href={`#${m.id}`}
          aria-current={active === m.id ? "true" : "false"}
          onClick={(e) => {
            e.preventDefault();
            scrollToId(m.id);
          }}
        >
          <span className="lbl">{m.label}</span>
          <span className="tick" />
        </a>
      ))}
    </nav>
  );
}

/* ================================================================== export = */
export default function DeepAnalysis({
  analysis,
  readHistory = [],
  profileContext,
  t,
  wt,
  onWt,
  onScoreGuide,
}) {

  const model = useMemo(
    () => normalizeDeep(analysis, { readHistory, profileContext }),
    [analysis, readHistory, profileContext]
  );

  if (!model) return null;

  const jumpToFinding = (key) => scrollToId(`rp-${SHORT[key]}`);

  // Mirrors MvHinge's render condition byte-for-byte: insufficient renders,
  // doors render, a bare gap schedule renders — only the no-doors-AND-no-gaps
  // payload returns null, and then the rail must not offer the section.
  const showHinge =
    model.hinge.insufficient ||
    (model.hinge.doors && model.hinge.doors.length > 0) ||
    model.hinge.gaps.length > 0;

  return (
    <div className="ilc-deep">
      <style>{CSS}</style>

      <EdgeNav showHinge={showHinge} />
      <div className="nx">
        <MvRead
          read={model.read}
          findings={model.findings}
          onJump={jumpToFinding}
          onScoreGuide={onScoreGuide}
          wt={wt}
          onWt={onWt}
        />
        <MvLands findings={model.findings} competitors={model.competitors} />
        <MvField field={model.field} risks={model.risks} competitors={model.competitors} />
        <MvBuild build={model.build} wt={wt} onWt={onWt} />
        <MvHinge hinge={model.hinge} competitors={model.competitors} />
      </div>
    </div>
  );
}