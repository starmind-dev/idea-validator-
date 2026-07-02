"use client";

// AuthModal.js — the login / sign-up modal.
//
// DROP-IN replacement for the old `AuthModal` that lived in ./components. Same
// prop contract, so every call site in page.js is unchanged:
//     <AuthModal onClose={...} onAuth={(u) => setUser(u)} t={t} />
//
// Surface is a faithful build of the approved Claude-Design export
// (IdeaLoop_Core_-_Login.html): a single modal with a Log in / Sign up segmented
// toggle, Continue with Google, email + password (show/hide + Forgot), the
// mode-aware copy, and the trust strip. Self-contained palette + fonts, matching
// the export pixel-for-pixel (same "designed surface owns its tokens" pattern as
// the landing / Overview). `t` is accepted for call-site compatibility.
//
// AUTH WIRING (real, unchanged behaviour from the email/password flow):
//   • Log in     → supabase.auth.signInWithPassword → onAuth(user) → onClose()
//   • Sign up    → supabase.auth.signUp. The on_auth_user_created trigger creates
//                  the profiles row, so no manual profile insert. If the project
//                  requires email confirmation, signUp returns no session → we show
//                  "check your email"; if not, we have a session → onAuth + close.
//   • Google     → supabase.auth.signInWithOAuth({ provider: 'google' }). Redirects
//                  out and back; page.js's onAuthStateChange picks up the session.
//                  REQUIRES the Google provider enabled in Supabase Auth + this
//                  origin in the allowed redirect URLs — otherwise the button errors.
//   • Forgot     → supabase.auth.resetPasswordForEmail(email).

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// ── design tokens (from the export) ──────────────────────────────────────────
const C = {
  cardGrad: "linear-gradient(180deg,#101016,#0b0b0f)",
  cardBorder: "rgba(255,255,255,0.10)",
  text: "#f4f4f5", heading: "#fafafa", sub: "#9a9aa3",
  violet: "#8b7ff0", violetText: "#c4bcff",
  ctaGrad: "linear-gradient(180deg,#9488f5,#8b7ff0)",
  teal: "#34d8a8", red: "#ee8a8a",
  label: "#a1a1aa", soft: "#8a8a93", faint: "#56565f", faint2: "#71717a", fine: "#6b6b73",
  e8: "#e8e8ea", e4: "#e4e4e7",
};
const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Spectral',serif";

// load Spectral + JetBrains Mono + the input focus/placeholder rules once. The
// modal can open over any screen (not just the landing), so it carries its own.
function useAuthAssets() {
  useEffect(() => {
    const fontId = "ilc-auth-fonts";
    if (!document.getElementById(fontId)) {
      const l = document.createElement("link");
      l.id = fontId; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Spectral:wght@400;500&family=JetBrains+Mono:wght@400;500;600&display=swap";
      document.head.appendChild(l);
    }
    const cssId = "ilc-auth-css";
    if (!document.getElementById(cssId)) {
      const s = document.createElement("style");
      s.id = cssId;
      s.textContent = `
        .ilc-auth-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.11);border-radius:12px;padding:14px 16px;font-size:15px;
          color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
          outline:none;transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;}
        .ilc-auth-input::placeholder{color:#56565f;}
        .ilc-auth-input:focus{border-color:rgba(139,127,240,0.7);background:rgba(139,127,240,0.06);
          box-shadow:0 0 0 4px rgba(139,127,240,0.12);}
        .ilc-auth-input:disabled{opacity:.6;}
      `;
      document.head.appendChild(s);
    }
  }, []);
}

const GoogleG = () => (
  <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export function AuthModal({ onClose, onAuth, t }) {
  useAuthAssets();
  const [mode, setMode] = useState("login");   // 'login' | 'signup'
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cardRef = useRef(null);

  const isLogin = mode === "login";

  // Esc closes.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const switchMode = (next) => { setMode(next); setError(""); setNotice(""); };

  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setNotice("");
    const mail = email.trim();
    if (!mail || !password) { setError("Enter your email and password."); return; }
    if (!isLogin && password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setBusy(true);
    try {
      if (isLogin) {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (err) { setError(err.message || "Could not log in."); return; }
        onAuth && onAuth(data.user);
        onClose && onClose();
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email: mail, password });
        if (err) { setError(err.message || "Could not create account."); return; }
        // Email-confirmation ON → no session yet. OFF → session present, go straight in.
        if (data.session) {
          onAuth && onAuth(data.user);
          onClose && onClose();
        } else {
          setNotice("Check your email to confirm your account, then log in.");
        }
      }
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (err) setError(err.message || "Google sign-in is unavailable.");
      // success → browser redirects to Google; page.js picks up the session on return.
    } catch (err) {
      setError(err?.message || "Google sign-in is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    setError(""); setNotice("");
    const mail = email.trim();
    if (!mail) { setError("Enter your email first, then tap Forgot."); return; }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo });
      if (err) setError(err.message || "Could not send reset link.");
      else setNotice("Password reset link sent — check your email.");
    } catch (err) {
      setError(err?.message || "Could not send reset link.");
    } finally {
      setBusy(false);
    }
  }

  const heading = isLogin ? "Welcome back" : "Create your account";
  const subhead = isLogin
    ? "Log in to reopen your loops and every saved verdict."
    : "Start free — turn your first rough idea into a defensible decision.";
  const ctaLabel = isLogin ? "Log in" : "Create account";
  const switchPrompt = isLogin ? "New to IdeaLoop Core?" : "Already have an account?";
  const switchAction = isLogin ? "Create an account" : "Log in";
  const pwPlaceholder = isLogin ? "Your password" : "Min 6 characters";
  const pwAutocomplete = isLogin ? "current-password" : "new-password";

  const tabBase = {
    flex: 1, border: "none", borderRadius: 10, padding: 10, fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "background .15s ease,color .15s ease",
  };
  const tabOn = { ...tabBase, background: "rgba(139,127,240,0.16)", color: C.violetText, boxShadow: "inset 0 0 0 1px rgba(139,127,240,0.4)" };
  const tabOff = { ...tabBase, background: "transparent", color: "#8a8a93" };

  return (
    <div
      onClick={() => !busy && onClose && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 1000 }}
    >
      {/* backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(120% 90% at 50% 30%, rgba(8,8,10,0.72), rgba(8,8,10,0.9))",
        backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)",
      }} />

      {/* modal */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div
          ref={cardRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative", width: "100%", maxWidth: 432, boxSizing: "border-box",
            background: C.cardGrad, border: `1px solid ${C.cardBorder}`, borderRadius: 22, padding: 34,
            boxShadow: "0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,127,240,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
            color: C.text,
          }}
        >
          {/* close */}
          <span
            onClick={() => !busy && onClose && onClose()}
            style={{
              position: "absolute", top: 18, right: 18, width: 30, height: 30, display: "flex",
              alignItems: "center", justifyContent: "center", borderRadius: 9, color: C.soft,
              fontSize: 18, cursor: "pointer", transition: "background .15s ease,color .15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = C.e4; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.soft; }}
          >×</span>

          {/* brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.teal, fontSize: 20, lineHeight: 1 }}>∞</span>
            <span style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.02em" }}>IdeaLoop Core</span>
          </div>

          {/* segmented toggle */}
          <div style={{
            display: "flex", gap: 4, padding: 4, marginTop: 22,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 13,
          }}>
            <button onClick={() => switchMode("login")} style={isLogin ? tabOn : tabOff}>Log in</button>
            <button onClick={() => switchMode("signup")} style={!isLogin ? tabOn : tabOff}>Sign up</button>
          </div>

          <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 27, lineHeight: 1.12, color: C.heading, margin: "24px 0 0" }}>{heading}</h2>
          <p style={{ fontSize: 14, color: C.sub, margin: "8px 0 0", lineHeight: 1.55 }}>{subhead}</p>

          {/* Google */}
          <button
            onClick={handleGoogle} disabled={busy}
            style={{
              width: "100%", marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12,
              padding: 12, fontSize: 14, fontWeight: 600, color: C.e8, cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.6 : 1, transition: "background .15s ease",
            }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <GoogleG /> Continue with Google
          </button>

          {/* divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.faint }}>OR WITH EMAIL</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* form */}
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, letterSpacing: ".02em", color: C.label, marginBottom: 7 }}>Email</label>
            <input
              className="ilc-auth-input" type="email" placeholder="you@example.com" autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 7px" }}>
              <label style={{ fontSize: 12, fontWeight: 500, letterSpacing: ".02em", color: C.label }}>Password</label>
              {isLogin && (
                <span onClick={handleForgot} style={{ fontSize: 12, color: C.violet, cursor: "pointer", fontWeight: 500 }}>Forgot?</span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="ilc-auth-input" type={showPw ? "text" : "password"} placeholder={pwPlaceholder}
                autoComplete={pwAutocomplete} style={{ paddingRight: 48 }}
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
              />
              <span
                onClick={() => setShowPw((s) => !s)}
                style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  fontFamily: MONO, fontSize: 10, letterSpacing: ".06em", color: C.faint2, cursor: "pointer", userSelect: "none",
                }}
              >{showPw ? "HIDE" : "SHOW"}</span>
            </div>

            {(error || notice) && (
              <div style={{
                marginTop: 14, fontSize: 12.5, lineHeight: 1.5,
                color: error ? C.red : C.teal,
              }}>{error || notice}</div>
            )}

            <button
              type="submit" disabled={busy}
              style={{
                width: "100%", marginTop: 24, background: C.ctaGrad, border: "none", borderRadius: 12, padding: 15,
                fontSize: 15, fontWeight: 600, color: "#fff", cursor: busy ? "default" : "pointer",
                boxShadow: "0 10px 30px rgba(139,127,240,0.32)", opacity: busy ? 0.7 : 1,
                transition: "transform .12s ease, box-shadow .15s ease",
              }}
              onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.boxShadow = "0 14px 38px rgba(139,127,240,0.42)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 10px 30px rgba(139,127,240,0.32)"; e.currentTarget.style.transform = "none"; }}
            >{busy ? "Working…" : ctaLabel}</button>
          </form>

          {!isLogin && (
            <p style={{ fontSize: 11, color: C.fine, textAlign: "center", margin: "14px auto 0", maxWidth: 300, lineHeight: 1.5 }}>
              By creating an account you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.sub, textDecoration: "underline", cursor: "pointer" }}>Terms</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.sub, textDecoration: "underline", cursor: "pointer" }}>Privacy Policy</a>.
            </p>
          )}

          {/* switch */}
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13.5, color: C.sub }}>
            {switchPrompt}{" "}
            <span onClick={() => switchMode(isLogin ? "signup" : "login")} style={{ color: C.violet, fontWeight: 600, cursor: "pointer" }}>{switchAction}</span>
          </div>

          {/* trust strip */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 24, paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.06)", fontFamily: MONO, fontSize: 9.5, letterSpacing: ".12em", color: C.faint,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.teal }} />
            NO CARD TO START · FREE CREDITS ON SIGN-UP
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;