// src/app/DeepEvolveView.js
//
// THE DEEP "EVOLVE" (re-evaluate) INPUT SCREEN — ported from the approved mockup
// `deep-reeval-final.html`. Replaces the old 3-field re-eval screen. Content-only:
// mount inside <DashboardShell> (the rail + top bar come from the shell), exactly
// like EvaluationView / ExploreView / DeepInputView.
//
// The working surface (left→right): the V1 PRESSURE briefing (verdict · strongest
// asset · binding constraint), a LINEAGE rail (the loop so far), the CENTER (the
// editable idea with inline metric-tagged clauses + a "just tell us what to change"
// freecard), and the X-RAY panel that lights up the part you click. The idea is an
// imperative contentEditable island (managed via refs — React never reconciles its
// rich content); the X-ray, the tag menus, and the freecard readout are React state.
//
// DATA CONTRACT (all optional — falls back to the mockup's demo content so the
// screen renders standalone; wired to real data in 5b):
//   metrics      { md|mo|or|tc: { name, score, color, last, win } }
//   pressure     { verdict:{score,read}, asset:{metricKey,score,desc,dir},
//                  constraint:{metricKey,score,desc,dir} }
//   lineage      [ { ver, score, note, edge?, here? } ]   (oldest→here)
//   profileLabel string   ("Beginner · Regular user AI")
//   credits      number|string
//   initialIdeaHtml  string  (tagged idea HTML for the editable region)
//   onReEvaluate(payload)    payload = { ideaText, ideaHtml, changedParts[], branchLabel, freeNote }

import React from "react";
import { ModeTitle } from "./ModeTitle";

/* ── metric + part model (mockup defaults; override via the `metrics` prop) ── */
const METRIC_DEFAULT = {
  md: { name: "Market demand", score: "6.0", color: "#6f8ff5",
    last: "Real, sustained pain — founders genuinely want an honest read and already pay people for it. Strongest axis; protect it while you fix the rest.",
    win: "Demand lifts when a specific buyer feels this as a recurring, expensive problem — not a nice-to-have. Name who, and what it costs them today." },
  mo: { name: "Monetization", score: "3.6", color: "#5fd08a",
    last: "Willingness-to-pay is plausible but unproven — the plan rides on a re-eval habit that hasn’t been demonstrated yet.",
    win: "Monetization lifts when there’s a clear payment trigger — a moment the buyer already pays for, or a budget this maps to. Tie the charge to that moment." },
  or: { name: "Originality", score: "1.9", color: "#a99cff",
    last: "Substitutable today — a single LLM prompt reproduces the core critique. The moat is a bet on compounding lineage, not yet a real source.",
    win: "Originality lifts when there’s a hard-to-copy source — data, network, or accumulation a competitor can’t clone by copying the UI." },
  tc: { name: "Technical", score: "6.5", color: "#e3c14a",
    last: "Bounded engineering, not research. The real risk is scoring-calibration stability — addressable, not open-ended.",
    win: "Technical confidence lifts when the hard part is a known, bounded build — not an open research problem. Name the riskiest piece and why it’s tractable." },
};
const PARTS = {
  target:    { label: "TARGET",    name: "Target buyer", metric: "md", q: "who it’s for" },
  problem:   { label: "PROBLEM",   name: "The problem",  metric: "md", q: "the pain it solves" },
  mechanism: { label: "MECHANISM", name: "Mechanism",    metric: "or", q: "how it works" },
  money:     { label: "MONEY",     name: "Money",        metric: "mo", q: "how it charges" },
  moat:      { label: "MOAT",      name: "Moat",         metric: "or", q: "why it holds" },
  scope:     { label: "SCOPE",     name: "Scope",        metric: "tc", q: "what it takes to build" },
};
const ORDER = ["target", "problem", "mechanism", "money", "moat", "scope"];
const metricClass = (part) => PARTS[part].metric;

// freecard "what to change" → a part (lifted verbatim from the mockup)
function interpret(t) {
  t = t.toLowerCase();
  if (/pric|charg|subscript|\bpay\b|paid|revenue|monet|credit|billing|\bcost|tier|\bplan\b|per[- ]seat|usage[- ]based/.test(t)) return "money";
  if (/moat|defens|competitor|can.?t copy|copy|lineage|network effect|accumulat|proprietary|data ?set/.test(t)) return "moat";
  if (/buyer|customer|\busers?\b|target|icp|audience|aim at|niche|segment|persona|founders?|teams?|smb|enterprise/.test(t)) return "target";
  if (/feature|mechanism|how it works|workflow|engine|capabilit|function|approach/.test(t)) return "mechanism";
  if (/\bbuild|tech\b|stack|model|infra|scope|complexity|engineer|pipeline/.test(t)) return "scope";
  if (/problem|pain|friction|\bneed\b|demand|nobody wants|market for/.test(t)) return "problem";
  return null;
}

const DEFAULT_PRESSURE = {
  verdict: { score: "3.9", read: "Real founder pain — but no defensible capture." },
  asset: { metricKey: "md", score: "6.0", desc: "Founders genuinely want an honest read — they already pay people for it.", dir: "Don't break this while fixing the rest." },
  constraint: { metricKey: "or", score: "1.9", desc: "No moat — a single LLM prompt reproduces the core critique.", dir: "The floor. Most leverage is here." },
};
const DEFAULT_LINEAGE = [
  { ver: "V1", score: "2.8", note: "the original idea" },
  { ver: "V2", score: "3.4", note: "narrowed to indie founders", edge: "target_shift" },
  { ver: "V3", score: "3.9", note: "added real-friction stress test", edge: "mechanism_shift", here: true },
];

const DEFAULT_IDEA_HTML = `
<p>Okay so the core thing I keep coming back to is this. I've watched so many founders — myself included — pour three, four, six months into building something, polishing it, getting the landing page perfect, then launching to silence. Nobody wanted it. The brutal part is the signal was usually there the whole time; they just never pressure-tested the idea before falling in love with it. So I want to build a tool for <span class="dev-clz md" data-part="target">indie hackers and solo founders who have already burned months building something nobody wanted<span class="dev-chip" contenteditable="false">TARGET</span></span> — people who are now gun-shy and want a brutally honest read before they commit again.</p>
<p>The founder types in their idea, even a messy one-paragraph version, and the system <span class="dev-clz or" data-part="mechanism">stress-tests it against real market friction, live competitor density, and the actual monetization reality of the space<span class="dev-chip" contenteditable="false">MECHANISM</span></span> instead of cheerleading like every other AI tool. ChatGPT tells you your idea is amazing. A VC ghosts you. Your friends are polite. Nobody gives the unglamorous truth — the wedge is too thin, there are nine funded companies doing this already, the buyer you're imagining holds no budget. That's the gap.</p>
<p><span class="dev-clz md" data-part="problem">Every founder forum, every indie-hacker Slack, every Reddit thread is full of people posting "is this idea any good, be honest"<span class="dev-chip" contenteditable="false">PROBLEM</span></span> — the appetite for an honest second opinion is enormous and almost completely unmet today. People pay coaches hundreds of dollars for this exact gut-check, which tells you the willingness is there even if the product isn't.</p>
<p>On the money side, I'm thinking <span class="dev-clz mo" data-part="money">a monthly subscription that bundles a pool of evaluation credits, with extra credits sold à la carte during a heavy iteration phase<span class="dev-chip" contenteditable="false">MONEY</span></span>. Founders don't evaluate once — they evaluate, then think "what if I changed the pricing," "what if I dropped this feature," "what if I aimed at a different buyer," and want to run it again. So <span class="dev-clz mo" data-part="money">the billing rides on re-evaluation, because that's the behaviour that repeats<span class="dev-chip" contenteditable="false">MONEY</span></span> — the loop is the revenue, not the first run.</p>
<p>That loop is also where the defensibility lives, which is the part I'm least sure about. Anyone can wrap an LLM and ask it to critique an idea; that's a weekend project. But <span class="dev-clz or" data-part="moat">the re-evaluation loop itself — the accumulated lineage of how a founder's thinking evolved across dozens of versions, and the cross-founder pattern of which mutations led to ideas that shipped — becomes something a single competitor's prompt can't reproduce<span class="dev-chip" contenteditable="false">MOAT</span></span>. The moat isn't the critique, it's the compounding history. That's the bet, and exactly the thing I want the tool to tell me about itself.</p>
<p>Technically it's not trivial but it's bounded. It's <span class="dev-clz tc" data-part="scope">an eight-call evaluation pipeline orchestrating several Claude models — a cheaper one for sorting, a stronger one for scoring — with live retrieval from Tavily, Exa, Serper and GitHub to ground every claim in real evidence<span class="dev-chip" contenteditable="false">SCOPE</span></span>. The hard part isn't any single call; it's keeping the scoring stable and calibrated so the same idea earns roughly the same score twice. I've been through seventy versions of the engine to get there, and that calibration discipline is part of the secret sauce.</p>
<p>There's a second mode — a divergent "explore" mode that doesn't score the idea at all but widens it, surfaces adjacent angles, opens directions the founder hadn't considered. That's for the early fuzzy stage; scoring is for when you're ready to be judged. The two feed each other — explore to widen, score to converge, explore again, branch, compare. The founder lives inside that loop, and every turn should feel cheaper to reach for than the last. The core pain is real and I feel it myself every time I start something new.</p>`.trim();

// small inline arrow for the "view full" affordances (matches the deep-result pattern)
function Arrow() {
  return (<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>);
}

export default function DeepEvolveView({
  metrics,
  pressure = DEFAULT_PRESSURE,
  lineage = DEFAULT_LINEAGE,
  profileLabel = "Beginner · Regular user AI",
  credits = "9999",
  initialIdeaHtml = DEFAULT_IDEA_HTML,
  ideaLoading = false,
  onReEvaluate,
}) {
  const METRIC = { ...METRIC_DEFAULT, ...(metrics || {}) };

  const ideaRef = React.useRef(null);
  const activeElRef = React.useRef(null);   // the currently-x-rayed .dev-clz element
  const chipTargetRef = React.useRef(null); // the .dev-clz a chip menu is acting on
  const savedRangeRef = React.useRef(null); // selection range for the tag menu

  const [activePart, setActivePart] = React.useState(null);
  const [activeText, setActiveText] = React.useState("");
  const [menu, setMenu] = React.useState(null); // { kind:'chip'|'tag', x, y }
  const [free, setFree] = React.useState("");
  const [readPart, setReadPart] = React.useState(null); // freecard interpretation
  const [tooShort, setTooShort] = React.useState(false);
  const [fullPop, setFullPop] = React.useState(null); // { label, title, body, color } | null

  const clauseText = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll(".dev-chip").forEach((n) => n.remove());
    return c.textContent.trim();
  };
  const setActive = (el) => {
    if (activeElRef.current) activeElRef.current.classList.remove("active");
    activeElRef.current = el;
    el.classList.add("active");
    setActivePart(el.dataset.part);
    setActiveText(clauseText(el));
  };
  const resetActive = () => { activeElRef.current = null; setActivePart(null); setActiveText(""); };

  // idea HTML, set imperatively (React never reconciles this content). While the
  // colour pass runs the editor is blurred + locked, so we inject the plain text
  // once for the blur, then swap to the tagged HTML once when it lands. The editor
  // being locked during loading means that single swap can never eat an edit.
  const injectedRef = React.useRef(null);
  React.useEffect(() => {
    if (!ideaRef.current) return;
    if (ideaLoading) {
      if (injectedRef.current === null) { ideaRef.current.innerHTML = initialIdeaHtml; injectedRef.current = "plain"; }
      return;
    }
    if (injectedRef.current !== "ready") { ideaRef.current.innerHTML = initialIdeaHtml; injectedRef.current = "ready"; }
  }, [ideaLoading, initialIdeaHtml]);

  // wire the contentEditable: click (chip/clause), tag-on-select, keep chips atomic
  React.useEffect(() => {
    const el = ideaRef.current;
    if (!el) return;
    const onClick = (e) => {
      const chip = e.target.closest(".dev-chip");
      if (chip) {
        const r = chip.getBoundingClientRect();
        chipTargetRef.current = chip.closest(".dev-clz");
        setMenu({ kind: "chip", x: r.left, y: r.bottom + 6 });
        return;
      }
      const cl = e.target.closest(".dev-clz");
      if (cl) setActive(cl);
    };
    const onMouseDown = (e) => { if (e.target.closest(".dev-chip")) e.preventDefault(); };
    const onMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return;
        const r = sel.getRangeAt(0);
        if (!el.contains(r.commonAncestorContainer)) return;
        if (r.toString().trim().length < 3) return;
        savedRangeRef.current = r.cloneRange();
        const rect = r.getBoundingClientRect();
        setMenu({ kind: "tag", x: rect.left, y: rect.bottom + 6 });
      }, 10);
    };
    el.addEventListener("click", onClick);
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // close menus on outside click
  React.useEffect(() => {
    if (!menu) return;
    const onDown = (e) => { if (!e.target.closest(".dev-menu") && !e.target.closest(".dev-chip")) setMenu(null); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  // chip menu pick: re-tag or remove
  const chipPick = (v) => {
    const target = chipTargetRef.current;
    if (!target) return setMenu(null);
    if (v === "remove") {
      const wasActive = target === activeElRef.current;
      target.replaceWith(document.createTextNode(clauseText(target) + " "));
      if (wasActive) resetActive();
    } else {
      target.classList.remove("md", "mo", "or", "tc");
      target.classList.add(metricClass(v));
      target.dataset.part = v;
      const chip = target.querySelector(".dev-chip");
      if (chip) chip.textContent = PARTS[v].label;
      if (target === activeElRef.current) { setActivePart(v); setActiveText(clauseText(target)); }
    }
    setMenu(null);
    chipTargetRef.current = null;
  };

  // tag menu pick: wrap the saved selection in a new tagged clause
  const tagPick = (part) => {
    const range = savedRangeRef.current;
    if (!range) return setMenu(null);
    const span = document.createElement("span");
    span.className = "dev-clz " + metricClass(part);
    span.dataset.part = part;
    try { range.surroundContents(span); }
    catch (err) { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); }
    const chip = document.createElement("span");
    chip.className = "dev-chip";
    chip.contentEditable = "false";
    chip.textContent = PARTS[part].label;
    span.appendChild(chip);
    window.getSelection().removeAllRanges();
    setMenu(null);
    savedRangeRef.current = null;
    setActive(span);
  };

  // freecard live read
  const onFree = (v) => {
    setFree(v);
    const trimmed = v.trim();
    if (trimmed.length < 4) { setReadPart(null); setTooShort(false); return; }
    const part = interpret(trimmed);
    if (!part) { setReadPart(null); setTooShort(true); return; }
    setTooShort(false);
    setReadPart(part);
  };

  // collect the result for the Re-evaluate button
  const handleRun = () => {
    if (!onReEvaluate) return;
    const el = ideaRef.current;
    const ideaHtml = el ? el.innerHTML : "";
    const ideaText = el ? (el.innerText || el.textContent || "").trim() : "";
    const changedParts = el
      ? Array.from(el.querySelectorAll(".dev-clz")).map((n) => ({ part: n.dataset.part, metric: metricClass(n.dataset.part), text: clauseText(n) }))
      : [];
    const freeNote = free.trim();
    const branchLabel = readPart ? `${readPart}_shift` : null;
    onReEvaluate({ ideaText, ideaHtml, changedParts, branchLabel, freeNote });
  };

  // word count (display only)
  const wc = (() => {
    const el = ideaRef.current;
    const n = el ? (el.innerText || "").trim().split(/\s+/).filter(Boolean).length : 0;
    return n ? `~${n.toLocaleString()} words` : "";
  })();

  const here = lineage.find((n) => n.here) || lineage[lineage.length - 1];
  const nextVer = here ? `V${(parseInt(String(here.ver).replace(/\D/g, ""), 10) || lineage.length) + 1}` : "V" + (lineage.length + 1);

  return (
    <div className="dev-root">
      <style dangerouslySetInnerHTML={{ __html: DEV_CSS }} />
      <div className="dev-arc1" />
      <div className="dev-glow" />
      <div className="dev-content">

        <div className="dev-toprow">
          <ModeTitle mode="evolve" label="Evolve · Deep" />
          <span className="dev-mono dev-profile">{profileLabel} · Edit <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-1px", marginLeft: 3 }}><path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></svg></span>
        </div>
        <h1 className="dev-serif">Re-evaluate.</h1>
        <p className="dev-sub">Reshape the idea, keep the lineage, measure the delta. Editing forks a new version — your current one stays intact.</p>

        {/* PRESSURE STRIP (V1 briefing) */}
        <div className="dev-pressure">
          <div className="dev-pcell v">
            <div className="dev-mono dev-plabel">VERDICT</div>
            <div className="dev-vrow"><div className="dev-mono dev-ring">{pressure.verdict.score}</div><div className="dev-vread">{pressure.verdict.read}</div></div>
            {pressure.verdict.readFull && pressure.verdict.readFull !== pressure.verdict.read && (
              <button className="dev-pmore" onClick={() => setFullPop({ label: "VERDICT", title: pressure.verdict.title, body: pressure.verdict.readFull, color: "#a99cff" })}>View full verdict <Arrow /></button>
            )}
          </div>
          {[["asset", "STRONGEST ASSET", "Don't break this while fixing the rest."], ["constraint", "BINDING CONSTRAINT", "The floor. Most leverage is here."]].map(([k, lbl]) => {
            const cell = pressure[k]; if (!cell) return null;
            const m = METRIC[cell.metricKey] || {};
            return (
              <div className={`dev-pcell dev-${k}`} key={k} style={{ "--pc": m.color }}>
                <div className="dev-ptag"><span className="dev-d" /><span className="dev-mono dev-t">{lbl} · {(m.name || "").split(" ")[0] === "Market" ? "MD" : (cell.metricKey || "").toUpperCase()} {cell.score}</span></div>
                <div className="dev-pdesc">{cell.desc}</div>
                <div className="dev-pdir">{cell.dir}</div>
                {cell.descFull && cell.descFull.length > (cell.desc || "").length && (
                  <button className="dev-pmore" onClick={() => setFullPop({ label: `${lbl} \u00b7 ${(cell.metricKey || "").toUpperCase()} ${cell.score}`, body: cell.descFull, color: m.color })}>View full {k === "asset" ? "strongest asset" : "binding constraint"} <Arrow /></button>
                )}
              </div>
            );
          })}
        </div>

        {/* WORK ROW */}
        <div className="dev-work">

          {/* LINEAGE */}
          <div className="dev-lineage-col">
            <div className="dev-mono dev-lin-label">YOUR LOOP SO FAR</div>
            <div className="dev-lin-tree">
              {lineage.map((n, i) => (
                <React.Fragment key={i}>
                  {n.edge && <div className="dev-lin-edge"><span className="dev-mono">{n.edge}</span></div>}
                  <div className={`dev-lin-node ${n.here ? "here" : ""}`}>
                    <span className="dev-lin-dot" />
                    <div className="dev-lin-ver">{n.ver} {n.score != null && <span className="dev-lin-score">· {n.score}</span>} {n.here && <span className="dev-mono dev-lin-here">YOU ARE HERE</span>}</div>
                    <div className="dev-lin-note">{n.note}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div className="dev-lin-safety">Editing forks <b>{nextVer}</b> — {here ? here.ver : "this version"} stays intact.</div>
          </div>

          {/* CENTER */}
          <div className="dev-center">
            <div className={`dev-ideacard${ideaLoading ? " dev-loading" : ""}`}>
              <div className="dev-ideatop"><span className="dev-mono dev-l">THE IDEA · CLICK A CLAUSE, SELECT TEXT TO TAG, OR EDIT FREELY</span><span className="dev-mono dev-wc">{wc}</span></div>
              <div className="dev-idea-wrap">
                <div id="dev-idea" ref={ideaRef} contentEditable={!ideaLoading} suppressContentEditableWarning spellCheck={false} />
                {ideaLoading && (
                  <div className="dev-idea-loading">
                    <div className="dev-spin" />
                    <span className="dev-mono">Reading your idea…</span>
                  </div>
                )}
              </div>
            </div>
            <div className="dev-freecard">
              <div className="dev-mono dev-fl">↳ OR — JUST TELL US WHAT TO CHANGE (NO EDITING REQUIRED)</div>
              <textarea
                value={free}
                onChange={(e) => onFree(e.target.value)}
                placeholder={'e.g. "switch pricing to usage-based, charged per evaluation"  ·  "drop the indie-hacker angle, aim at product teams inside companies"  ·  "make the moat the cross-founder outcome data"'}
              />
              <div className="dev-readout">{freecardReadout(readPart, tooShort, METRIC)}</div>
            </div>
          </div>

          {/* X-RAY */}
          <div className="dev-xray">{renderXray(activePart, activeText, METRIC)}</div>

        </div>

        {/* RUN BAR */}
        <div className="dev-runbar">
          <span className="dev-mono dev-cr">{credits} credits remaining</span>
          <button className="dev-ev-btn" onClick={handleRun}>Re-evaluate with fresh data →</button>
        </div>
      </div>

      {/* menus */}
      {menu && (
        <div className="dev-menu show" style={{ left: clampX(menu.x), top: clampY(menu.y) }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="dev-mt dev-mono">TAG AS PART</div>
          {ORDER.map((k) => {
            const p = PARTS[k], m = METRIC[p.metric];
            return (
              <button key={k} onClick={() => (menu.kind === "chip" ? chipPick(k) : tagPick(k))}>
                <span className="dev-sw" style={{ background: m.color }} />{p.name}<span className="dev-pn">{m.name.split(" ")[0]}</span>
              </button>
            );
          })}
          {menu.kind === "chip" && (<><div className="dev-div" /><button className="dev-rm" onClick={() => chipPick("remove")}>✕ Remove tag</button></>)}
        </div>
      )}

      {/* view-full popup (verdict / strongest asset / binding constraint) */}
      {fullPop && (
        <div className="dev-pop-overlay" onClick={(e) => { if (e.target === e.currentTarget) setFullPop(null); }}>
          <div className="dev-pop-card" style={{ "--pc": fullPop.color || "#a99cff" }}>
            <div className="dev-pop-spine" />
            <button className="dev-pop-x" aria-label="Close" onClick={() => setFullPop(null)}>×</button>
            <div className="dev-mono dev-pop-label">{fullPop.label}</div>
            {fullPop.title && <div className="dev-pop-title">{fullPop.title}</div>}
            <p className="dev-pop-body">{fullPop.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── X-ray panel (JSX; mirrors the mockup's renderXray / resetXray) ── */
function renderXray(part, text, METRIC) {
  if (!part) {
    return (
      <div className="dev-xempty">
        <div className="dev-big">Click a tagged clause to x-ray the part it touches and the score it moves.</div>
        <div className="dev-leg dev-mono">
          {ORDER.map((k) => { const p = PARTS[k], m = METRIC[p.metric];
            return (<div className="dev-it" key={k}><span className="dev-leg-sw" style={{ background: m.color }} /><span className="dev-pt">{p.label}</span><span className="dev-mt2">{m.name}</span></div>); })}
        </div>
      </div>
    );
  }
  const p = PARTS[part], m = METRIC[p.metric];
  const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
  return (
    <>
      <div className="dev-mono dev-xcl" style={{ color: m.color }}>X-RAY · {p.label} · DRIVES {m.name.toUpperCase()} {m.score}</div>
      <div className="dev-xname">{p.name} <span className="dev-xmetric" style={{ color: m.color, background: tint(m.color, 12), border: `1px solid ${tint(m.color, 35)}` }}>→ {m.name} {m.score}</span></div>
      <div className="dev-xquote" style={{ borderColor: m.color }}>{text}</div>
      <div className="dev-xblk"><div className="dev-mono dev-xh">WHAT THIS PART IS ON THE HOOK FOR</div><div className="dev-xb">This is your <b>{p.q}</b>. It’s judged on {m.name} ({m.score}) — reshape it and that’s the axis you’re testing.</div></div>
      <div className="dev-xblk"><div className="dev-mono dev-xh">LAST JUDGMENT — WHY IT SAT THERE</div><div className="dev-xb">{m.last}<span className="dev-det">This is the last read. Your reshape is re-judged from scratch.</span></div></div>
      <div className="dev-xblk dev-xwin" style={{ "--xc": m.color }}><div className="dev-mono dev-xh">HOW {m.name.toUpperCase()} IS WON</div><div className="dev-xb">{m.win}</div></div>
      <div className="dev-xsafe">This is the last judgment, not a prediction. Your reshape gets re-scored on fresh evidence — no preview can promise the number.</div>
      <div className="dev-xbranch">Editing this part auto-labels the branch <b>{part}_shift</b> in your lineage.</div>
    </>
  );
}

function freecardReadout(part, tooShort, METRIC) {
  if (tooShort) return "Reading… add a bit more and we’ll map this to a part (target, money, mechanism, moat…).";
  if (!part) return "We'll read your change, map it to a part, and diff it into the idea above — tagging exactly what moved.";
  const p = PARTS[part], m = METRIC[p.metric];
  const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
  return (
    <>We read this as a change to your <span className="dev-tag" style={{ color: m.color, background: tint(m.color, 12), border: `1px solid ${tint(m.color, 35)}` }}>{p.label}</span> → moves <b style={{ color: m.color }}>{m.name}</b>, labels the branch <b>{part}_shift</b>. We'll diff it in and tag what changed — your current version stays intact.</>
  );
}

function clampX(x) { if (typeof window === "undefined") return x; return x + 238 > window.innerWidth ? window.innerWidth - 238 : x; }
function clampY(y) { if (typeof window === "undefined") return y; return y + 300 > window.innerHeight ? Math.max(8, y - 312) : y; }

/* ── scoped styles (mockup CSS, minus the shell chrome, scoped under .dev-root) ── */
const DEV_CSS = `
.dev-root{position:relative;min-width:0;color:#e6e9ee;background:radial-gradient(120% 75% at 50% -8%, #16132c 0%, #0d0f17 48%, #090b10 100%)}
.dev-root *{box-sizing:border-box}
.dev-root ::placeholder{color:#525a68}
.dev-mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.dev-serif{font-family:'Newsreader',Georgia,serif}
.dev-arc1{position:absolute;top:-380px;left:-80px;width:1140px;height:1140px;border:1px solid rgba(150,140,255,0.05);border-radius:50%;pointer-events:none}
.dev-glow{position:absolute;top:-160px;right:-220px;width:620px;height:620px;background:radial-gradient(circle,rgba(124,108,255,0.09),transparent 70%);pointer-events:none}
.dev-content{position:relative;z-index:3;max-width:1560px;margin:0;padding:28px 40px 0 48px}

.dev-toprow{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
.dev-kicker{font-size:11px;letter-spacing:2.5px;color:#7b8492}
.dev-profile{font-size:11px;letter-spacing:1px;color:#6b7480;border:1px solid #232a34;border-radius:8px;padding:6px 12px}
.dev-root h1{font-weight:500;font-size:36px;line-height:1.05;color:#f4f6f9;letter-spacing:-.5px;margin:0 0 9px}
.dev-sub{font-size:14px;line-height:1.5;color:#9aa3b0;max-width:560px;margin:0 0 24px}

.dev-pressure{position:relative;border:1px solid #1d2430;border-radius:16px;background:linear-gradient(165deg,rgba(34,32,56,0.18),rgba(15,17,25,0.40));padding:20px 26px;display:flex;margin-bottom:22px}
.dev-pressure::after{content:"";position:absolute;right:12px;bottom:12px;width:13px;height:13px;border-right:1.5px solid #2a3340;border-bottom:1.5px solid #2a3340;border-bottom-right-radius:3px}
.dev-pcell{flex:1;padding:0 28px}.dev-pcell.v{flex:none;width:300px;padding-left:0}.dev-pcell+.dev-pcell{border-left:1px solid #1b212c}
.dev-plabel{font-size:9.5px;letter-spacing:1.6px;color:#5a6373;margin-bottom:14px}
.dev-vrow{display:flex;align-items:center;gap:16px}
.dev-ring{width:48px;height:48px;flex:none;border-radius:50%;border:1.5px solid #e0a93a;display:flex;align-items:center;justify-content:center;color:#e0a93a;font-size:15px;font-weight:600}
.dev-vread{font-size:16px;font-weight:600;line-height:1.35;color:#f1f4f8}
.dev-ptag{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.dev-ptag .dev-d{width:7px;height:7px;border-radius:50%;background:var(--pc,#6f8ff5)}
.dev-ptag .dev-t{font-size:10px;letter-spacing:1.4px;font-weight:500;color:var(--pc,#6f8ff5)}
.dev-pdesc{font-size:13.5px;line-height:1.45;color:#dfe4ea;margin-bottom:5px}
.dev-pdir{font-size:12px;color:#6b7480}

.dev-work{display:flex;gap:24px;align-items:stretch}

.dev-lineage-col{flex:none;align-self:flex-start;width:286px;border:1px solid #1d2430;border-radius:16px;background:linear-gradient(165deg,rgba(34,32,56,0.20),rgba(15,17,25,0.42));padding:22px 22px 24px;position:relative;display:flex;flex-direction:column}
.dev-lineage-col::after{content:"";position:absolute;right:11px;bottom:11px;width:13px;height:13px;border-right:1.5px solid #2a3340;border-bottom:1.5px solid #2a3340;border-bottom-right-radius:3px}
.dev-lin-label{font-size:9.5px;letter-spacing:1.9px;color:#5a6373;margin-bottom:20px}
.dev-lin-tree{position:relative;padding-left:22px}
.dev-lin-tree::before{content:"";position:absolute;left:5px;top:10px;bottom:6px;width:1px;background:linear-gradient(180deg,rgba(124,108,255,.10),rgba(124,108,255,.4))}
.dev-lin-node{position:relative;margin-bottom:7px}
.dev-lin-dot{position:absolute;left:-22px;top:3px;width:11px;height:11px;border-radius:50%;border:2px solid #33384a;background:#0b0d14}
.dev-lin-node.here .dev-lin-dot{border-color:#a99cff;box-shadow:0 0 11px -1px rgba(124,108,255,.85)}
.dev-lin-ver{font-size:14px;color:#cdd3db;display:flex;align-items:center;gap:9px}
.dev-lin-node.here .dev-lin-ver{color:#f1f4f8;font-weight:600}
.dev-lin-score{font-size:11px;color:#7b8492}.dev-lin-node.here .dev-lin-score{color:#a99cff}
.dev-lin-here{font-size:9px;letter-spacing:1px;color:#a99cff;border:1px solid rgba(124,108,255,.35);border-radius:5px;padding:1px 6px}
.dev-lin-note{font-size:11.5px;color:#6b7480;margin-top:2px}
.dev-lin-edge{margin:3px 0 10px;padding-left:2px}
.dev-lin-edge .dev-mono{font-size:10px;letter-spacing:.5px;color:#7c6cf0;background:rgba(124,108,255,.08);border:1px solid rgba(124,108,255,.18);border-radius:5px;padding:2px 7px}
.dev-lin-safety{margin-top:auto;padding-top:18px;font-size:11px;line-height:1.5;color:#5f6775}.dev-lin-safety b{color:#a99cff;font-weight:500}

.dev-center{flex:1;min-width:0;display:flex;flex-direction:column;gap:16px}
.dev-ideacard{border:1px solid #1d2430;border-radius:14px;background:rgba(10,12,18,0.45);padding:18px 20px}
.dev-ideatop{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.dev-ideatop .dev-l{font-size:9.5px;letter-spacing:1.6px;color:#5f6775}.dev-ideatop .dev-wc{font-size:10px;color:#4f5765}
.dev-idea-wrap{position:relative}
.dev-ideacard.dev-loading #dev-idea{filter:blur(5px);opacity:.4;pointer-events:none;user-select:none;min-height:180px}
.dev-idea-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#9aa3b0}
.dev-idea-loading .dev-mono{font-size:11px;letter-spacing:1.4px;color:#8a93a3}
.dev-spin{width:22px;height:22px;border-radius:50%;border:2px solid rgba(124,108,255,.22);border-top-color:#a99cff;animation:dev-spin .7s linear infinite}
@keyframes dev-spin{to{transform:rotate(360deg)}}
#dev-idea{font-size:15.5px;line-height:1.95;color:#dfe3e9;max-height:430px;overflow-y:auto;padding-right:8px;outline:none}
#dev-idea p{margin-bottom:15px}
#dev-idea::-webkit-scrollbar{width:8px}#dev-idea::-webkit-scrollbar-thumb{background:#222a36;border-radius:4px}#dev-idea::-webkit-scrollbar-track{background:transparent}
.dev-clz{--c:#6f8ff5;border-bottom:1.5px solid;border-radius:3px;padding:0 2px;cursor:pointer;transition:background .12s}
.dev-clz.md{--c:#6f8ff5;border-bottom-color:rgba(111,143,245,.55)}
.dev-clz.mo{--c:#5fd08a;border-bottom-color:rgba(95,208,138,.55)}
.dev-clz.or{--c:#a99cff;border-bottom-color:rgba(169,156,255,.55)}
.dev-clz.tc{--c:#e3c14a;border-bottom-color:rgba(227,193,74,.55)}
.dev-clz:hover{background:color-mix(in srgb,var(--c) 10%,transparent)}
.dev-clz.active{border:1px solid var(--c);border-bottom-width:1px;border-radius:6px;padding:1px 6px;background:color-mix(in srgb,var(--c) 12%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--c) 28%,transparent),0 10px 30px -18px var(--c)}
.dev-chip{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.5px;margin-left:4px;padding:1px 5px;border-radius:4px;border:1px solid var(--c);color:var(--c);background:color-mix(in srgb,var(--c) 8%,transparent);cursor:pointer;user-select:none;vertical-align:1px}
.dev-chip:hover{background:color-mix(in srgb,var(--c) 20%,transparent)}
.dev-freecard{border:1px solid #1d2430;border-radius:14px;background:rgba(10,12,18,0.40);padding:16px 18px}
.dev-freecard .dev-fl{font-size:9.5px;letter-spacing:1.6px;color:#a99cff;margin-bottom:11px}
.dev-freecard textarea{width:100%;min-height:62px;resize:vertical;background:rgba(8,10,15,0.5);border:1px solid #202834;border-radius:10px;padding:11px 13px;font-size:13.5px;line-height:1.5;color:#e6e9ee;font-family:inherit;outline:none;transition:border-color .15s}
.dev-freecard textarea:focus{border-color:#7c6cf0}
.dev-readout{margin-top:11px;font-size:12.5px;line-height:1.55;color:#7b8492;min-height:20px}
.dev-readout .dev-tag{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.5px;padding:2px 7px;border-radius:5px;margin:0 2px}
.dev-readout b{color:#a99cff;font-weight:500;font-family:'JetBrains Mono',monospace}

.dev-xray{flex:none;width:380px;border:1px solid rgba(124,108,255,.28);border-radius:14px;background:linear-gradient(165deg,rgba(124,108,255,.06),rgba(10,12,18,.5));padding:18px 20px}
.dev-xempty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:16px;color:#6b7480}
.dev-xempty .dev-big{font-size:14px;color:#9aa3b0;max-width:250px;line-height:1.5}
.dev-xempty .dev-leg{display:flex;flex-direction:column;gap:8px;font-size:11px;text-align:left}
.dev-xempty .dev-it{display:flex;align-items:center;gap:8px;min-width:190px}.dev-xempty .dev-leg-sw{width:8px;height:8px;border-radius:50%}
.dev-xempty .dev-pt{color:#7b8492}.dev-xempty .dev-mt2{color:#525a68;margin-left:auto;font-size:10px}
.dev-xcl{font-size:9.5px;letter-spacing:1.4px;margin-bottom:12px}
.dev-xname{font-size:21px;font-weight:600;color:#f1f4f8;display:flex;gap:10px;align-items:baseline;margin-bottom:2px;flex-wrap:wrap}
.dev-xmetric{font-size:11px;font-family:'JetBrains Mono',monospace;letter-spacing:.5px;padding:2px 8px;border-radius:6px}
.dev-xquote{font-size:12.5px;line-height:1.5;color:#aab2bd;font-style:italic;border-left:2px solid;padding-left:11px;margin:14px 0 18px}
.dev-xblk{margin-bottom:16px}.dev-xh{font-size:9.5px;letter-spacing:1.4px;color:#8a93a0;margin-bottom:6px}
.dev-xb{font-size:13px;line-height:1.55;color:#cdd3db}.dev-xb .dev-det{display:block;font-size:11px;color:#6b7480;margin-top:5px}.dev-xb b{color:#cdd3db}
.dev-xwin .dev-xh{color:var(--xc)}.dev-xwin .dev-xb{border-left:2px solid var(--xc);padding-left:11px}
.dev-xsafe{font-size:11.5px;line-height:1.5;color:#7b8492;background:rgba(8,10,15,.4);border:1px solid #232a34;border-radius:9px;padding:11px 13px;margin-top:18px}
.dev-xbranch{font-size:11px;color:#6b7480;margin-top:12px}.dev-xbranch b{color:#a99cff;font-weight:500;font-family:'JetBrains Mono',monospace}

.dev-runbar{display:flex;align-items:center;justify-content:space-between;margin:24px 0 40px}
.dev-runbar .dev-cr{font-size:11px;color:#5f6775}
.dev-ev-btn{background:linear-gradient(180deg,#a99cff,#7b66ef);border:none;border-radius:12px;padding:15px 28px;font-size:14.5px;font-weight:600;color:#fff;cursor:pointer;box-shadow:0 8px 30px rgba(124,108,255,0.38);transition:transform .12s,box-shadow .15s;font-family:inherit}
.dev-ev-btn:hover{transform:translateY(-1px);box-shadow:0 14px 44px rgba(124,108,255,0.5)}
.dev-pmore{display:inline-flex;align-items:center;gap:6px;margin-top:10px;font-size:11.5px;font-weight:600;color:var(--pc,#a99cff);background:none;border:none;cursor:pointer;padding:3px 0;font-family:inherit}
.dev-pmore:hover{opacity:.82}
.dev-pop-overlay{position:fixed;inset:0;background:rgba(6,7,11,0.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:60px 24px;z-index:1000;overflow-y:auto}
.dev-pop-card{position:relative;background:#0e1015;border:1px solid #1d2430;border-radius:20px;max-width:640px;width:100%;padding:34px 40px 36px;box-shadow:0 30px 80px rgba(0,0,0,0.6)}
.dev-pop-spine{position:absolute;left:0;top:26px;bottom:26px;width:2px;border-radius:2px;background:linear-gradient(180deg,var(--pc,#a99cff),transparent);opacity:.55}
.dev-pop-x{position:absolute;top:14px;right:16px;background:none;border:none;color:#6b7480;font-size:24px;line-height:1;cursor:pointer;padding:2px 8px;border-radius:8px}
.dev-pop-x:hover{color:#cdd3db}
.dev-pop-label{font-size:10px;letter-spacing:1.6px;color:var(--pc,#a99cff);margin-bottom:14px}
.dev-pop-title{font-size:19px;font-weight:600;letter-spacing:-.3px;color:#f4f6f9;margin-bottom:14px;line-height:1.3}
.dev-pop-body{font-size:15px;line-height:1.8;color:#c5ccd6;margin:0;white-space:pre-line}

.dev-menu{position:fixed;z-index:80;background:#11131b;border:1px solid #262d3a;border-radius:11px;padding:6px;box-shadow:0 22px 60px -22px #000;display:none}
.dev-menu.show{display:flex;flex-direction:column;gap:1px}
.dev-menu .dev-mt{font-size:9px;letter-spacing:1px;color:#5f6775;padding:4px 9px 6px}
.dev-menu button{display:flex;align-items:center;gap:9px;background:none;border:none;color:#cdd3db;font-size:12.5px;padding:7px 11px;border-radius:7px;cursor:pointer;text-align:left;width:100%;font-family:inherit;white-space:nowrap}
.dev-menu button:hover{background:#1b2230}
.dev-menu button .dev-pn{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:9px;color:#5f6775}
.dev-menu .dev-sw{width:9px;height:9px;border-radius:50%;flex:none}
.dev-menu .dev-div{height:1px;background:#1e2530;margin:4px 2px}
.dev-menu .dev-rm{color:#e8606b}.dev-menu .dev-rm:hover{background:rgba(232,96,107,.1)}
`;