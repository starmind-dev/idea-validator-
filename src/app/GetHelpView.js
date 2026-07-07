"use client";

// GetHelpView.js — the "Get help" rail screen (dashView === "help").
//
// Two jobs, no faked help desk:
//   • How ILC works  — a short accordion that catches the confusions unique to
//                      ILC's STANCE (no verdict, Explore vs Deep, scores as
//                      conditions), drawn from the doctrine. Pure content.
//   • Send feedback  — writes to public.feedback via /api/feedback. Optional
//                      category + optional "email if you'd like a reply". No
//                      published support address; nothing required but the message.
//                      In beta the feedback IS the work — this is the channel that
//                      feeds engine tuning.
//
// Overview idiom (self-injected fonts, shared C palette). Anonymous-friendly:
// anyone can read the primer and send a note.
//
// Props: t (compat) · onSubmit({ message, category, replyEmail }) -> Promise

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

// ── primer content (drawn from ILC doctrine) ─────────────────────────────────
const PRIMER = [
  {
    q: "Why there\u2019s no verdict",
    a: "ILC reads the shape of the evidence around your idea \u2014 where it stands, where it\u2019s thin \u2014 and stops deliberately short of a go-or-kill call. That closure is yours to make. The read is grounding for your decision, not a substitute for it.",
  },
  {
    q: "Explore vs Deep",
    a: "Explore widens a rough idea into angles \u2014 no score, no rank, no verdict. Deep pressures one version against real market, monetization, and originality evidence. They\u2019re different jobs, not a short version and a long one \u2014 reach for Explore to open a thought, Deep to test one.",
  },
  {
    q: "How to read your scores",
    a: "Scores are conditions and difficulty, never worth or a prediction. A 6 isn\u2019t \u201cmediocre\u201d \u2014 it\u2019s \u201chere\u2019s what stands, and here\u2019s what has to be true.\u201d Small run-to-run variance is normal and, by design, every point traces back to the evidence behind it. The bottleneck it surfaces is the real signal.",
  },
  {
    q: "What counts as a run",
    a: "Explore, Deep, and Re-evaluate each spend one run; Compare is always free. You get three runs a week \u2014 enough for one full loop, or spent however the idea needs.",
  },
];

function AccordionItem({ q, a, first, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${C.line}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "17px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: SERIF, fontSize: 17, color: C.text }}
      >
        {q}
        <span style={{ color: open ? C.tealDeep : C.mut2, fontFamily: MONO, fontSize: 13, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>&rsaquo;</span>
      </button>
      {open && <div style={{ fontSize: 13.5, lineHeight: 1.68, color: C.sec2, padding: "0 0 18px", maxWidth: 560 }}>{a}</div>}
    </div>
  );
}

const CATS = [["bug", "Bug"], ["question", "Question"], ["idea", "Idea"]];

export default function GetHelpView({ t, onSubmit }) {
  useDesignFonts();
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const canSend = message.trim().length > 0 && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true); setError("");
    try {
      await onSubmit?.({ message: message.trim(), category: category || null, replyEmail: replyEmail.trim() || null });
      setSent(true); setMessage(""); setCategory(""); setReplyEmail("");
    } catch (e) {
      setError(e?.message || "Couldn\u2019t send just now \u2014 try again.");
    } finally {
      setSending(false);
    }
  };

  const fieldBase = {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px",
    fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.55, color: C.text, outline: "none",
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* header */}
        <div style={{ ...eyebrow(C.faint, 12, ".2em"), display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span style={{ color: C.tealDeep, fontSize: 15 }}>&infin;</span> GET HELP
        </div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.01em", margin: "15px 0 0", color: C.text }}>
          Get help
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: C.sec2, margin: "12px 0 0", maxWidth: 520 }}>
          A short primer on how ILC thinks — and a direct line to me. It&rsquo;s a beta; your notes are what shape it.
        </p>

        {/* primer */}
        <Panel>
          <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 6 }}>HOW ILC WORKS</div>
          {PRIMER.map((it, i) => (
            <AccordionItem key={it.q} q={it.q} a={it.a} first={i === 0} defaultOpen={i === 0} />
          ))}
        </Panel>

        {/* feedback */}
        <Panel>
          <div style={{ ...eyebrow(C.mut2, 10, ".2em"), marginBottom: 14 }}>SEND FEEDBACK</div>

          {sent ? (
            <div>
              <p style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.5, color: C.text, margin: "0 0 8px" }}>
                Got it — thank you.
              </p>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: C.sec2, margin: "0 0 18px", maxWidth: 460 }}>
                I read every note. If you left an email, I&rsquo;ll reply when I can.
              </p>
              <button onClick={() => setSent(false)} style={{ fontFamily: MONO, fontSize: 12.5, color: C.sec2, background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9, padding: "8px 16px", cursor: "pointer" }}>
                Send another
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.5, color: C.text, margin: "0 0 20px", maxWidth: 480 }}>
                It&rsquo;s a beta. Tell me what&rsquo;s rough — I read every note.
              </p>

              <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: C.mut2, display: "block", marginBottom: 11 }}>
                What kind of note is it? <span style={{ textTransform: "none", letterSpacing: 0, color: C.faint }}>(optional)</span>
              </span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
                {CATS.map(([val, label]) => {
                  const on = category === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setCategory(on ? "" : val)}
                      style={{
                        fontFamily: MONO, fontSize: 12.5, color: on ? C.tealDeep : C.mut,
                        background: on ? "rgba(52,216,168,0.07)" : "transparent",
                        border: `1px solid ${on ? C.tealDim : "rgba(255,255,255,0.12)"}`,
                        borderRadius: 999, padding: "7px 15px", cursor: "pointer",
                      }}
                    >{label}</button>
                  );
                })}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="What's working, what's confusing, what broke, what you wish it did…"
                style={{ ...fieldBase, resize: "none" }}
              />

              <input
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                placeholder="Email — optional, only if you'd like a reply"
                style={{ ...fieldBase, marginTop: 16 }}
              />

              {error && <p style={{ fontSize: 12.5, color: C.red, margin: "14px 0 0" }}>{error}</p>}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginTop: 20, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11.5, lineHeight: 1.6, color: C.mut2, maxWidth: 400 }}>
                  Only the message is required. Your email is used only to reply — never shown, never listed anywhere.
                </div>
                <button
                  onClick={send}
                  disabled={!canSend}
                  style={{
                    fontFamily: MONO, fontSize: 12.5, fontWeight: 500, borderRadius: 9, padding: "11px 20px",
                    border: "none", whiteSpace: "nowrap",
                    color: canSend ? "#062b22" : C.mut2,
                    background: canSend ? C.tealDeep : "rgba(255,255,255,0.05)",
                    cursor: canSend ? "pointer" : "default",
                  }}
                >
                  {sending ? "Sending…" : "Send feedback →"}
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}