"use client";

// SettingsView.js — the "Settings" rail screen (dashView === "settings").
//
// Two panels, nothing invented:
//   • Account          — email (read-only) + sign out (both live), and a
//                        "Delete account & data" row. Delete lights up once its
//                        backend cascade is wired (KVKK erasure): with an
//                        onDeleteAccount handler the typed-confirm flow runs; with
//                        none it shows an honest "coming before launch" note
//                        instead of a button that lies.
//   • Builder context  — the three profile fields that calibrate Deep (coding, AI,
//                        background). Edited locally, saved through the SAME
//                        onSaveProfile path (/api/profile) the Deep-input step uses.
//
// Overview idiom: self-injects Spectral + JetBrains Mono, owns the shared C
// palette. `t` accepted for parity; content uses C.
//
// Props: t · isAnon · onSignUp · email · profile{coding,ai,education} ·
//        onSaveProfile(fields) · onSignOut · onDeleteAccount (optional)

import { useState, useEffect } from "react";

const C = {
  text: "#fafafa", sec: "#c8c8cc", sec2: "#b4b4bd", mut: "#9a9aa3", mut2: "#71717a",
  faint: "#6b7280", faint2: "#52525b",
  teal: "#5fe3bd", tealDeep: "#34d8a8", tealDim: "rgba(52,216,168,0.4)", red: "#ee8a8a",
  line: "rgba(255,255,255,0.07)", panel: "rgba(255,255,255,0.018)",
};
const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Spectral',serif";

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

const Panel = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "26px 28px", marginTop: 20, ...style }}>
    {children}
  </div>
);

const CODING = ["Beginner", "Intermediate", "Advanced"];
const AI = ["None", "Some", "Regular user"];

function Pills({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const on = value === opt;
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            fontFamily: MONO, fontSize: 12.5, letterSpacing: ".01em",
            color: on ? C.tealDeep : C.mut,
            background: on ? "rgba(52,216,168,0.07)" : "transparent",
            border: `1px solid ${on ? C.tealDim : "rgba(255,255,255,0.12)"}`,
            borderRadius: 999, padding: "8px 16px", cursor: "pointer",
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

const Header = (
  <>
    <div style={{ ...eyebrow(C.faint, 12, ".2em"), display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span style={{ color: C.tealDeep, fontSize: 15 }}>∞</span> SETTINGS
    </div>
    <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.01em", margin: "15px 0 0", color: C.text }}>
      Settings
    </h1>
    <p style={{ fontSize: 15, lineHeight: 1.6, color: C.sec2, margin: "12px 0 0", maxWidth: 520 }}>
      Your account, and the background that calibrates every Deep read.
    </p>
  </>
);

export default function SettingsView({ t, isAnon = false, onSignUp, email, profile, onSaveProfile, onSignOut, onDeleteAccount }) {
  useDesignFonts();
  const [coding, setCoding] = useState(profile?.coding || "");
  const [ai, setAi] = useState(profile?.ai || "");
  const [education, setEducation] = useState(profile?.education || "");
  const [saving, setSaving] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  // reseed if the upstream profile changes (e.g. after a save round-trips)
  useEffect(() => {
    setCoding(profile?.coding || ""); setAi(profile?.ai || ""); setEducation(profile?.education || "");
  }, [profile?.coding, profile?.ai, profile?.education]);

  const dirty =
    coding !== (profile?.coding || "") ||
    ai !== (profile?.ai || "") ||
    education !== (profile?.education || "");

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try { await onSaveProfile?.({ coding, ai, education }); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    if (delText.trim().toLowerCase() !== "delete" || delBusy) return;
    setDelBusy(true); setDelErr("");
    try { await onDeleteAccount?.(); }
    catch (e) { setDelErr(e?.message || "Couldn\u2019t delete your account \u2014 please try again."); }
    finally { setDelBusy(false); }
  };

  // anonymous: nothing to manage — a sign-in surface
  if (isAnon) {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ maxWidth: 760 }}>
          {Header}
          <Panel>
            <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 14 }}>ACCOUNT</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.68, color: C.sec2, margin: "0 0 18px", maxWidth: 500 }}>
              Sign in to manage your account and the background that calibrates your Deep reads.
            </p>
            <button
              onClick={onSignUp}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(52,216,168,0.55)"; e.currentTarget.style.color = "#dffaf1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.color = "#e7ebf2"; }}
              style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: ".01em", color: "#e7ebf2", background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, padding: "12px 22px", cursor: "pointer", transition: "border-color .18s,color .18s" }}
            >
              Sign in →
            </button>
          </Panel>
        </div>
      </div>
    );
  }

  const rowLabel = { fontSize: 13.5, color: C.mut };
  const hair = { height: 1, background: C.line, margin: "22px 0" };
  const ghost = { fontFamily: MONO, fontSize: 12.5, color: C.sec2, background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9, padding: "8px 16px", cursor: "pointer" };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: 760 }}>
        {Header}

        {/* ACCOUNT */}
        <Panel>
          <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 20 }}>ACCOUNT</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span style={rowLabel}>Email</span>
            <span style={{ fontSize: 14, color: C.text }}>{email || "—"}</span>
          </div>

          <div style={hair} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span style={rowLabel}>Signed in on this device</span>
            <button onClick={onSignOut} style={ghost}>Sign out</button>
          </div>

          <div style={hair} />

          {/* delete — dormant until onDeleteAccount is wired */}
          {!delOpen ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, color: C.red, marginBottom: 6 }}>Delete account &amp; data</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.6, color: C.mut, maxWidth: 430 }}>
                  Permanently removes your account and every idea, evaluation, branch, and note. This can&rsquo;t be undone.
                </div>
              </div>
              <button
                onClick={() => { setDelOpen(true); setDelText(""); setDelErr(""); }}
                style={{ fontFamily: MONO, fontSize: 12.5, color: C.red, background: "transparent", border: "1px solid rgba(238,138,138,0.35)", borderRadius: 9, padding: "8px 16px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Delete account
              </button>
            </div>
          ) : onDeleteAccount ? (
            <div style={{ border: "1px solid rgba(238,138,138,0.28)", borderRadius: 12, padding: "18px 18px 16px", background: "rgba(238,138,138,0.035)" }}>
              <div style={{ fontSize: 13.5, color: C.red, marginBottom: 10 }}>This erases everything. There is no undo.</div>
              <div style={{ fontSize: 12.5, color: C.mut, marginBottom: 12 }}>Type <b style={{ color: C.sec }}>delete</b> to confirm.</div>
              <input
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
                placeholder="delete"
                style={{ width: 200, maxWidth: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9, padding: "9px 12px", fontFamily: MONO, fontSize: 13, color: C.text, outline: "none" }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button
                  onClick={doDelete}
                  disabled={delText.trim().toLowerCase() !== "delete" || delBusy}
                  style={{
                    fontFamily: MONO, fontSize: 12.5, fontWeight: 500, borderRadius: 9, padding: "9px 16px",
                    border: "1px solid rgba(238,138,138,0.5)",
                    color: delText.trim().toLowerCase() === "delete" ? "#2a0d0d" : "#7a5c5c",
                    background: delText.trim().toLowerCase() === "delete" ? C.red : "rgba(238,138,138,0.12)",
                    cursor: delText.trim().toLowerCase() === "delete" && !delBusy ? "pointer" : "default",
                  }}
                >
                  {delBusy ? "Deleting…" : "Delete everything"}
                </button>
                <button onClick={() => { setDelOpen(false); setDelText(""); setDelErr(""); }} style={ghost}>Cancel</button>
              </div>
              {delErr && <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.red, marginTop: 13 }}>{delErr}</div>}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: C.mut, maxWidth: 460 }}>
                Account deletion is coming before launch. It&rsquo;ll remove your account and all your data for good — no exceptions.
              </div>
              <button onClick={() => setDelOpen(false)} style={ghost}>Close</button>
            </div>
          )}
        </Panel>

        {/* BUILDER CONTEXT */}
        <Panel>
          <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 16 }}>YOUR BUILDER CONTEXT</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.mut, margin: "0 0 24px", maxWidth: 480 }}>
            This calibrates every Deep read to your background — the analysis stays specific to who&rsquo;s actually reading it.
          </p>

          <div style={{ marginBottom: 26 }}>
            <label style={{ fontSize: 13.5, fontWeight: 500, color: C.text, display: "block", marginBottom: 12 }}>How familiar are you with coding?</label>
            <Pills options={CODING} value={coding} onChange={setCoding} />
          </div>

          <div style={{ marginBottom: 26 }}>
            <label style={{ fontSize: 13.5, fontWeight: 500, color: C.text, display: "block", marginBottom: 12 }}>How much experience do you have with AI tools?</label>
            <Pills options={AI} value={ai} onChange={setAi} />
          </div>

          <div>
            <label style={{ fontSize: 13.5, fontWeight: 500, color: C.text, display: "block", marginBottom: 12 }}>Your background</label>
            <textarea
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              rows={2}
              placeholder="e.g., Clinical ops lead in pharma, 8 yrs — or: final-year CS student — or: marketing, switching to product"
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 13px", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.55, color: C.text, resize: "none", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
            <button
              onClick={save}
              disabled={!dirty || saving}
              style={{
                fontFamily: MONO, fontSize: 12.5, fontWeight: 500, borderRadius: 9, padding: "9px 18px",
                border: "none",
                color: dirty ? "#062b22" : C.mut2,
                background: dirty ? C.tealDeep : "rgba(255,255,255,0.05)",
                cursor: dirty && !saving ? "pointer" : "default",
              }}
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}