"use client";
import CapacityWall from "./CapacityWall";

// DashboardShell.js — the new left-rail app chrome (the "Dashboard").
//
// A layout wrapper, NOT a screen: it draws the persistent left rail (brand,
// primary nav, an EVALUATE group for the two entry modes, and a footer group)
// plus a thin top bar carrying the account email + Log out, then renders the
// active screen as {children}. Today it hosts the Overview; it is built to host
// the Hub and other screens next without change.
//
// This is additive chrome — it does not replace or touch the existing top-header
// step-flow app. Wire it in page.js behind a new screen state, e.g.
//   <DashboardShell t={t} active="overview" onNavigate={handleNav}
//                   userEmail={user?.email} onLogout={handleLogout}>
//     <OverviewView t={t} onStartExplore={...} onStartDeep={...} />
//   </DashboardShell>
// and map the nav keys (overview / hub / explore / deep / settings / plan / help)
// to your routing in handleNav.
//
// Props:
//   t          — theme token bag
//   active     — key of the active nav item (highlighted)
//   onNavigate — fn(key): a rail item was clicked
//   userEmail  — string shown top-right
//   onLogout   — fn(): log out clicked
//   children   — the active screen

import { useState } from "react";

const RAIL_W = 232;

// ── inline icons (stroke style, matches the rest of ILC) ─────────────────────
const ip = (color, size = 18) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
});
const Grid = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
  </svg>
);
const Stack = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <path d="M12 3.5l8.5 4.2-8.5 4.2-8.5-4.2 8.5-4.2z" /><path d="M3.5 12l8.5 4.2 8.5-4.2" /><path d="M3.5 16l8.5 4.2 8.5-4.2" />
  </svg>
);
const Compass = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill={color} stroke="none" />
  </svg>
);
const Target = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
  </svg>
);
const Settings = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9l-2.1 2.1M7 17l-2.1 2.1" />
  </svg>
);
const Diamond = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <path d="M12 3l8 8.4-8 9.2-8-9.2L12 3z" /><path d="M4.4 11.4h15.2" />
  </svg>
);
const Help = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.5 2.5 0 0 1 4.2 1.3c0 1.6-2 2-2 3.4" /><path d="M12 17.2v.2" />
  </svg>
);

const NAV_MAIN = [
  { key: "overview", label: "Overview", Icon: Grid },
  { key: "hub", label: "My ideas hub", Icon: Stack },
];
const NAV_EVAL = [
  { key: "explore", label: "Explore mode", Icon: Compass, color: "#7aa2ff" },
  { key: "deep", label: "Deep analysis", Icon: Target, color: "#8a82c2" },
];
const NAV_FOOT = [
  { key: "settings", label: "Settings", Icon: Settings },
  { key: "plan", label: "My plan", Icon: Diamond },
  { key: "help", label: "Get help", Icon: Help },
];

function RailItem({ t, item, active, onNavigate }) {
  const [hover, setHover] = useState(false);
  const on = active === item.key;
  const fg = on ? t.text : (hover ? t.text : t.sec);
  const iconColor = on && item.color ? item.color : fg;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate && onNavigate(item.key)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate && onNavigate(item.key); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "9px 12px", borderRadius: 9, cursor: "pointer",
        fontSize: 14, fontWeight: on ? 600 : 450, color: fg,
        background: on ? "rgba(255,255,255,0.07)" : hover ? "rgba(255,255,255,0.035)" : "transparent",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <item.Icon color={iconColor} />
      <span>{item.label}</span>
    </div>
  );
}

export default function DashboardShell({ t, active = "overview", onNavigate, userEmail, authLoading = false, onLogin, onLogout, capacityWall = false, onCapacityClose, children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, color: t.text }}>
      {/* ── left rail ── */}
      <aside
        style={{
          width: RAIL_W, flexShrink: 0, boxSizing: "border-box",
          borderRight: `1px solid ${t.border}`, background: t.bg,
          display: "flex", flexDirection: "column", padding: "22px 16px",
          position: "sticky", top: 0, height: "100vh",
        }}
      >
        <div style={{ padding: "0 8px", marginBottom: 26 }}>
          <img
            src="/idealoop-wordmark.png"
            alt="IdeaLoop Core"
            style={{ display: "block", height: 46, width: "auto" }}
          />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_MAIN.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} onNavigate={onNavigate} />
          ))}
        </nav>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.mut, margin: "22px 0 8px", padding: "0 12px" }}>
          Evaluate
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_EVAL.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} onNavigate={onNavigate} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ height: 1, background: t.divider, margin: "0 8px 10px" }} />
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_FOOT.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} onNavigate={onNavigate} />
          ))}
        </nav>
      </aside>

      {/* ── main column ── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 18,
            height: 60, flexShrink: 0, padding: "0 32px",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          {!authLoading && (userEmail ? (
            <>
              <span style={{ fontSize: 13, color: t.sec }}>{userEmail}</span>
              <button
                onClick={onLogout}
                style={{ fontSize: 13, color: t.mut, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = t.sec)}
                onMouseLeave={(e) => (e.currentTarget.style.color = t.mut)}
              >
                Log out
              </button>
            </>
          ) : (
            <button
              onClick={onLogin}
              style={{ fontSize: 13, color: t.link, background: "none", border: "none", cursor: "pointer", padding: "6px 4px", fontWeight: 500 }}
            >
              Log in
            </button>
          ))}
        </header>

        <div style={{ flex: 1, padding: "40px 32px 64px" }}>
          {children}
        </div>

        <footer style={{ flexShrink: 0, padding: "16px 32px", borderTop: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 12, color: t.mut, margin: 0 }}>
            IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
          </p>
          <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: 12 }}>
            <a href="/privacy" style={{ color: t.mut, textDecoration: "none" }}>Privacy</a>
            <a href="/terms" style={{ color: t.mut, textDecoration: "none" }}>Terms</a>
            <a href="/disclaimer" style={{ color: t.mut, textDecoration: "none" }}>Disclaimer</a>
          </div>
        </footer>
      </main>
      {capacityWall && <CapacityWall onClose={onCapacityClose} />}
    </div>
  );
}