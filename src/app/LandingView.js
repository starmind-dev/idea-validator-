import React, { useRef, useEffect, useState } from "react";

/*
 * LandingView — IdeaLoop Core public marketing landing page.
 *
 * Recognition-first rebuild. The page now leads with the loop-as-cognition
 * (hero ring) instead of the old "grounded inspiration" differentiator, then
 * earns the differentiator inside the Explore beat. No Tailwind — inline styles
 * only. Section order:
 *   Nav → Hero (loop ring) → The Gap → The Loop Walked (spine) → Explore
 *   (grounded fan) → Footing (Deep/Re-eval/Compare) → Lineage → Handoff
 *   → Why-not → When-to-open (strip) → Pricing → Final CTA → Footer.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  EASY-TO-FILL STUBS (left intentionally inert for now — see memory):
 *
 *  1. BETA — the "#beta" section carries free-beta framing only; no prices or
 *     credits are shown. Its "Save your spot" waitlist posts to /api/waitlist
 *     (source: landing). When the paid model ships, add the pricing UI here then.
 *
 *  2. SAMPLE_LOOP_URL — set this to a real read-only sample-lineage URL to make the
 *     "View a sample loop" buttons appear + work. While it is null, those buttons
 *     are hidden (the rest of the layout is unaffected). Flip one constant to ship.
 *
 *  3. Handlers (onStartLoop / onLogIn / onViewSample) are passed in as props so
 *     the routing gate in page.js decides what "enter the app" means.
 *
 *  4. showFooting — render toggle for the "footing" (Deep/Re-eval/Compare)
 *     section. Default true.
 * ───────────────────────────────────────────────────────────────────────────
 */

// ── Sample loop: set to a real URL later to enable the "View a sample loop" buttons.
const SAMPLE_LOOP_URL = null;

// ── Pricing config (single source of truth for the pricing section copy/numbers).
//    NOTE: reconcile against the real credit model before launch.
// (Pricing config removed — no pricing or credits are shown during beta.)

function smoothScrollTo(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingView({
  onStartLoop = () => {},
  onLogIn = () => {},
  onStartFree,
  onGetCredits,
  onViewSample,
  showFooting = true,
}) {
  const boardRef = useRef(null);

  // ── Fit-scaler for the lineage board (1240px design → scales to container).
  //    The new lineage inner is 1240×360 (was 560 in the old design).
  useEffect(() => {
    const wrap = boardRef.current;
    if (!wrap) return;
    const DESIGN_W = 1240;
    const DESIGN_H = 360;
    const fit = () => {
      const inner = wrap.firstElementChild;
      if (!inner) return;
      const avail = wrap.clientWidth || DESIGN_W;
      const s = Math.min(1, avail / DESIGN_W);
      inner.style.transform = "scale(" + s + ")";
      inner.style.left = (s >= 1 ? (avail - DESIGN_W) / 2 : 0) + "px";
      wrap.style.height = (DESIGN_H * s) + "px";
    };
    fit();
    const raf = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);

  // ── Load display + mono faces (Spectral / JetBrains Mono) once.
  useEffect(() => {
    const id = "ilc-landing-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // ── Inject keyframes + navlink hover (ring trace, reduced-motion guard) once.
  useEffect(() => {
    const id = "ilc-landing-kf";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent =
      "@keyframes ilcCircle{to{stroke-dashoffset:-973.9}}" +
      ".ringtrace{animation:ilcCircle 4.5s linear infinite;}" +
      "@media (prefers-reduced-motion: reduce){.ringtrace{animation:none;opacity:0}}" +
      "a.navlink{color:#b4b4bd;text-decoration:none;}a.navlink:hover{color:#e4e4e7;}";
    document.head.appendChild(style);
  }, []);

  const scrollToId = (id) => smoothScrollTo(document.getElementById(id));

  // Default the optional handlers to the primary CTA / nothing as appropriate.
  const onStartFreeFn = onStartFree || onStartLoop;
  const onGetCreditsFn = onGetCredits || onStartLoop;
  const onViewSampleFn =
    onViewSample || (() => { if (SAMPLE_LOOP_URL) window.open(SAMPLE_LOOP_URL, "_blank"); });
  const showSample = !!SAMPLE_LOOP_URL || !!onViewSample;

  // ── Beta waitlist ("Save your spot") — self-contained: own state, own POST to
  //    /api/waitlist (source: landing). Anonymous; the email is the key.
  const [wlOpen, setWlOpen] = useState(false);
  const [wlEmail, setWlEmail] = useState("");
  const [wlState, setWlState] = useState("idle"); // idle | sending | done | error
  const [wlErr, setWlErr] = useState("");
  const submitWaitlist = async () => {
    const e = wlEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setWlErr("Enter a valid email."); return; }
    setWlState("sending"); setWlErr("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, source: "landing" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setWlErr(data.error || "Could not save. Try again."); setWlState("error"); return; }
      setWlState("done");
    } catch (_) { setWlErr("Could not save. Try again."); setWlState("error"); }
  };

  return (

<div style={{ background: '#09090b', color: '#f4f4f5', fontFamily: '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif', WebkitFontSmoothing: 'antialiased', overflowX: 'hidden' }}>

  {/* NAV */}
  <header style={{ position: 'sticky', top: '0', zIndex: '50', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'flex', alignItems: 'center' }}><img src="/idealoop-wordmark.png" alt="IdeaLoop Core" style={{ display: 'block', height: '46px', width: 'auto' }} /></div>
    <nav style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}><a className="navlink" href="#the-loop">The loop</a><a className="navlink" href="#explore">Explore</a><a className="navlink" href="#beta">Beta</a></nav>
    <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}><span onClick={onLogIn} style={{ fontSize: '14px', color: '#a1a1aa', cursor: 'pointer' }}>Log in</span><span onClick={onStartLoop} style={{ fontSize: '14px', fontWeight: '600', color: '#fff', background: '#8b7ff0', padding: '9px 18px', borderRadius: '10px', cursor: 'pointer' }}>Start an idea loop</span></div>
  </header>

  {/* 1 HERO — RECOGNITION */}
  <section style={{ position: 'relative', textAlign: 'center', padding: '74px 24px 0', maxWidth: '1180px', margin: '0 auto' }}>
    <div style={{ position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)', width: '820px', height: '520px', background: 'radial-gradient(ellipse at center, rgba(52,216,168,0.09), rgba(139,127,240,0.05) 46%, transparent 70%)', pointerEvents: 'none' }}></div>
    <div style={{ position: 'relative' }}>
      <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: '9px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '7px 16px' }}><span style={{ color: '#34d8a8' }}>∞</span> THE LOOP YOU ALREADY RUN</div>
      <h1 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '44px', lineHeight: '1.2', letterSpacing: '-0.015em', margin: '24px auto 0', maxWidth: '900px', color: '#fafafa' }}>Every serious idea moves in a loop.<span style={{ display: 'block', marginTop: '12px', color: '#c8c8cc' }}>Until now, that loop lived in your head.</span></h1>
      <p style={{ fontSize: '17.5px', lineHeight: '1.62', color: '#b4b4bd', margin: '22px auto 0', maxWidth: '680px' }}>A spark arrives. You turn it over. Another version appears. One angle starts to hold. You pressure it, revise it, compare it, return to it. That is not a workflow to learn — it is how thinking already moves. <span style={{ color: '#f0f0f1', fontWeight: '500' }}>IdeaLoop Core gives that motion somewhere to live.</span></p>

      {/* SIGNATURE: LOOP RING */}
      <div style={{ position: 'relative', width: '600px', maxWidth: '100%', margin: '30px auto 0', aspectRatio: '600/470' }}>
        <svg viewBox="0 0 600 470" style={{ position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="ringgrad" x1="300" y1="60" x2="300" y2="370" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#8aa9f7" /><stop offset="50%" stopColor="#9d86f0" /><stop offset="100%" stopColor="#34d8a8" /></linearGradient>
          </defs>
          <circle cx="300" cy="215" r="155" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          {/* solid forward arc: Spark -> Explore -> Deep -> Decide (right) */}
          <path d="M300,60 A155,155 0 0 1 300,370" fill="none" stroke="url(#ringgrad)" strokeWidth="2" opacity="0.85" />
          {/* dotted return arc: Decide -> Re-evaluate -> Compare -> Spark (left) */}
          <path d="M300,370 A155,155 0 0 1 300,60" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" strokeDasharray="2 7" />
          {/* animated load trace */}
          <path className="ringtrace" d="M300,60 A155,155 0 1 1 299.9,60" fill="none" stroke="#5fe3bd" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="150 824" style={{ filter: 'drop-shadow(0 0 6px rgba(95,227,189,0.75))' }} />
        </svg>

        {/* center caption */}
        <div style={{ position: 'absolute', left: '50%', top: '45.7%', transform: 'translate(-50%,-50%)', width: '188px', textAlign: 'center', fontFamily: '\'JetBrains Mono\',monospace' }}>
          <div style={{ fontSize: '10.5px', letterSpacing: '.14em', color: '#5fe3bd' }}>↻ THE LOOP NEVER CLOSES</div>
          <div style={{ fontSize: '10.5px', color: '#71717a', marginTop: '5px', lineHeight: '1.5' }}>while the idea is still alive</div>
        </div>

        {/* nodes */}
        {/* Spark (top) */}
        <div style={{ position: 'absolute', left: '50%', top: '12.8%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#0c0c11', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a8a8b0" strokeWidth="1.6"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg></span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#e4e4e7' }}>Spark</span>
        </div>
        {/* Explore (upper right) */}
        <div style={{ position: 'absolute', left: '72.4%', top: '29.3%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#0c0c12', border: '1px solid rgba(122,162,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(122,162,255,0.12)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><polygon points="15.6,8.4 10.8,10.8 8.4,15.6 13.2,13.2" /></svg></span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#cdd6f5' }}>Explore</span>
        </div>
        {/* Deep (lower right) */}
        <div style={{ position: 'absolute', left: '72.4%', top: '62.2%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#0d0c12', border: '1px solid rgba(138,130,194,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b3a3f5" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="#b3a3f5" /></svg></span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#d7d0f3' }}>Deep</span>
        </div>
        {/* Decide (bottom) */}
        <div style={{ position: 'absolute', left: '50%', top: '78.7%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '58px', height: '58px', borderRadius: '50%', background: '#0a1310', border: '1.5px solid rgba(52,216,168,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(52,216,168,0.28)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5fe3bd" strokeWidth="1.9"><path d="M5 12.5l4 4L19 7.5" /></svg></span>
          <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#5fe3bd' }}>Decide</span>
        </div>
        {/* Re-evaluate (lower left) */}
        <div style={{ position: 'absolute', left: '27.6%', top: '62.2%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#0a0f0d', border: '1px solid rgba(52,216,168,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#5fe3bd" strokeWidth="1.6"><path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L21 8" /><path d="M21 4v4h-4" /><path d="M20.5 12a8.5 8.5 0 0 1-14.3 6.2L3 16" /><path d="M3 20v-4h4" /></svg></span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#bfeede' }}>Re-evaluate</span>
        </div>
        {/* Compare (upper left) */}
        <div style={{ position: 'absolute', left: '27.6%', top: '29.3%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px' }}>
          <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#0c0d12', border: '1px solid rgba(166,182,245,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a6b6f5" strokeWidth="1.6"><path d="M4 9h13l-3.2-3.2" /><path d="M20 15H7l3.2 3.2" /></svg></span>
          <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#cdd5f5' }}>Compare</span>
        </div>
      </div>

      <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#71717a', margin: '8px auto 0', maxWidth: '600px', lineHeight: '1.5' }}>The read stops where your judgment starts — we surface directions and the evidence, never the verdict.</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '24px' }}>
        <span onClick={onStartLoop} style={{ fontSize: '15.5px', fontWeight: '600', color: '#fff', background: '#8b7ff0', padding: '14px 28px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 8px 30px rgba(139,127,240,0.3)' }}>Start an idea loop →</span>
        {showSample && (<span style={{ fontSize: '15.5px', fontWeight: '500', color: '#d4d4d8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 24px', borderRadius: '12px', cursor: 'pointer' }} onClick={onViewSampleFn}>View a sample loop</span>)}
      </div>
      <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', color: '#52525b', marginTop: '18px' }}>NO CARD · YOUR FIRST RUN IS FREE</div>
    </div>
  </section>

  {/* 2 THE GAP */}
  <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '122px 24px 0' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#ee8a8a' }}>THE GAP · TWO PROBLEMS, ONE ANSWER</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '40px', lineHeight: '1.12', letterSpacing: '-0.01em', margin: '14px auto 0', maxWidth: '760px', color: '#fafafa' }}>The idea is not the scarce part. The loop around it is.</h2></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '46px', alignItems: 'start' }}>
      {/* problem 1 */}
      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '28px 28px 24px' }}>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#71717a' }}>PROBLEM ONE</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '23px', lineHeight: '1.25', color: '#f0f0f1', marginTop: '12px' }}>Your thinking gets scattered — and nothing remembers.</div>
        <p style={{ fontSize: '14.5px', lineHeight: '1.6', color: '#9a9aa3', margin: '12px 0 0' }}>Every chat starts from zero. Every report dies the moment the idea changes. The reasoning never compounds.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 15px', transform: 'rotate(-1deg)' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#71717a', letterSpacing: '.1em' }}>NOTES.APP</span><div style={{ fontSize: '13px', color: '#9a9aa3', marginTop: '4px' }}>3 versions, all lost</div></div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 15px', transform: 'rotate(2deg)' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#71717a', letterSpacing: '.1em' }}>SCREENSHOTS</span><div style={{ fontSize: '13px', color: '#9a9aa3', marginTop: '4px' }}>somewhere in the camera roll</div></div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 15px', transform: 'rotate(-1.5deg)' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#71717a', letterSpacing: '.1em' }}>YOUR HEAD</span><div style={{ fontSize: '13px', color: '#9a9aa3', marginTop: '4px' }}>“wait, why did I drop that?”</div></div>
        </div>
      </div>
      {/* problem 2 */}
      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '28px 28px 24px' }}>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#71717a' }}>PROBLEM TWO</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '23px', lineHeight: '1.25', color: '#f0f0f1', marginTop: '12px' }}>Sparks are everywhere — footing under them isn’t.</div>
        <p style={{ fontSize: '14.5px', lineHeight: '1.6', color: '#9a9aa3', margin: '12px 0 0' }}>Exciting directions are free and infinite. The hard part is one that holds — backed by evidence, not enthusiasm. Hype evaporates on contact with reality.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 15px', transform: 'rotate(-2deg)' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#5fe3bd', letterSpacing: '.1em' }}>CHATGPT</span><div style={{ fontSize: '13px', color: '#9a9aa3', marginTop: '4px' }}>“Totally build this!”</div></div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 15px', transform: 'rotate(1.5deg)' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#8aa9f7', letterSpacing: '.1em' }}>CLAUDE</span><div style={{ fontSize: '13px', color: '#9a9aa3', marginTop: '4px' }}>“6 considerations…”</div></div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '11px', padding: '11px 15px', transform: 'rotate(-1deg)' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#f0883e', letterSpacing: '.1em' }}>REDDIT</span><div style={{ fontSize: '13px', color: '#9a9aa3', marginTop: '4px' }}>“been done”</div></div>
        </div>
      </div>
    </div>
    <div style={{ textAlign: 'center', marginTop: '34px' }}>
      <p style={{ fontFamily: '\'Spectral\',serif', fontStyle: 'italic', fontSize: '19px', color: '#cdcdd4', margin: '0 auto', maxWidth: '600px' }}>The loop is real. It just never had anywhere to live.</p>
      <p style={{ fontSize: '16.5px', lineHeight: '1.6', color: '#9a9aa3', maxWidth: '680px', margin: '14px auto 0' }}><span style={{ color: '#5fe3bd' }}>One answer to both:</span> <span style={{ fontFamily: '\'Spectral\',serif', fontStyle: 'italic', color: '#cdcdd4' }}>grounded inspiration</span> — directions worth shaping, kept on the record, each one backed by evidence you can open and disagree with.</p>
    </div>
  </section>

  {/* 3 THE LOOP, WALKED AS COGNITION */}
  <section id="the-loop" style={{ maxWidth: '860px', margin: '0 auto', padding: '140px 24px 0', scrollMarginTop: '88px' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#34d8a8' }}>∞ THE LOOP, WALKED</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '40px', lineHeight: '1.12', margin: '14px auto 0', maxWidth: '680px', color: '#fafafa' }}>The same motion — now with evidence, memory, and return.</h2><p style={{ fontSize: '17px', lineHeight: '1.6', color: '#b4b4bd', margin: '16px auto 0', maxWidth: '600px' }}>No screens here — just the motion. Six beats you already run, finally with somewhere to land.</p></div>

    <div style={{ position: 'relative', margin: '54px auto 0', maxWidth: '640px' }}>
      <div style={{ position: 'absolute', left: '7px', top: '14px', bottom: '14px', width: '2px', background: 'linear-gradient(180deg,#8a8a93,#8aa9f7 22%,#b3a3f5 42%,#34d8a8 60%,#5fe3bd 78%,#a6b6f5)', opacity: '.6' }}></div>

      {/* beat 1 */}
      <div style={{ position: 'relative', padding: '0 0 36px 42px' }}>
        <span style={{ position: 'absolute', left: '0', top: '5px', width: '16px', height: '16px', borderRadius: '50%', background: '#0c0c11', border: '2px solid #9a9aa3' }}></span>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#9a9aa3' }}>ROUGH</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '27px', lineHeight: '1.2', color: '#fafafa', marginTop: '7px' }}>A spark arrives.</div>
        <div style={{ fontSize: '15.5px', color: '#9a9aa3', lineHeight: '1.55', marginTop: '6px' }}>You catch it before it’s gone.</div>
      </div>
      {/* beat 2 */}
      <div style={{ position: 'relative', padding: '0 0 36px 42px' }}>
        <span style={{ position: 'absolute', left: '0', top: '5px', width: '16px', height: '16px', borderRadius: '50%', background: '#0c0c12', border: '2px solid #8aa9f7', boxShadow: '0 0 14px rgba(122,162,255,0.3)' }}></span>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#8aa9f7' }}>EXPLORE</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '27px', lineHeight: '1.2', color: '#fafafa', marginTop: '7px' }}>You turn it over.</div>
        <div style={{ fontSize: '15.5px', color: '#9a9aa3', lineHeight: '1.55', marginTop: '6px' }}>What if it’s this angle, what if that — fanned into directions worth shaping.</div>
      </div>
      {/* beat 3 */}
      <div style={{ position: 'relative', padding: '0 0 36px 42px' }}>
        <span style={{ position: 'absolute', left: '0', top: '5px', width: '16px', height: '16px', borderRadius: '50%', background: '#0d0c12', border: '2px solid #b3a3f5', boxShadow: '0 0 14px rgba(138,130,194,0.3)' }}></span>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#b3a3f5' }}>DEEP</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '27px', lineHeight: '1.2', color: '#fafafa', marginTop: '7px' }}>You get serious about one.</div>
        <div style={{ fontSize: '15.5px', color: '#9a9aa3', lineHeight: '1.55', marginTop: '6px' }}>You pressure it against the real world — scores, risks, the binding constraint.</div>
      </div>
      {/* beat 4 */}
      <div style={{ position: 'relative', padding: '0 0 36px 42px' }}>
        <span style={{ position: 'absolute', left: '-1px', top: '4px', width: '18px', height: '18px', borderRadius: '50%', background: '#0a1310', border: '2px solid #34d8a8', boxShadow: '0 0 18px rgba(52,216,168,0.45)' }}></span>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#5fe3bd' }}>VERDICT</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '27px', lineHeight: '1.2', color: '#fafafa', marginTop: '7px' }}>You reach a read you can stand on.</div>
        <div style={{ fontSize: '15.5px', color: '#9a9aa3', lineHeight: '1.55', marginTop: '6px' }}>Not a grade. The shape of the decision, left to you to make.</div>
      </div>
      {/* beat 5 */}
      <div style={{ position: 'relative', padding: '0 0 36px 42px' }}>
        <span style={{ position: 'absolute', left: '0', top: '5px', width: '16px', height: '16px', borderRadius: '50%', background: '#0a0f0d', border: '2px solid #5fe3bd' }}></span>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#5fe3bd' }}>RE-EVALUATE</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '27px', lineHeight: '1.2', color: '#fafafa', marginTop: '7px' }}>The idea shifts. You run it again.</div>
        <div style={{ fontSize: '15.5px', color: '#9a9aa3', lineHeight: '1.55', marginTop: '6px' }}>Not because the world changed. Because the thought did.</div>
      </div>
      {/* beat 6 */}
      <div style={{ position: 'relative', padding: '0 0 4px 42px' }}>
        <span style={{ position: 'absolute', left: '0', top: '5px', width: '16px', height: '16px', borderRadius: '50%', background: '#0c0d12', border: '2px solid #a6b6f5' }}></span>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.14em', color: '#a6b6f5' }}>COMPARE</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '27px', lineHeight: '1.2', color: '#fafafa', marginTop: '7px' }}>You hold two up against each other.</div>
        <div style={{ fontSize: '15.5px', color: '#9a9aa3', lineHeight: '1.55', marginTop: '6px' }}>Side by side, where the call actually lives.</div>
      </div>
    </div>

    <div style={{ textAlign: 'center', marginTop: '46px' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}><span style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.14)' }}></span><span style={{ fontFamily: '\'Spectral\',serif', fontStyle: 'italic', fontSize: '23px', color: '#f0f0f1' }}>Once an idea, always in the loop.</span><span style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.14)' }}></span></div></div>
  </section>

  {/* 4 INSIDE ONE MOTION: EXPLORE (DIFFERENTIATOR) */}
  <section id="explore" style={{ maxWidth: '1180px', margin: '0 auto', padding: '128px 24px 0', scrollMarginTop: '88px' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#8aa9f7' }}>INSIDE ONE MOTION · EXPLORE</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '42px', lineHeight: '1.1', margin: '14px auto 0', maxWidth: '720px', color: '#fafafa' }}>One spark in. Directions worth shaping — with the receipts underneath.</h2><p style={{ fontSize: '17px', lineHeight: '1.6', color: '#b4b4bd', margin: '16px auto 0', maxWidth: '640px' }}>This is the beat that earns the claim. Explore surfaces angles that hold — each one a spark plus the wall, the bet, and the sources underneath. The shaping is yours.</p></div>

    <div style={{ marginTop: '42px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.09)', background: '#0b0b0f', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', overflow: 'hidden', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ef6a6a', opacity: '.7' }}></span><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#e0a857', opacity: '.7' }}></span><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#34d8a8', opacity: '.7' }}></span><span style={{ marginLeft: '14px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', color: '#5b5b64' }}>idealoop.core / explore — AI procurement RFP analyzer</span></div>

      <div style={{ padding: '24px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(107,147,245,0.12)', border: '1px solid rgba(107,147,245,0.4)', color: '#8aa9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px' }}>2</span>
            <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.14em', color: '#c8c8cc' }}>WHERE IT COULD GO</span>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Directions the evidence supports</span>
          </div>
          <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', letterSpacing: '.1em', color: '#52525b' }}>fan order · not ranked</span>
        </div>

        {/* rough idea node */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '22px' }}>
          <div style={{ width: '340px', background: 'linear-gradient(150deg,rgba(20,22,34,0.85),rgba(12,13,20,0.6))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '15px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', letterSpacing: '.14em', color: '#8aa9f7' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.7"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>YOUR ROUGH IDEA</div>
            <div style={{ fontSize: '13px', color: '#c2c2c8', lineHeight: '1.5', marginTop: '9px' }}>“An AI that reads RFP responses for government procurement teams.”</div>
          </div>
        </div>

        {/* fan connectors (3) */}
        <div style={{ position: 'relative', height: '62px' }}>
          <span style={{ position: 'absolute', left: '50%', top: '-1px', transform: 'translateX(-50%)', width: '9px', height: '9px', borderRadius: '50%', background: '#f1719b', boxShadow: '0 0 14px rgba(241,113,155,0.7)' }}></span>
          <svg viewBox="0 0 1000 62" preserveAspectRatio="none" style={{ position: 'absolute', inset: '0', width: '100%', height: '100%', overflow: 'visible' }}>
            <path d="M500,4 C500,40 175,28 167,58" stroke="rgba(107,147,245,0.4)" strokeWidth="1.3" fill="none" />
            <path d="M500,4 C500,40 500,30 500,58" stroke="rgba(107,147,245,0.4)" strokeWidth="1.3" fill="none" />
            <path d="M500,4 C500,40 825,28 833,58" stroke="rgba(224,168,87,0.32)" strokeWidth="1.3" fill="none" />
          </svg>
          <span style={{ position: 'absolute', left: '16.67%', bottom: '0', transform: 'translateX(-50%)', width: '7px', height: '7px', borderRadius: '50%', background: '#6b93f5' }}></span>
          <span style={{ position: 'absolute', left: '50%', bottom: '0', transform: 'translateX(-50%)', width: '7px', height: '7px', borderRadius: '50%', background: '#6b93f5' }}></span>
          <span style={{ position: 'absolute', left: '83.33%', bottom: '0', transform: 'translateX(-50%)', width: '7px', height: '7px', borderRadius: '50%', background: '#e0a857' }}></span>
        </div>

        {/* fan of angle cards (3) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
          {/* card 1 */}
          <div style={{ background: '#0b0b10', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 15px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ alignSelf: 'flex-start', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9.5px', letterSpacing: '.12em', color: '#71717a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px' }}>TARGET SHIFT</span>
            <span style={{ alignSelf: 'flex-start', marginTop: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9.5px', letterSpacing: '.1em', color: '#8aa9f7', background: 'rgba(107,147,245,0.1)', border: '1px solid rgba(107,147,245,0.3)', borderRadius: '6px', padding: '4px 9px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6b93f5' }}></span>WORTH SHAPING</span>
            <div style={{ fontSize: '15.5px', color: '#f4f4f5', fontWeight: '600', lineHeight: '1.3', marginTop: '13px' }}>Bid / no-bid triage for mid-market GovCon vendors</div>
            <div style={{ marginTop: '14px' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#6b7280' }}>THE OPENING</div><div style={{ display: 'flex', gap: '7px', marginTop: '6px' }}><span style={{ color: '#8aa9f7', flexShrink: '0' }}>→</span><span style={{ fontSize: '12px', color: '#b4b4bd', lineHeight: '1.45' }}>Vendors burn weeks on proposals they were never positioned to win…</span></div></div>
            <div style={{ marginTop: '11px' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#6b7280' }}>THE WALL</div><div style={{ display: 'flex', gap: '7px', marginTop: '6px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e7bd7a" strokeWidth="1.7" style={{ flexShrink: '0', marginTop: '2px' }}><circle cx="12" cy="12" r="9" /><path d="M6.3 6.3l11.4 11.4" /></svg><span style={{ fontSize: '12px', color: '#9a9aa3', lineHeight: '1.45' }}>GovWin and Bloomberg already own discovery…</span></div></div>
            <span style={{ alignSelf: 'flex-start', marginTop: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.08em', color: '#e7bd7a' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e0a857' }}></span>DEMAND UNPROVEN</span>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginTop: '13px' }}></div>
            <div style={{ textAlign: 'right', marginTop: '11px', fontSize: '12.5px', color: '#8aa9f7', cursor: 'pointer' }}>look closer ›</div>
          </div>
          {/* card 2 */}
          <div style={{ background: '#0b0b10', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 15px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ alignSelf: 'flex-start', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9.5px', letterSpacing: '.12em', color: '#71717a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px' }}>MECHANISM SHIFT</span>
            <span style={{ alignSelf: 'flex-start', marginTop: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9.5px', letterSpacing: '.1em', color: '#8aa9f7', background: 'rgba(107,147,245,0.1)', border: '1px solid rgba(107,147,245,0.3)', borderRadius: '6px', padding: '4px 9px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6b93f5' }}></span>WORTH SHAPING</span>
            <div style={{ fontSize: '15.5px', color: '#f0f0f1', fontWeight: '600', lineHeight: '1.3', marginTop: '13px' }}>Win-probability scoring from past awards</div>
            <div style={{ marginTop: '14px' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#6b7280' }}>THE OPENING</div><div style={{ display: 'flex', gap: '7px', marginTop: '6px' }}><span style={{ color: '#8aa9f7', flexShrink: '0' }}>→</span><span style={{ fontSize: '12px', color: '#b4b4bd', lineHeight: '1.45' }}>Award histories are public; nothing scores a vendor’s odds before they write…</span></div></div>
            <div style={{ marginTop: '11px' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#6b7280' }}>THE WALL</div><div style={{ display: 'flex', gap: '7px', marginTop: '6px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e7bd7a" strokeWidth="1.7" style={{ flexShrink: '0', marginTop: '2px' }}><circle cx="12" cy="12" r="9" /><path d="M6.3 6.3l11.4 11.4" /></svg><span style={{ fontSize: '12px', color: '#9a9aa3', lineHeight: '1.45' }}>Signal may be too noisy per agency to trust on its own…</span></div></div>
            <span style={{ alignSelf: 'flex-start', marginTop: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.08em', color: '#9a9aa3' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8a8a93' }}></span>FREE SUBSTITUTE</span>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginTop: '13px' }}></div>
            <div style={{ textAlign: 'right', marginTop: '11px', fontSize: '12.5px', color: '#8aa9f7', cursor: 'pointer' }}>look closer ›</div>
          </div>
          {/* card 3 (lightly grounded) */}
          <div style={{ background: '#0b0b10', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '16px 15px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ alignSelf: 'flex-start', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9.5px', letterSpacing: '.12em', color: '#71717a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px' }}>USE-CASE SHIFT</span>
            <span style={{ alignSelf: 'flex-start', marginTop: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9.5px', letterSpacing: '.1em', color: '#e7bd7a', background: 'rgba(224,168,87,0.1)', border: '1px solid rgba(224,168,87,0.3)', borderRadius: '6px', padding: '4px 9px' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e0a857' }}></span>LIGHTLY GROUNDED</span>
            <div style={{ fontSize: '15.5px', color: '#f0f0f1', fontWeight: '600', lineHeight: '1.3', marginTop: '13px' }}>Integrator-led distribution</div>
            <div style={{ marginTop: '14px' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#6b7280' }}>THE OPENING</div><div style={{ display: 'flex', gap: '7px', marginTop: '6px' }}><span style={{ color: '#8aa9f7', flexShrink: '0' }}>→</span><span style={{ fontSize: '12px', color: '#b4b4bd', lineHeight: '1.45' }}>Systems integrators already sit between vendors and agencies…</span></div></div>
            <div style={{ marginTop: '11px' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#6b7280' }}>THE WALL</div><div style={{ display: 'flex', gap: '7px', marginTop: '6px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e7bd7a" strokeWidth="1.7" style={{ flexShrink: '0', marginTop: '2px' }}><circle cx="12" cy="12" r="9" /><path d="M6.3 6.3l11.4 11.4" /></svg><span style={{ fontSize: '12px', color: '#9a9aa3', lineHeight: '1.45' }}>Channel deals are slow and dilute the wedge…</span></div></div>
            <span style={{ alignSelf: 'flex-start', marginTop: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.08em', color: '#9a9aa3' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8a8a93' }}></span>THIN EVIDENCE</span>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginTop: '13px' }}></div>
            <div style={{ textAlign: 'right', marginTop: '11px', fontSize: '12.5px', color: '#8aa9f7', cursor: 'pointer' }}>look closer ›</div>
          </div>
        </div>

        {/* retrieved evidence strip */}
        <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '11px', padding: '13px 16px', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', background: 'rgba(255,255,255,0.015)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', letterSpacing: '.12em', color: '#9a9aa3' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5fe3bd" strokeWidth="1.7"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>EVERY ANGLE CITES ITS SOURCES</span>
          <span style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.12)' }}></span>
          <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#c2c2c8' }}>GovWin IQ</span>
          <span style={{ color: '#3f3f46' }}>·</span>
          <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#c2c2c8' }}>Bloomberg Government</span>
          <span style={{ color: '#3f3f46' }}>·</span>
          <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#c2c2c8' }}>Bonfire</span>
          <span style={{ color: '#3f3f46' }}>·</span>
          <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#8aa9f7' }}>r/govcon · 38 threads</span>
          <span style={{ color: '#3f3f46' }}>·</span>
          <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#8aa9f7' }}>14 RFPs retrieved</span>
        </div>
      </div>
    </div>
    <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '13px', color: '#71717a' }}>Their inspiration is asserted. <span style={{ color: '#9a9aa3' }}>Ours is cited — and still yours to shape.</span></div>
  </section>

  {/* 5 THE FOOTING */}
  {showFooting && (<>
  <section style={{ maxWidth: '1180px', margin: '0 auto', padding: '130px 24px 0' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#8b7ff0' }}>THE FOOTING · THE RIGOR UNDER THE SPARK</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '40px', lineHeight: '1.12', margin: '14px auto 0', maxWidth: '700px', color: '#fafafa' }}>The footing under the spark.</h2><p style={{ fontSize: '17px', lineHeight: '1.6', color: '#b4b4bd', margin: '16px auto 0', maxWidth: '640px' }}>An angle is only worth shaping if it survives pressure. Deep, Re-evaluate, and Compare give the spark its footing — scores, deltas, tradeoffs, and sources you can inspect.</p></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', marginTop: '48px' }}>
      {/* deep shot */}
      <div style={{ background: '#0b0b0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 0' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', letterSpacing: '.12em', color: '#b3a3f5' }}>DEEP ANALYSIS</div><div style={{ fontSize: '16px', color: '#f0f0f1', fontWeight: '500', marginTop: '8px' }}>The pressure read</div></div>
        <div style={{ padding: '16px 18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}><span style={{ fontFamily: '\'Spectral\',serif', fontSize: '38px', color: '#fafafa' }}>4.7</span><span style={{ fontSize: '13px', color: '#71717a' }}>/ 10 overall</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '14px' }}>
            <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '5px' }}><span>Market demand</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', color: '#5fe3bd' }}>6.0</span></div><div style={{ height: '4px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}><div style={{ width: '60%', height: '100%', borderRadius: '3px', background: '#34d8a8' }}></div></div></div>
            <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '5px' }}><span>Monetization</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', color: '#8aa9f7' }}>4.7</span></div><div style={{ height: '4px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}><div style={{ width: '47%', height: '100%', borderRadius: '3px', background: '#6b93f5' }}></div></div></div>
            <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '5px' }}><span>Originality</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', color: '#b3a3f5' }}>3.6</span></div><div style={{ height: '4px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}><div style={{ width: '36%', height: '100%', borderRadius: '3px', background: '#9d86f0' }}></div></div></div>
            <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '5px' }}><span>Build difficulty</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', color: '#e7bd7a' }}>8.5</span></div><div style={{ height: '4px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}><div style={{ width: '85%', height: '100%', borderRadius: '3px', background: '#e0a857' }}></div></div></div>
          </div>
          <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#52525b', marginTop: '14px' }}>EVERY SCORE OPENS ITS SOURCES</div>
        </div>
      </div>
      {/* re-evaluate shot */}
      <div style={{ background: '#0b0b0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 0' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', letterSpacing: '.12em', color: '#5fe3bd' }}>RE-EVALUATE</div><div style={{ fontSize: '16px', color: '#f0f0f1', fontWeight: '500', marginTop: '8px' }}>The measured delta</div></div>
        <div style={{ padding: '16px 18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'Spectral\',serif', fontSize: '30px', color: '#9a9aa3' }}>4.7</div><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', color: '#71717a', marginTop: '2px' }}>v1</div></div><svg width="34" height="14" viewBox="0 0 34 14" fill="none" style={{ flexShrink: '0' }}><path d="M2 7h26" stroke="#5fe3bd" strokeWidth="1.4" /><path d="M24 3l5 4-5 4" stroke="#5fe3bd" strokeWidth="1.4" fill="none" /></svg><div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'Spectral\',serif', fontSize: '38px', color: '#fafafa' }}>5.9</div><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', color: '#5fe3bd', marginTop: '2px' }}>v3</div></div><div style={{ marginLeft: 'auto', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', color: '#08120e', background: '#5fe3bd', borderRadius: '6px', padding: '5px 9px', fontWeight: '600' }}>+1.2</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', color: '#b4b4bd' }}><span style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(52,216,168,0.12)', border: '1px solid rgba(52,216,168,0.3)', color: '#5fe3bd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>▲</span>Monetization — narrower wedge, clearer buyer</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', color: '#b4b4bd' }}><span style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(52,216,168,0.12)', border: '1px solid rgba(52,216,168,0.3)', color: '#5fe3bd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>▲</span>Originality — the triage angle is unclaimed</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', color: '#9a9aa3' }}><span style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(224,168,87,0.12)', border: '1px solid rgba(224,168,87,0.3)', color: '#e7bd7a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>▬</span>Build difficulty — unchanged, still the wall</div>
          </div>
          <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#52525b', marginTop: '14px' }}>THE CHANGE IS MEASURED, NOT ASSERTED</div>
        </div>
      </div>
      {/* compare shot */}
      <div style={{ background: '#0b0b0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 0' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', letterSpacing: '.12em', color: '#a6b6f5' }}>COMPARE</div><div style={{ fontSize: '16px', color: '#f0f0f1', fontWeight: '500', marginTop: '8px' }}>Two bets, side by side</div></div>
        <div style={{ padding: '16px 18px 20px', display: 'flex', gap: '12px' }}>
          <div style={{ flex: '1', background: 'rgba(107,147,245,0.05)', border: '1px solid rgba(107,147,245,0.2)', borderRadius: '10px', padding: '12px' }}><div style={{ fontSize: '12px', color: '#c2c2c8', lineHeight: '1.4' }}>RFP analyzer</div><div style={{ fontFamily: '\'Spectral\',serif', fontSize: '26px', color: '#f0f0f1', marginTop: '8px' }}>4.7</div><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', color: '#71717a', marginTop: '4px' }}>PLATFORM RISK</div></div>
          <div style={{ flex: '1', background: 'rgba(157,134,240,0.05)', border: '1px solid rgba(157,134,240,0.2)', borderRadius: '10px', padding: '12px' }}><div style={{ fontSize: '12px', color: '#c2c2c8', lineHeight: '1.4' }}>Triage wedge</div><div style={{ fontFamily: '\'Spectral\',serif', fontSize: '26px', color: '#f0f0f1', marginTop: '8px' }}>5.9</div><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', color: '#71717a', marginTop: '4px' }}>SUBSTITUTION RISK</div></div>
        </div>
        <div style={{ padding: '0 18px 18px', fontSize: '12.5px', color: '#9a9aa3', lineHeight: '1.5' }}>The call comes down to which wall you’d rather clear — laid out, not chosen for you.</div>
      </div>
    </div>
  </section>
  </>)}

  {/* 6 THE TRACE — LINEAGE (compact, ghosted) */}
  <section style={{ maxWidth: '1180px', margin: '0 auto', padding: '130px 24px 0' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#5fe3bd' }}>THE TRACE · THE IDEA’S MEMORY</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '40px', lineHeight: '1.12', margin: '14px auto 0', maxWidth: '700px', color: '#fafafa' }}>Every version, branch, and killed path stays on record.</h2><p style={{ fontSize: '17px', lineHeight: '1.6', color: '#b4b4bd', margin: '16px auto 0', maxWidth: '640px' }}>This is the one thing your head cannot do. You can turn an idea over ten times and still lose the genealogy of how you got there. IdeaLoop Core keeps the path.</p></div>

    <div style={{ position: 'relative', marginTop: '42px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.09)', background: '#0b0b0f', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', overflow: 'hidden', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#ef6a6a', opacity: '.7' }}></span><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#e0a857', opacity: '.7' }}></span><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#34d8a8', opacity: '.7' }}></span><span style={{ marginLeft: '14px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', color: '#5b5b64' }}>idealoop.core / lineage — AI procurement RFP analyzer</span></div>
      <div style={{ padding: '14px' }}><div style={{ background: 'radial-gradient(120% 90% at 30% -10%, #141326 0%, #0c0c14 50%, #08080d 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '18px 14px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,sans-serif', overflow: 'hidden' }}>

  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
    <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.16em', color: '#71717a' }}>IDEA EVOLUTION · ONE SPARK, FIVE GENERATIONS</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#9a9aa3' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8a8a93' }}></span>Rough</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b93f5' }}></span>Explore</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9d86f0' }}></span>Deep</span>
      <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.12)' }}></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d8a8' }}></span>Active</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e0a857' }}></span>Parked</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef6a6a' }}></span>Killed</span>
    </div>
  </div>

  <div ref={boardRef} style={{ position: 'relative', width: '100%', height: '360px', overflow: 'hidden' }}>
  <div style={{ position: 'absolute', left: '0', top: '0', width: '1240px', height: '360px', transformOrigin: 'top left' }}>

    {/* stage headers */}
    <div style={{ position: 'absolute', left: '20px', top: '4px', width: '200px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '19px', height: '19px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#c8c8cc' }}>1</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.12em', color: '#8a8a93' }}>SPARK</span></div></div>
    <div style={{ position: 'absolute', left: '270px', top: '4px', width: '170px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '19px', height: '19px', borderRadius: '50%', border: '1px solid rgba(107,147,245,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#8aa9f7' }}>2</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.12em', color: '#8aa9f7' }}>EXPLORE</span></div></div>
    <div style={{ position: 'absolute', left: '540px', top: '4px', width: '200px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '19px', height: '19px', borderRadius: '50%', border: '1px solid rgba(157,134,240,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#b3a3f5' }}>3</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.12em', color: '#b3a3f5' }}>DEEP</span></div></div>
    <div style={{ position: 'absolute', left: '812px', top: '4px', width: '200px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '19px', height: '19px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#c8c8cc' }}>4</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.12em', color: '#c8c8cc' }}>EVOLVE</span></div></div>
    <div style={{ position: 'absolute', left: '1035px', top: '4px', width: '205px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '19px', height: '19px', borderRadius: '50%', border: '1px solid rgba(52,216,168,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10px', color: '#5fe3bd' }}>5</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11px', letterSpacing: '.12em', color: '#5fe3bd' }}>TODAY</span></div></div>

    {/* connectors */}
    <svg viewBox="0 0 1240 360" width="1240" height="360" style={{ position: 'absolute', inset: '0', overflow: 'visible' }}>
      <defs>
        <linearGradient id="spine" x1="0" y1="0" x2="1240" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#8a8a93" /><stop offset="22%" stopColor="#6b93f5" /><stop offset="52%" stopColor="#9d86f0" /><stop offset="80%" stopColor="#6b93f5" /><stop offset="100%" stopColor="#34d8a8" /></linearGradient>
        <filter id="sglow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      {/* ghost side paths */}
      <path d="M212,196 C238,150 250,96 270,90" stroke="rgba(255,255,255,0.07)" strokeWidth="1.2" fill="none" strokeDasharray="3 5" />
      <path d="M212,196 C238,244 250,288 270,292" stroke="rgba(255,255,255,0.07)" strokeWidth="1.2" fill="none" strokeDasharray="3 5" />
      <path d="M620,200 C660,240 660,270 660,288" stroke="rgba(239,106,106,0.25)" strokeWidth="1.2" fill="none" strokeDasharray="3 5" />
      <path d="M912,196 C912,240 912,262 912,284" stroke="rgba(224,168,87,0.26)" strokeWidth="1.2" fill="none" strokeDasharray="3 5" />
      {/* bright spine glow */}
      <path d="M212,196 C238,190 250,186 270,184 M428,184 C480,188 500,192 540,190 M745,190 C775,188 795,186 812,186 M1012,186 C1020,188 1028,190 1035,190" stroke="url(#spine)" strokeWidth="7" fill="none" opacity="0.16" filter="url(#sglow)" />
      {/* spine */}
      <path d="M212,196 C238,190 250,186 270,184" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
      <path d="M428,184 C480,188 500,192 540,190" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
      <path d="M745,190 C775,188 795,186 812,186" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
      <path d="M1012,186 C1020,188 1028,190 1035,190" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
    </svg>

    {/* SPARK rough (spine) */}
    <div style={{ position: 'absolute', left: '20px', top: '150px', width: '188px', background: 'rgba(255,255,255,0.028)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '13px', padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9a9aa3" strokeWidth="1.7"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg></span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.14em', color: '#8a8a93' }}>ROUGH</span></div>
      <div style={{ fontSize: '13px', color: '#e4e4e7', fontWeight: '500', marginTop: '9px' }}>The rough spark</div>
      <div style={{ fontSize: '11.5px', color: '#8a8a93', marginTop: '5px', lineHeight: '1.45' }}>“An AI that reads RFP responses for government procurement teams.”</div>
    </div>

    {/* ghost angles */}
    <div style={{ position: 'absolute', left: '270px', top: '62px', width: '150px', background: 'rgba(255,255,255,0.014)', border: '1px solid rgba(107,147,245,0.14)', borderRadius: '10px', padding: '8px 12px', opacity: '0.38' }}>
      <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8.5px', letterSpacing: '.12em', color: '#8aa9f7' }}>ANGLE</div>
      <div style={{ fontSize: '11.5px', color: '#bdbdc4', marginTop: '3px' }}>Positioning shift</div>
    </div>
    <div style={{ position: 'absolute', left: '270px', top: '262px', width: '150px', background: 'rgba(255,255,255,0.014)', border: '1px solid rgba(107,147,245,0.14)', borderRadius: '10px', padding: '8px 12px', opacity: '0.42' }}>
      <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8.5px', letterSpacing: '.12em', color: '#8aa9f7' }}>ANGLE</div>
      <div style={{ fontSize: '11.5px', color: '#cdcdd4', marginTop: '3px' }}>Use-case shift — dead end</div>
    </div>
    {/* EXPLORE pursued (spine) */}
    <div style={{ position: 'absolute', left: '270px', top: '152px', width: '158px', background: 'linear-gradient(150deg,rgba(22,28,44,0.95),rgba(13,15,23,0.95))', border: '1px solid rgba(107,147,245,0.4)', borderRadius: '11px', padding: '10px 13px', boxShadow: '0 0 24px rgba(107,147,245,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8.5px', letterSpacing: '.12em', color: '#8aa9f7' }}>ANGLE · PURSUED</span><svg width="34" height="13" viewBox="0 0 34 13" fill="none"><polyline points="2,9 9,4 16,7 24,3 32,6" stroke="#6b7c9e" strokeWidth="1.1" /></svg></div>
      <div style={{ fontSize: '12.5px', color: '#e4e4e7', fontWeight: '500', marginTop: '6px' }}>Target wedge</div>
      <div style={{ fontSize: '10.5px', color: '#8aa9f7', marginTop: '3px' }}>municipal & county entry</div>
    </div>

    {/* DEEP verdict (spine) */}
    <div style={{ position: 'absolute', left: '540px', top: '148px', width: '205px', background: 'linear-gradient(150deg,rgba(26,21,40,0.95),rgba(14,12,20,0.95))', border: '1px solid rgba(157,134,240,0.4)', borderRadius: '13px', padding: '12px 15px', boxShadow: '0 0 26px rgba(157,134,240,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(157,134,240,0.16)', border: '1px solid rgba(157,134,240,0.36)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b3a3f5" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg></span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.14em', color: '#b3a3f5' }}>DEEP</span></div><span style={{ fontFamily: '\'Spectral\',serif', fontSize: '18px', color: '#e4e4e7' }}>4.7</span></div>
      <div style={{ fontSize: '13px', color: '#e8e8ea', fontWeight: '500', marginTop: '9px' }}>First read</div>
      <div style={{ fontSize: '11.5px', color: '#9a9aa3', marginTop: '4px', lineHeight: '1.45' }}>Real pain, unbuilt moat, high compliance cost.</div>
    </div>
    {/* ghost DEEP killed */}
    <div style={{ position: 'absolute', left: '540px', top: '288px', width: '205px', background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(239,106,106,0.18)', borderRadius: '11px', padding: '8px 13px', opacity: '0.5' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8.5px', letterSpacing: '.14em', color: '#9d86f0' }}>DEEP</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8px', letterSpacing: '.1em', color: '#ee8a8a', background: 'rgba(239,106,106,0.1)', border: '1px solid rgba(239,106,106,0.28)', padding: '1px 6px', borderRadius: '4px' }}>KILLED</span></div>
      <div style={{ fontSize: '11.5px', color: '#b8b8bd', marginTop: '4px' }}>Resale data module</div>
    </div>

    {/* EVOLVE explore (spine) */}
    <div style={{ position: 'absolute', left: '812px', top: '148px', width: '200px', background: 'linear-gradient(150deg,rgba(22,28,44,0.95),rgba(13,15,23,0.95))', border: '1px solid rgba(107,147,245,0.4)', borderRadius: '13px', padding: '12px 15px', boxShadow: '0 0 24px rgba(107,147,245,0.09)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(107,147,245,0.16)', border: '1px solid rgba(107,147,245,0.36)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg></span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.14em', color: '#8aa9f7' }}>EXPLORE</span></div><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8.5px', letterSpacing: '.1em', color: '#5b5b64' }}>FORKED</span></div>
      <div style={{ fontSize: '13px', color: '#e8e8ea', fontWeight: '500', marginTop: '9px' }}>Tyler Munis native wedge</div>
      <div style={{ fontSize: '11.5px', color: '#9a9aa3', marginTop: '4px', lineHeight: '1.45' }}>A positioning shift — v1 stays intact beside it.</div>
    </div>
    {/* ghost EVOLVE parked */}
    <div style={{ position: 'absolute', left: '812px', top: '288px', width: '200px', background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(224,168,87,0.2)', borderRadius: '11px', padding: '8px 13px', opacity: '0.52' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8.5px', letterSpacing: '.14em', color: '#9d86f0' }}>DEEP</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '8px', letterSpacing: '.1em', color: '#e7bd7a', background: 'rgba(224,168,87,0.1)', border: '1px solid rgba(224,168,87,0.28)', padding: '1px 6px', borderRadius: '4px' }}>PARKED 3.6</span></div>
      <div style={{ fontSize: '11.5px', color: '#c8c8cc', marginTop: '4px' }}>Protest-defense layer</div>
    </div>

    {/* TODAY lead */}
    <div style={{ position: 'absolute', left: '1035px', top: '144px', width: '205px', background: 'linear-gradient(150deg,rgba(14,32,28,0.95),rgba(11,18,20,0.95))', border: '1px solid rgba(52,216,168,0.5)', borderRadius: '13px', padding: '14px 15px', boxShadow: '0 0 46px rgba(52,216,168,0.16)' }}>
      <div style={{ position: 'absolute', right: '14px', top: '-12px', fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.12em', color: '#06120e', background: '#5fe3bd', padding: '3px 9px', borderRadius: '5px', fontWeight: '500' }}>LEAD</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'rgba(107,147,245,0.16)', border: '1px solid rgba(107,147,245,0.36)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg></span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '9px', letterSpacing: '.14em', color: '#8aa9f7' }}>EXPLORE</span></div><span style={{ fontFamily: '\'Spectral\',serif', fontSize: '18px', color: '#f0f0f1' }}>5.9</span></div>
      <div style={{ fontSize: '13.5px', color: '#f4f4f5', fontWeight: '600', marginTop: '9px' }}>Munis-native integration moat</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px' }}><span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d8a8' }}></span><span style={{ fontSize: '11px', color: '#5fe3bd', fontFamily: '\'JetBrains Mono\',monospace', letterSpacing: '.04em' }}>ACTIVE · G5 · YOU ARE HERE</span></div>
    </div>
  </div>
  </div>

  <div style={{ marginTop: '6px', textAlign: 'center', fontSize: '13px', color: '#71717a' }}>From one rough sentence to a backed bet — <span style={{ color: '#9a9aa3' }}>five generations, every angle and dead end kept on the record.</span></div>
</div></div>
    </div>
  </section>

  {/* 7 THE HANDOFF — gates-forward compact */}
  <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '130px 24px 0' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#8b7ff0' }}>THE HANDOFF · EXECUTION BRIEF</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '40px', lineHeight: '1.12', margin: '14px auto 0', maxWidth: '720px', color: '#fafafa' }}>Where the read stops — your first move begins.</h2><p style={{ fontSize: '17px', lineHeight: '1.6', color: '#b4b4bd', margin: '16px auto 0', maxWidth: '600px' }}>Most tools end at a verdict. IdeaLoop Core ends at a handoff: the first wall to clear, and the gates that tell you when to revise or stop.</p></div>

    <div style={{ marginTop: '44px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px', background: '#0b0b0f', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', padding: '30px 32px 32px', textAlign: 'left' }}>
      {/* the bet */}
      <div style={{ borderLeft: '2px solid #8b7ff0', background: 'rgba(139,127,240,0.05)', borderRadius: '0 12px 12px 0', padding: '18px 22px' }}>
        <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '10.5px', letterSpacing: '.14em', color: '#b3a3f5' }}>THE BET</div>
        <div style={{ fontFamily: '\'Spectral\',serif', fontStyle: 'italic', fontSize: '19px', lineHeight: '1.5', color: '#ececf0', marginTop: '9px' }}>The wall here is the build — the integration and audit-trail infrastructure that give the product its only defensible position.</div>
      </div>

      {/* decision gates, front and center */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '22px' }}>
        <div style={{ border: '1px solid rgba(224,168,87,0.3)', borderRadius: '13px', padding: '20px 22px', background: 'rgba(224,168,87,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'rgba(224,168,87,0.12)', border: '1px solid rgba(224,168,87,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e7bd7a', fontSize: '14px' }}>⎆</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.12em', color: '#e7bd7a' }}>REVISE IF</span></div>
          <div style={{ fontSize: '14px', lineHeight: '1.55', color: '#b4b4bd', marginTop: '12px' }}>After six months of outreach, no technical co-founder commits — the path re-cuts toward a vendor or systems-integrator arrangement.</div>
        </div>
        <div style={{ border: '1px solid rgba(239,106,106,0.32)', borderRadius: '13px', padding: '20px 22px', background: 'rgba(239,106,106,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'rgba(239,106,106,0.12)', border: '1px solid rgba(239,106,106,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef6a6a', fontSize: '15px' }}>✕</span><span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.12em', color: '#ef8a8a' }}>STOP IF</span></div>
          <div style={{ fontSize: '14px', lineHeight: '1.55', color: '#b4b4bd', marginTop: '12px' }}>Eighteen months in, the ERP layer is unbuilt and no certified pathway is active at a named account — the build wall has not moved despite a genuine attempt.</div>
        </div>
      </div>

      <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.06)', fontFamily: '\'Spectral\',serif', fontStyle: 'italic', fontSize: '16px', color: '#8b7ff0' }}>The read ends here — your first move belongs to you.</div>
    </div>
  </section>

  {/* 8 WHY NOT */}
  <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '130px 24px 0' }}>
    <div style={{ textAlign: 'center' }}><div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#6b7280' }}>WHY NOT JUST CHATGPT?</div><h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '40px', lineHeight: '1.12', margin: '14px auto 0', maxWidth: '640px', color: '#fafafa' }}>Two tools grade your idea. One widens it.</h2></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px', marginTop: '48px' }}>
      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '26px' }}><div style={{ fontSize: '16px', color: '#d4d4d8', fontWeight: '600' }}>A chat assistant</div><div style={{ fontSize: '13.5px', color: '#71717a', marginTop: '6px' }}>ChatGPT, Claude</div><div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '18px 0' }}></div><div style={{ display: 'flex', flexDirection: 'column', gap: '11px', fontSize: '13.5px', color: '#b4b4bd' }}><div>×  Excited directions, no evidence behind them</div><div>×  Forgets structure between chats</div><div>×  No versions, no lineage</div></div></div>
      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '26px' }}><div style={{ fontSize: '16px', color: '#d4d4d8', fontWeight: '600' }}>An idea validator</div><div style={{ fontSize: '13.5px', color: '#71717a', marginTop: '6px' }}>one-off scoring tools</div><div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '18px 0' }}></div><div style={{ display: 'flex', flexDirection: 'column', gap: '11px', fontSize: '13.5px', color: '#b4b4bd' }}><div>×  Hands you a static report</div><div>×  Dies the moment the idea changes</div><div>×  Grades the idea — never widens it</div></div></div>
      <div style={{ background: 'linear-gradient(180deg,rgba(52,216,168,0.06),rgba(255,255,255,0.012))', border: '1px solid rgba(52,216,168,0.3)', borderRadius: '16px', padding: '26px', boxShadow: '0 0 50px rgba(52,216,168,0.07)' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#34d8a8', fontSize: '17px' }}>∞</span><span style={{ fontSize: '16px', color: '#f4f4f5', fontWeight: '600' }}>IdeaLoop Core</span></div><div style={{ fontSize: '13.5px', color: '#5fe3bd', marginTop: '6px' }}>grounded inspiration</div><div style={{ height: '1px', background: 'rgba(52,216,168,0.18)', margin: '18px 0' }}></div><div style={{ display: 'flex', flexDirection: 'column', gap: '11px', fontSize: '13.5px', color: '#c8c8cc' }}><div style={{ color: '#5fe3bd' }}>✓  Directions worth shaping, with the receipts</div><div style={{ color: '#5fe3bd' }}>✓  Every version branched & kept</div><div style={{ color: '#5fe3bd' }}>✓  Re-evaluates as evidence changes</div></div></div>
    </div>
  </section>

  {/* 9 WHEN TO OPEN A LOOP — compressed strip */}
  <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '120px 24px 0', textAlign: 'center' }}>
    <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', letterSpacing: '.18em', color: '#34d8a8' }}>WHEN TO OPEN A LOOP</div>
    <h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '30px', lineHeight: '1.18', margin: '12px auto 0', maxWidth: '600px', color: '#f0f0f1' }}>Whenever the next move needs footing.</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginTop: '26px' }}>
      <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12.5px', color: '#c2c2c8', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '9px 16px' }}>a new idea</span>
      <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12.5px', color: '#c2c2c8', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '9px 16px' }}>a pivot on the table</span>
      <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12.5px', color: '#c2c2c8', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '9px 16px' }}>before you write code</span>
      <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12.5px', color: '#c2c2c8', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '9px 16px' }}>before you hire</span>
      <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12.5px', color: '#c2c2c8', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '9px 16px' }}>before you launch</span>
      <span style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12.5px', color: '#c2c2c8', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '9px 16px' }}>setting an idea down</span>
    </div>
  </section>

  {/* 10 BETA — free while in beta, with the overflow waitlist. Replaces the old
      placeholder pricing section; no credits or prices are shown during beta. */}
  <section id="beta" style={{ maxWidth: '760px', margin: '0 auto', padding: '128px 24px 0', scrollMarginTop: '88px', textAlign: 'center' }}>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', letterSpacing: '.2em', color: '#9a9aa3', textTransform: 'uppercase' }}><span style={{ color: '#34d8a8', fontSize: '15px', lineHeight: '1' }}>&infin;</span> The beta</div>
    <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: '500', fontSize: '40px', lineHeight: '1.12', letterSpacing: '-0.01em', margin: '16px auto 0', color: '#fafafa' }}>It&rsquo;s free while it&rsquo;s in beta.</h2>
    <p style={{ fontSize: '16.5px', color: '#a1a1aa', margin: '16px auto 0', maxWidth: '600px', lineHeight: '1.62' }}>No card, no credits, no catch — full access to Explore and Deep while the engine&rsquo;s being tuned. When the beta ends you&rsquo;ll hear the pricing here first, and nothing is ever charged without you choosing it.</p>

    <div style={{ maxWidth: '640px', margin: '34px auto 0', textAlign: 'left', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '26px 30px' }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '10px', letterSpacing: '.2em', color: '#9a9aa3', textTransform: 'uppercase', marginBottom: '16px' }}>How the beta runs</div>
      <div style={{ display: 'flex', gap: '14px', paddingBottom: '13px' }}><span style={{ color: '#34d8a8', fontSize: '14px', marginTop: '1px' }}>✓</span><div><div style={{ fontSize: '14px', color: '#fafafa', fontWeight: '500' }}>Free, full access.</div><div style={{ fontSize: '13.5px', color: '#9a9aa3', lineHeight: '1.58', marginTop: '3px' }}>Explore and Deep, no paywall, no card on file.</div></div></div>
      <div style={{ display: 'flex', gap: '14px', padding: '13px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}><span style={{ color: '#34d8a8', fontSize: '14px', marginTop: '1px' }}>✓</span><div><div style={{ fontSize: '14px', color: '#fafafa', fontWeight: '500' }}>A loop&rsquo;s worth of runs each week.</div><div style={{ fontSize: '13.5px', color: '#9a9aa3', lineHeight: '1.58', marginTop: '3px' }}>Enough to put one real idea through Explore &rarr; Deep &rarr; Re-evaluate. Compare is always free.</div></div></div>
      <div style={{ display: 'flex', gap: '14px', paddingTop: '13px', borderTop: '1px solid rgba(255,255,255,0.07)' }}><span style={{ color: '#34d8a8', fontSize: '14px', marginTop: '1px' }}>✓</span><div><div style={{ fontSize: '14px', color: '#fafafa', fontWeight: '500' }}>Kept small on purpose.</div><div style={{ fontSize: '13.5px', color: '#9a9aa3', lineHeight: '1.58', marginTop: '3px' }}>A weekly cap keeps the beta something one person can watch closely and stand behind. If a week is full when you arrive, save your spot and I&rsquo;ll open one.</div></div></div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '30px', flexWrap: 'wrap' }}>
      <span onClick={onStartLoop} style={{ fontSize: '15.5px', fontWeight: '600', color: '#fff', background: '#8b7ff0', padding: '14px 28px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 8px 30px rgba(139,127,240,0.28)' }}>Start an idea loop &rarr;</span>
      {wlState !== "done" && (<span onClick={() => setWlOpen((v) => !v)} style={{ fontSize: '15px', fontWeight: '500', color: '#d4d4d8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)', padding: '14px 24px', borderRadius: '12px', cursor: 'pointer' }}>Save your spot</span>)}
    </div>

    {wlOpen && wlState !== "done" && (
      <div style={{ maxWidth: '420px', margin: '18px auto 0' }}>
        <div style={{ display: 'flex', gap: '9px' }}>
          <input type="email" value={wlEmail} onChange={(ev) => setWlEmail(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") submitWaitlist(); }} placeholder="you@email.com" disabled={wlState === "sending"} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '10px', padding: '11px 13px', fontSize: '13.5px', color: '#fafafa', outline: 'none' }} />
          <span onClick={submitWaitlist} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', fontWeight: '500', color: '#062b22', background: '#34d8a8', borderRadius: '10px', padding: '11px 16px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: wlState === "sending" ? 0.7 : 1 }}>{wlState === "sending" ? "Saving…" : "Save my spot"}</span>
        </div>
        {wlErr && (<div style={{ fontSize: '12px', color: '#ee8a8a', marginTop: '8px', textAlign: 'left' }}>{wlErr}</div>)}
      </div>
    )}
    {wlState === "done" && (<div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', color: '#34d8a8', marginTop: '20px' }}>&#10003; You&rsquo;re on the list — I&rsquo;ll email when a spot opens.</div>)}

    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#52525b', marginTop: '20px' }}>NO CARD · YOUR FIRST RUN IS FREE</div>
  </section>

  {/* 11 FINAL CTA — recognition close */}
  <section style={{ maxWidth: '900px', margin: '0 auto', padding: '140px 24px 0', textAlign: 'center' }}>
    <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '64px 40px', overflow: 'hidden', background: 'radial-gradient(120% 140% at 50% 0%, rgba(52,216,168,0.08), rgba(139,127,240,0.05) 40%, transparent 70%)' }}>
      <h2 style={{ fontFamily: '\'Spectral\',serif', fontWeight: '500', fontSize: '44px', lineHeight: '1.12', letterSpacing: '-0.01em', color: '#fafafa' }}>You already run this loop.<br />Give it somewhere to live.</h2>
      <p style={{ fontSize: '17px', color: '#a1a1aa', margin: '16px auto 0', maxWidth: '520px', lineHeight: '1.6' }}>Bring one rough idea. Leave with grounded directions, a first read, and a record you can return to.</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '30px' }}><span onClick={onStartLoop} style={{ fontSize: '16px', fontWeight: '600', color: '#fff', background: '#8b7ff0', padding: '15px 30px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 8px 30px rgba(139,127,240,0.3)' }}>Start an idea loop →</span>{showSample && (<span style={{ fontSize: '16px', fontWeight: '500', color: '#d4d4d8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', padding: '15px 26px', borderRadius: '12px', cursor: 'pointer' }} onClick={onViewSampleFn}>View a sample loop</span>)}</div>
      <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '12px', color: '#52525b', marginTop: '22px' }}>NO CARD · YOUR FIRST RUN IS FREE</div>
    </div>
  </section>

  {/* FOOTER */}
  <footer style={{ maxWidth: '1180px', margin: '120px auto 0', padding: '80px 24px 50px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}><img src="/idealoop-wordmark.png" alt="IdeaLoop Core" style={{ display: 'block', height: '26px', width: 'auto' }} /></div>
      <div style={{ display: 'flex', gap: '26px', fontSize: '13.5px', flexWrap: 'wrap' }}><a className="navlink" href="#the-loop">The loop</a><a className="navlink" href="#explore">Explore</a><a className="navlink" href="#beta">Beta</a><a className="navlink" href="/privacy">Privacy</a><a className="navlink" href="/terms">Terms</a><a className="navlink" href="/disclaimer">Disclaimer</a><span onClick={onLogIn} style={{ color: '#9a9aa3', cursor: 'pointer' }}>Log in</span></div>
      <div style={{ fontSize: '13px', color: '#52525b' }}>© 2026 IdeaLoop Core</div>
    </div>
    <div style={{ fontFamily: '\'JetBrains Mono\',monospace', fontSize: '11.5px', color: '#52525b', marginTop: '26px', lineHeight: '1.5' }}>All analysis is AI-generated. Use as a guide, not a definitive assessment.</div>
  </footer>
</div>
  );
}