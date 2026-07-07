"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { buildTaggedIdeaHtml } from "../lib/services/tagIdeaHtml";
import ComparisonView from "./ComparisonView";
import LineageView from "./LineageView";
import EvaluationView from "./EvaluationView";
import ExecutionBriefView from "./ExecutionBriefView";
import ExploreView from "./ExploreView.js";
import ExploreInputView from "./ExploreInputView";
import DeepInputView from "./DeepInputView";
import MyPlanView from "./MyPlanView";
import SettingsView from "./SettingsView";
import GetHelpView from "./GetHelpView";
import DeepEvolveView from "./DeepEvolveView";
import HubView from "./HubView";
import OverviewView from "./OverviewView";
import LandingView from "./LandingView";
import DashboardShell from "./DashboardShell";
import { BackLink, BackLinkDivider } from "./BackLink";
import { AuthModal } from "./AuthModal";
import {
  StepProgress,
  StatusBadge,
  ScoreBar,
  SectionHeader,
  Card,
  PageContainer,
  getTheme,
  getScoreColor,
  getTcColor,
  recordLastIdea,
} from "./components";

// ============================================
// EVALUATION LIMIT HELPERS
// ============================================
const EVAL_LIMIT = 1;
const EVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getRecentEvals() {
  // Lifetime cap: every recorded eval counts, no rolling window.
  try {
    const raw = localStorage.getItem("iv_eval_timestamps");
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
}

function recordEval() {
  const recent = getRecentEvals();
  recent.push(Date.now());
  localStorage.setItem("iv_eval_timestamps", JSON.stringify(recent));
}

function getEvalsRemaining() {
  return Math.max(0, EVAL_LIMIT - getRecentEvals().length);
}

function getNextResetTime() {
  const recent = getRecentEvals();
  if (recent.length === 0) return null;
  const oldest = Math.min(...recent);
  const resetsAt = new Date(oldest + EVAL_WINDOW_MS);
  const now = new Date();
  const diffMs = resetsAt - now;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "< 1h";
}

// ============================================
// MAIN APP
// ============================================
// Live braille spinner for the in-progress pipeline step — the "thinking" signal.
// Self-contained interval so only this span re-renders, not the whole overlay.
const STREAM_SPINNER_FRAMES = ["\u280b", "\u2819", "\u2839", "\u2838", "\u283c", "\u2834", "\u2826", "\u2827", "\u2807", "\u280f"];
function StreamSpinner({ color }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setF((x) => (x + 1) % STREAM_SPINNER_FRAMES.length), 90);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color, flexShrink: 0, width: 16, textAlign: "center" }}>{STREAM_SPINNER_FRAMES[f]}</span>;
}

// Retrieval source -> trust-dot colour, matching the competitor-card source badges
// (EvaluationView sourceColors) so the stream and the cards name the same sources.
const STREAM_SRC_DOT = { github: "#9a9aa2", tavily: "#2dd4bf", exa: "#a78bfa", google: "#6fa8f5" };

// Per-mode stream identity — the ONE seam where the two cognitive modes (and
// re-eval) diverge during a run. deep = indigo (pressure), explore = blue
// (widening, non-verdict), reeval = violet (evolution). When you want fully
// bespoke per-mode streaming displays later, branch from this map / inside
// StreamOverlay — the call sites already pass the mode, so nothing else moves.
const STREAM_VARIANTS = {
  deep:    { accent: "#8a82c2", glow: "rgba(138,130,194,0.55)", label: "EVALUATION PIPELINE" },
  explore: { accent: "#60a5fa", glow: "rgba(96,165,250,0.55)",  label: "WIDENING THE IDEA" },
  reeval:  { accent: "#8b5cf6", glow: "rgba(139,92,246,0.55)",  label: "EVOLUTION PIPELINE" },
};

// StreamOverlay — the fixed full-screen pipeline modal shown while a run streams.
// It does DOUBLE DUTY: it shows the SSE beats AND, because it's a fixed
// z-index:9999 blur, it blocks every other control (rail, buttons) for the
// duration of the run — the interaction-block that (together with the
// runningRef lock) keeps a second pipeline from being started mid-run. `mode`
// picks the accent + label; everything else is shared. Single source for all
// three call sites (deep/explore input + re-eval).
function StreamOverlay({ streamSteps, t, mode = "deep" }) {
  const v = STREAM_VARIANTS[mode] || STREAM_VARIANTS.deep;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      background: t.streamOverlay, animation: "overlayFadeIn 0.3s ease-out",
    }}>
      <div style={{
        background: t.streamBg, border: `1px solid ${t.streamBorder}`, borderRadius: 12,
        padding: "28px 32px", fontFamily: "'Courier New', Courier, monospace",
        fontSize: 13, lineHeight: 1.8, width: "90%", maxWidth: 520, boxShadow: t.streamShadow,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${t.streamDivider}` }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: v.accent, boxShadow: `0 0 8px ${v.glow}` }} />
          <span style={{ color: t.mut, fontSize: 11, letterSpacing: "0.08em" }}>{v.label}</span>
        </div>
        {streamSteps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            color: s.done ? t.sec : t.text, opacity: s.done ? 0.8 : 1,
            animation: "fadeInStep 0.3s ease-out",
          }}>
            {s.done ? (
              <span style={{ color: v.accent, flexShrink: 0, width: 16, textAlign: "center" }}>✓</span>
            ) : (
              <StreamSpinner color={v.accent} />
            )}
            <span style={{ wordBreak: "break-word" }}>
              {s.source && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: STREAM_SRC_DOT[s.source] || "#9a9aa2", marginRight: 7, verticalAlign: "1px" }} />}
              {s.message}
            </span>
          </div>
        ))}
        {streamSteps.length > 0 && !streamSteps.some(s => s.step === "complete") && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.mut, marginTop: 2 }}>
            <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
          </div>
        )}
        {streamSteps.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.mut }}>
            <span style={{ width: 16, textAlign: "center", animation: "blink 1s step-end infinite" }}>_</span>
            <span>Initializing...</span>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeInStep { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ============================================================================
// LeaveGuardModal — fires before a take-to action leaves an UNSAVED exploration.
// An unsaved fan is at risk: navigating to Deep/Explore loses the read, the
// terrain, and the directions not taken. Leads with "Save & continue" (the
// on-brand "nothing is lost" move); "Leave anyway" stays available. Matches the
// Explore Dawn identity; the violet destination word marks the Deep handoff.
// ============================================================================
function LeaveGuardModal({ target, dest, onCancel, onLeave, onSave }) {
  const [saving, setSaving] = useState(false);
  const destLabel = dest === "deep" ? "to Deep" : "to Explore";
  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  return (
    <div role="alertdialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 24 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(6,8,12,0.72)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 472, background: "#0e1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "30px 32px 26px", boxShadow: "0 36px 90px rgba(0,0,0,0.62)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "monospace", fontSize: 10.5, letterSpacing: "0.22em", color: "#7aa2ff", margin: "0 0 16px" }}>
          <span style={{ width: 8, height: 8, border: "1.5px solid #7aa2ff", transform: "rotate(45deg)", boxShadow: "0 0 9px -1px #7aa2ff", display: "inline-block" }} />UNSAVED EXPLORATION
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 12px", color: "#e9eef5" }}>Leave without saving?</h2>
        <p style={{ fontSize: 14, lineHeight: 1.62, color: "#8b94a1", margin: "0 0 8px" }}>
          You haven&apos;t saved this exploration. Taking <b style={{ color: "#c3ccd7", fontWeight: 500 }}>{target}</b> <span style={{ color: "#9a8fd8", fontWeight: 500 }}>{destLabel}</span> leaves it behind — the read, the terrain, and the directions you didn&apos;t take go with it.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.62, color: "#8b94a1", margin: 0 }}>
          <b style={{ color: "#c3ccd7", fontWeight: 500 }}>Save</b> keeps the whole family in My Ideas, then continues.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <button onClick={onCancel} style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, background: "none", border: "none", color: "#646d79", cursor: "pointer", padding: "11px 6px" }}>Cancel</button>
          <span style={{ marginRight: "auto" }} />
          <button onClick={onLeave} style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#8b94a1", cursor: "pointer", padding: "11px 18px" }}>Leave anyway</button>
          <button onClick={doSave} disabled={saving} style={{ fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, background: "#7aa2ff", border: "1px solid #7aa2ff", borderRadius: 10, color: "#0a0d13", cursor: saving ? "default" : "pointer", padding: "11px 18px", opacity: saving ? 0.8 : 1 }}>
            {saving ? "Saving…" : "Save & continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CompareTray — the one persistent, cross-space compare basket.
// Backed by page-level `compareSelected`; rendered as a viewport-fixed sibling
// on the hub and lineage branches so a half-finished pick survives navigation
// between lineage trees and the evaluated room. Deep-only (startComparison
// refuses non-Deep), so the identity is violet throughout. Each chip carries
// its origin so two same-titled branches stay distinguishable.
// ============================================================================
function CompareTray({ selected, onRemove, onClear, onCompare }) {
  if (!selected || selected.length === 0) return null;
  const VI = "#9a8fd8";
  const full = selected.length === 2;
  const originLabel = (o) => (o === "lineage" ? "from lineage" : o === "evaluated" ? "from evaluated" : "deep");
  const ICmp = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M11 18H8a2 2 0 0 1-2-2V9" /></svg>
  );
  const ITarget = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.3" /><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" /></svg>
  );
  const IArrow = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  );
  return (
    <div style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 220, display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(180deg, rgba(138,130,194,0.13), rgba(13,17,25,0.97)), #0b0e15", border: "1px solid rgba(138,130,194,0.42)", borderRadius: 15, padding: "11px 12px 11px 16px", boxShadow: "0 0 0 1px rgba(138,130,194,0.05), 0 16px 40px -16px rgba(138,130,194,0.6)", fontFamily: "inherit", backdropFilter: "blur(10px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, letterSpacing: "0.16em", color: VI, textTransform: "uppercase", paddingRight: 2 }}>
        {ICmp} Compare <span style={{ color: "#5a6373", letterSpacing: "0.1em" }}>{selected.length} / 2</span>
      </div>
      {selected.map((s, i) => (
        <div key={`${s.ideaId}:${s.evaluationId || "latest"}:${i}`} style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(138,130,194,0.10)", border: "1px solid rgba(138,130,194,0.32)", borderRadius: 10, padding: "7px 9px 7px 8px", maxWidth: 212 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(138,130,194,0.16)", border: "1px solid rgba(138,130,194,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: VI, flex: "0 0 auto" }}>{ITarget}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, color: "#dfe3ec", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>{s.title || "Idea"}</span>
            <span style={{ display: "block", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.06em", color: "#5a6373", marginTop: 2, textTransform: "uppercase" }}>deep · {originLabel(s.origin)}</span>
          </span>
          <span role="button" tabIndex={0} onClick={() => onRemove(s)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRemove(s); } }} title="Remove" style={{ flex: "0 0 auto", width: 18, height: 18, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#5a6373", cursor: "pointer", fontSize: 13 }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#e9ecf2"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#5a6373"; }}>✕</span>
        </div>
      ))}
      {!full && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px dashed rgba(138,130,194,0.34)", borderRadius: 10, padding: "8px 12px", color: "#8b94a3", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.04em" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: VI }} /> pick one more — anywhere
        </div>
      )}
      {full && (
        <span role="button" tabIndex={0} onClick={onClear} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClear(); } }} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.05em", color: "#5a6373", cursor: "pointer", padding: "0 4px" }} onMouseEnter={(e) => (e.currentTarget.style.color = "#8b94a3")} onMouseLeave={(e) => (e.currentTarget.style.color = "#5a6373")}>clear</span>
      )}
      <button onClick={() => full && onCompare()} disabled={!full} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 11, padding: "10px 16px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "inherit", cursor: full ? "pointer" : "not-allowed", border: full ? "1px solid rgba(138,130,194,0.5)" : "1px solid rgba(255,255,255,0.06)", background: full ? "linear-gradient(180deg,#938ac9,#7d75b5)" : "rgba(255,255,255,0.04)", color: full ? "#fff" : "#5a6373", boxShadow: full ? "0 8px 22px -10px rgba(138,130,194,0.9)" : "none" }}>
        Compare {IArrow}
      </button>
    </div>
  );
}

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  // Which room HubView opens to. Lineage-back sets "evaluated" so you land on the
  // evaluated shelf, not the rough-or-evaluated chooser. Normal hub entry = "hub".
  const [hubReturnView, setHubReturnView] = useState("hub");
  // Lineage deep "Re-evaluate": load the idea first, then fire startReEvaluation
  // from an effect (it reads analysis/currentIdeaId off state — avoids a stale closure).
  const [pendingReEvalId, setPendingReEvalId] = useState(null);
  // Which entry path opened re-eval: "lineage" (from the tree) or "analysis" (from
  // a saved deep result opened off the Evaluated card). The back link points home.
  const [reEvalSource, setReEvalSource] = useState("analysis");
  // Which view the Dashboard shell shows; the rail stays put, only this swaps.
  const [dashView, setDashView] = useState("overview"); // "overview" | "hub"
  const [profile, setProfile] = useState({ coding: "", ai: "", education: "" });
  const [profileMoreOpen, setProfileMoreOpen] = useState(false);
  const [profileBg, setProfileBg] = useState({ role: "", build: "", reach: "" });
  const [evalsRemaining, setEvalsRemaining] = useState(EVAL_LIMIT);
  const [evalUnlimited, setEvalUnlimited] = useState(false); // dev plan → no eval limit
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Global capacity wall — opened when an analyze is refused with 503/"CAPACITY"
  // (the weekly budget guard tripped for everyone). Distinct from a per-user LIMIT.
  const [capacityWall, setCapacityWall] = useState(false);
  // Public marketing landing gate. Stays false during SSR/first paint to avoid a
  // hydration flash; an effect (below, after auth resolves) flips it on only for a
  // genuine logged-out first-touch visit (no saved nav snapshot, no deep-link). Any
  // CTA or a successful login dismisses it. Returning logged-in users never see it.
  const [showLanding, setShowLanding] = useState(false);
  const landingDecidedRef = useRef(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | naming | saving | saved | error
  const [saveError, setSaveError] = useState("");
  const [savedIdeasCount, setSavedIdeasCount] = useState(0);
  const [savedIdeaId, setSavedIdeaId] = useState(null);
  const [ideaName, setIdeaName] = useState(""); // user-chosen name when saving
  const [showScoreGuide, setShowScoreGuide] = useState(false);
  const SAVED_IDEA_LIMIT = 5;

  // My Ideas Hub state
  const [myIdeas, setMyIdeas] = useState([]);
  const [myIdeasLoading, setMyIdeasLoading] = useState(false);
  const [myIdeasError, setMyIdeasError] = useState("");
  const [deletingIdeaId, setDeletingIdeaId] = useState(null);
  const [viewingFromSaved, setViewingFromSaved] = useState(false); // tracks if we opened from My Ideas

  // Comparison state
  const [compareSelected, setCompareSelected] = useState([]); // array of idea IDs (max 2)
  const [compareSelecting, setCompareSelecting] = useState(false); // true when in selection mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState(null); // { ideaA, ideaB } with full analysis
  const [compareLoading, setCompareLoading] = useState(false);

  // Lineage view state
  const [lineageMode, setLineageMode] = useState(false);
  const [lineageTargetId, setLineageTargetId] = useState(null);
  const [loadingIdeaId, setLoadingIdeaId] = useState(null);

  // Evaluation cache — avoids re-fetching already-viewed ideas
  const evaluationCacheRef = useRef({});
  const didRestoreRef = useRef(false);

  // Preview entry: ?view=overview -> Dashboard/Overview.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "overview") setCurrentScreen("dashboard");
  }, []);

  // Inline idea editing state (hub card rename)
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState("");

  // Evaluation / idea identity (persist targets)
  const [currentEvaluationId, setCurrentEvaluationId] = useState(null);
  const [currentIdeaId, setCurrentIdeaId] = useState(null);
  const [dbNextResetTime, setDbNextResetTime] = useState(null); // DB-based reset time for logged-in users

  // Re-evaluation state
  const [reEvalMode, setReEvalMode] = useState(false); // true when on re-eval screen
  const [reEvalTargetUser, setReEvalTargetUser] = useState(""); // changed target user text
  const [reEvalProblem, setReEvalProblem] = useState(""); // changed problem text
  const [reEvalCoreIdea, setReEvalCoreIdea] = useState(""); // changed core idea text
  const [reEvalOriginalIdea, setReEvalOriginalIdea] = useState(""); // original idea text for display
  const [ideaTagging, setIdeaTagging] = useState(false);     // colour pass in flight (blur the canvas)
  const [taggedIdeaHtml, setTaggedIdeaHtml] = useState(null); // Haiku-tagged idea HTML; null → plain fallback
  const [loadedIdeaText, setLoadedIdeaText] = useState(""); // full idea text including revisions (for re-eval of alternatives)
  const [isReEvaluating, setIsReEvaluating] = useState(false);
  const [isReEvalResult, setIsReEvalResult] = useState(false); // true when showing re-eval results (not yet saved)
  const [reEvalRevisionNotes, setReEvalRevisionNotes] = useState(null); // stored for saving later
  const [reEvalChangedFields, setReEvalChangedFields] = useState(null); // changed_fields metadata (sent with the branch save + the change walkthrough)
  const [reEvalContextSnapshot, setReEvalContextSnapshot] = useState(null); // analysis snapshot from before re-eval
  const [reEvalPrevAnalysis, setReEvalPrevAnalysis] = useState(null); // FULL prior analysis (V_prev) — the change-walkthrough diffs against this
  const [walkthroughData, setWalkthroughData] = useState(null); // change-walkthrough result { markers, anchors } from the re-evaluate-walkthrough route
  const [walkthroughLoading, setWalkthroughLoading] = useState(false); // true while the walkthrough is being computed in the background
  const [pendingEvidenceReJudge, setPendingEvidenceReJudge] = useState(null); // a signal whose re-judge is queued: load the idea, then run a no-edit, evidence-only re-eval
  const [evidenceSignal, setEvidenceSignal] = useState(null); // the signal whose evidence drove the CURRENT re-judge result — drives the evidence-first lead banner
  const [readDecisionBusy, setReadDecisionBusy] = useState(false); // true while a "set as current read" / "keep old read" decision is committing

  // Branch creation form state (V4S14)
  const [branchReason, setBranchReason] = useState("");
  const [branchDimensions, setBranchDimensions] = useState([]); // array of strings like ["target_user", "problem"]
  const [branchSetAsMain, setBranchSetAsMain] = useState(false); // INERT — Lead is set only via SET LEAD (lineage). Remove its checkbox from EvaluationView.
  const [saveStandalone, setSaveStandalone] = useState(false); // re-eval closure: save z as its OWN root deep card (no parent), not a branch
  const [reEvalEditTarget, setReEvalEditTarget] = useState(false); // toggle for target user edit field
  const [reEvalEditProblem, setReEvalEditProblem] = useState(false); // toggle for problem edit field
  const [reEvalEditCore, setReEvalEditCore] = useState(false); // toggle for core idea edit field


  // Alternatives popup state
  const [showAlternativesPopup, setShowAlternativesPopup] = useState(false);
  const [alternativesData, setAlternativesData] = useState(null); // { ideaId, title, evaluations: [...] }

  // SSE streaming state
  const [streamSteps, setStreamSteps] = useState([]); // array of { step, message, done }
  const streamRef = useRef(null); // ref to track if stream should be aborted
  // Synchronous concurrency lock shared by handleAnalyze + handleReEvaluate. Set
  // BEFORE any await and released in finally, so a second trigger (rail swap,
  // fast re-click) can't slip a parallel pipeline through the async eval-check
  // gap before isAnalyzing/isReEvaluating flips true. The button's isAnalyzing
  // guard alone leaks because that state is set post-await.
  const runningRef = useRef(false);


  // Theme (launch: dark only — V4S23 entitlement/devMode system removed)
  const t = getTheme("dark");

  // Listen for auth state changes (login, logout, session restore)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Decide once, after auth resolves, whether to show the public landing. Show it only
  // for a logged-out first-touch visit: no signed-in user, no saved nav snapshot, and no
  // explicit deep-link into the app. A logged-in user, a restorable session, or a deep-link
  // all skip straight into the app. Runs once (landingDecidedRef) so a later state change
  // can't re-raise the landing over someone already working.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (authLoading || landingDecidedRef.current) return;
    landingDecidedRef.current = true;
    if (user) return; // signed in → app
    let nav = null;
    try { nav = JSON.parse(sessionStorage.getItem("iv_nav") || "null"); } catch (e) {}
    if (nav && nav.screen) return; // mid-session refresh → restore handles it
    const params = new URLSearchParams(window.location.search);
    if (params.get("hub") || params.get("view")) return; // deep-link into app
    setShowLanding(true);
  }, [authLoading, user]);

  // A successful login from the landing dismisses it and drops the visitor into the app.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user && showLanding) setShowLanding(false);
  }, [user]);

  // Leave the landing and enter the app at Overview. Used by every landing CTA except Log in.
  const enterApp = () => {
    setShowLanding(false);
    setCurrentScreen("dashboard");
    setDashView("overview");
  };

  // On login: load THIS account's profile from the DB into state. Profile is per-account;
  // localStorage is per-device, so reading it back from the DB is what makes the profile
  // switch correctly between accounts. Only migrate localStorage -> DB when the account has
  // no saved profile yet, so a previous account's localStorage can't overwrite this one.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("coding_level, ai_experience, education")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const hasDbProfile = data && (data.coding_level || data.ai_experience || data.education);
        if (hasDbProfile) {
          const dbProfile = {
            coding: data.coding_level || "",
            ai: data.ai_experience || "",
            education: data.education || "",
          };
          setProfile(dbProfile);
          localStorage.setItem("iv_profile", JSON.stringify(dbProfile));
          return;
        }
        // No saved profile for this account — migrate localStorage up if it holds data.
        const saved = localStorage.getItem("iv_profile");
        if (!saved) return;
        const localProfile = JSON.parse(saved);
        if (!(localProfile.coding || localProfile.ai || localProfile.education)) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              coding_level: localProfile.coding,
              ai_experience: localProfile.ai,
              education: localProfile.education,
            }),
          }).then((res) => {
            if (!res.ok) res.json().then((d) => console.error("Profile migration failed:", d.error));
          });
        });
      });
    return () => { cancelled = true; };
  }, [user]);

  // Fetch saved ideas count when user logs in
  useEffect(() => {
    if (!user) {
      setSavedIdeasCount(0);
      return;
    }
    supabase
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ count, error }) => {
        if (!error && count !== null) setSavedIdeasCount(count);
      });
  }, [user]);

  // Sync eval usage from database for logged-in users
  useEffect(() => {
    if (!user) return;
    const syncEvalUsage = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/eval-usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setEvalsRemaining(data.remaining);
          setEvalUnlimited(!!data.dev);
          if (data.next_reset_time) setDbNextResetTime(data.next_reset_time);
        }
      } catch (err) {
        console.error("Eval usage sync failed:", err);
      }
    };
    syncEvalUsage();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile({ coding: "", ai: "", education: "" });
    setProfileBg({ role: "", build: "", reach: "" });
    localStorage.removeItem("iv_profile");
    sessionStorage.removeItem("iv_nav");
    setLineageMode(false);
    setLineageTargetId(null);
  };

  // Load saved profile + eval count after mount (avoids hydration mismatch). The screen is
  // no longer forced here — the landing default is Overview, and the restore effect below
  // returns the user to wherever they were before a refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const saved = localStorage.getItem("iv_profile");
    if (saved) setProfile(JSON.parse(saved));
    setEvalsRemaining(getEvalsRemaining());
  }, []);
  const [idea, setIdea] = useState("");
  const [inputMode, setInputMode] = useState("deep"); // "explore" | "deep" — which input screen the "input" route shows
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [readHistory, setReadHistory] = useState([]); // previous reads of the open deep idea (read_history); [] when never re-read
  const [historicalRead, setHistoricalRead] = useState(null); // an opened previous read (read-only viewer) or null
  const [exploreAnalysis, setExploreAnalysis] = useState(null); // ll2_explore_v1 payload (Explore mode)
  const [historicalExploreRead, setHistoricalExploreRead] = useState(null); // a preserved explore read opened read-only (graduated_to_deep)
  // Declared above the persistence/restore effects below: their dependency arrays reference
  // these, and a dep on a const declared lower in the component hits a TDZ during prerender.
  const [roughRoomIdea, setRoughRoomIdea] = useState(null); // { id, text, title }
  const [roughEditing, setRoughEditing] = useState(false);     // rough-room edit mode
  const [roughDraftTitle, setRoughDraftTitle] = useState("");  // edit draft: title
  const [roughDraftText, setRoughDraftText] = useState("");    // edit draft: body
  const [roughSaving, setRoughSaving] = useState(false);       // edit save in flight
  const [savedExploreIdeaId, setSavedExploreIdeaId] = useState(null); // explored idea saved this session
  // Jump-back source for the input screens. When a take-to-explore / take-to-deep
  // handoff comes from a SAVED explored idea (or one of its angles), this holds
  // { id, text, count } so the destination input renders a preview card that
  // returns to that explored idea. null = cold open / fresh exploration → no card.
  const [exploreSourceIdea, setExploreSourceIdea] = useState(null);
  const [briefData, setBriefData] = useState(null); // assembled six-block execution brief

  // Persist a small navigation snapshot so a refresh returns the user to where they were
  // (deep view, lineage tree, hub, …) instead of the Overview landing. sessionStorage survives
  // refresh but resets on a fresh tab, so a brand-new session still lands on Overview. Gated on
  // didRestoreRef so the initial default screen can't overwrite the snapshot before it's read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === "undefined" || !didRestoreRef.current) return;
    try {
      // Compare is rebuilt from the two selections (ideaId + evaluationId), so persist those;
      // fall back to the bare ids from compareData if the selections were cleared.
      let compareSel = null;
      if (compareMode && compareData) {
        if (compareSelected && compareSelected.length === 2) compareSel = compareSelected;
        else if (compareData.ideaA && compareData.ideaB)
          compareSel = [{ ideaId: compareData.ideaA.id }, { ideaId: compareData.ideaB.id }];
      }
      sessionStorage.setItem("iv_nav", JSON.stringify({
        screen: currentScreen, dashView, inputMode,
        ideaId: currentIdeaId || savedIdeaId || savedExploreIdeaId || (roughRoomIdea && roughRoomIdea.id) || null,
        evalId: currentEvaluationId,
        lineageMode, lineageTargetId,
        compareMode: !!(compareMode && compareData), compareSel,
        hubRoom: hubReturnView,
      }));
    } catch (e) {}
  }, [currentScreen, dashView, inputMode, currentIdeaId, savedIdeaId, savedExploreIdeaId, roughRoomIdea, currentEvaluationId, lineageMode, lineageTargetId, compareMode, compareData, compareSelected, hubReturnView]);

  // A freshly-evaluated result lives only in memory until Save creates its row. Stash the
  // finished result so a refresh before saving rehydrates it instead of losing it. The moment
  // it gets a saved id (or the result is cleared / you leave the result screen) the stash is
  // dropped, and the id-based restore above takes over as the canonical saved copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === "undefined" || !didRestoreRef.current) return;
    try {
      const savedDeep = savedIdeaId || currentIdeaId;
      if (analysis && !savedDeep && (currentScreen === "results1" || currentScreen === "results2" || currentScreen === "brief")) {
        sessionStorage.setItem("iv_fresh_result", JSON.stringify({ kind: "deep", screen: currentScreen, analysis, idea, brief: briefData || null }));
      } else if (exploreAnalysis && !savedExploreIdeaId && currentScreen === "explore") {
        sessionStorage.setItem("iv_fresh_result", JSON.stringify({ kind: "explore", explore: exploreAnalysis, idea }));
      } else {
        sessionStorage.removeItem("iv_fresh_result");
      }
    } catch (e) {}
  }, [analysis, exploreAnalysis, briefData, idea, savedIdeaId, currentIdeaId, savedExploreIdeaId, currentScreen]);

  // Draft autosave for the idea input — what you type survives a refresh (or coming back
  // later) instead of vanishing into an empty box. Lives on the input screen only; cleared
  // on submit (in handleAnalyze) and the moment the box is emptied. localStorage so a typed-
  // but-unsent idea is still there in a new session, the way a mail draft would be.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === "undefined" || !didRestoreRef.current) return;
    if (currentScreen !== "input") return;
    try {
      if (idea.trim()) localStorage.setItem("iv_draft_input", idea);
      else localStorage.removeItem("iv_draft_input");
    } catch (e) {}
  }, [idea, currentScreen]);

  // When the input screen opens empty, repopulate the saved draft (covers both a refresh
  // landing on input and simply returning to the box later).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentScreen !== "input" || idea.trim()) return;
    try {
      const d = localStorage.getItem("iv_draft_input");
      if (d) setIdea(d);
    } catch (e) {}
  }, [currentScreen]);

  // Deep result sections (scores ↔ evidence/reality) are screen swaps inside the
  // same window-scrolled container, so the page keeps its prior scroll offset and
  // lands you at the bottom of the next section instead of its top. Reset to the
  // top whenever either Deep results screen opens — covers "Continue to Evidence &
  // Reality", the saved-idea "View Evidence & Reality", and the back transition.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentScreen === "results1" || currentScreen === "results2") {
      window.scrollTo(0, 0);
    }
  }, [currentScreen]);

  // Draft autosave for the re-eval edits (target / problem / core), keyed per idea so each
  // idea keeps its own in-progress changes. Cleared on submit (in handleReEvaluate).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof window === "undefined" || !didRestoreRef.current) return;
    if (currentScreen !== "reeval" || !reEvalMode) return;
    const id = currentIdeaId || savedIdeaId;
    if (!id) return;
    try {
      const any = reEvalTargetUser.trim() || reEvalProblem.trim() || reEvalCoreIdea.trim();
      if (any) localStorage.setItem(`iv_draft_reeval_${id}`, JSON.stringify({ t: reEvalTargetUser, p: reEvalProblem, c: reEvalCoreIdea }));
      else localStorage.removeItem(`iv_draft_reeval_${id}`);
    } catch (e) {}
  }, [reEvalTargetUser, reEvalProblem, reEvalCoreIdea, currentScreen, reEvalMode, currentIdeaId, savedIdeaId]);

  // When re-eval opens for an idea with empty fields, repopulate that idea's saved draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentScreen !== "reeval" || !reEvalMode) return;
    if (reEvalTargetUser.trim() || reEvalProblem.trim() || reEvalCoreIdea.trim()) return;
    const id = currentIdeaId || savedIdeaId;
    if (!id) return;
    try {
      const raw = localStorage.getItem(`iv_draft_reeval_${id}`);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.t) setReEvalTargetUser(d.t);
        if (d.p) setReEvalProblem(d.p);
        if (d.c) setReEvalCoreIdea(d.c);
      }
    } catch (e) {}
  }, [currentScreen, reEvalMode]);

  // Restore that snapshot once auth resolves. Idea views and the lineage tree need the
  // signed-in user, so if the user isn't resolved yet we wait for the next run rather than
  // falling back to Overview. An explicit ?view=overview / ?hub=new deep-link wins.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (authLoading || didRestoreRef.current) return;
    let nav = null;
    try { nav = JSON.parse(sessionStorage.getItem("iv_nav") || "null"); } catch (e) {}

    // Every screen that reopens a saved idea routes through loadSavedIdea, which self-routes by
    // the idea's own state (deep -> results1, explore -> explore, rough -> roughroom). Deep
    // sub-screens that survive a reload (results2, brief) are restored on top after the load.
    // reeval depends on transient context and gracefully falls back to the idea's main view.
    const IDEA_SCREENS = ["results1", "results2", "explore", "roughroom", "brief", "reeval"];
    const isIdeaView = nav && nav.ideaId && IDEA_SCREENS.includes(nav.screen);
    const isLineage = nav && nav.lineageMode && nav.lineageTargetId;
    const isCompare = nav && nav.compareMode && nav.compareSel && nav.compareSel.length === 2;

    // Anything that hits the server (idea / lineage / compare) waits for the signed-in user
    // rather than falling back to Overview before auth resolves.
    if ((isIdeaView || isLineage || isCompare) && !user) return;
    didRestoreRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("hub") === "new" || params.get("view") === "overview") return;
    if (!nav || !nav.screen) return; // no snapshot → stay on the Overview landing
    if (nav.hubRoom) setHubReturnView(nav.hubRoom); // which hub room (evaluated/rough) survives a refresh

    // Fresh, unsaved result still held in the browser stash — rehydrate straight from memory
    // (no server, no id yet). Only when there's no saved id for this screen; a saved idea
    // always prefers the id-based reload below.
    if (!nav.ideaId) {
      let fresh = null;
      try { fresh = JSON.parse(sessionStorage.getItem("iv_fresh_result") || "null"); } catch (e) {}
      if (fresh && fresh.kind === "deep" && fresh.analysis && (nav.screen === "results1" || nav.screen === "results2" || nav.screen === "brief")) {
        setAnalysis(fresh.analysis);
        setIdea(fresh.idea || "");
        if (fresh.brief) setBriefData(fresh.brief);
        setCurrentScreen(nav.screen);
        return;
      }
      if (fresh && fresh.kind === "explore" && fresh.explore && nav.screen === "explore") {
        setExploreAnalysis(fresh.explore);
        setIdea(fresh.idea || "");
        setCurrentScreen("explore");
        return;
      }
    }

    if (isCompare) {
      setCurrentScreen("dashboard");
      setDashView(nav.dashView || "hub");
      startComparison(nav.compareSel); // re-fetches both ideas and rebuilds the compare view
      return;
    }
    if (isLineage) {
      setCurrentScreen("dashboard");
      setDashView(nav.dashView || "hub");
      setLineageTargetId(nav.lineageTargetId);
      setLineageMode(true);
      return;
    }
    if (isIdeaView) {
      const isExploreOrRough = nav.screen === "explore" || nav.screen === "roughroom";
      const evalId = isExploreOrRough ? undefined : (nav.evalId || undefined);
      Promise.resolve(loadSavedIdea(nav.ideaId, evalId)).then(() => {
        if (nav.screen === "results2" || nav.screen === "brief") setCurrentScreen(nav.screen);
      });
      return;
    }
    if (nav.screen === "dashboard") {
      setCurrentScreen("dashboard");
      if (nav.dashView) setDashView(nav.dashView);
      return;
    }
    if (nav.screen === "input") {
      if (nav.inputMode) setInputMode(nav.inputMode);
      setCurrentScreen("input");
    }
    // profile / unknown → stay on Overview
  }, [authLoading, user]);

  // First Deep entry: if the profile isn't set, route through the profile screen first
  // (its Continue returns to the Deep input). One guard covers every Deep entry point.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentScreen === "input" && inputMode === "deep" && !(profile.coding && profile.ai)) {
      setCurrentScreen("profile");
    }
  }, [currentScreen, inputMode, profile.coding, profile.ai]);
  // Graduation intent: when set, the next deep save flips THIS idea forward in
  // place (rough -> deep) instead of creating a new idea. Declared per analysis
  // run via handleAnalyze, so a fresh (non-rough-room) run always clears it.
  const [graduatingIdeaId, setGraduatingIdeaId] = useState(null);

  // Explore handoff plumbing. pendingGraduateParent flags the parent "take idea-x
  // to Deep" path so the eventual Deep run graduates the node in place (the id is
  // read LIVE at run time — see DeepInputView onRun — never captured here, so a
  // "Save & continue" that sets savedExploreIdeaId is reflected correctly).
  const [pendingGraduateParent, setPendingGraduateParent] = useState(false);
  // Angle → forward BRANCH plumbing (parallel to pendingGraduateParent, but a
  // branch not a graduation). pendingBranchParent flags the "take ANGLE-x to
  // Deep/Explore" path so the eventual run attaches its result UNDER the saved
  // explored idea as a NEW non-main child, instead of converting the explore in
  // place (graduation) or spawning a standalone root. The concrete parent id is
  // resolved LIVE at the input onRun into branchParentId — handleAnalyze clears
  // savedExploreIdeaId/currentIdeaId before save time, so it can't be re-derived
  // later. Null when the explore root isn't saved → no parent → standalone (the
  // existing unsaved-explore warning + fallback is untouched).
  const [pendingBranchParent, setPendingBranchParent] = useState(false);
  const [branchParentId, setBranchParentId] = useState(null);
  // Which explore ANGLE a forward-from-angle run came from (its id). Travels with
  // the branch parent so the saved deep/explore child is tagged with
  // origin_angle_id — the fan then recognizes a handled angle by id, not by
  // matching text, so editing the seed never breaks the link. pendingOriginAngle
  // is set at the handoff; resolved into originAngleId at the run; sent at save;
  // cleared after. Null for non-angle runs.
  const [pendingOriginAngle, setPendingOriginAngle] = useState(null);
  const [originAngleId, setOriginAngleId] = useState(null);
  // The unsaved-exploration leave guard: { target, dest, proceed } | null.
  const [leaveGuard, setLeaveGuard] = useState(null);

  // Persist the whole exploration (idea-x + its angles) as one family. Extracted
  // so BOTH the Section 4 Save tile (onSaveExplore) and the leave guard's
  // "Save & continue" share one path. Returns the save payload; throws on auth /
  // failure (the caller decides what to do).
  const persistExploration = async (ideaName) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setShowAuthModal(true); throw new Error("Log in to save"); }
    const res = await fetch("/api/ideas/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        mode: "explore",
        explore_result: exploreAnalysis,
        idea_text: exploreAnalysis.idea,
        idea_name: ideaName || undefined,
        profile,
        ...(graduatingIdeaId ? { graduate_idea_id: graduatingIdeaId } : {}),
        // Angle → Explore: when THIS exploration was widened from an angle of a
        // SAVED explored idea, attach it as a branch under that idea. Mutually
        // exclusive with graduate. Null for a normal / whole-idea exploration
        // save (the Section-4 Save tile and the leave-guard "Save & continue").
        ...(branchParentId ? { parent_idea_id: branchParentId } : {}),
        // Tag this exploration with the angle it was widened from (angle handoff),
        // so the parent fan marks that angle handled by id.
        ...(originAngleId ? { origin_angle_id: originAngleId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    if (data.idea_id) setSavedExploreIdeaId(data.idea_id);
    if (data.graduated) {
      setGraduatingIdeaId(null);
      delete evaluationCacheRef.current[data.idea_id];
    }
    // Branch intent (angle → Explore under a saved root) is spent once saved.
    setBranchParentId(null);
    setOriginAngleId(null);
    fetchMyIdeas();
    return data;
  };

  // Reroute a take-to action to the matching INPUT screen pre-filled, instead of
  // auto-running. The founder reviews/edits the seed before spending a credit.
  // graduateParent flags the parent → Deep graduation (see DeepInputView onRun).
  const goToInput = (mode, text, graduateParent = false, branchParent = false, originAngle = null) => {
    // Jump-back card source: capture the explored idea ONLY when this handoff came
    // from a saved one (or one of its angles) — savedExploreIdeaId (saved this
    // session) or currentIdeaId (reopened from My Ideas). A fresh, unsaved
    // exploration has its own protocol, so the card is suppressed there.
    const srcId = savedExploreIdeaId || (viewingFromSaved ? currentIdeaId : null);
    if (srcId && exploreAnalysis) {
      setExploreSourceIdea({
        id: srcId,
        text: exploreAnalysis.idea || "",
        count: (exploreAnalysis.angles || []).length || 0,
      });
    } else {
      setExploreSourceIdea(null);
    }
    setIdea(text);
    setPendingGraduateParent(!!graduateParent);
    // Branch-under-explore intent for the angle → Deep/Explore handoff. Resolved
    // to a concrete parent id at the input onRun (savedExploreIdeaId still intact
    // there); mutually exclusive with graduateParent by construction.
    setPendingBranchParent(!!branchParent);
    // The angle id this handoff carries (when from a specific angle), tagged onto
    // the saved child so the fan recognizes it by id.
    setPendingOriginAngle(originAngle || null);
    setInputMode(mode);
    setCurrentScreen("input");
  };

  // An exploration is at risk only while unsaved (not persisted this session and
  // not reopened from the hub). guardLeave warns before a take-to action leaves it;
  // if it's already saved there's nothing to lose, so it proceeds straight through.
  const exploreUnsaved = () => !savedExploreIdeaId && !viewingFromSaved;
  const guardLeave = (target, dest, proceed) => {
    if (exploreUnsaved()) setLeaveGuard({ target, dest, proceed });
    else proceed();
  };

  // ============================================
  // EXECUTION BRIEF STATE (Screen 3 / step-4 handoff)
  // ============================================
  // briefSections : dict of blocks received so far, keyed by block id
  //   (bet / prove_next / order / wont_count / gates / handoff) — the
  //   PROGRESSIVE render source; each block renders the moment its section
  //   event lands. Seeded whole from analysis.execution_brief on a saved load.
  // briefStatus   : "idle" | "streaming" | "complete" | "error"
  // briefError    : user-facing message when briefStatus === "error"
  // briefRetrying : soft transient-retry notice (route retries the open once
  //   before the first section) — distinct from error, never aborts.
  // briefData     : the assembled six-block object — set on `complete` (or
  //   seeded from a saved brief). This is the client-held copy threaded into
  //   the normal-save body so a fresh → generate → save persists the brief.
  const [briefSections, setBriefSections] = useState({});
  const [briefStatus, setBriefStatus] = useState("idle");
  const [briefError, setBriefError] = useState("");
  const [briefRetrying, setBriefRetrying] = useState(false);

  // Clear brief state when analysis switches to a fresh/different idea so a
  // stale brief never bleeds across ideas. (Saved loads seed instead, in
  // applyLoadedIdea.)
  const resetExecutionBrief = () => {
    setBriefSections({});
    setBriefStatus("idle");
    setBriefError("");
    setBriefRetrying(false);
    setBriefData(null);
  };

  const getStepNumber = () => {
    // Deep arc (V6): Idea(1) · Deep Analysis(2) · Evidence & Reality(3) ·
    // Handoff(4) · Evolve(5). results1 is the Deep Analysis screen, results2 is
    // Evidence & Reality, brief is the Handoff. Profile/input fold into Idea.
    const map = { profile: 1, input: 1, myideas: 1, reeval: 5, results1: 2, results2: 3, brief: 4 };
    return map[currentScreen] || 1;
  };

  // Check if the currently viewed idea is a branch (has a parent)
  const isBranchIdea = currentIdeaId ? !!myIdeas.find(i => i.id === currentIdeaId)?.parent_idea_id : false;

  // SSE streaming helper — streams events from the chosen analyze endpoint and returns the final analysis
  const analyzeWithStream = async (ideaText, profileData, endpoint = "/api/analyze-pro", action = "deep") => {
    setStreamSteps([]);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ idea: ideaText, profile: profileData, action }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      // Global capacity guard (503 / code "CAPACITY"): the whole beta hit its weekly
      // ceiling. Raise the capacity wall + waitlist instead of a generic error, and
      // signal callers to bail quietly. A per-user LIMIT (402) still throws below and
      // surfaces the existing "your runs refill {day}" copy.
      if (res.status === 503 || errData.code === "CAPACITY") {
        setCapacityWall(true);
        return { capacity: true };
      }
      throw new Error(errData.error || "Analysis failed");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalAnalysis = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));

            if (event.step === "error") {
              throw new Error(event.message);
            }

            // Beat model: each pipeline beat is ONE line that transitions in place
            // from a live spinner to a checkmark. baseOf() strips the _start/_done
            // suffix so a stage's start and done resolve to the same beat (this is
            // also what fixes the old stage2a/2b/2c desync — no hardcoded pairing
            // names). Retrieval sources have no _start, so they append as their own
            // checked sub-rows; evidence_ready closes the parent "search" beat.
            const baseOf = (step) => step.replace(/_(start|done)$/, "");
            const SOURCE_DONES = { github_done: "github", tavily_done: "tavily", exa_done: "exa", serper_done: "google" };

            if (event.step === "complete") {
              finalAnalysis = event.data;
              setStreamSteps((prev) => [
                ...prev.map((s) => (s.done ? s : { ...s, done: true })),
                { step: "complete", message: "Evaluation complete ✓", done: true },
              ]);
            } else if (event.step === "retry") {
              // F4/B+ — soft transient-failure notice. NOT an error: the run is
              // still going, a step stumbled and is being retried once. Append as an
              // in-progress line so the panel shows an honest "hit a snag — retrying"
              // beat during the extra wait. Resolves to a check in the final sweep;
              // if the retry also fails, an "error" event follows and aborts.
              setStreamSteps((prev) => [...prev, { step: "retry", message: event.message, done: false }]);
            } else if (event.step === "evidence_ready") {
              // Close the parent retrieval beat, then add the assembled-evidence line.
              setStreamSteps((prev) => [
                ...prev.map((s) => (s.base === "search" && !s.done ? { ...s, done: true, message: "Searched 4 sources" } : s)),
                { step: "evidence_ready", base: "evidence", message: event.message, done: true },
              ]);
            } else if (SOURCE_DONES[event.step]) {
              // A retrieved source — appears already-checked (the 8 calls resolve
              // together), carrying its trust-dot colour.
              setStreamSteps((prev) => [...prev, { step: event.step, base: baseOf(event.step), source: SOURCE_DONES[event.step], message: event.message, done: true }]);
            } else if (event.step === "scoring") {
              setStreamSteps((prev) => [...prev, { step: "scoring", base: "scoring", message: event.message, done: true }]);
            } else if (event.step.endsWith("_start")) {
              const base = baseOf(event.step);
              setStreamSteps((prev) =>
                prev.some((s) => s.base === base)
                  ? prev.map((s) => (s.base === base ? { ...s, done: false, message: event.message } : s))
                  : [...prev, { step: event.step, base, message: event.message, done: false }]
              );
            } else if (event.step.endsWith("_done")) {
              const base = baseOf(event.step);
              setStreamSteps((prev) =>
                prev.some((s) => s.base === base && !s.source)
                  ? prev.map((s) => (s.base === base && !s.source ? { ...s, done: true, message: event.message } : s))
                  : [...prev, { step: event.step, base, message: event.message, done: true }]
              );
            }
          } catch (e) {
            // Skip malformed SSE events
            if (e.message !== "Analysis failed" && !e.message.startsWith("Failed to parse")) {
              console.error("SSE parse error:", e);
            } else {
              throw e;
            }
          }
        }
      }
    }

    if (!finalAnalysis) {
      throw new Error("Analysis failed — no result received.");
    }

    // Mark any remaining in-progress steps as done (the stages for deep/explore)
    setStreamSteps((prev) =>
      prev.map((s) => (s.done ? s : { ...s, done: true }))
    );

    // Check for ethics block
    if (finalAnalysis.ethics_blocked) {
      return { ethicsBlocked: true, message: finalAnalysis.ethics_message };
    }

    return { ethicsBlocked: false, analysis: finalAnalysis };
  };

  // CHANGE WALKTHROUGH (V87 Stage 3a) — after a deep re-eval lands, ask the diff
  // route to compute the markers and narrate them. The route is stateless: it
  // takes BOTH full analyses in the body and never touches the DB. Fire-and-forget
  // by design — the result screen reads `walkthroughData` from state, and on ANY
  // failure it simply stays null and no markers render. Never blocks the result.
  const runWalkthrough = async (prevAnalysis, nextAnalysis, changedFieldNames) => {
    if (!prevAnalysis || !nextAnalysis) return;
    setWalkthroughData(null);
    setWalkthroughLoading(true);
    try {
      const res = await fetch(`/api/ideas/${currentIdeaId || "pending"}/re-evaluate-walkthrough`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prevAnalysis,
          nextAnalysis,
          changedFields: Array.isArray(changedFieldNames) ? changedFieldNames : [],
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.ok) setWalkthroughData(data);
    } catch (e) {
      // non-fatal — the result screen renders without markers
    } finally {
      setWalkthroughLoading(false);
    }
  };

  const handleAnalyze = async (mode = "deep", ideaTextOverride = null, graduateId = null, branchParentArg = null, originAngleArg = null) => {
    const ideaToUse = ideaTextOverride != null ? ideaTextOverride : idea;
    if (!ideaToUse.trim()) return;
    setEvidenceSignal(null);

    // For logged-in users, check DB-based limits; for anon, use localStorage
    if (user) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/eval-usage", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const data = await res.json();
          if (res.ok && data.remaining <= 0) {
            const resetTime = data.next_reset_time
              ? formatResetTime(data.next_reset_time)
              : "soon";
            setError("You've used your free evaluations. Get credits to keep evaluating.");
            return;
          }
        }
      } catch (err) {
        // Fall through to localStorage check if DB check fails
        console.error("DB eval check failed, using localStorage:", err);
      }
    } else {
      const remaining = getEvalsRemaining();
      if (remaining <= 0) {
        setError("You've used your free evaluations. Get credits to keep evaluating.");
        return;
      }
    }

    // Concurrency lock — committed to running now (all eval-limit early returns
    // are above). Reject any second run that races in before the next one ends.
    if (runningRef.current) return;
    runningRef.current = true;

    setIsAnalyzing(true);
    setError("");
    // Reset save state for new evaluation
    setSaveStatus("idle");
    setSaveError("");
    setSavedIdeaId(null);
    setIdeaName("");
    setCurrentEvaluationId(null);
    setCurrentIdeaId(null);
    setViewingFromSaved(false);
    // This analysis run declares its graduation intent (or lack of one). A
    // fresh run from input/explore passes null, clearing any stale intent.
    setGraduatingIdeaId(graduateId);
    // This run also declares its branch-under-explore parent (or null). Resolved
    // live by the input onRun; stored here so it survives to save time even though
    // savedExploreIdeaId is cleared just below. A cold-open run passes null.
    setBranchParentId(branchParentArg);
    // ...and the originating angle id (when forward-from-angle), tagged onto the
    // saved child at save time so the fan recognizes it by id.
    setOriginAngleId(originAngleArg);
    // The parent-graduate flag is consumed by the Deep run's onRun (which resolved
    // graduateId from it); clear it so it never leaks into a later cold-open run.
    setPendingGraduateParent(false);
    setPendingBranchParent(false);
    setPendingOriginAngle(null);
    // A new run starts a clean Explore session — no saved explored idea yet.
    setSavedExploreIdeaId(null);
    // ...and no explored idea to jump back to once a run commits.
    setExploreSourceIdea(null);
    setIsReEvalResult(false);
    setReEvalRevisionNotes(null);
    try {
      const endpoint = mode === "explore" ? "/api/analyze-explore" : "/api/analyze-pro";
      const result = await analyzeWithStream(ideaToUse, profile, endpoint, mode);

      if (result.capacity) return; // capacity wall already raised
      if (result.ethicsBlocked) {
        setError(result.message);
        return;
      }

      // Record eval usage: DB for logged-in users, localStorage for anon
      if (user) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const usageRes = await fetch("/api/eval-usage", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: mode }),
            });
            const usageData = await usageRes.json();
            if (usageRes.ok) {
              setEvalsRemaining(usageData.remaining);
            }
          }
        } catch (err) {
          console.error("Failed to record eval usage in DB:", err);
        }
      } else {
        recordEval();
        setEvalsRemaining(getEvalsRemaining());
      }

      if (mode === "explore") {
        setExploreAnalysis(result.analysis);
        setCurrentScreen("explore");
      } else {
        setAnalysis(result.analysis);
        setWalkthroughData(null);
        resetExecutionBrief();
        setCurrentScreen("results1");
      }
      try { localStorage.removeItem("iv_draft_input"); } catch (e) {}
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
      runningRef.current = false;
    }
  };

  // EVIDENCE RE-JUDGE — the "Needs Your Move" re-evaluation. Same deep pipeline as a
  // normal re-eval, but the founder edited NOTHING: we re-run /api/analyze-pro on the
  // UNCHANGED idea text so retrieval picks up the world's move, then narrate with an
  // EMPTY changedFields set. With no edit, every changed anchor resolves to the
  // walkthrough's "evidence-only" shape — "you changed nothing here; fresh evidence
  // surfaced and the read followed." Path A: show the evidence delta itself; reshaping
  // stays the optional follow-on via the normal Evolve entry. prevAnalysis is captured
  // LOCALLY (not via reEvalPrevAnalysis state) to dodge the set-then-read stale closure.
  const startEvidenceReJudge = async (signal) => {
    if (!currentIdeaId || !user) return;
    const prev = analysis;
    const ideaText = (loadedIdeaText || idea || "").trim();
    if (!prev || !ideaText) { setIsReEvaluating(false); return; }
    if (runningRef.current) return;
    runningRef.current = true;
    setIsReEvaluating(true);
    setError("");
    setReEvalSource("analysis");
    setReEvalPrevAnalysis(prev);
    setReEvalOriginalIdea(ideaText);
    setEvidenceSignal(signal || null);
    setWalkthroughData(null);
    try {
      const result = await analyzeWithStream(ideaText, profile, "/api/analyze-pro", "reeval");
      if (result.capacity) return; // capacity wall already raised
      if (result.ethicsBlocked) {
        setError(result.message || "Re-judge could not complete.");
        return;
      }
      // Record eval usage (a re-judge is a full pipeline run). NOTE: whether a watch
      // re-judge should consume a credit or ride the watch is a pricing call — kept
      // consistent with handleReEvaluate for now.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const usageRes = await fetch("/api/eval-usage", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: "reeval" }),
          });
          const usageData = await usageRes.json();
          if (usageRes.ok) setEvalsRemaining(usageData.remaining);
        }
      } catch (err) { console.error("Failed to record eval usage:", err); }

      setReEvalRevisionNotes(null);
      setReEvalChangedFields(null);
      setAnalysis(result.analysis);
      // EMPTY changedFields -> the diff lights only evidence/read paths -> evidence-only.
      runWalkthrough(prev, result.analysis, []);
      resetExecutionBrief();
      setViewingFromSaved(false);
      setSaveStatus("idle");
      setSaveError("");
      setSavedIdeaId(null);
      setIdeaName("");
      setCurrentEvaluationId(null);
      setIsReEvalResult(true);
      setReEvalMode(false);
      setCurrentScreen("results1");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsReEvaluating(false);
      runningRef.current = false;
    }
  };

  // Resolve the triggering signal (called on a re-read DECISION, never on click —
  // so a failed re-read leaves the signal standing).
  const resolveEvidenceSignal = async (status) => {
    const sig = evidenceSignal;
    if (!sig || !sig.id) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/signals/${sig.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ status }),
      });
    } catch (e) { /* non-fatal — a refresh reconciles */ }
  };

  // SET AS CURRENT READ — make the fresh re-read this idea's current evaluation.
  // The save route snapshots the old read into read_history (it survives as a
  // "previous read"); the idea text is unchanged, so no new version is forked.
  const setAsCurrentRead = async () => {
    if (!currentIdeaId || !analysis || readDecisionBusy) return;
    setReadDecisionBusy(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setReadDecisionBusy(false); return; }
      const res = await fetch("/api/ideas/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          recheck_idea_id: currentIdeaId,
          analysis,
          idea_text: (loadedIdeaText || reEvalOriginalIdea || idea || "").trim(),
          execution_brief: briefData || null,
          profile,
          signal_id: evidenceSignal?.id || null,
        }),
      });
      if (res.ok) {
        await resolveEvidenceSignal("acted");
        setEvidenceSignal(null);
        setIsReEvalResult(false);
        loadSavedIdea(currentIdeaId); // reload so the now-current read shows cleanly
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not set the current read.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setReadDecisionBusy(false);
    }
  };

  // KEEP THE OLD READ — discard the fresh re-read; the old read stays current. The
  // signal still resolves (the resolved-signal baseline union keeps it from re-firing).
  const keepOldRead = async () => {
    if (readDecisionBusy) return;
    setReadDecisionBusy(true);
    try {
      await resolveEvidenceSignal("acted");
      setEvidenceSignal(null);
      setIsReEvalResult(false);
      if (currentIdeaId) loadSavedIdea(currentIdeaId); // back to the still-current old read
    } finally {
      setReadDecisionBusy(false);
    }
  };

  // Set this idea's evidence-watch cadence (the dial on a saved deep result).
  // PATCHes /api/ideas/[id]/watch; returns true on success so the dial can confirm.
  const onSetWatch = async (cadence) => {
    if (!currentIdeaId) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const res = await fetch(`/api/ideas/${currentIdeaId}/watch`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ cadence }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  };

  // Re-evaluate a saved idea with optional changes
  const handleReEvaluate = async (payload) => {
    if (!currentIdeaId || !user) return;
    setEvidenceSignal(null);

    // Check eval limits (same as handleAnalyze)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch("/api/eval-usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && data.remaining <= 0) {
          const resetTime = data.next_reset_time
            ? formatResetTime(data.next_reset_time)
            : "soon";
          setError("You've used your free evaluations. Get credits to keep evaluating.");
          return;
        }
      }
    } catch (err) {
      console.error("DB eval check failed:", err);
    }

    // Concurrency lock (shared with handleAnalyze) — no run may start while one
    // is in flight; released in finally.
    if (runningRef.current) return;
    runningRef.current = true;

    setIsReEvaluating(true);
    setError("");

    try {
      // V87 Stage 5b — Evolve screen payload: the founder reshapes the full idea
      // text directly (and optionally tags the parts they touched, or describes the
      // change in the freecard). modifiedIdea is the edited text; changedFields are
      // the touched parts mapped to the canonical part vocabulary (ideaParts.PARTS)
      // the change-walkthrough diff understands.
      const p = payload || {};
      const PART_FIELD = { target: "target_user", problem: "use_case", mechanism: "mechanism", money: "payment_shape", moat: "defensibility", scope: "build_profile" };
      let modifiedIdea = (typeof p.ideaText === "string" && p.ideaText.trim()) ? p.ideaText.trim() : reEvalOriginalIdea;
      const freeNote = (typeof p.freeNote === "string" ? p.freeNote.trim() : "");
      if (freeNote) modifiedIdea += `\n\n[CHANGE REQUEST — ${freeNote}]`;
      const partList = Array.isArray(p.changedParts) ? p.changedParts.map((c) => c && c.part).filter(Boolean) : [];
      if (p.branchLabel && /_shift$/.test(p.branchLabel)) partList.push(p.branchLabel.replace(/_shift$/, ""));
      const fieldSet = [];
      for (const part of partList) { const f = PART_FIELD[part] || part; if (f && !fieldSet.includes(f)) fieldSet.push(f); }
      const revisions = fieldSet.map((f) => ({ type: f, text: null }));
      const changedFields = fieldSet.map((f) => ({ field: f, original_value: null, new_value: null }));

      // Use SSE streaming
      const reEvalEndpoint = "/api/analyze-pro";
      const result = await analyzeWithStream(modifiedIdea, profile, reEvalEndpoint, "reeval");

      if (result.capacity) return; // capacity wall already raised
      if (result.ethicsBlocked) {
        setError(result.message);
        return;
      }

      // Record eval usage
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const usageRes = await fetch("/api/eval-usage", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: "reeval" }),
          });
          const usageData = await usageRes.json();
          if (usageRes.ok) {
            setEvalsRemaining(usageData.remaining);
          }
        } catch (err) {
          console.error("Failed to record eval usage:", err);
        }
      }

      // Store revision notes and changed fields for when user saves later
      setReEvalRevisionNotes(revisions.length > 0 ? revisions : null);
      setReEvalChangedFields(changedFields.length > 0 ? changedFields : null);

      // Show results as FRESH evaluation (not saved, not viewing from saved)
      setAnalysis(result.analysis);
      // V87 Stage 3a — fire the change walkthrough off the FULL prior analysis vs
      // the just-computed one. changedFields here are the edited input fields; the
      // diff route maps each to the part it touches. Non-blocking, result-safe.
      runWalkthrough(reEvalPrevAnalysis, result.analysis, changedFields.map((c) => c.field));
      resetExecutionBrief();
      setViewingFromSaved(false);
      setSaveStatus("idle");
      setSaveError("");
      setSavedIdeaId(null);
      setIdeaName("");
      setCurrentEvaluationId(null);
      setIsReEvalResult(true); // flag so save knows to use re-evaluate endpoint
      setReEvalMode(false);
      setReEvalTargetUser("");
      setReEvalProblem("");
      setReEvalCoreIdea("");
      try { if (currentIdeaId) localStorage.removeItem(`iv_draft_reeval_${currentIdeaId}`); } catch (e) {}
      setCurrentScreen("results1");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsReEvaluating(false);
      runningRef.current = false;
    }
  };

  // Start re-evaluation flow from saved idea view
  // Evolve colour pass — a Haiku display-call that tags the load-bearing clauses
  // so the canvas loads pre-coloured. Non-fatal: any failure falls back to plain
  // text. Engine untouched. The canvas blurs while ideaTagging is true.
  const runIdeaTagging = async (analysisObj, rawIdea, ideaId) => {
    setTaggedIdeaHtml(null);
    setIdeaTagging(true);
    try {
      const clean = (rawIdea || "").trim()
        .replace(/^idea\s*:\s*/i, "").replace(/^["\x27\s]+/, "").replace(/["\x27,\s]+$/, "").trim();
      if (!clean) { setIdeaTagging(false); return; }
      const ev = (analysisObj && analysisObj.evaluation) || {};
      const anatomy = {
        target_problem: ev.market_demand?.diagnosis || "",
        mechanism: ev.originality?.differentiation_basis_diagnosis || "",
        moat: ev.originality?.defensibility_diagnosis || "",
        money: ev.monetization?.diagnosis || "",
        scope: ev.technical_complexity?.base_score_explanation || "",
      };
      const res = await fetch(`/api/ideas/${ideaId}/tag-parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaText: clean, anatomy }),
      });
      const data = await res.json().catch(() => ({}));
      const tags = Array.isArray(data && data.tags) ? data.tags : [];
      setTaggedIdeaHtml(buildTaggedIdeaHtml(clean, tags));
    } catch (e) {
      setTaggedIdeaHtml(null); // render falls back to the plain ideaHtml
    } finally {
      setIdeaTagging(false);
    }
  };

  const startReEvaluation = (source) => {
    if (!user) { setShowAuthModal(true); return; }
    // Record the entry path so the back link points home: "lineage" (from the tree)
    // → back to this idea's lineage; anything else → back to the analysis.
    setReEvalSource(source === "lineage" ? "lineage" : "analysis");
    // Capture context snapshot for the "Evolve This Idea" screen
    const ideaTitle = myIdeas.find(i => i.id === currentIdeaId)?.title || "";
    setReEvalContextSnapshot(analysis ? {
      title: ideaTitle,
      overall: analysis.evaluation?.overall_score || analysis.evaluation?.weighted_overall || 0,
      md: analysis.evaluation?.market_demand?.score,
      mo: analysis.evaluation?.monetization?.score,
      or: analysis.evaluation?.originality?.score,
      tc: analysis.evaluation?.technical_complexity?.score,
      failure_risks: analysis.evaluation?.failure_risks || [],
      evidence_strength: analysis.evaluation?.evidence_strength || null,
    } : null);
    // V87 Stage 3a — keep the FULL prior analysis (not just the scores snapshot
    // above); the change-walkthrough diffs the new analysis against this one.
    setReEvalPrevAnalysis(analysis || null);
    setWalkthroughData(null);
    setReEvalOriginalIdea(loadedIdeaText || idea);
    setReEvalTargetUser("");
    setReEvalProblem("");
    setReEvalCoreIdea("");
    setReEvalEditTarget(false);
    setReEvalEditProblem(false);
    setReEvalEditCore(false);
    setError("");
    setReEvalMode(true);
    setCurrentScreen("reeval");
    runIdeaTagging(analysis || null, loadedIdeaText || idea, currentIdeaId);
  };

  // Helper: format a reset time ISO string to human-readable
  const formatResetTime = (isoString) => {
    const resetDate = new Date(isoString);
    const now = new Date();
    const diffMs = resetDate - now;
    if (diffMs <= 0) return "< 1h";
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return "< 1h";
  };

  // Weekday-form of the refill moment for the editorial run-button nudge
  // ("Your runs refill Monday."). Rolling 7-day window, so it's always within a
  // week — a weekday name reads warmer than the "2d 3h" duration form above.
  const formatRefillDay = (isoString) => {
    if (!isoString) return "soon";
    const d = new Date(isoString), now = new Date();
    if (d - now <= 0) return "shortly";
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dd = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - startOfToday) / 864e5);
    if (dd <= 0) return "later today";
    if (dd === 1) return "tomorrow";
    return d.toLocaleDateString(undefined, { weekday: "long" });
  };

  // Save evaluation to database — two-step: first show name input, then save
  const handleSaveIdea = async () => {
    if (!user) { setShowAuthModal(true); return; }
    if (!analysis || saveStatus === "saving" || saveStatus === "saved") return;

    // First click: show the naming input
    if (saveStatus !== "naming") {
      setSaveStatus("naming");
      if (isReEvalResult) {
        // Pre-fill with "Branch" for re-evaluations
        setIdeaName("Branch");
        setBranchReason("");
        setBranchDimensions([]);
        setBranchSetAsMain(false);
      } else {
        // Pre-fill with a sensible default from the idea text
        const firstLine = idea.split(/[.!?\n]/)[0].trim();
        setIdeaName(firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + "...");
      }
      return;
    }

    // Second click (confirm): actually save with the chosen name
    if (!ideaName.trim()) return;

    setSaveStatus("saving");
    setSaveError("");

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSaveStatus("error");
        setSaveError("Session expired. Please log in again.");
        return;
      }

      if (isReEvalResult && currentIdeaId && !saveStandalone) {
        // Branch save: create new idea linked to parent
        // Validate branch form fields
        if (!branchReason.trim()) {
          setSaveStatus("naming");
          setSaveError("Please explain why this is a different direction.");
          return;
        }
        if (branchDimensions.length === 0) {
          setSaveStatus("naming");
          setSaveError("Select at least one dimension that changed.");
          return;
        }

        const res = await fetch(`/api/ideas/${currentIdeaId}/branch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: ideaName.trim(),
            raw_idea_text: idea || reEvalOriginalIdea || "",
            branch_reason: branchReason.trim(),
            changed_dimensions: branchDimensions,
            analysis,
            profile,
            changed_fields: reEvalChangedFields,
            // V87 Stage 3b — persist the change-walkthrough with the branch so its
            // markers survive a reload (null on a non-re-eval branch).
            walkthrough: walkthroughData || null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSaveStatus("error");
          setSaveError(data.error || "Failed to save. Please try again.");
          return;
        }

        setSaveStatus("saved");
        setCurrentIdeaId(data.idea_id);
        setCurrentEvaluationId(data.evaluation_id);
        setIsReEvalResult(false);

        // Saving a branch GROWS the tree only — it never moves the Lead. The Lead
        // is set in exactly one place now: the SET LEAD control in the lineage view.

        // Refresh hub data so lineage view and hub reflect the new branch
        fetchMyIdeas();
      } else if (isReEvalResult && saveStandalone) {
        // Standalone save: persist the evolved candidate as its OWN root idea
        // (no parent_idea_id) so it lands in Evaluated as an independent deep
        // card, outside the x→y→z lineage. Routes to the same root-save endpoint
        // a first-time evaluation uses; no branch reason/dimensions apply.
        const res = await fetch("/api/ideas/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            idea_text: idea || reEvalOriginalIdea || "",
            idea_name: ideaName.trim(),
            profile,
            analysis,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSaveStatus("error");
          setSaveError(data.error || "Failed to save. Please try again.");
          if (data.limit_reached) setSavedIdeasCount(data.saved_count);
          return;
        }

        setSaveStatus("saved");
        setSavedIdeaId(data.idea_id);
        setCurrentIdeaId(data.idea_id);
        setCurrentEvaluationId(data.evaluation_id);
        setIsReEvalResult(false);
        setSaveStandalone(false);
        if (typeof data.saved_count === "number") setSavedIdeasCount(data.saved_count);
        fetchMyIdeas();
      } else {
        // Normal save: create new idea + evaluation
        const res = await fetch("/api/ideas/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            idea_text: idea,
            idea_name: ideaName.trim(),
            profile,
            analysis,
            // fresh → generate → save: persist the client-held brief with the
            // new row (null when none was generated). Branch saves do NOT carry
            // it — a branch persists its brief via generate-from-hub later.
            execution_brief: briefData || null,
            // Graduation: when set, the save flips this existing idea forward in
            // place (rough -> deep) instead of creating a new idea. Absent on a
            // normal fresh save.
            ...(graduatingIdeaId ? { graduate_idea_id: graduatingIdeaId } : {}),
            // Angle → Deep: when the explored idea this angle came from is saved,
            // attach this fresh deep eval as a NEW non-main child UNDER it (a
            // branch in the explore's lineage) instead of a standalone root.
            // Mutually exclusive with graduate_idea_id (graduate converts in
            // place; this spawns a child). Null on a normal fresh deep or an
            // unsaved-explore angle — which keeps the standalone fallback.
            ...(branchParentId ? { parent_idea_id: branchParentId } : {}),
            // Tag the deep child with the angle it was born from, so the fan marks
            // that angle handled by id (survives seed edits). Null otherwise.
            ...(originAngleId ? { origin_angle_id: originAngleId } : {}),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setSaveStatus("error");
          setSaveError(data.error || "Failed to save. Please try again.");
          if (data.limit_reached) {
            setSavedIdeasCount(data.saved_count);
          }
          return;
        }

        setSaveStatus("saved");
        setSavedIdeaId(data.idea_id);
        setCurrentIdeaId(data.idea_id);
        setCurrentEvaluationId(data.evaluation_id);
        if (typeof data.saved_count === "number") setSavedIdeasCount(data.saved_count);

        if (data.graduated) {
          // The rough card became a deep card in place. Intent is spent; drop
          // the stale cached rough read so reopening shows the deep room, and
          // refresh the hub so the card moves shelves.
          setGraduatingIdeaId(null);
          delete evaluationCacheRef.current[data.idea_id];
          fetchMyIdeas();
        } else if (branchParentId) {
          // Angle → Deep child: a new deep node now lives in the explore's
          // lineage. Spend the branch intent and refresh so it appears there.
          setBranchParentId(null);
          setOriginAngleId(null);
          fetchMyIdeas();
        }
      }
    } catch (err) {
      setSaveStatus("error");
      setSaveError("Something went wrong. Please try again.");
    }
  };

  // Fetch saved ideas for My Ideas Hub
  const fetchMyIdeas = async () => {
    if (!user) return;
    setMyIdeasLoading(true);
    setMyIdeasError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/ideas/list", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMyIdeas(data.ideas || []);
      setSavedIdeasCount(data.count || 0);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load ideas.");
    } finally {
      setMyIdeasLoading(false);
    }
  };

  // Apply loaded evaluation data to state (shared by cache hit and fetch paths)
  // Previous reads of a deep idea — evidence re-reads that replaced the live eval
  // in place (the idea text never changed). Fire-and-forget on open; resolves to
  // [] for ideas that were never re-read, so the "Previous reads" strip simply
  // doesn't render.
  const fetchReadHistory = async (ideaId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setReadHistory([]); return; }
      const res = await fetch(`/api/ideas/${ideaId}/history`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setReadHistory(res.ok && Array.isArray(data.reads) ? data.reads : []);
    } catch {
      setReadHistory([]);
    }
  };

  // Open the preserved EXPLORE read of a graduated deep idea (read-only). The
  // Lineage inspector only has the idea id, so fetch read_history, pick the
  // explore snapshot, and hand it to the read-only ExploreView viewer. (The deep
  // surface already holds the item and sets the state directly — no fetch.)
  const openExploredVersion = async (ideaId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/ideas/${ideaId}/history`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json();
      const reads = res.ok && Array.isArray(data.reads) ? data.reads : [];
      const ex = reads.find((r) => r.kind === "explore" && r.explore);
      if (ex) setHistoricalExploreRead(ex);
    } catch { /* no-op */ }
  };

  const applyLoadedIdea = (data, ideaId, afterLoad) => {
    setIdea(data.idea.raw_idea_text);
    setAnalysis(data.analysis);
    // V87 Stage 3c — restore persisted walkthrough markers on reload. The GET
    // route surfaces meta_json as analysis._meta, and the branch route stored the
    // walkthrough under meta_json.walkthrough; null for non-re-eval ideas.
    setWalkthroughData(data.analysis?._meta?.walkthrough || null);
    setSaveStatus("saved");
    setSavedIdeaId(ideaId);
    setCurrentIdeaId(ideaId);
    setCurrentEvaluationId(data.evaluation_id);
    setViewingFromSaved(true);

    // Read history — a fresh idea-open always lands on the current read, never a
    // previously-opened snapshot. Reset the viewer, then load previous reads only
    // for deep ideas (rough/explore have none).
    setHistoricalRead(null);
    setReadHistory([]);
    if (data.analysis) fetchReadHistory(ideaId);

    // Seed the execution-brief state from the loaded analysis. The [id] route
    // surfaces a persisted brief as analysis.execution_brief; when present we
    // mark it complete so opening the brief screen DISPLAYS it without a new
    // generation. When absent, reset to idle so a stale brief can't bleed across
    // ideas — the user can generate one fresh.
    const loadedBrief = data.analysis?.execution_brief;
    if (loadedBrief && Object.keys(loadedBrief).length > 0) {
      setBriefSections(loadedBrief);
      setBriefData(loadedBrief);
      setBriefStatus("complete");
    } else {
      setBriefSections({});
      setBriefData(null);
      setBriefStatus("idle");
    }
    setBriefError("");
    setBriefRetrying(false);

    // Reconstruct the full idea text including revisions
    let fullIdeaText = data.idea.raw_idea_text;
    const revisionNotes = data.analysis?._meta?.revision_notes;
    if (revisionNotes && Array.isArray(revisionNotes) && revisionNotes.length > 0) {
      const changeLabel = (type) => {
        if (type === "target_user") return "Target user";
        if (type === "problem") return "Problem it solves";
        if (type === "core_idea") return "Core idea";
        return "";
      };
      revisionNotes.forEach((rev) => {
        if (rev.type && rev.text) {
          fullIdeaText += `\n\n[REVISION — ${changeLabel(rev.type)} changed to: ${rev.text}]`;
        }
      });
    }
    setLoadedIdeaText(fullIdeaText);
    // afterLoad intent: the Overview "Open execution brief →" resume routes here.
    // We set the brief screen in the SAME synchronous batch as setAnalysis above,
    // so the brief guard (currentScreen === "brief" && analysis) is satisfied on
    // the next render. Routing via a post-load setCurrentScreen in a .then() would
    // race the not-yet-committed analysis state and fall through to the white
    // screen (return null). Only honor "brief" when analysis is actually present.
    if (afterLoad === "brief" && data.analysis) {
      setCurrentScreen("brief");
    } else {
      setCurrentScreen("results1");
    }
  };

  // Route a loaded idea to the right room based on its derived state. Deep ideas
  // carry an analysis and open the results room; rough ideas have none and open
  // the two-door rough room; explore ideas open the explore room.
  const routeLoadedIdea = (data, ideaId, afterLoad) => {
    const state = data && data.state;
    // Mark this as the family the user last opened — the Overview "continue
    // where you left off" resume target (per-browser; resolved to a hub card).
    recordLastIdea(ideaId);
    if (state === "rough") {
      const txt = data.idea?.raw_idea_text || "";
      // Overview "Explore this" (rough secondary): graduate this rough idea
      // forward into the Explore input in place — mirrors the rough-room door
      // (graduatingIdeaId carries the node so running flips it forward, not a dup).
      if (afterLoad === "graduate-explore") {
        setHubReturnView("evaluated");
        setSavedExploreIdeaId(null);
        setGraduatingIdeaId(ideaId);
        goToInput("explore", txt, true);
        return;
      }
      setRoughRoomIdea({
        id: ideaId,
        text: txt,
        title: data.idea?.title || txt.split(/[.!?\n]/)[0].trim().slice(0, 80),
      });
      setRoughEditing(false);
      setCurrentScreen("roughroom");
      return;
    }
    if (state === "explore") {
      if (data.explore) {
        // Overview "Take one deep" (explore secondary): graduate this explored
        // idea forward into the Deep input in place. graduatingIdeaId carries the
        // explore node so the deep run flips it forward (line: deep onRun reads
        // savedExploreIdeaId || graduatingIdeaId); clearing savedExploreIdeaId
        // keeps it on the graduate path, not the branch-under-explore path.
        if (afterLoad === "graduate-deep") {
          setExploreAnalysis(data.explore);
          setViewingFromSaved(true);
          setHubReturnView("evaluated");
          setSavedExploreIdeaId(null);
          setGraduatingIdeaId(ideaId);
          goToInput("deep", data.explore.idea || "", true);
          return;
        }
        setExploreAnalysis(data.explore);
        // Reopened from the hub: this explored idea is already saved. Mark it so
        // the "Keep this explored idea" bar doesn't offer to save it again, and
        // remember its id so a new angle branches under it and "take to Deep as
        // it stands" graduates THIS idea rather than making a duplicate.
        setViewingFromSaved(true);
        setSavedExploreIdeaId(ideaId);
        setCurrentScreen("explore");
      } else {
        setMyIdeasError("This explored idea can't be opened yet.");
      }
      return;
    }
    // deep (default) — analysis present
    applyLoadedIdea(data, ideaId, afterLoad);
  };

  // Load a saved idea's full evaluation and show it
  const loadSavedIdea = async (ideaId, evaluationId, afterLoad) => {
    if (!user) return;
    setMyIdeasError("");
    setEvidenceSignal(null);
    setShowAlternativesPopup(false);

    const cacheKey = evaluationId ? `${ideaId}-${evaluationId}` : ideaId;

    // Check cache first — instant load if available
    if (evaluationCacheRef.current[cacheKey]) {
      const cached = evaluationCacheRef.current[cacheKey];
      routeLoadedIdea(cached, ideaId, afterLoad);
      return;
    }

    setMyIdeasLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = evaluationId
        ? `/api/ideas/${ideaId}?evaluation_id=${evaluationId}`
        : `/api/ideas/${ideaId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Store in cache
      evaluationCacheRef.current[cacheKey] = data;

      routeLoadedIdea(data, ideaId, afterLoad);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load idea.");
    } finally {
      setMyIdeasLoading(false);
    }
  };

  // ============================================
  // EXECUTION BRIEF — SSE consumer + entry
  // ============================================
  // Fresh consumer written against the brief route's OWN event contract
  // (start / section / retry / error / complete) — deliberately NOT forked from
  // analyzeWithStream, which switches on the pipeline's stage steps. Two hard
  // differences from analyze: the brief route REQUIRES `Authorization: Bearer`,
  // and sections are rendered PROGRESSIVELY (each `section` event paints its
  // block immediately; we never wait for `complete` to show content).
  //
  // evaluationId is passed ONLY when a saved row exists (currentEvaluationId).
  // Saved → the route persists to evaluations.execution_brief_json. Fresh/unsaved
  // → omitted; the brief rides back on `complete` into briefData and persists
  // later via the normal-save body. `currentEvaluationId || null` covers all
  // cases: it's null on a fresh unsaved eval and set after load or save.
  const streamExecutionBrief = async (evaluationId) => {
    if (!analysis) return;

    setBriefStatus("streaming");
    setBriefError("");
    setBriefRetrying(false);
    setBriefSections({});
    setBriefData(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setBriefStatus("error");
        setBriefError("Session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/execution-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          analysis,
          ...(evaluationId ? { evaluation_id: evaluationId } : {}),
          devMode: "subscriber",
        }),
      });

      // Non-stream failures arrive as a JSON error (401/400/402/422/5xx).
      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setBriefStatus("error");
        setBriefError(
          errData.error ||
            (res.status === 422
              ? "An execution brief isn't available for this analysis."
              : "Couldn't generate the execution brief.")
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep the incomplete trailing line

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          let event;
          try {
            event = JSON.parse(payload);
          } catch {
            continue; // ignore keepalives / non-JSON
          }

          if (event.step === "start") {
            // stream opened; nothing to paint yet (loading state shows)
          } else if (event.step === "section") {
            // progressive paint — render this block immediately
            setBriefRetrying(false);
            setBriefSections((prev) => ({ ...prev, [event.id]: event.data }));
          } else if (event.step === "retry") {
            // soft transient notice — the route is reopening before the first
            // section. NOT an error; the run is still alive.
            setBriefRetrying(true);
          } else if (event.step === "error") {
            setBriefStatus("error");
            setBriefError(event.message || "Brief generation failed.");
            return;
          } else if (event.step === "complete") {
            // authoritative assembled brief — store for save + mark done
            const brief = event.brief || {};
            setBriefSections(brief);
            setBriefData(brief);
            setBriefRetrying(false);
            setBriefStatus("complete");
          }
        }
      }

      // Stream ended without a terminal event (defensive): if we never reached
      // complete or error, treat a populated section set as done, else error.
      setBriefStatus((prev) => {
        if (prev === "complete" || prev === "error") return prev;
        return "error";
      });
    } catch (err) {
      setBriefStatus("error");
      setBriefError(err?.message || "Couldn't generate the execution brief.");
    }
  };

  // Navigate to the brief screen. If a brief is already attached (saved idea
  // loaded with execution_brief, or one generated this session), DISPLAY it —
  // don't regenerate (that wastes a call and overwrites the saved artifact).
  // Otherwise stream a fresh one, passing evaluation_id only when a row exists.
  const openExecutionBrief = ({ regenerate = false } = {}) => {
    if (!analysis) return;
    setCurrentScreen("brief");

    const hasBrief =
      briefData ||
      (analysis.execution_brief && Object.keys(analysis.execution_brief).length > 0);

    if (hasBrief && !regenerate) {
      // already have it — make sure state reflects the attached brief, no stream
      const existing = briefData || analysis.execution_brief;
      setBriefSections(existing);
      setBriefData(existing);
      setBriefStatus("complete");
      setBriefError("");
      setBriefRetrying(false);
      return;
    }

    streamExecutionBrief(currentEvaluationId || null);
  };

  // "Save this idea →" from the brief screen. The brief has no independent save —
  // it persists WITH the idea through the one canonical handleSaveIdea flow (the
  // normal-save body already carries `execution_brief: briefData`). So this does
  // NOT save here; it pre-opens results2's NORMAL naming form and routes there,
  // so the action the user clicked continues visibly into the naming step.
  // Only ever called on the fresh, non-re-eval path (the affordance is gated to
  // it in ExecutionBriefView) — so setting "naming" opens the normal variant,
  // never the branch form (which keys off isReEvalResult).
  const openSaveFromBrief = () => {
    if (saveStatus !== "saving" && saveStatus !== "saved" && saveStatus !== "naming") {
      setSaveStatus("naming");
      const firstLine = (idea || "").split(/[.!?\n]/)[0].trim();
      setIdeaName(firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + "...");
    }
    setCurrentScreen("results2");
  };

  // Delete a saved idea
  const deleteSavedIdea = async (ideaId) => {
    if (!user) return;
    setDeletingIdeaId(ideaId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Cascade-aware: the server archives the idea + all of its descendant
      // branches and returns their ids, so remove the whole lineage locally.
      const removed = new Set(data.archived_ids || [ideaId]);
      setMyIdeas((prev) => prev.filter((i) => !removed.has(i.id)));
      setSavedIdeasCount((prev) => Math.max(0, prev - (data.archived_count || 1)));
    } catch (err) {
      setMyIdeasError(err.message || "Failed to delete idea.");
    } finally {
      setDeletingIdeaId(null);
    }
  };

  // Update idea fields (title, status_label) via PATCH
  const updateIdea = async (ideaId, fields) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/ideas/${ideaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Optimistic local update
      setMyIdeas((prev) =>
        prev.map((i) => (i.id === ideaId ? { ...i, ...fields } : i))
      );
    } catch (err) {
      console.error("Failed to update idea:", err);
      setMyIdeasError(err.message || "Failed to update idea.");
    }
  };

  // Save edits to a rough idea's title + body from the rough-room edit mode.
  // PATCHes the (now-editable) raw_idea_text + title, reflects locally on the
  // room card AND the hub list, then re-fetches so the hub + resume card pick
  // up the change. Blank title falls back to a derived first-sentence title so
  // the route's non-empty-title guard never fires.
  const saveRoughEdits = async () => {
    if (!roughRoomIdea?.id) return;
    const text = (roughDraftText || "").trim();
    if (!text) { setError("Idea text can't be empty."); return; }
    const title =
      (roughDraftTitle || "").trim() ||
      text.split(/[.!?\n]/)[0].trim().slice(0, 80) ||
      "Untitled idea";
    setRoughSaving(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setRoughSaving(false); return; }
      const res = await fetch(`/api/ideas/${roughRoomIdea.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, raw_idea_text: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");
      setRoughRoomIdea((p) => (p ? { ...p, text, title } : p));
      setMyIdeas((prev) =>
        prev.map((i) => (i.id === roughRoomIdea.id ? { ...i, title, raw_idea_text: text } : i))
      );
      setRoughEditing(false);
      fetchMyIdeas();
    } catch (err) {
      setError(err.message || "Failed to save.");
    } finally {
      setRoughSaving(false);
    }
  };

  // Lineage deep Re-evaluate: once the requested idea is loaded (analysis +
  // currentIdeaId in state), drop into its Evolve re-eval flow.
  useEffect(() => {
    if (pendingReEvalId && currentIdeaId === pendingReEvalId && analysis) {
      setPendingReEvalId(null);
      startReEvaluation("lineage");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReEvalId, currentIdeaId, analysis]);

  // Needs-Your-Move re-judge: once the signal's idea is loaded, run the no-edit,
  // evidence-only re-eval (mirror of the lineage Re-evaluate deferred-fire).
  useEffect(() => {
    if (pendingEvidenceReJudge && currentIdeaId === pendingEvidenceReJudge.idea_id && analysis) {
      const sig = pendingEvidenceReJudge;
      setPendingEvidenceReJudge(null);
      startEvidenceReJudge(sig);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEvidenceReJudge, currentIdeaId, analysis]);

  // Navigate to My Ideas Hub
  const goToMyIdeas = () => {
    // The hub IS the two-shelf HubView now (was the old flat list). Every "My
    // Ideas" link and every room's back-button lands here, so the new hub is
    // reachable and returnable without the ?hub=new URL or a page refresh.
    setCurrentScreen("dashboard");
    setDashView("hub");
    setLineageMode(false);
    setLineageTargetId(null);
    setCompareMode(false);
    setCompareSelecting(false);
    setCompareSelected([]);
    setCompareData(null);
    setHistoricalRead(null);
    setReadHistory([]);
    fetchMyIdeas();
  };

  // Shared rail navigation for the Dashboard shell. Every screen rendered inside
  // the shell wires its rail to this, so navigation behaves identically whether
  // you're on the Overview, the Hub, or a flow screen.
  // Persist the builder-context profile from Settings through the same path the
  // Deep-input profile step uses (/api/profile). Updates local state so the rest
  // of the app (Deep calibration, greetings) sees the change immediately.
  const saveProfileFields = async ({ coding, ai, education }) => {
    const toSave = { coding, ai, education };
    setProfile(toSave);
    try { localStorage.setItem("iv_profile", JSON.stringify(toSave)); } catch {}
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ coding_level: coding, ai_experience: ai, education }),
    });
  };

  // Get Help "Send feedback" → public.feedback via /api/feedback. Optional auth:
  // attaches the bearer token when signed in, sends anonymously otherwise.
  const submitFeedback = async ({ message, category, replyEmail }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ message, category, reply_email: replyEmail }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Couldn't send your feedback."); }
    return true;
  };
  // Settings "Delete account" -> KVKK/GDPR erasure. Calls the authenticated
  // delete route, then tears the session down exactly like handleLogout and drops
  // to a clean anonymous Overview. Throws on failure so SettingsView surfaces the
  // error and the account is NOT reported as deleted.
  const handleDeleteAccount = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("You're signed out — nothing to delete.");
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Could not delete your account. Please try again.");
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile({ coding: "", ai: "", education: "" });
    setProfileBg({ role: "", build: "", reach: "" });
    localStorage.removeItem("iv_profile");
    localStorage.removeItem("iv_eval_timestamps");
    sessionStorage.removeItem("iv_nav");
    setLineageMode(false);
    setLineageTargetId(null);
    setCurrentScreen("dashboard");
    setDashView("overview");
  };

  const railNav = (key) => {
    // Any rail destination means leaving an open sub-view (a lineage tree or a
    // comparison). Clear those modes first so the outer hub/compare/lineage
    // guard below doesn't re-catch and trap us on the screen we're leaving.
    setLineageMode(false);
    setLineageTargetId(null);
    setCompareMode(false);
    setCompareSelecting(false);
    setCompareData(null);
    setCompareSelected([]);
    setHubReturnView("hub"); // a rail destination is a fresh hub entry → chooser (open-from-room overrides this)
    if (key === "overview") { setCurrentScreen("dashboard"); setDashView("overview"); }
    else if (key === "hub") goToMyIdeas();
    else if (key === "explore") { setExploreSourceIdea(null); setPendingGraduateParent(false); setPendingBranchParent(false); setBranchParentId(null); setPendingOriginAngle(null); setOriginAngleId(null); setInputMode("explore"); setCurrentScreen("input"); }
    else if (key === "deep") { setExploreSourceIdea(null); setPendingGraduateParent(false); setPendingBranchParent(false); setBranchParentId(null); setPendingOriginAngle(null); setOriginAngleId(null); setInputMode("deep"); setCurrentScreen("input"); }
    else if (key === "plan") { setCurrentScreen("dashboard"); setDashView("plan"); }
    else if (key === "settings") { setCurrentScreen("dashboard"); setDashView("settings"); }
    else if (key === "help") { setCurrentScreen("dashboard"); setDashView("help"); }
  };

  // Toggle idea/evaluation selection for comparison
  // Each entry is { ideaId, evaluationId } — evaluationId null means "use latest"
  const toggleCompareSelect = (ideaId, evaluationId = null, meta = null) => {
    setCompareSelected((prev) => {
      const existingIndex = prev.findIndex(
        (s) => s.ideaId === ideaId && s.evaluationId === evaluationId
      );
      if (existingIndex !== -1) return prev.filter((_, i) => i !== existingIndex);
      if (prev.length >= 2) return prev; // max 2
      // meta carries { title, origin, mode } so the global CompareTray can render a
      // chip without a re-fetch. startComparison ignores these extra fields; the
      // iv_nav persistence keeps them so a refresh mid-pick restores the basket.
      return [...prev, { ideaId, evaluationId, ...(meta || {}) }];
    });
  };

  // Check if an idea/evaluation is selected for comparison
  const isCompareSelected = (ideaId, evaluationId = null) => {
    return compareSelected.some(
      (s) => s.ideaId === ideaId && s.evaluationId === evaluationId
    );
  };

  // Load two ideas/evaluations for comparison and enter compare mode
  const startComparison = async (selectionsOverride) => {
    if (!user) { setShowAuthModal(true); return; }
    const selections = selectionsOverride || compareSelected;
    if (selections.length !== 2) return;
    setCompareLoading(true);
    setMyIdeasError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load both ideas in parallel, using evaluation_id when specified
      const [resA, resB] = await Promise.all(
        selections.map((sel) => {
          const url = sel.evaluationId
            ? `/api/ideas/${sel.ideaId}?evaluation_id=${sel.evaluationId}`
            : `/api/ideas/${sel.ideaId}`;
          return fetch(url, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).then((r) => r.json());
        })
      );

      if (resA.error) throw new Error(resA.error);
      if (resB.error) throw new Error(resB.error);

      // Compare is Deep×Deep only — refuse anything without a Deep evaluation so a
      // stray selection can never white-screen the compare view.
      if (!resA.analysis?.evaluation || !resB.analysis?.evaluation) {
        throw new Error("Compare needs two Deep evaluations.");
      }

      // Find the idea objects from myIdeas for titles
      // For alternatives, try to find an alternative name from evaluation data
      const getTitleForSelection = (sel, resData) => {
        const ideaObj = myIdeas.find((i) => i.id === sel.ideaId);
        if (sel.evaluationId && ideaObj) {
          // Look for the specific evaluation in the idea's evaluations array
          const ev = (ideaObj.evaluations || []).find((e) => e.id === sel.evaluationId);
          if (ev?.alternative_name) return `${ideaObj.title} — ${ev.alternative_name}`;
        }
        return ideaObj?.title || "Idea";
      };

      setCompareData({
        ideaA: {
          id: selections[0].ideaId,
          title: getTitleForSelection(selections[0], resA),
          analysis: resA.analysis,
        },
        ideaB: {
          id: selections[1].ideaId,
          title: getTitleForSelection(selections[1], resB),
          analysis: resB.analysis,
        },
        authToken: session.access_token,
      });
      setCompareMode(true);
    } catch (err) {
      setMyIdeasError(err.message || "Failed to load ideas for comparison.");
    } finally {
      setCompareLoading(false);
    }
  };

  // ============================================
  // WRAPPER CALLBACKS FOR EvaluationView
  // ============================================
  const onResetAndNewIdea = () => {
    setCurrentScreen("input");
    setAnalysis(null);
    setIdea("");
    setEvalsRemaining(user ? evalsRemaining : getEvalsRemaining());
    setSaveStatus("idle");
    setSaveError("");
    setSavedIdeaId(null);
    setIdeaName("");
    setCurrentEvaluationId(null);
    setCurrentIdeaId(null);
    setViewingFromSaved(false);
    setHistoricalRead(null);
    setReadHistory([]);
    resetExecutionBrief();
  };

  const onBackToMyIdeasCleanup = () => {
    setViewingFromSaved(false);
    setCurrentEvaluationId(null);
    setCurrentIdeaId(null);
    resetExecutionBrief();
    goToMyIdeas();
  };

  const onDiscardReEval = () => {
    setIsReEvalResult(false);
    setSaveStandalone(false);
    setReEvalRevisionNotes(null);
    setReEvalChangedFields(null);
    setReEvalContextSnapshot(null);
    setViewingFromSaved(true);
    setSaveStatus("saved");
    goToMyIdeas();
  };

  // Re-eval closure → "Save as a standalone deep card". Opens the naming form in
  // standalone mode (no branch reason/dimensions) with a sensible default name
  // pulled from the evolved idea text; the save handler routes it to the root path.
  const startStandaloneSave = () => {
    setSaveStandalone(true);
    setBranchSetAsMain(false);
    setBranchReason("");
    setBranchDimensions([]);
    const src = (idea || reEvalOriginalIdea || "").trim();
    const firstLine = src.split(/[.!?\n]/)[0].trim();
    setIdeaName(firstLine ? (firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + "...") : "");
    setSaveStatus("naming");
  };

  // RETIRED. The Lead (is_main_version) moves in ONE place only: the SET LEAD
  // control in the lineage view. This was the "saving promotes to main" reflex from
  // the single-idea era — it overrode the family root on re-eval. Kept as a no-op so
  // EvaluationView's prop wiring doesn't break; its set-as-main button is now inert
  // and should be removed from that component.
  // ==========================================
  // AUTH LOADING GATE — prevent screen flash on refresh
  // ==========================================
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: t.mut, fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>IdeaLoop Core</p>
      </div>
    );
  }

  // ==========================================
  // PUBLIC LANDING — first-touch marketing page (logged-out, no session/deep-link).
  // The page owns its own nav/footer/CTAs; "Start an idea loop" enters the app at
  // Overview, "Log in" opens the existing AuthModal (a successful login auto-dismisses
  // the landing via the effect above). Pricing + "View sample loop" are stubbed inside
  // LandingView for now.
  // ==========================================
  if (showLanding) {
    return (
      <>
        <LandingView
          onStartLoop={enterApp}
          onStartFree={enterApp}
          onGetCredits={enterApp}
          onLogIn={() => setShowAuthModal(true)}
        />
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
      </>
    );
  }

  // ==========================================
  // VIEWER: the preserved EXPLORE read (read-only). A deep idea that graduated
  // from an explore keeps its explored view in read_history; opening it (from the
  // deep surface or the Lineage inspector) mounts ExploreView read-only with the
  // CTAs suppressed and a back link to the live read. It sits above the screen
  // dispatch so it wins regardless of the underlying screen; clearing it falls
  // back to whatever was underneath (the deep results, or the lineage tree).
  // ==========================================
  if (historicalExploreRead && historicalExploreRead.explore) {
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        <ExploreView
          screen="explore"
          t={t}
          analysis={historicalExploreRead.explore}
          user={user}
          viewingFromSaved={true}
          showAuthModal={showAuthModal}
          setCurrentScreen={setCurrentScreen}
          setShowAuthModal={setShowAuthModal}
          setUser={setUser}
          setViewingFromSaved={setViewingFromSaved}
          goToMyIdeas={goToMyIdeas}
          readOnly={true}
          outdatedMeta={{
            superseded_at: historicalExploreRead.superseded_at,
            superseded_reason: historicalExploreRead.superseded_reason,
            original_created_at: historicalExploreRead.original_created_at,
          }}
          onBackToCurrent={() => setHistoricalExploreRead(null)}
        />
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREEN: DASHBOARD (persistent rail; content swaps between Overview and Hub).
  // The !lineageMode && !compareMode guard lets the dedicated lineage/compare
  // branch take over and then fall straight back here (currentScreen is still
  // "dashboard"), so returning from a tree or a compare lands back in the hub.
  // ==========================================
  if (currentScreen === "dashboard" && !lineageMode && !compareMode) {
    return (
      <>
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active={dashView}
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        {dashView === "hub" ? (
          <HubView
            t={t}
            isAnon={!user}
            onSignUp={() => setShowAuthModal(true)}
            initialView={hubReturnView}
            onViewChange={setHubReturnView}
            onOpenIdea={(id, fromView) => { if (fromView) setHubReturnView(fromView); loadSavedIdea(id); }}
            onOpenLineage={(id) => { if (!user) { setShowAuthModal(true); return; } setLineageTargetId(id); setLineageMode(true); }}
            compareSelected={compareSelected}
            onAddToCompare={(id, evalId, meta) => toggleCompareSelect(id, evalId, meta)}
          />
        ) : dashView === "plan" ? (
          <MyPlanView
            t={t}
            isAnon={!user}
            onSignUp={() => setShowAuthModal(true)}
            onRunLoop={() => railNav("explore")}
          />
        ) : dashView === "settings" ? (
          <SettingsView
            t={t}
            isAnon={!user}
            onSignUp={() => setShowAuthModal(true)}
            email={user?.email}
            profile={profile}
            onSaveProfile={saveProfileFields}
            onSignOut={handleLogout}
            onDeleteAccount={handleDeleteAccount}
          />
        ) : dashView === "help" ? (
          <GetHelpView
            t={t}
            onSubmit={submitFeedback}
          />
        ) : (
          <OverviewView
            t={t}
            onStartExplore={() => { setPendingGraduateParent(false); setPendingBranchParent(false); setBranchParentId(null); setPendingOriginAngle(null); setOriginAngleId(null); setInputMode("explore"); setCurrentScreen("input"); }}
            onStartDeep={() => { setPendingGraduateParent(false); setPendingBranchParent(false); setBranchParentId(null); setPendingOriginAngle(null); setOriginAngleId(null); setInputMode("deep"); setCurrentScreen("input"); }}
            onContinue={(id, target) => {
              if (target === "evolve") {
                // Defer: load the resume node first; the pendingReEvalId effect
                // fires startReEvaluation once its analysis + currentIdeaId land.
                // (Mirrors the lineage "Re-evaluate" entry — re-eval needs analysis
                // in state, so we can't enter the screen synchronously here.)
                setPendingReEvalId(id);
                loadSavedIdea(id);
                return;
              }
              // "graduate-deep" (explore → Deep input) and "graduate-explore"
              // (rough → Explore input) are honored in routeLoadedIdea's rough/
              // explore branches: load the node, then graduate it forward in place
              // into the right input (text + graduatingIdeaId carried). "brief"
              // opens the saved execution brief. Plain open otherwise.
              const afterLoad =
                target === "brief" ||
                target === "graduate-deep" ||
                target === "graduate-explore"
                  ? target
                  : undefined;
              loadSavedIdea(id, undefined, afterLoad);
            }}
            onEvidenceReJudge={(sig) => { setIsReEvaluating(true); setPendingEvidenceReJudge(sig); loadSavedIdea(sig.idea_id); }}
            onOpenIdea={(id) => loadSavedIdea(id)}
            onViewAll={goToMyIdeas}
          />
        )}
      </DashboardShell>
      <CompareTray
        selected={compareSelected}
        onRemove={(s) => toggleCompareSelect(s.ideaId, s.evaluationId)}
        onClear={() => setCompareSelected([])}
        onCompare={() => startComparison(compareSelected)}
      />
      </>
    );
  }

  // ==========================================
  // SCREEN 0: PROFILE
  // ==========================================
  if (currentScreen === "profile") {
    const canContinue = profile.coding && profile.ai;
    const bgFieldStyle = { width: "100%", background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 12, padding: "12px 16px", fontSize: 14, color: t.inputText, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 };
    const bgFieldLabel = { fontSize: 13.5, fontWeight: 600, color: t.text, display: "block", marginBottom: 8 };

    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} t={t} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px 0" }}>
                Tell us about yourself
              </h2>
              <p style={{ fontSize: 14, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                We calibrate the analysis to your background, so the read is specific to you.
              </p>
            </div>

            <Card style={{ padding: 28, marginBottom: 32 }} t={t}>
              {/* Coding */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "block", marginBottom: 12 }}>
                  How familiar are you with coding?
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["Beginner", "Intermediate", "Advanced"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, coding: opt }))}
                      style={{
                        flex: 1,
                        minWidth: 80,
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxSizing: "border-box",
                        ...(profile.coding === opt
                          ? { background: t.ctaBg, color: t.ctaText, borderColor: t.ctaBg }
                          : { background: t.inputBg, color: t.sec, borderColor: t.inputBorder }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "block", marginBottom: 12 }}>
                  How much experience do you have with AI tools?
                </label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["None", "Some", "Regular user"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, ai: opt }))}
                      style={{
                        flex: 1,
                        minWidth: 80,
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxSizing: "border-box",
                        ...(profile.ai === opt
                          ? { background: t.ctaBg, color: t.ctaText, borderColor: t.ctaBg }
                          : { background: t.inputBg, color: t.sec, borderColor: t.inputBorder }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background — single field by default; "add more detail" expands into three structured fields. All compose into the single education string the engine reads. */}
              <div>
                {!profileMoreOpen && (
                  <>
                    <label style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "block", marginBottom: 12 }}>
                      Your background
                    </label>
                    <textarea
                      value={profile.education}
                      onChange={(e) => setProfile((p) => ({ ...p, education: e.target.value }))}
                      placeholder="e.g., Clinical ops lead in pharma, 8 yrs — or: final-year CS student — or: marketing, switching to product"
                      rows={2}
                      style={bgFieldStyle}
                    />
                  </>
                )}
                {profileMoreOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <label style={bgFieldLabel}>Your role or experience</label>
                      <textarea
                        value={profileBg.role}
                        onChange={(e) => setProfileBg((b) => ({ ...b, role: e.target.value }))}
                        placeholder="e.g., Clinical ops lead at a pharma, 8 yrs — or: final-year CS student — or: marketing, switching to product"
                        rows={2}
                        style={bgFieldStyle}
                      />
                    </div>
                    <div>
                      <label style={bgFieldLabel}>How do you handle the building?</label>
                      <textarea
                        value={profileBg.build}
                        onChange={(e) => setProfileBg((b) => ({ ...b, build: e.target.value }))}
                        placeholder="e.g., I ship my own apps in Python — or: non-technical, I'll partner or hire for it"
                        rows={2}
                        style={bgFieldStyle}
                      />
                    </div>
                    <div>
                      <label style={bgFieldLabel}>
                        Any relevant connections? <span style={{ fontSize: 11, fontWeight: 400, color: t.mut }}>optional</span>
                      </label>
                      <textarea
                        value={profileBg.reach}
                        onChange={(e) => setProfileBg((b) => ({ ...b, reach: e.target.value }))}
                        placeholder="e.g., I know hospital procurement managers — or: starting cold, which is completely normal"
                        rows={2}
                        style={bgFieldStyle}
                      />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setProfileMoreOpen((v) => !v)}
                  style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", color: t.link || t.sec, fontSize: 13 }}
                >
                  {profileMoreOpen ? "Use a single line instead" : "Add more detail for a sharper read"}
                  <span style={{ display: "inline-flex", transform: profileMoreOpen ? "rotate(180deg)" : "none", transition: "transform 0.18s" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><path d="M6 9l6 6 6-6" /></svg></span>
                </button>
                {profileMoreOpen && (
                  <p style={{ fontSize: 12.5, color: t.mut, lineHeight: 1.55, margin: "14px 0 0" }}>
                    The more concrete, the sharper your founder-fit, bottleneck, and risk read. A single honest line works fine too.
                  </p>
                )}
              </div>
            </Card>

            <button
              onClick={() => {
                const composed = profileMoreOpen
                  ? [profileBg.role, profileBg.build ? `Building: ${profileBg.build}` : "", profileBg.reach ? `Reach: ${profileBg.reach}` : ""]
                      .map((s) => s.trim()).filter(Boolean).join(". ")
                  : profile.education;
                const eduToSave = composed.trim() ? composed : profile.education;
                const toSave = { ...profile, education: eduToSave };
                setProfile(toSave);
                localStorage.setItem("iv_profile", JSON.stringify(toSave));
                // Save to database via server-side API route (bypasses RLS)
                if (user) {
                  supabase.auth.getSession().then(({ data: { session } }) => {
                    if (!session) return;
                    fetch("/api/profile", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({
                        coding_level: profile.coding,
                        ai_experience: profile.ai,
                        education: eduToSave,
                      }),
                    }).then((res) => {
                      if (!res.ok) res.json().then((d) => console.error("Profile save to DB failed:", d.error));
                    });
                  });
                }
                setCurrentScreen("input");
              }}
              disabled={!canContinue}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: canContinue ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                ...(canContinue
                  ? { background: t.ctaBg, color: t.ctaText }
                  : { background: t.surfAlt, color: t.mut }),
              }}
            >
              Continue
            </button>
          </PageContainer>
        </main>
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREEN 1: IDEA INPUT
  // ==========================================
  // Explore gets its own input screen (the quiet-field star map); Deep keeps the
  // shared screen below. Routed by inputMode, set from the Overview mode cards.
  if (currentScreen === "input" && inputMode === "explore") {
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        <ExploreInputView
          t={t}
          idea={idea}
          setIdea={setIdea}
          onRun={() => handleAnalyze("explore", null, pendingGraduateParent ? (graduatingIdeaId || null) : null, pendingBranchParent ? (savedExploreIdeaId || (viewingFromSaved ? currentIdeaId : null)) : null, pendingBranchParent ? pendingOriginAngle : null)}
          onBack={goToMyIdeas}
          isAnalyzing={isAnalyzing}
          evalsRemaining={evalsRemaining}
          isAnon={!user}
          refillLabel={formatRefillDay(dbNextResetTime)}
          onSignUp={() => setShowAuthModal(true)}
          error={error}
          sourceIdea={exploreSourceIdea}
          onBackToSource={() => { if (exploreSourceIdea) loadSavedIdea(exploreSourceIdea.id); }}
        />
        {isAnalyzing && <StreamOverlay streamSteps={streamSteps} t={t} mode="explore" />}
      </DashboardShell>
    );
  }

  // Deep gets its own input screen (the "under pressure" creed intake); like
  // Explore, routed by inputMode. Reached only by cold open today (Overview's
  // Deep card -> onStartDeep), so provenance is null; the strip is wired for
  // when handoffs later route through here. The shared screen below stays as a
  // harmless fallback (both inputMode values now early-return).
  if (currentScreen === "input" && inputMode === "deep") {
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        <DeepInputView
          t={t}
          idea={idea}
          setIdea={setIdea}
          onRun={() => handleAnalyze("deep", null, pendingGraduateParent ? (savedExploreIdeaId || graduatingIdeaId || null) : null, pendingBranchParent ? (savedExploreIdeaId || (viewingFromSaved ? currentIdeaId : null)) : null, pendingBranchParent ? pendingOriginAngle : null)}
          onBack={goToMyIdeas}
          isAnalyzing={isAnalyzing}
          evalsRemaining={evalsRemaining}
          isAnon={!user}
          refillLabel={formatRefillDay(dbNextResetTime)}
          onSignUp={() => setShowAuthModal(true)}
          error={error}
          profile={profile}
          onEditProfile={() => setCurrentScreen("profile")}
          sourceIdea={exploreSourceIdea}
          onBackToSource={() => { if (exploreSourceIdea) loadSavedIdea(exploreSourceIdea.id); }}
        />
        {isAnalyzing && <StreamOverlay streamSteps={streamSteps} t={t} mode="deep" />}
      </DashboardShell>
    );
  }

  if (currentScreen === "input") {
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuth={(u) => setUser(u)}
            t={t}
          />
        )}

        {/* Profile summary — deep-flow only; relocated into content (the rail owns nav now). */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={() => setCurrentScreen("profile")} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
            {profile.coding} · {profile.ai} AI · Edit <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-1px", marginLeft: 3 }}><path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></svg>
          </button>
        </div>

        <StepProgress currentStep={getStepNumber()} savedMode={viewingFromSaved} branchMode={viewingFromSaved && isBranchIdea} t={t} />

          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              <>
                <h2 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 12px 0" }}>
                  Describe your AI product idea
                </h2>
                <p style={{ fontSize: 16, color: t.sec, lineHeight: 1.6, margin: 0 }}>
                  Include what it does, who would use it, and what problem it solves.
                  Specific ideas get sharper evaluations.
                </p>
              </>
            </div>

            <Card style={{ padding: 6, marginBottom: 24 }} t={t}>
              <textarea
                value={idea}
                onChange={(e) => {
                  setIdea(e.target.value);
                  // V4S28 B9 — Gate state persists across keystrokes (was clearing
                  // mid-keystroke in B7, which made the suggestion vanish exactly
                  // when the user was acting on it). Gate only updates when a new
                  // gate result returns (Analyze press): replaces if FAIL with
                  // different missing slots, clears if PASS.
                }}
                placeholder="Example: An AI-powered idea evaluation workflow that scores startup ideas against real competitor data from GitHub and Google. It's for founders and ambitious builders who waste weeks on ideas without knowing if there's real demand. The problem is that most people either ask friends who say 'great idea!' or use ChatGPT which gives generic encouragement instead of structured, honest analysis..."
                rows={8}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "16px 20px",
                  fontSize: 16,
                  color: t.inputText,
                  lineHeight: 1.6,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </Card>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "12px 20px", marginBottom: 24 }}>
                <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: t.mut, fontFamily: "monospace" }}>
                {idea.length > 0 ? `${idea.length} characters` : ""}
              </span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {/* Explore mode entry — widens a rough idea (LL2). Dawn identity,
                    deliberately not the Deep purple/cta. Same gate + usage path. */}
                <button
                  onClick={() => handleAnalyze("explore")}
                  disabled={!idea.trim() || isAnalyzing || evalsRemaining <= 0}
                  style={{
                    padding: "12px 22px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    background: "transparent",
                    cursor: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                    color: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? t.mut : "#bcd2ff",
                    border: `1px solid ${!idea.trim() || isAnalyzing || evalsRemaining <= 0 ? t.border : "rgba(122,162,255,0.46)"}`,
                  }}
                >
                  {isAnalyzing ? "..." : "Explore"}
                </button>
                <button
                  onClick={() => handleAnalyze("deep")}
                  disabled={!idea.trim() || isAnalyzing || evalsRemaining <= 0}
                  style={{
                    padding: "12px 32px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    cursor: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                    ...(!idea.trim() || isAnalyzing || evalsRemaining <= 0
                      ? { background: t.surfAlt, color: t.mut }
                      : { background: t.ctaBg, color: t.ctaText }),
                  }}
                >
                  {isAnalyzing ? "Analyzing..." : evalsRemaining <= 0 ? "Limit Reached" : "Analyze Idea"}
                </button>
              </div>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              padding: "10px 16px",
              borderRadius: 12,
              background: evalsRemaining <= 0 ? "rgba(239,68,68,0.08)" : evalsRemaining === 1 ? "rgba(245,158,11,0.08)" : t.surfAlt,
              border: `1px solid ${evalsRemaining <= 0 ? "rgba(239,68,68,0.2)" : evalsRemaining === 1 ? "rgba(245,158,11,0.2)" : t.border}`,
            }}>
              <span style={{
                fontSize: 13,
                color: evalsRemaining <= 0 ? "#f87171" : evalsRemaining === 1 ? "#fbbf24" : t.sec,
              }}>
                {evalUnlimited
                  ? "Developer — unlimited evaluations"
                  : evalsRemaining <= 0
                  ? "You've used your free evaluations. Get credits to keep going."
                  : `${evalsRemaining} of ${EVAL_LIMIT} free evaluations remaining`}
              </span>
            </div>

            {isAnalyzing && <StreamOverlay streamSteps={streamSteps} t={t} mode={inputMode} />}
          </PageContainer>
      </DashboardShell>
    );
  }

  // ROUGH ROOM: a rough idea's two-door room. Idea text + Explore/Deep doors.
  // Deep graduates the idea forward in place (no copy). Explore arrives with
  // the explore room. Serves both standalone rough ideas and saved angles.
  if (currentScreen === "roughroom") {
    // Redesigned capture card (faithful to the approved Rough_Idea_Capture export).
    // Title/body render from roughRoomIdea; both doors trigger the graduate-in-place
    // handlers. EDIT MODE: the Edit affordance swaps the title + body for inline
    // inputs bound to roughDraftTitle/roughDraftText, saved via saveRoughEdits ->
    // PATCH /api/ideas/[id] { title, raw_idea_text } (the route + service now accept
    // raw_idea_text). The SAVED/EDITING pill and the live word count are truthful.
    // Per scope: no tag chips, no fake generation/timestamp stamp.
    const roughBodySource = roughEditing ? roughDraftText : (roughRoomIdea?.text || "");
    const roughWordCount = roughBodySource.trim()
      ? roughBodySource.trim().split(/\s+/).length
      : 0;
    // Doors route to the input screen pre-filled with the SAVED text, so they're
    // inert while mid-edit (save or cancel first).
    const roughDoorsLocked = roughEditing;
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "40px 48px 64px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 820 }}>

              {/* back */}
              <BackLink t={t} flush onClick={goToMyIdeas}>My ideas</BackLink>

              {/* THE CAPTURE CARD */}
              <div style={{ marginTop: 22, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "26px 30px 24px" }}>

                {/* stamp row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.22em", color: "#8a8a93" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9a9aa3" strokeWidth="1.6">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                    ROUGH IDEA
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {roughRoomIdea?.id && !roughEditing && (
                      <button
                        onClick={() => {
                          setRoughDraftTitle(roughRoomIdea.title || "");
                          setRoughDraftText(roughRoomIdea.text || "");
                          setError("");
                          setRoughEditing(true);
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "5px 11px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.06em", color: "#a1a1aa", cursor: "pointer", transition: "border-color .15s, color .15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; e.currentTarget.style.color = "#e4e4e7"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#a1a1aa"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                        Edit
                      </button>
                    )}
                    {roughEditing && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() => { setRoughEditing(false); setError(""); }}
                          disabled={roughSaving}
                          style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "5px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.06em", color: "#a1a1aa", cursor: roughSaving ? "default" : "pointer", opacity: roughSaving ? 0.5 : 1 }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveRoughEdits}
                          disabled={roughSaving}
                          style={{ background: "rgba(52,216,168,0.12)", border: "1px solid rgba(52,216,168,0.4)", borderRadius: 7, padding: "5px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.06em", color: "#5fe3bd", cursor: roughSaving ? "default" : "pointer", opacity: roughSaving ? 0.6 : 1 }}
                        >
                          {roughSaving ? "Saving\u2026" : "Save"}
                        </button>
                      </div>
                    )}
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.1em", color: roughEditing ? "#e0b768" : "#5fe3bd" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: roughEditing ? "#e0a93c" : "#34d8a8" }} />
                      {roughEditing ? "EDITING" : "SAVED"}
                    </span>
                  </div>
                </div>

                {/* title */}
                {roughEditing ? (
                  <input
                    value={roughDraftTitle}
                    onChange={(e) => setRoughDraftTitle(e.target.value)}
                    placeholder="Title (optional \u2014 defaults to the first line)"
                    style={{ width: "100%", boxSizing: "border-box", margin: "16px 0 0", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 13px", fontFamily: "'Spectral',serif", fontWeight: 500, fontSize: 26, lineHeight: 1.2, letterSpacing: "-0.01em", color: "#fafafa", outline: "none" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(52,216,168,0.45)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                ) : (
                  <h1 style={{ fontFamily: "'Spectral',serif", fontWeight: 500, fontSize: 29, lineHeight: 1.18, letterSpacing: "-0.01em", margin: "16px 0 0", color: "#fafafa" }}>
                    {roughRoomIdea?.title || "Untitled idea"}
                  </h1>
                )}

                {/* body */}
                {roughEditing ? (
                  <textarea
                    value={roughDraftText}
                    onChange={(e) => setRoughDraftText(e.target.value)}
                    autoFocus
                    placeholder="Describe the idea\u2026"
                    style={{ width: "100%", boxSizing: "border-box", margin: "16px 0 0", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "13px 15px", fontFamily: "inherit", fontSize: 14.5, lineHeight: 1.65, color: "#e4e4e7", outline: "none", resize: "vertical", minHeight: 150 }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(52,216,168,0.45)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                ) : (
                  <p style={{ margin: "16px 0 0", paddingLeft: 15, borderLeft: "2px solid rgba(255,255,255,0.1)", fontSize: 14.5, lineHeight: 1.65, color: "#b4b4bd", whiteSpace: "pre-wrap" }}>
                    {roughRoomIdea?.text}
                  </p>
                )}

                {/* word count */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#52525b" }}>
                    {roughWordCount} {roughWordCount === 1 ? "word" : "words"}
                  </span>
                </div>
              </div>

              {/* TAKE IT FORWARD */}
              <div style={{ marginTop: 30, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.22em", color: "#6b7280" }}>TAKE IT FORWARD</div>
                <span style={{ fontSize: 12.5, color: "#52525b" }}>Same idea, written back to your hub — no copy left behind.</span>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: "#f87171", margin: "14px 0 0" }}>{error}</p>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>

                {/* EXPLORE door */}
                <div
                  role="button"
                  tabIndex={roughRoomIdea ? 0 : -1}
                  onClick={() => {
                    // Route to the Explore INPUT screen pre-filled — the founder
                    // reviews/edits the seed before spending a credit (NOT an instant
                    // run), matching the lineage take-forward (onAdvance). The rough
                    // node graduates in place when they run: graduatingIdeaId carries
                    // its id, savedExploreIdeaId is cleared so it wins at the run.
                    // hubReturnView -> "evaluated" so "← My ideas" after graduating
                    // lands where the now-evaluated card lives, not the rough shelf
                    // it just left (mirrors onAdvance).
                    if (!roughRoomIdea) return;
                    setHubReturnView("evaluated");
                    setSavedExploreIdeaId(null);
                    setGraduatingIdeaId(roughRoomIdea.id);
                    goToInput("explore", roughRoomIdea.text || "", true);
                  }}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && roughRoomIdea) { e.preventDefault(); e.currentTarget.click(); } }}
                  style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(107,147,245,0.035)", border: "1px solid rgba(107,147,245,0.22)", borderRadius: 10, padding: "14px 16px", cursor: !roughRoomIdea ? "not-allowed" : "pointer", opacity: !roughRoomIdea ? 0.55 : 1, transition: "border-color .15s" }}
                  onMouseEnter={(e) => { if (roughRoomIdea) e.currentTarget.style.borderColor = "rgba(107,147,245,0.6)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(107,147,245,0.22)"; }}
                >
                  <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: "rgba(107,147,245,0.12)", border: "1px solid rgba(107,147,245,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="9" />
                      <polygon points="15.6,8.4 10.8,10.8 8.4,15.6 13.2,13.2" />
                    </svg>
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14.5, color: "#f0f0f1", fontWeight: 600 }}>Explore mode</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.12em", color: "#8aa9f7" }}>WIDEN</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9a9aa3", marginTop: 2, lineHeight: 1.4 }}>Fan into angles · no verdict yet</div>
                  </div>
                  <span style={{ color: "#8aa9f7", fontSize: 16, flexShrink: 0 }}>→</span>
                </div>

                {/* DEEP door */}
                <div
                  role="button"
                  tabIndex={roughRoomIdea ? 0 : -1}
                  onClick={() => {
                    // Route to the Deep INPUT screen pre-filled — review/edit before
                    // spending a credit (NOT an instant run), as the lineage
                    // take-forward (onAdvance) does. The rough node graduates in place
                    // on run via graduatingIdeaId. hubReturnView -> "evaluated" so back
                    // lands on the shelf the now-deep card moved to.
                    if (!roughRoomIdea) return;
                    setHubReturnView("evaluated");
                    setSavedExploreIdeaId(null);
                    setGraduatingIdeaId(roughRoomIdea.id);
                    goToInput("deep", roughRoomIdea.text || "", true);
                  }}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && roughRoomIdea) { e.preventDefault(); e.currentTarget.click(); } }}
                  style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(139,127,240,0.05)", border: "1px solid rgba(139,127,240,0.3)", borderRadius: 10, padding: "14px 16px", cursor: !roughRoomIdea ? "not-allowed" : "pointer", opacity: !roughRoomIdea ? 0.55 : 1, position: "relative", transition: "border-color .15s" }}
                  onMouseEnter={(e) => { if (roughRoomIdea) e.currentTarget.style.borderColor = "rgba(139,127,240,0.7)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(139,127,240,0.3)"; }}
                >
                  <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: "rgba(139,127,240,0.14)", border: "1px solid rgba(139,127,240,0.34)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b3a3f5" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="5" />
                      <circle cx="12" cy="12" r="1.4" fill="#b3a3f5" />
                    </svg>
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14.5, color: "#f0f0f1", fontWeight: 600 }}>Deep analysis</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.12em", color: "#b3a3f5" }}>SCORE</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9a9aa3", marginTop: 2, lineHeight: 1.4 }}>Pressure-test · verdict 0–5</div>
                  </div>
                  <span style={{ color: "#b3a3f5", fontSize: 16, flexShrink: 0 }}>→</span>
                </div>
              </div>

              {/* keep as rough */}
              <div style={{ marginTop: 16, fontSize: 12.5, color: "#71717a" }}>
                Not ready?{" "}
                <span
                  onClick={goToMyIdeas}
                  style={{ color: "#a1a1aa", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.2)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#e4e4e7")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
                >Keep it as a rough idea</span>{" "}
                and come back later.
              </div>

            </div>
          </div>
        </main>
      </DashboardShell>
    );
  }

  if ((lineageMode && lineageTargetId) || (compareMode && compareData)) {
    // COMPARISON MODE: render ComparisonView instead of hub (subscribers only)
    if (compareMode && compareData) {
      return (
        <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
          t={t}
          active="hub"
          userEmail={user?.email}
          authLoading={authLoading}
          onLogin={() => setShowAuthModal(true)}
          onLogout={handleLogout}
          onNavigate={railNav}
        >
          {showAuthModal && (
            <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
          )}
            <ComparisonView
              ideaA={compareData.ideaA}
              ideaB={compareData.ideaB}
              authToken={compareData.authToken}
              t={t}
              onBack={() => {
                setCompareMode(false);
                setCompareSelecting(false);
                setCompareData(null);
                setCompareSelected([]);
                fetchMyIdeas();
              }}
            />
        </DashboardShell>
      );
    }

    // LINEAGE MODE: render LineageView instead of hub (subscribers only)
    if (lineageMode && lineageTargetId) {
      return (
        <>
        <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
          t={t}
          active="hub"
          userEmail={user?.email}
          authLoading={authLoading}
          onLogin={() => setShowAuthModal(true)}
          onLogout={handleLogout}
          onNavigate={railNav}
        >
          {showAuthModal && (
            <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
          )}
            <LineageView
              myIdeas={myIdeas}
              targetIdeaId={lineageTargetId}
              onViewExploredVersion={openExploredVersion}
              t={t}
              onBack={() => {
                setHubReturnView("evaluated"); // came from the evaluated shelf → return there, not the chooser
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              onReEvaluate={async (ideaId) => {
                // Deep Re-evaluate from the tree: leave lineage, load the deep idea,
                // and let the pending-flag effect drop into its Evolve flow.
                setHubReturnView("evaluated");
                setLineageMode(false);
                setLineageTargetId(null);
                setPendingReEvalId(ideaId);
                await loadSavedIdea(ideaId);
              }}
              onAdvance={(ideaId, action) => {
                // Take a node forward to the matching INPUT screen, pre-filled — the
                // founder reviews/edits the seed before spending a credit (NOT an
                // instant run). Set up to graduate THIS node in place when they run:
                // graduatingIdeaId carries the node id, and savedExploreIdeaId is
                // cleared so it (not a stale saved-explore) wins at the Deep run.
                const node = myIdeas.find((i) => i.id === ideaId);
                if (!node) return;
                const text = node.raw_idea_text || node.title || "";
                setHubReturnView("evaluated");
                setLineageMode(false);
                setLineageTargetId(null);
                setSavedExploreIdeaId(null);
                setGraduatingIdeaId(ideaId);
                goToInput(action, text, true);
              }}
              onViewIdea={async (ideaId) => {
                setLoadingIdeaId(ideaId);
                await loadSavedIdea(ideaId);
                setLoadingIdeaId(null);
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              onStartComparison={async (selectedPair) => {
                setCompareSelected(selectedPair);
                await startComparison(selectedPair);
                setLineageMode(false);
                setLineageTargetId(null);
              }}
              compareSelected={compareSelected}
              onAddToCompare={(id, evalId, meta) => toggleCompareSelect(id, evalId, meta)}
              onUpdateIdea={updateIdea}
              onDelete={async (ideaId) => {
                // Determine (from the current tree) whether the lineage node
                // we're focused on is inside the subtree about to be deleted.
                const willRemove = new Set([ideaId]);
                let frontier = [ideaId];
                while (frontier.length) {
                  const kids = myIdeas
                    .filter((i) => i.parent_idea_id && frontier.includes(i.parent_idea_id) && !willRemove.has(i.id))
                    .map((i) => i.id);
                  kids.forEach((id) => willRemove.add(id));
                  frontier = kids;
                }
                await deleteSavedIdea(ideaId);
                // If the lineage we're viewing is now gone, go back to the hub.
                if (willRemove.has(lineageTargetId)) {
                  setHubReturnView("evaluated");
                  setLineageMode(false);
                  setLineageTargetId(null);
                }
              }}
              onMakeStandalone={async (ideaId) => {
                // Detach the node (+ its branch) into its own root card. The canvas
                // already removed it optimistically; the refresh reconciles (and
                // restores it if the server call failed).
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  await fetch(`/api/ideas/${ideaId}/detach`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                } catch (e) {
                  // swallow — fetchMyIdeas below reconciles canvas ↔ server
                } finally {
                  fetchMyIdeas();
                }
              }}
              loadingIdeaId={loadingIdeaId}
            />
        </DashboardShell>
        <CompareTray
          selected={compareSelected}
          onRemove={(s) => toggleCompareSelect(s.ideaId, s.evaluationId)}
          onClear={() => setCompareSelected([])}
          onCompare={() => startComparison(compareSelected)}
        />
        </>
      );
    }

  }

  // ==========================================
  // EVOLVE THIS IDEA (Re-evaluation Screen)
  // ==========================================
  if (currentScreen === "reeval" && reEvalMode) {
    // V87 Stage 5b — the Evolve (re-evaluate) INPUT screen is DeepEvolveView, fed
    // from the prior analysis. The founder reshapes the full idea text (with inline
    // part-tagging + an optional freecard); onReEvaluate runs the deep pipeline on
    // the edited text and the change-walkthrough diffs it against the prior version.
    const prev = reEvalPrevAnalysis || analysis;
    const ev = (prev && prev.evaluation) || {};
    const num = (x, d = 1) => (typeof x === "number" ? x.toFixed(d) : "—");
    const moScore = typeof ev.monetization?.display_score === "number" ? ev.monetization.display_score : ev.monetization?.score;
    const cap = (str) => (typeof str === "string" && str.length ? str.charAt(0).toUpperCase() + str.slice(1) : str);
    // Mockup card sizes are fixed; make the real prose FIT. clip() trims to a sentence
    // boundary when one lands past half the budget, else a word boundary + ellipsis.
    const clip = (str, max) => {
      const x = (typeof str === "string" ? str.trim() : "");
      if (x.length <= max) return x;
      const head = x.slice(0, max);
      const m = head.match(/^[\s\S]*[.!?](?=\s|$)/);
      if (m && m[0].length >= max * 0.5) return m[0].trim();
      return head.replace(/\s+\S*$/, "").trim() + "\u2026";
    };

    const evolveMetrics = {
      md: { name: "Market demand", color: "#6f8ff5", score: num(ev.market_demand?.score),
        last: ev.market_demand?.diagnosis || ev.market_demand?.binding_friction_explanation || "The last read for this axis.",
        win: ev.market_demand?.direction || "Demand lifts when a specific buyer feels this as a recurring, expensive problem — name who, and what it costs them." },
      mo: { name: "Monetization", color: "#5fd08a", score: num(moScore),
        last: ev.monetization?.diagnosis || ev.monetization?.binding_payment_constraint_explanation || "The last read for this axis.",
        win: ev.monetization?.direction || "Monetization lifts when the charge ties to a moment the buyer already pays for." },
      or: { name: "Originality", color: "#a99cff", score: num(ev.originality?.score),
        last: ev.originality?.differentiation_basis_diagnosis || ev.originality?.defensibility_diagnosis || ev.originality?.binding_constraint_explanation || "The last read for this axis.",
        win: ev.originality?.direction || "Originality lifts when there's a hard-to-copy source — data, network, or accumulation a competitor can't clone." },
      tc: { name: "Technical", color: "#e3c14a", score: num(ev.technical_complexity?.score),
        last: ev.technical_complexity?.base_score_explanation || "The last read for this axis.",
        win: ev.technical_complexity?.incremental_note || ev.technical_complexity?.adjustment_explanation || "Technical confidence lifts when the hard part is a bounded build, not open research." },
    };
    // x-ray panel has no max-height in the mockup; it relied on short copy. Clip
    // the real diagnosis/direction prose so the panel keeps the mockup's height.
    Object.keys(evolveMetrics).forEach((k) => {
      evolveMetrics[k].lastFull = (evolveMetrics[k].last || "").trim();
      evolveMetrics[k].winFull = (evolveMetrics[k].win || "").trim();
      evolveMetrics[k].last = clip(evolveMetrics[k].last, 220);
      evolveMetrics[k].win = clip(evolveMetrics[k].win, 220);
    });

    const trio = [
      { k: "md", key: "market_demand", s: ev.market_demand?.score },
      { k: "mo", key: "monetization", s: moScore },
      { k: "or", key: "originality", s: ev.originality?.score },
    ].filter((x) => typeof x.s === "number");
    const strongest = trio.length ? trio.reduce((a, b) => (b.s > a.s ? b : a)) : null;
    const weakest = trio.length ? trio.reduce((a, b) => (b.s < a.s ? b : a)) : null;
    // verdict line must stay SHORT (one-liner) — never dump the full summary into
    // the narrow verdict cell. Headline → short lead → hard-truncated summary clause.
    // Verdict cell is ~300px wide => keep it ~2 lines. Pressure descriptions ~2 lines.
    const verdictRead = ev.verdict_headline || clip(ev.verdict_lead, 80) || clip(ev.summary, 72) || "Your latest read.";
    const verdictFull = (typeof ev.summary === "string" && ev.summary.trim()) || (typeof ev.verdict_lead === "string" && ev.verdict_lead.trim()) || "";
    const verdictTitle = (typeof ev.verdict_headline === "string" && ev.verdict_headline.trim()) || "";
    const evolvePressure = {
      verdict: { score: num(ev.overall_score), read: verdictRead, readFull: verdictFull, title: verdictTitle },
      asset: strongest ? { metricKey: strongest.k, score: num(strongest.s), desc: clip(evolveMetrics[strongest.k].lastFull, 95), descFull: evolveMetrics[strongest.k].lastFull, dir: "Don't break this while fixing the rest." } : null,
      constraint: weakest ? { metricKey: weakest.k, score: num(weakest.s), desc: clip(evolveMetrics[weakest.k].lastFull, 95), descFull: evolveMetrics[weakest.k].lastFull, dir: "The floor. Most leverage is here." } : null,
    };

    // Real lineage: walk parent_idea_id up from the current idea (root → here).
    // A root idea has no ancestors → a single node, which is correct.
    const chain = [];
    { let cur = myIdeas.find((x) => x.id === currentIdeaId) || null; let guard = 0;
      while (cur && guard++ < 25) { chain.unshift(cur); cur = cur.parent_idea_id ? (myIdeas.find((x) => x.id === cur.parent_idea_id) || null) : null; } }
    const scoreOf = (nd) => { if (!nd) return null; if (typeof nd.overall_score === "number") return nd.overall_score; if (typeof nd.score === "number") return nd.score; if (nd.evaluation && typeof nd.evaluation.overall_score === "number") return nd.evaluation.overall_score; return null; };
    const dimLabel = (nd) => { const d = Array.isArray(nd.changed_dimensions) ? nd.changed_dimensions[0] : null; if (typeof d === "string" && d) return d.replace(/_explanation$/, "") + "_shift"; return nd.branch_reason ? "branch" : null; };
    const evolveLineage = chain.length
      ? chain.map((nd, i) => {
          const isHere = nd.id === currentIdeaId;
          const sc = isHere ? ev.overall_score : scoreOf(nd);
          return { ver: `V${i + 1}`, score: typeof sc === "number" ? num(sc) : null, note: isHere ? (reEvalContextSnapshot?.title || nd.title || "current idea") : (nd.title || "—"), edge: i > 0 ? dimLabel(nd) : null, here: isHere };
        })
      : [{ ver: "V1", score: num(ev.overall_score), note: reEvalContextSnapshot?.title || ideaName || "current idea", here: true }];

    // Sanitize bad-paste cruft so a serialized fragment can't leak into the editor:
    // drop a leading `idea:` label and strip wrapping quotes / a trailing `",` tail.
    let cleanIdea = (reEvalOriginalIdea || loadedIdeaText || idea || "").trim();
    cleanIdea = cleanIdea.replace(/^idea\s*:\s*/i, "").replace(/^["'\s]+/, "").replace(/["',\s]+$/, "").trim();
    const esc = (txt) => txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paras = cleanIdea.split(/\n\s*\n/).map((para) => para.trim()).filter(Boolean);
    const ideaHtml = (paras.length ? paras : [cleanIdea]).map((para) => `<p>${esc(para)}</p>`).join("\n");

    const profLabel = profile
      ? ([profile.coding ? cap(profile.coding) : null, profile.ai ? cap(profile.ai) + " AI" : null].filter(Boolean).join(" · ") || "Your profile")
      : "Your profile";

    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        <PageContainer>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "4px 0 0" }}>
            {/* Contextual back: re-eval has two entry paths. From the lineage tree →
                back to that idea's lineage, plus a shortcut to peek at the analysis
                without the roundtrip; from a saved deep result → back to the analysis. */}
            {reEvalSource === "lineage" ? (
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                <BackLink t={t} onClick={() => { setReEvalMode(false); setCurrentScreen("dashboard"); setLineageTargetId(currentIdeaId); setLineageMode(true); }}>Go back to the lineage</BackLink>
                <BackLinkDivider t={t} />
                <BackLink t={t} noChevron onClick={() => { setReEvalMode(false); setCurrentScreen("results2"); }}>View the analysis</BackLink>
              </span>
            ) : (
              <BackLink t={t} onClick={() => { setReEvalMode(false); setCurrentScreen("results2"); }}>Go back to the analysis</BackLink>
            )}
          </div>
        </PageContainer>

        <StepProgress currentStep={getStepNumber()} savedMode={true} branchMode={isBranchIdea} t={t} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          {error && (
            <PageContainer>
              <div style={{ margin: "0 0 16px", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)" }}>
                <p style={{ fontSize: 14, color: "#f87171", margin: 0 }}>{error}</p>
              </div>
            </PageContainer>
          )}
          <DeepEvolveView
            metrics={evolveMetrics}
            pressure={evolvePressure}
            lineage={evolveLineage}
            profileLabel={profLabel}
            credits={typeof evalsRemaining === "number" ? evalsRemaining : "—"}
            initialIdeaHtml={taggedIdeaHtml || ideaHtml}
            ideaLoading={ideaTagging}
            onReEvaluate={handleReEvaluate}
          />
        </main>

        {isReEvaluating && <StreamOverlay streamSteps={streamSteps} t={t} mode="reeval" />}
      </DashboardShell>
    );
  }

  // ==========================================
  // SCREEN: EXPLORE (delegated to ExploreView)
  // ==========================================
  if (currentScreen === "explore" && exploreAnalysis) {
    // Which angles are ALREADY saved (as rough branches) under this explore family.
    // Derived from the real saved ideas so the per-angle "saved" state survives
    // leaving + returning (ExploreView's own state is per-mount) and blocks dup
    // saves. Family id: the explore saved this session, else the reopened one.
    const exploreFamilyId = savedExploreIdeaId || (viewingFromSaved ? currentIdeaId : null);
    const familyChildren = exploreFamilyId
      ? (myIdeas || []).filter((i) => i.parent_idea_id === exploreFamilyId)
      : [];
    const savedBranchTexts = exploreFamilyId
      ? new Set(familyChildren.map((i) => (i.raw_idea_text || "").trim()).filter(Boolean))
      : null;
    // Angles already taken forward (saved as a rough branch, or sent to
    // Deep/Explore) recognized BY ID — robust to seed edits, unlike the text set
    // above. An angle counts as handled if any child carries its origin_angle_id.
    const handledAngleIds = exploreFamilyId
      ? new Set(familyChildren.map((i) => i.origin_angle_id).filter(Boolean))
      : null;
    // Per-angle done targets for the fan footer: which angle has been taken to
    // Explore / Deep, and the child idea id to jump to. Mode is read off the
    // child's latest eval — a Deep child carries a weighted score; an Explore
    // child's eval has none; no eval at all is a rough-branch save. Built from the
    // same family children, so it stays in sync after every save + refresh.
    const angleStatus = {};
    familyChildren.forEach((c) => {
      const aid = c.origin_angle_id;
      if (!aid) return;
      const latest = (c.evaluations || [])[0] || null;
      const slot = angleStatus[aid] || {};
      if (!latest) slot.saved = true;
      else if (latest.weighted_overall_score != null) slot.deep = c.id;
      else slot.explore = c.id;
      angleStatus[aid] = slot;
    });
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
      <ExploreView
        screen="explore"
        t={t}
        analysis={exploreAnalysis}
        savedBranchTexts={savedBranchTexts}
        handledAngleIds={handledAngleIds}
        angleStatus={angleStatus}
        onOpenChild={(id) => loadSavedIdea(id)}
        user={user}
        viewingFromSaved={viewingFromSaved}
        showAuthModal={showAuthModal}
        setCurrentScreen={setCurrentScreen}
        setShowAuthModal={setShowAuthModal}
        setUser={setUser}
        setViewingFromSaved={setViewingFromSaved}
        goToMyIdeas={goToMyIdeas}
        onSaveBranch={async (ids) => {
          // Persist each selected angle's branch_idea_text as a saved idea
          // (eval-less) via the additive Explore route. Returns a promise so
          // ExploreView's save-state can reflect saving → saved/error.
          const list = (ids || [])
            .map((id) => (exploreAnalysis.angles || []).find((a) => a.id === id))
            .filter(Boolean);
          if (!list.length) return;
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setShowAuthModal(true); throw new Error("Log in to save"); }
          for (const angle of list) {
            const res = await fetch("/api/ideas/save", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({
                mode: "explore",
                idea_text: angle.branch_idea_text,
                idea_name: angle.title,
                basis: angle.basis?.primary || null,
                profile,
                origin_idea_text: exploreAnalysis.idea,
                // Tag the rough branch with its source angle id so the fan marks
                // it handled by id (verbatim here, but keeps recognition uniform).
                origin_angle_id: angle.id || null,
                // If the explored idea was saved this session, branch the angle
                // under it (orphan rule); the route verifies it's explored.
                ...(savedExploreIdeaId ? { parent_idea_id: savedExploreIdeaId } : {}),
              }),
            });
            if (!res.ok) {
              const e = await res.json().catch(() => ({}));
              throw new Error(e.error || "Save failed");
            }
          }
          // Refresh so the derived "saved" state (savedBranchTexts) reflects this
          // save on return — ExploreView's own per-mount state is lost on remount.
          fetchMyIdeas();
        }}
        onTakeToDeep={(angleId, opts) => {
          // Reroute to Deep's INPUT screen (don't auto-run): the founder reviews /
          // edits the seed before spending a Deep credit, matching the tile's
          // "edit the seed first" promise. A specific angle is its own fresh Deep
          // root (no graduation); the original idea graduates the node in place
          // (flagged via graduateParent, resolved live at the Deep run). Guarded so
          // an unsaved exploration isn't lost on an accidental click.
          const o = opts || {};
          let text = exploreAnalysis.idea;
          let target = "this idea";
          let graduateParent = true;
          let branchParent = false;
          if (!o.useOriginalIdea && angleId) {
            const a = (exploreAnalysis.angles || []).find((x) => x.id === angleId);
            if (a && a.branch_idea_text) text = a.branch_idea_text;
            if (a && a.title) target = a.title;
            // A specific angle belongs to its explored idea: when that idea is
            // saved, the Deep result branches UNDER it (a new node in its
            // lineage); when it isn't, branchParent resolves to no parent at the
            // run → standalone, exactly the warned unsaved-explore fallback. The
            // whole idea still GRADUATES in place (converts) — unchanged.
            graduateParent = false;
            branchParent = true;
          }
          guardLeave(target, "deep", () => goToInput("deep", text, graduateParent, branchParent, branchParent ? angleId : null));
        }}
        onSaveExplore={persistExploration}
        onExploreVariation={() =>
          guardLeave("this idea", "explore", () => goToInput("explore", exploreAnalysis.idea, false))
        }
        onExploreAngle={(a) => {
          // "take it to explore" on one angle — reroute to Explore's input pre-filled
          // with the angle's rough text so the founder can refine before re-widening.
          // The angle belongs to its explored idea, so when that idea is saved the new
          // exploration branches UNDER it (branchParent=true); unsaved → standalone.
          // Guarded like the others.
          const text = (a && a.branch_idea_text) || exploreAnalysis.idea;
          const target = (a && a.title) || "this direction";
          guardLeave(target, "explore", () => goToInput("explore", text, false, true, a ? a.id : null));
        }}
      />
      {leaveGuard && (
        <LeaveGuardModal
          target={leaveGuard.target}
          dest={leaveGuard.dest}
          onCancel={() => setLeaveGuard(null)}
          onLeave={() => { const p = leaveGuard.proceed; setLeaveGuard(null); p(); }}
          onSave={async () => {
            // Save & continue: persist the family, then proceed. On auth/error the
            // save path opens the auth modal (or surfaces the error) and throws —
            // abort the leave so nothing navigates with the work unsaved.
            try { await persistExploration(); }
            catch (e) { setLeaveGuard(null); return; }
            const p = leaveGuard.proceed;
            setLeaveGuard(null);
            p();
          }}
        />
      )}
      </DashboardShell>
    );
  }
  // ==========================================
  // SCREENS: ANALYSIS + EXECUTION PLAN (delegated to EvaluationView)
  // ==========================================
  if ((currentScreen === "results1" || currentScreen === "results2") && analysis) {
    // A brief is "already attached" if one was generated this session (briefData)
    // or persisted on a saved load (analysis.execution_brief). Drives the CTA
    // label; openExecutionBrief decides display-vs-generate.
    const hasExistingBrief = !!(
      briefData ||
      (analysis.execution_brief && Object.keys(analysis.execution_brief).length > 0)
    );
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
      <EvaluationView
        screen={historicalRead ? "results1" : currentScreen}
        t={t}
        analysis={historicalRead ? historicalRead.analysis : analysis}
        walkthroughData={historicalRead ? null : walkthroughData}
        evidenceSignal={historicalRead ? null : evidenceSignal}
        onSetAsCurrentRead={setAsCurrentRead}
        onKeepOldRead={keepOldRead}
        readDecisionBusy={readDecisionBusy}
        watchCadence={(myIdeas.find((i) => i.id === currentIdeaId) || {}).watch_cadence || "off"}
        onSetWatch={onSetWatch}
        profile={profile}
        user={user}
        viewingFromSaved={viewingFromSaved}
        isBranchIdea={isBranchIdea}
        showScoreGuide={showScoreGuide}
        showAuthModal={showAuthModal}
        saveStatus={saveStatus}
        saveError={saveError}
        savedIdeasCount={savedIdeasCount}
        ideaName={ideaName}
        openExecutionBrief={openExecutionBrief}
        hasExecutionBrief={hasExistingBrief}
        currentEvaluationId={currentEvaluationId}
        currentIdeaId={currentIdeaId}
        myIdeas={myIdeas}
        branchReason={branchReason}
        branchDimensions={branchDimensions}
        isReEvalResult={historicalRead ? false : isReEvalResult}
        evalsRemaining={evalsRemaining}
        setCurrentScreen={setCurrentScreen}
        setShowAuthModal={setShowAuthModal}
        setShowScoreGuide={setShowScoreGuide}
        setUser={setUser}
        setViewingFromSaved={setViewingFromSaved}
        setIdeaName={setIdeaName}
        setSaveStatus={setSaveStatus}
        setSaveError={setSaveError}
        setBranchReason={setBranchReason}
        setBranchDimensions={setBranchDimensions}
        setBranchSetAsMain={setBranchSetAsMain}
        saveStandalone={saveStandalone}
        setSaveStandalone={setSaveStandalone}
        onStartStandalone={startStandaloneSave}
        setIsReEvalResult={setIsReEvalResult}
        goToMyIdeas={goToMyIdeas}
        handleSaveIdea={handleSaveIdea}
        startReEvaluation={startReEvaluation}
        getStepNumber={getStepNumber}
        onResetAndNewIdea={onResetAndNewIdea}
        onBackToMyIdeasCleanup={onBackToMyIdeasCleanup}
        onDiscardReEval={onDiscardReEval}
        readHistory={readHistory}
        onOpenHistoricalRead={setHistoricalRead}
        onOpenExploredVersion={setHistoricalExploreRead}
        readOnly={!!historicalRead}
        outdatedMeta={historicalRead ? { superseded_at: historicalRead.superseded_at, superseded_reason: historicalRead.superseded_reason, original_created_at: historicalRead.original_created_at } : undefined}
        onBackToCurrent={() => setHistoricalRead(null)}
      />
      {isReEvaluating && <StreamOverlay streamSteps={streamSteps} t={t} mode="reeval" />}
      </DashboardShell>
    );
  }

  // ============================================
  // SCREEN: EXECUTION BRIEF (results3 / step-4 handoff)
  // ============================================
  if (currentScreen === "brief" && analysis) {
    return (
      <DashboardShell capacityWall={capacityWall} onCapacityClose={() => setCapacityWall(false)}
        t={t}
        active=""
        userEmail={user?.email}
        authLoading={authLoading}
        onLogin={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onNavigate={railNav}
      >
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(u) => setUser(u)} t={t} />
        )}
        <ExecutionBriefView
          t={t}
          analysis={analysis}
          sections={briefSections}
          status={briefStatus}
          error={briefError}
          retrying={briefRetrying}
          viewingFromSaved={viewingFromSaved}
          isBranchIdea={isBranchIdea}
          isReEvalResult={isReEvalResult}
          saveStatus={saveStatus}
          savedIdeaId={savedIdeaId}
          getStepNumber={getStepNumber}
          setCurrentScreen={setCurrentScreen}
          goToMyIdeas={goToMyIdeas}
          onRegenerate={() => openExecutionBrief({ regenerate: true })}
          onSaveIdea={openSaveFromBrief}
          onNewIdea={onResetAndNewIdea}
        />
      </DashboardShell>
    );
  }

  return null;
}