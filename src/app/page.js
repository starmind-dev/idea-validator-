"use client";

import { useState, useEffect } from "react";

// ============================================
// STEP PROGRESS BAR
// ============================================
function StepProgress({ currentStep }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const steps = [
    { number: 1, label: "Profile" },
    { number: 2, label: "Idea" },
    { number: 3, label: "Analysis" },
    { number: 4, label: "Evaluation" },
  ];

  const circleSize = isMobile ? 28 : 40;
  const circleFontSize = isMobile ? 11 : 14;
  const connectorWidth = isMobile ? 28 : 80;
  const connectorMargin = isMobile ? "0 4px" : "0 12px";
  const labelFontSize = isMobile ? 9 : 12;
  const labelMarginTop = isMobile ? 5 : 8;
  const containerPadding = isMobile ? "20px 8px" : "32px 0";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: containerPadding }}>
      {steps.map((step, index) => (
        <div key={step.number} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: circleSize,
                height: circleSize,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: circleFontSize,
                fontWeight: 600,
                transition: "all 0.3s",
                flexShrink: 0,
                ...(currentStep > step.number
                  ? { background: "rgba(16,185,129,0.2)", color: "#34d399", border: "2px solid rgba(16,185,129,0.5)" }
                  : currentStep === step.number
                  ? { background: "#fff", color: "#0a0a0a", border: "2px solid #fff", boxShadow: "0 4px 12px rgba(255,255,255,0.1)" }
                  : { background: "rgba(38,38,38,0.6)", color: "#525252", border: "2px solid rgba(64,64,64,0.5)" }),
              }}
            >
              {currentStep > step.number ? "✓" : step.number}
            </div>
            <span
              style={{
                fontSize: labelFontSize,
                marginTop: labelMarginTop,
                fontWeight: 500,
                color: currentStep >= step.number ? "#d4d4d4" : "#525252",
                whiteSpace: "nowrap",
              }}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              style={{
                width: connectorWidth,
                height: 2,
                margin: connectorMargin,
                marginBottom: isMobile ? 18 : 24,
                borderRadius: 2,
                background: currentStep > step.number ? "rgba(16,185,129,0.5)" : "#262626",
                transition: "all 0.3s",
                flexShrink: 0,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// STATUS BADGE
// ============================================
function StatusBadge({ status }) {
  const colorMap = {
    growing: { bg: "rgba(16,185,129,0.15)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
    active: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)" },
    acquired: { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
    failed: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
    shutdown: { bg: "rgba(239,68,68,0.15)", color: "#f87171", border: "rgba(239,68,68,0.3)" },
  };
  const c = colorMap[status] || colorMap.active;

  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 10px",
        borderRadius: 9999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ============================================
// SCORE BAR
// ============================================
function ScoreBar({ name, score, explanation, weight, notes }) {
  const percentage = (score / 10) * 100;
  const getColor = (s) => {
    if (s >= 8) return "#10b981";
    if (s >= 6) return "#3b82f6";
    if (s >= 4) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>
          {name}
          {weight && <span style={{ fontSize: 11, fontWeight: 400, color: "#525252", marginLeft: 8 }}>{weight}</span>}
        </span>
        <span style={{ fontSize: 14, fontFamily: "monospace", fontWeight: 600, color: getColor(score) }}>
          {score.toFixed(1)}/10
        </span>
      </div>
      <div style={{ width: "100%", height: 8, background: "#262626", borderRadius: 9999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: getColor(score),
            width: `${percentage}%`,
            transition: "width 1s ease-out",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: "#737373", marginTop: 8, lineHeight: 1.5 }}>{explanation}</p>
      {notes && notes.map((note, i) => (
        <p key={i} style={{ fontSize: 11, color: "#525252", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
      ))}
    </div>
  );
}

// ============================================
// SECTION HEADER
// ============================================
function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: "rgba(38,38,38,0.8)",
          border: "1px solid rgba(64,64,64,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f5f5f5", margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 14, color: "#737373", margin: "4px 0 0 0" }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================
// CARD WRAPPER
// ============================================
function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "rgba(23,23,23,0.6)",
        border: "1px solid rgba(38,38,38,0.8)",
        borderRadius: 16,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// PAGE CONTAINER - ensures padding on ALL screens
// ============================================
function PageContainer({ children, wide = false }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: wide ? 960 : 640,
        marginLeft: "auto",
        marginRight: "auto",
        paddingLeft: isMobile ? 16 : 32,
        paddingRight: isMobile ? 16 : 32,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
// ============================================
// EVALUATION LIMIT HELPERS
// ============================================
const EVAL_LIMIT = 3;
const EVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getRecentEvals() {
  try {
    const raw = localStorage.getItem("iv_eval_timestamps");
    if (!raw) return [];
    const timestamps = JSON.parse(raw);
    const cutoff = Date.now() - EVAL_WINDOW_MS;
    return timestamps.filter((t) => t > cutoff);
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
export default function Home() {
  const [currentScreen, setCurrentScreen] = useState("profile");
  const [profile, setProfile] = useState({ coding: "", ai: "", education: "" });
  const [evalsRemaining, setEvalsRemaining] = useState(EVAL_LIMIT);

  // Load saved profile + eval count after mount (avoids hydration mismatch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const saved = localStorage.getItem("iv_profile");
    if (saved) {
      setProfile(JSON.parse(saved));
      setCurrentScreen("input");
    }
    setEvalsRemaining(getEvalsRemaining());
  }, []);
  const [idea, setIdea] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState({});
  const [editingPhase, setEditingPhase] = useState(null);
  const [editedPhases, setEditedPhases] = useState(null);

  const togglePhase = (i) => setExpandedPhases((p) => ({ ...p, [i]: !p[i] }));

  const startEditingPhase = (i) => {
    if (!editedPhases) setEditedPhases([...analysis.phases]);
    setEditingPhase(i);
  };

  const savePhaseEdit = (i, field, value) => {
    const updated = [...(editedPhases || analysis.phases)];
    updated[i] = { ...updated[i], [field]: value };
    setEditedPhases(updated);
  };

  const stopEditingPhase = () => setEditingPhase(null);
  const currentPhases = editedPhases || (analysis ? analysis.phases : []);

  const getStepNumber = () => {
    const map = { profile: 1, input: 2, results1: 3, results2: 4 };
    return map[currentScreen] || 1;
  };

  const handleAnalyze = async () => {
    if (!idea.trim()) return;

    const remaining = getEvalsRemaining();
    if (remaining <= 0) {
      setError(`You've used all ${EVAL_LIMIT} free evaluations this week. Next slot opens in ${getNextResetTime()}.`);
      return;
    }

    setIsAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      if (data.ethics_blocked) {
        setError(data.ethics_message);
        return;
      }

      recordEval();
      setEvalsRemaining(getEvalsRemaining());

      setAnalysis(data);
      setEditedPhases(null);
      setExpandedPhases({});
      setCurrentScreen("results1");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Shared header style
  const headerStyle = {
    width: "100%",
    borderBottom: "1px solid rgba(38,38,38,0.8)",
  };

  const footerStyle = {
    width: "100%",
    borderTop: "1px solid rgba(38,38,38,0.8)",
    padding: "20px 0",
  };

  // ==========================================
  // SCREEN 0: PROFILE
  // ==========================================
  if (currentScreen === "profile") {
    const canContinue = profile.coding && profile.ai;

    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column" }}>
        <header style={headerStyle}>
          <PageContainer>
            <div style={{ padding: "16px 0" }}>
              <h1 style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0 }}>
                Idea Validator
              </h1>
            </div>
          </PageContainer>
        </header>

        <StepProgress currentStep={getStepNumber()} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 12px 0" }}>
                Tell us about yourself
              </h2>
              <p style={{ fontSize: 14, color: "#737373", lineHeight: 1.6, margin: 0 }}>
                We'll calibrate the analysis to your experience level<br />
                so the recommendations are relevant to you.
              </p>
            </div>

            <Card style={{ padding: 28, marginBottom: 32 }}>
              {/* Coding */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", display: "block", marginBottom: 12 }}>
                  How familiar are you with coding?
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {["Beginner", "Intermediate", "Advanced"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, coding: opt }))}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        ...(profile.coding === opt
                          ? { background: "#fff", color: "#0a0a0a", borderColor: "#fff" }
                          : { background: "rgba(23,23,23,0.8)", color: "#a3a3a3", borderColor: "rgba(64,64,64,0.6)" }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", display: "block", marginBottom: 12 }}>
                  How much experience do you have with AI tools?
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {["None", "Some", "Regular user"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, ai: opt }))}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        borderRadius: 12,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        ...(profile.ai === opt
                          ? { background: "#fff", color: "#0a0a0a", borderColor: "#fff" }
                          : { background: "rgba(23,23,23,0.8)", color: "#a3a3a3", borderColor: "rgba(64,64,64,0.6)" }),
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Education */}
              <div>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#d4d4d4", display: "block", marginBottom: 12 }}>
                  What is your education or professional background?
                </label>
                <input
                  type="text"
                  value={profile.education}
                  onChange={(e) => setProfile((p) => ({ ...p, education: e.target.value }))}
                  placeholder="e.g., Software Engineer, Marketing Manager, Student..."
                  style={{
                    width: "100%",
                    background: "rgba(23,23,23,0.8)",
                    border: "1px solid rgba(64,64,64,0.6)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    fontSize: 14,
                    color: "#f5f5f5",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </Card>

            <button
              onClick={() => {
                localStorage.setItem("iv_profile", JSON.stringify(profile));
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
                  ? { background: "#fff", color: "#0a0a0a" }
                  : { background: "rgba(38,38,38,0.6)", color: "#525252" }),
              }}
            >
              Continue
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaValidator — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN 1: IDEA INPUT
  // ==========================================
  if (currentScreen === "input") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column" }}>
        <header style={headerStyle}>
          <PageContainer>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0 }}>
                Idea Validator
              </h1>
              <button onClick={() => setCurrentScreen("profile")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                {profile.coding} · {profile.ai} AI · Edit ✎
              </button>
            </div>
          </PageContainer>
        </header>

        <StepProgress currentStep={getStepNumber()} />

        <main style={{ flex: 1, paddingBottom: 48 }}>
          <PageContainer>
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 30, fontWeight: 600, margin: "0 0 12px 0" }}>
                Describe your AI product idea
              </h2>
              <p style={{ fontSize: 16, color: "#737373", lineHeight: 1.6, margin: 0 }}>
                Be as specific as you can. What does it do? Who is it for?
                What problem does it solve? The more detail you provide,
                the better the analysis.
              </p>
            </div>

            <Card style={{ padding: 6, marginBottom: 24 }}>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Example: An AI-powered app that analyzes food photos and gives personalized nutrition advice..."
                rows={8}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "16px 20px",
                  fontSize: 16,
                  color: "#f5f5f5",
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
              <span style={{ fontSize: 14, color: "#525252", fontFamily: "monospace" }}>
                {idea.length > 0 ? `${idea.length} characters` : ""}
              </span>
              <button
                onClick={handleAnalyze}
                disabled={!idea.trim() || isAnalyzing || evalsRemaining <= 0}
                style={{
                  padding: "12px 32px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  cursor: !idea.trim() || isAnalyzing || evalsRemaining <= 0 ? "not-allowed" : "pointer",
                  ...(!idea.trim() || isAnalyzing || evalsRemaining <= 0
                    ? { background: "rgba(38,38,38,0.6)", color: "#525252" }
                    : { background: "#fff", color: "#0a0a0a" }),
                }}
              >
                {isAnalyzing ? "Analyzing..." : evalsRemaining <= 0 ? "Limit Reached" : "Analyze Idea"}
              </button>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 24,
              padding: "10px 16px",
              borderRadius: 12,
              background: evalsRemaining <= 0 ? "rgba(239,68,68,0.08)" : evalsRemaining === 1 ? "rgba(245,158,11,0.08)" : "rgba(38,38,38,0.4)",
              border: `1px solid ${evalsRemaining <= 0 ? "rgba(239,68,68,0.2)" : evalsRemaining === 1 ? "rgba(245,158,11,0.2)" : "rgba(64,64,64,0.3)"}`,
            }}>
              <span style={{
                fontSize: 13,
                color: evalsRemaining <= 0 ? "#f87171" : evalsRemaining === 1 ? "#fbbf24" : "#737373",
              }}>
                {evalsRemaining <= 0
                  ? `No evaluations remaining this week. Next slot opens in ${getNextResetTime()}.`
                  : `${evalsRemaining} of ${EVAL_LIMIT} free evaluations remaining this week`}
              </span>
            </div>

            {isAnalyzing && (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{
                  display: "inline-block",
                  width: 32,
                  height: 32,
                  border: "2px solid #404040",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ fontSize: 14, color: "#737373", marginTop: 16 }}>
                  Analyzing your idea... This may take 15-30 seconds.
                </p>
              </div>
            )}
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaValidator — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN 2: COMPETITION + PHASES
  // ==========================================
  if (currentScreen === "results1" && analysis) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column" }}>
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0 }}>
                Idea Validator
              </h1>
              <button onClick={() => setCurrentScreen("input")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                ← Back to idea
              </button>
            </div>
          </PageContainer>
        </header>

        <StepProgress currentStep={getStepNumber()} />

        <main style={{ flex: 1, paddingBottom: 64 }}>
          <PageContainer wide>

            {/* Scope Warning */}
            {analysis.scope_warning && (
              <div style={{
                padding: "12px 16px",
                marginBottom: 24,
                borderRadius: 12,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                fontSize: 13,
                color: "#fbbf24",
                lineHeight: 1.5,
              }}>
                ⚠️ This idea includes components outside our primary evaluation scope (hardware, physical services, or non-software elements). Scores evaluate the software and AI components. Challenges specific to physical components may not be fully captured.
              </div>
            )}

            {/* Competition */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="🌐" title="Competition Landscape" subtitle="Similar existing products in the market" />

              {analysis.competition.data_source === "verified" ? (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 16,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}>
                  <span style={{ fontSize: 12, color: "#34d399", fontWeight: 600 }}>Verified Sources</span>
                  <span style={{ fontSize: 11, color: "#737373" }}>via GitHub & Google</span>
                </div>
              ) : (
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 16,
                  padding: "6px 14px",
                  borderRadius: 9999,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}>
                  <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 600 }}>AI-Generated</span>
                  <span style={{ fontSize: 11, color: "#737373" }}>use as directional guide</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
                {analysis.competition.competitors.map((comp, i) => {
                  const sourceColors = {
                    github: { bg: "rgba(110,84,148,0.15)", color: "#a78bfa", border: "rgba(110,84,148,0.3)", label: "GitHub" },
                    google: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "rgba(59,130,246,0.3)", label: "Google" },
                    llm: { bg: "rgba(115,115,115,0.15)", color: "#a3a3a3", border: "rgba(115,115,115,0.3)", label: "AI" },
                  };
                  const src = sourceColors[comp.source] || sourceColors.llm;

                  return (
                    <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: 0, flex: 1, minWidth: 0 }}>{comp.name}</h3>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 9999,
                            border: `1px solid ${src.border}`,
                            background: src.bg,
                            color: src.color,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            whiteSpace: "nowrap",
                          }}>
                            {src.label}
                          </span>
                          <StatusBadge status={comp.status} />
                        </div>
                      </div>
                      <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.6, margin: 0, flex: 1 }}>
                        {comp.description}
                      </p>
                      <p style={{ fontSize: 12, color: "#34d399", fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
                        {comp.outcome}
                      </p>
                      {comp.url && (
                        <a
                          href={comp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#60a5fa",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          Visit →
                        </a>
                      )}
                    </Card>
                  );
                })}
              </div>

              {analysis.competition.differentiation && (
                <Card style={{ background: "rgba(23,23,23,0.4)", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", margin: "0 0 8px 0" }}>
                    How your idea compares
                  </h3>
                  <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>
                    {analysis.competition.differentiation}
                  </p>
                </Card>
              )}
            </section>

            {/* Phases */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="⚙" title="Execution Phases" subtitle="Recommended roadmap for building your idea" />

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {currentPhases.map((phase, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(23,23,23,0.6)",
                      border: "1px solid rgba(38,38,38,0.8)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      onClick={() => togglePhase(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "20px 24px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "rgba(59,130,246,0.15)",
                        border: "1px solid rgba(59,130,246,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#60a5fa",
                        flexShrink: 0,
                      }}>
                        {phase.number}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
                          {phase.title}
                        </h3>
                        <p style={{ fontSize: 14, color: "#737373", margin: "4px 0 0 0", lineHeight: 1.5 }}>
                          {phase.summary}
                        </p>
                      </div>
                      <span style={{
                        color: "#525252",
                        transition: "transform 0.2s",
                        transform: expandedPhases[i] ? "rotate(180deg)" : "rotate(0deg)",
                        flexShrink: 0,
                        fontSize: 18,
                      }}>
                        ▾
                      </span>
                    </div>

                    {expandedPhases[i] && (
                      <div style={{ padding: "0 24px 24px 24px", borderTop: "1px solid rgba(38,38,38,0.6)" }}>
                        {editingPhase === i ? (
                          <div style={{ paddingTop: 20 }}>
                            <input
                              type="text"
                              value={(editedPhases || analysis.phases)[i].title}
                              onChange={(e) => savePhaseEdit(i, "title", e.target.value)}
                              style={{
                                width: "100%",
                                background: "rgba(38,38,38,0.6)",
                                border: "1px solid rgba(64,64,64,0.6)",
                                borderRadius: 12,
                                padding: "10px 16px",
                                fontSize: 14,
                                color: "#f5f5f5",
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 12,
                              }}
                            />
                            <textarea
                              value={(editedPhases || analysis.phases)[i].details}
                              onChange={(e) => savePhaseEdit(i, "details", e.target.value)}
                              rows={6}
                              style={{
                                width: "100%",
                                background: "rgba(38,38,38,0.6)",
                                border: "1px solid rgba(64,64,64,0.6)",
                                borderRadius: 12,
                                padding: "12px 16px",
                                fontSize: 14,
                                color: "#f5f5f5",
                                outline: "none",
                                resize: "none",
                                lineHeight: 1.6,
                                boxSizing: "border-box",
                                fontFamily: "inherit",
                                marginBottom: 12,
                              }}
                            />
                            <button
                              onClick={stopEditingPhase}
                              style={{ fontSize: 12, fontWeight: 500, color: "#34d399", background: "none", border: "none", cursor: "pointer" }}
                            >
                              ✓ Done editing
                            </button>
                          </div>
                        ) : (
                          <div style={{ paddingTop: 20 }}>
                            <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.7, margin: "0 0 16px 0", whiteSpace: "pre-line" }}>
                              {(editedPhases || analysis.phases)[i].details}
                            </p>
                            <button
                              onClick={() => startEditingPhase(i)}
                              style={{ fontSize: 12, fontWeight: 500, color: "#525252", background: "none", border: "none", cursor: "pointer" }}
                            >
                              Edit this phase
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <button
              onClick={() => setCurrentScreen("results2")}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                background: "#fff",
                color: "#0a0a0a",
                cursor: "pointer",
              }}
            >
              Continue to Tools & Evaluation
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer wide>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaValidator — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  // ==========================================
  // SCREEN 3: TOOLS + ESTIMATES + EVALUATION
  // ==========================================
  if (currentScreen === "results2" && analysis) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", display: "flex", flexDirection: "column" }}>
        <header style={headerStyle}>
          <PageContainer wide>
            <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h1 style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: "#525252", margin: 0 }}>
                Idea Validator
              </h1>
              <button onClick={() => setCurrentScreen("results1")} style={{ fontSize: 12, color: "#525252", background: "none", border: "none", cursor: "pointer" }}>
                ← Back to analysis
              </button>
            </div>
          </PageContainer>
        </header>

        <StepProgress currentStep={getStepNumber()} />

        <main style={{ flex: 1, paddingBottom: 64 }}>
          <PageContainer wide>

            {/* Tools */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="🔧" title="Tool Recommendations" subtitle="Platforms and tools to help you build" />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {analysis.tools.map((tool, i) => (
                  <Card key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>{tool.name}</h3>
                      <p style={{ fontSize: 12, color: "#737373", margin: "4px 0 0 0", fontWeight: 500 }}>{tool.category}</p>
                    </div>
                    <p style={{ fontSize: 14, color: "rgba(96,165,250,0.8)", lineHeight: 1.6, margin: 0 }}>
                      {tool.description}
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Time & Difficulty */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="⏱" title="Time & Difficulty" subtitle="Calibrated to your experience level" />

              <Card style={{ padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 8px 0" }}>
                      Estimated Duration
                    </p>
                    <p style={{ fontSize: 24, fontWeight: 700, color: "#f5f5f5", margin: 0 }}>
                      {analysis.estimates.duration}
                    </p>
                  </div>
                  <div style={{ width: 1, height: 64, background: "#262626" }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 8px 0" }}>
                      Difficulty Level
                    </p>
                    <span style={{
                      display: "inline-block",
                      fontSize: 14,
                      fontWeight: 700,
                      padding: "6px 16px",
                      borderRadius: 9999,
                      ...(analysis.estimates.difficulty === "Very Hard"
                        ? { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                        : analysis.estimates.difficulty === "Hard"
                        ? { background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }
                        : analysis.estimates.difficulty === "Moderate"
                        ? { background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }
                        : { background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }),
                    }}>
                      {analysis.estimates.difficulty}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#a3a3a3", textAlign: "center", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
                  {analysis.estimates.explanation}
                </p>
              </Card>
            </section>

            {/* Final Evaluation */}
            <section style={{ marginBottom: 48 }}>
              <SectionHeader icon="📊" title="Final Evaluation" subtitle="Scored analysis of your AI product idea" />

              {/* Overall score */}
              <Card style={{ padding: 32, textAlign: "center", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: "0 0 4px 0" }}>
                  Overall Idea Potential
                </p>
                <p style={{ fontSize: 10, color: "#404040", margin: "0 0 12px 0" }}>
                  Weighted average · Higher is better
                </p>
                <p style={{ fontSize: 64, fontWeight: 700, color: "#f5f5f5", margin: 0, lineHeight: 1 }}>
                  {analysis.evaluation.overall_score.toFixed(1)}
                  <span style={{ fontSize: 20, fontWeight: 400, color: "#525252" }}>/10</span>
                </p>
              </Card>

              {/* Metrics */}
              <Card style={{ padding: 32, marginBottom: 16 }}>
                <ScoreBar
                  name="Market Demand"
                  score={analysis.evaluation.market_demand.score}
                  explanation={analysis.evaluation.market_demand.explanation}
                  weight="30%"
                  notes={[
                    analysis.evaluation.market_demand.geographic_note,
                    analysis.evaluation.market_demand.trajectory_note,
                  ].filter(Boolean)}
                />
                <ScoreBar
                  name={analysis.evaluation.monetization.label || "Monetization Potential"}
                  score={analysis.evaluation.monetization.score}
                  explanation={analysis.evaluation.monetization.explanation}
                  weight="25%"
                />
                <ScoreBar
                  name="Originality"
                  score={analysis.evaluation.originality.score}
                  explanation={analysis.evaluation.originality.explanation}
                  weight="25%"
                />
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5" }}>
                      Technical Complexity
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#525252", marginLeft: 8 }}>20% · inverted</span>
                    </span>
                    <span style={{
                      fontSize: 14,
                      fontFamily: "monospace",
                      fontWeight: 600,
                      color: analysis.evaluation.technical_complexity.score >= 8 ? "#ef4444"
                        : analysis.evaluation.technical_complexity.score >= 6 ? "#f59e0b"
                        : analysis.evaluation.technical_complexity.score >= 4 ? "#3b82f6"
                        : "#10b981",
                    }}>
                      {analysis.evaluation.technical_complexity.score.toFixed(1)}/10
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "#262626", borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 9999,
                      background: analysis.evaluation.technical_complexity.score >= 8 ? "#ef4444"
                        : analysis.evaluation.technical_complexity.score >= 6 ? "#f59e0b"
                        : analysis.evaluation.technical_complexity.score >= 4 ? "#3b82f6"
                        : "#10b981",
                      width: `${(analysis.evaluation.technical_complexity.score / 10) * 100}%`,
                      transition: "width 1s ease-out",
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: "#737373", marginTop: 8, lineHeight: 1.5 }}>
                    {analysis.evaluation.technical_complexity.base_score_explanation}
                    {" "}{analysis.evaluation.technical_complexity.adjustment_explanation}
                    {" "}{analysis.evaluation.technical_complexity.explanation}
                  </p>
                  {analysis.evaluation.technical_complexity.incremental_note && (
                    <p style={{ fontSize: 11, color: "#525252", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
                      {analysis.evaluation.technical_complexity.incremental_note}
                    </p>
                  )}
                </div>
              </Card>

              {/* Marketplace Note */}
              {analysis.evaluation.marketplace_note && (
                <Card style={{ padding: 24, marginBottom: 16, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa", margin: "0 0 6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Marketplace Note
                  </p>
                  <p style={{ fontSize: 13, color: "#a3a3a3", lineHeight: 1.6, margin: 0 }}>
                    {analysis.evaluation.marketplace_note}
                  </p>
                </Card>
              )}

              {/* Summary */}
              <Card style={{ padding: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e5e5e5", margin: "0 0 12px 0" }}>Summary</h3>
                <p style={{ fontSize: 14, color: "#a3a3a3", lineHeight: 1.7, margin: 0 }}>
                  {analysis.evaluation.summary}
                </p>
              </Card>
            </section>

            <button
              onClick={() => {
                setCurrentScreen("input");
                setAnalysis(null);
                setIdea("");
                setEditedPhases(null);
                setExpandedPhases({});
                setEvalsRemaining(getEvalsRemaining());
              }}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid rgba(64,64,64,0.6)",
                background: "transparent",
                color: "#a3a3a3",
                cursor: "pointer",
              }}
            >
              Analyze Another Idea
            </button>
          </PageContainer>
        </main>

        <footer style={footerStyle}>
          <PageContainer wide>
            <p style={{ fontSize: 12, color: "#404040", margin: 0 }}>
              IdeaValidator — All analysis is AI-generated. Use as a guide, not a definitive assessment.
            </p>
          </PageContainer>
        </footer>
      </div>
    );
  }

  return null;
}