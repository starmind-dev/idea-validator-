// src/app/CapacityWall.js
// The at-capacity wall. Shown only when a run is refused with HTTP 503 / code
// "CAPACITY" — the GLOBAL weekly budget guard (the whole beta hit its ceiling),
// distinct from a per-user LIMIT (402) which keeps the existing "your runs refill
// {day}" nudge. Calm, honest, not a paywall: names the cap, reassures that saved
// work is untouched, and offers the overflow waitlist. Self-contained — it POSTs
// its own email to /api/waitlist (source: capacity_wall). Rendered once inside
// DashboardShell so it overlays every in-app screen.
"use client";
import { useState } from "react";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Spectral',serif";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CapacityWall({ onClose }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [err, setErr] = useState("");

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setErr("Enter a valid email."); return; }
    setState("sending"); setErr("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, source: "capacity_wall" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error || "Could not save. Try again."); setState("error"); return; }
      setState("done");
    } catch (_) { setErr("Could not save. Try again."); setState("error"); }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(4,5,8,0.72)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          width: "100%", maxWidth: "460px",
          background: "radial-gradient(120% 90% at 50% 0%,rgba(52,216,168,0.05),transparent 60%),#0d0f14",
          border: "1px solid rgba(255,255,255,0.09)", borderRadius: "18px",
          padding: "32px 32px 28px", boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      >
        {state === "done" ? (
          <div>
            <span style={{
              display: "inline-flex", width: "34px", height: "34px", borderRadius: "50%",
              background: "rgba(52,216,168,0.09)", border: "1px solid rgba(52,216,168,0.4)",
              alignItems: "center", justifyContent: "center", color: "#34d8a8", marginBottom: "14px",
            }}>✓</span>
            <div style={{ fontFamily: SERIF, fontSize: "19px", color: "#fafafa", marginBottom: "8px" }}>You&rsquo;re on the list.</div>
            <div style={{ fontSize: "13.5px", color: "#a1a1aa", lineHeight: 1.6 }}>
              I&rsquo;ll email the moment a spot opens — usually as the week rolls forward. Nothing else needed from you.
            </div>
            <div style={{ fontSize: "11.5px", color: "#71717a", lineHeight: 1.6, marginTop: "18px" }}>
              Meanwhile your saved work stays open — read, compare, and browse everything you&rsquo;ve already made.
            </div>
            <div
              onClick={onClose}
              style={{
                marginTop: "22px", textAlign: "center", fontSize: "13.5px", fontWeight: 600,
                color: "#e8e8ea", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px",
                padding: "11px", cursor: "pointer",
              }}
            >Back to my ideas</div>
          </div>
        ) : (
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "9px",
              fontFamily: MONO, fontSize: "11px", letterSpacing: ".18em", color: "#9a9aa3", textTransform: "uppercase",
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d8a8", boxShadow: "0 0 7px 1px rgba(52,216,168,0.55)" }} />
              The beta is full
            </div>
            <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: "27px", lineHeight: 1.18, color: "#fafafa", margin: "16px 0 0" }}>
              Full for this week.
            </div>
            <p style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.66, margin: "14px 0 0" }}>
              ILC runs on a set number of runs each week — small enough that one founder can cover the cost and actually read what happens. That cap&rsquo;s been reached. New runs open back up as the week rolls forward, and everything you&rsquo;ve made is safe.
            </p>

            <div style={{ fontSize: "13px", color: "#fafafa", fontWeight: 500, margin: "24px 0 11px" }}>
              Want a nudge when a spot opens?
            </div>
            <div style={{ display: "flex", gap: "9px" }}>
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter") submit(); }}
                placeholder="you@email.com"
                disabled={state === "sending"}
                style={{
                  flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "10px", padding: "11px 13px", fontFamily: "inherit", fontSize: "13.5px",
                  color: "#fafafa", outline: "none",
                }}
              />
              <button
                onClick={submit}
                disabled={state === "sending"}
                style={{
                  fontFamily: MONO, fontSize: "12.5px", fontWeight: 500, color: "#062b22",
                  background: "#34d8a8", border: "none", borderRadius: "10px", padding: "11px 16px",
                  cursor: state === "sending" ? "default" : "pointer", whiteSpace: "nowrap", opacity: state === "sending" ? 0.7 : 1,
                }}
              >{state === "sending" ? "Saving…" : "Notify me →"}</button>
            </div>
            {err ? <div style={{ fontSize: "12px", color: "#ee8a8a", marginTop: "9px" }}>{err}</div> : null}

            <div style={{ fontSize: "11.5px", color: "#71717a", lineHeight: 1.6, marginTop: "16px" }}>
              Your saved ideas, history, and comparisons aren&rsquo;t affected — only new runs are paused.
            </div>
            <div
              onClick={onClose}
              style={{ marginTop: "16px", textAlign: "center", fontSize: "12.5px", color: "#9a9aa3", cursor: "pointer" }}
            >Close</div>
          </div>
        )}
      </div>
    </div>
  );
}