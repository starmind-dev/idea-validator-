"use client";

// MyPlanView.js — the "My plan" rail screen (dashView === "plan").
//
// Three honest parts, all backed by what the schema can prove today:
//   • Standing      — Beta · Free. No card, no charge.
//   • This week      — the rolling run allowance, metered FUNGIBLY: any mix of
//                      explore / deep / re-evaluate counts the same, compare is
//                      free. Pips + count + refill day are read LIVE from
//                      /api/eval-usage (the same entitlement the run-button nudge
//                      reads) — never invented.
//   • After beta     — names the pricing SHAPE (flat plan + pay-as-you-go runs)
//                      without a number, because none is set yet, and makes the
//                      promise instead. No price, no checkout: those appear only
//                      when Polar is live.
//
// Self-injects Spectral + JetBrains Mono and owns its palette, matching the
// Overview idiom. `t` is accepted for call-site parity; the content uses C below.
//
// Props: t (compat) · isAnon · onSignUp · onRunLoop

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ── design palette (shared with OverviewView) ────────────────────────────────
const C = {
  text: "#fafafa", sec: "#c8c8cc", sec2: "#b4b4bd", mut: "#9a9aa3", mut2: "#71717a",
  faint: "#6b7280", faint2: "#52525b",
  teal: "#5fe3bd", tealDeep: "#34d8a8", tealDim: "rgba(52,216,168,0.4)",
  line: "rgba(255,255,255,0.07)", line2: "rgba(255,255,255,0.05)",
  panel: "rgba(255,255,255,0.018)",
};
const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Spectral',serif";

// idempotent — reuses the Overview font id so it loads once app-wide.
function useDesignFonts() {
  useEffect(() => {
    const id = "ilc-ov-fonts";
    if (document.getElementById(id)) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "";
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Spectral:wght@400;500&family=JetBrains+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(pre1); document.head.appendChild(pre2); document.head.appendChild(link);
  }, []);
}

const eyebrow = (color = C.faint, size = 12, ls = ".16em") => ({
  fontFamily: MONO, fontSize: size, letterSpacing: ls, color, margin: 0,
});

// weekday form of the refill moment (rolling 7-day window → always within a week)
function refillDay(iso) {
  if (!iso) return "soon";
  const d = new Date(iso), now = new Date();
  if (d - now <= 0) return "shortly";
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dd = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5);
  if (dd <= 0) return "later today";
  if (dd === 1) return "tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

const Panel = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 28px", marginTop: 20, ...style }}>
    {children}
  </div>
);

function Badge({ label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: C.tealDeep, border: `1px solid ${C.tealDim}`, borderRadius: 999, padding: "4px 12px" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.tealDeep, boxShadow: "0 0 7px 1px rgba(52,216,168,0.6)" }} />
      {label}
    </span>
  );
}

// live allowance panel — pips, count, refill, and the fungible-runs explainer
function ThisWeek({ ent }) {
  const total = ent?.runsPerWeek ?? 3;
  const left = Math.max(0, ent?.runsLeft ?? 0);
  const used = Math.max(0, ent?.runsUsed ?? (total - left));
  const refill =
    left <= 0 ? `Refills ${refillDay(ent?.nextRunFreesAt)}`
    : used === 0 ? "Your full week is open"
    : "Refills as the week rolls forward";
  return (
    <Panel>
      <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 16 }}>THIS WEEK</div>
      <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 500, color: C.text }}>
        {left} run{left === 1 ? "" : "s"} left
      </div>
      <div style={{ display: "flex", gap: 8, margin: "16px 0 14px" }}>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} style={{
            width: 46, height: 6, borderRadius: 999,
            background: i < left ? C.tealDeep : "rgba(255,255,255,0.06)",
            border: i < left ? "1px solid transparent" : `1px solid ${C.line}`,
            boxShadow: i < left ? "0 0 10px -1px rgba(52,216,168,0.45)" : "none",
          }} />
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: ".02em", color: C.sec2 }}>{refill}</div>
      <div style={{ fontSize: 13, lineHeight: 1.62, color: C.mut, marginTop: 14, maxWidth: 484 }}>
        {total} run{total === 1 ? "" : "s"} a week — enough for one full loop (explore → deep → re-evaluate), or spent however the idea needs: three explores, two deep dives, any mix at all. Compare is always free.
      </div>
    </Panel>
  );
}

// after-beta panel — names the shape (flat + PAYG), no numbers, then the promise
function AfterBeta({ onRunLoop }) {
  return (
    <Panel>
      <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 16 }}>WHAT HAPPENS AFTER BETA</div>
      <p style={{ fontSize: 14.5, lineHeight: 1.68, color: C.sec2, margin: "0 0 14px", maxWidth: 500 }}>
        Beta stays free while the engine&rsquo;s being tuned. When it ends, pricing stays simple — a flat plan for regular use, and pay-as-you-go runs for the occasional one.
      </p>
      <p style={{ fontSize: 14.5, lineHeight: 1.68, color: "#cdd2da", margin: 0, maxWidth: 500 }}>
        Pricing isn&rsquo;t set yet. <span style={{ color: C.tealDeep }}>You&rsquo;ll hear it here first, and nothing is ever charged without you choosing it.</span>
      </p>
      {onRunLoop && (
        <span
          onClick={onRunLoop}
          style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12.5, color: C.tealDeep, cursor: "pointer", borderBottom: "1px solid rgba(52,216,168,0.35)", paddingBottom: 2 }}
        >
          Run a loop →
        </span>
      )}
    </Panel>
  );
}

export default function MyPlanView({ t, isAnon = false, onSignUp, onRunLoop }) {
  useDesignFonts();
  const [ent, setEnt] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    if (isAnon) { setStatus("ready"); return; }
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { if (alive) setStatus("ready"); return; }
        const res = await fetch("/api/eval-usage", { headers: { Authorization: `Bearer ${session.access_token}` } });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "x");
        if (alive) { setEnt(d); setStatus("ready"); }
      } catch { if (alive) setStatus("error"); }
    })();
    return () => { alive = false; };
  }, [isAnon]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* header */}
        <div style={{ ...eyebrow(C.faint, 12, ".2em"), display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span style={{ color: C.tealDeep, fontSize: 15 }}>∞</span> MY PLAN
        </div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.01em", margin: "15px 0 0", color: C.text }}>
          You&rsquo;re on the free beta.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: C.sec2, margin: "12px 0 0", maxWidth: 520 }}>
          Full access to Explore and Deep — no card, no charge — while the engine is being tuned.
        </p>
        <div style={{ marginTop: 16 }}><Badge label="Beta · Free" /></div>

        {/* this week */}
        {isAnon ? (
          <Panel>
            <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 14 }}>THIS WEEK</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.68, color: C.sec2, margin: "0 0 18px", maxWidth: 500 }}>
              Sign in to start your week — you get a loop&rsquo;s worth of runs, and everything you make is saved. Trying it costs nothing: your first run is on us.
            </p>
            <button
              onClick={onSignUp}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(52,216,168,0.55)"; e.currentTarget.style.color = "#dffaf1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#e7ebf2"; }}
              style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: ".01em", color: "#e7ebf2", background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, padding: "12px 22px", cursor: "pointer", transition: "border-color .18s,color .18s" }}
            >
              Sign in to start →
            </button>
          </Panel>
        ) : status === "loading" ? (
          <Panel><p style={{ fontFamily: MONO, fontSize: 12.5, color: C.faint, margin: 0 }}>Loading your plan…</p></Panel>
        ) : status === "error" ? (
          <Panel><p style={{ fontSize: 13.5, color: C.mut, margin: 0 }}>Couldn&rsquo;t load your usage just now — try again in a moment.</p></Panel>
        ) : ent?.unlimited ? (
          <Panel>
            <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 14 }}>THIS WEEK</div>
            <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: 500, color: C.text }}>Unlimited runs</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.mut, marginTop: 12 }}>Developer access — no weekly cap.</p>
          </Panel>
        ) : (
          <ThisWeek ent={ent} />
        )}

        {/* after beta */}
        <AfterBeta onRunLoop={isAnon ? null : onRunLoop} />
      </div>
    </div>
  );
}