"use client";
import CapacityWall from "./CapacityWall";

// DashboardShell.js — the new left-rail app chrome (the "Dashboard").
//
// A layout wrapper, NOT a screen: it draws the persistent left rail (brand,
// primary nav, an EVALUATE group for the two entry modes, and a footer group)
// plus a thin top bar carrying the account cluster, then renders the active
// screen as {children}.
//
// The rail COLLAPSES to an icons-only strip via the panel-toggle in its header
// (or ⌘\). The choice persists in localStorage, so it survives navigation and
// reloads. Labels drop to hover-tooltips when collapsed; the main column widens
// to fill the reclaimed space.
//
// Props:
//   t          — theme token bag
//   active     — key of the active nav item (highlighted)
//   onNavigate — fn(key): a rail item was clicked
//   userEmail  — string shown top-right
//   onLogout   — fn(): log out clicked
//   children   — the active screen

import { useState, useEffect, useCallback } from "react";

const RAIL_W = 232;
const RAIL_W_COLLAPSED = 68;
const RAIL_STORE_KEY = "ilc_rail_collapsed";

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

// Panel-toggle glyph (the app-standard "sidebar" mark): a framed panel with a
// left column, and a chevron in the main area pointing the way it will move —
// left = collapse (sidebar showing), right = expand (sidebar tucked away).
const PanelToggle = ({ color, collapsed, size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M9 4.5v15" />
    {collapsed ? <path d="M12.6 9.5 15.1 12l-2.5 2.5" /> : <path d="M15.4 9.5 12.9 12l2.5 2.5" />}
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

function RailItem({ t, item, active, collapsed, onNavigate }) {
  const [hover, setHover] = useState(false);
  const on = active === item.key;
  const fg = on ? t.text : (hover ? t.text : t.sec);
  const iconColor = on && item.color ? item.color : fg;
  return (
    <div
      role="button"
      tabIndex={0}
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate && onNavigate(item.key)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate && onNavigate(item.key); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: collapsed ? 0 : 12,
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "9px 0" : "9px 12px", borderRadius: 9, cursor: "pointer",
        fontSize: 14, fontWeight: on ? 600 : 450, color: fg,
        background: on ? "rgba(255,255,255,0.07)" : hover ? "rgba(255,255,255,0.035)" : "transparent",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <item.Icon color={iconColor} />
      {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
    </div>
  );
}

// Header toggle button (panel-toggle glyph) with its own hover state.
function RailToggle({ t, collapsed, onToggle }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? "Expand sidebar  (⌘\\)" : "Collapse sidebar  (⌘\\)"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      style={{
        width: 30, height: 30, flex: "0 0 30px", borderRadius: 8,
        display: "grid", placeItems: "center", cursor: "pointer",
        color: hover ? t.text : t.sec,
        background: hover ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none", transition: "background 0.14s, color 0.14s",
      }}
    >
      <PanelToggle color="currentColor" collapsed={collapsed} />
    </button>
  );
}

// ── account cluster ──────────────────────────────────────────────────────────
// Avatar initial + email + hairline + ghost Log out, grouped into one bordered
// control that reads as an account chip instead of two loose text nodes. Falls
// back to a quiet "Log in" when signed out; renders nothing while auth loads.
function AccountBar({ t, userEmail, authLoading, onLogin, onLogout }) {
  const [hover, setHover] = useState(false);
  const [loHover, setLoHover] = useState(false);
  if (authLoading) return null;
  if (!userEmail) {
    return (
      <button
        onClick={onLogin}
        style={{ fontSize: 13, color: t.link, background: "none", border: "none", cursor: "pointer", padding: "6px 4px", fontWeight: 500 }}
      >
        Log in
      </button>
    );
  }
  const initial = (userEmail.trim()[0] || "?").toUpperCase();
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 9,
        padding: "5px 7px 5px 8px",
        border: `1px solid ${hover ? (t.borderStrong || "rgba(255,255,255,0.15)") : t.border}`,
        borderRadius: 10, transition: "border-color 0.15s",
      }}
    >
      <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600, color: "#c9c2ee", background: "rgba(138,130,194,0.18)", border: "1px solid rgba(138,130,194,0.4)" }}>
        {initial}
      </span>
      <span style={{ fontSize: 13, color: t.sec }}>{userEmail}</span>
      <span style={{ width: 1, height: 15, background: t.border }} />
      <button
        onClick={onLogout}
        onMouseEnter={() => setLoHover(true)}
        onMouseLeave={() => setLoHover(false)}
        style={{ fontSize: 13, color: loHover ? t.sec : t.mut, background: loHover ? "rgba(255,255,255,0.05)" : "none", border: "none", cursor: "pointer", padding: "3px 8px", borderRadius: 7, transition: "color 0.14s, background 0.14s" }}
      >
        Log out
      </button>
    </div>
  );
}

export default function DashboardShell({ t, active = "overview", onNavigate, userEmail, authLoading = false, onLogin, onLogout, capacityWall = false, onCapacityClose, children }) {
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted choice after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    try { if (localStorage.getItem(RAIL_STORE_KEY) === "1") setCollapsed(true); } catch {}
  }, []);

  const toggleRail = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(RAIL_STORE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  // ⌘\ (or Ctrl+\) toggles the rail, the way every editor does it.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); toggleRail(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRail]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, color: t.text }}>
      {/* ── left rail ── */}
      <aside
        style={{
          width: collapsed ? RAIL_W_COLLAPSED : RAIL_W, flexShrink: 0, boxSizing: "border-box",
          borderRight: `1px solid ${t.border}`, background: t.bg,
          display: "flex", flexDirection: "column",
          padding: collapsed ? "22px 12px" : "22px 16px",
          position: "sticky", top: 0, height: "100vh", overflowX: "hidden",
          transition: "width 0.24s cubic-bezier(0.4,0,0.2,1), padding 0.24s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* brand + toggle — fixed-height header so the toggle keeps the SAME
            vertical position whether the rail is open or collapsed (it never
            jumps). Expanded: wordmark left, toggle right. Collapsed: toggle
            only, centered, at that same vertical center. */}
        <div
          style={{
            height: 44, marginBottom: 24, display: "flex", alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: collapsed ? 0 : "0 4px 0 8px",
          }}
        >
          {!collapsed && (
            <img src="/idealoop-wordmark.png" alt="IdeaLoop Core" style={{ display: "block", height: 40, width: "auto" }} />
          )}
          <RailToggle t={t} collapsed={collapsed} onToggle={toggleRail} />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_MAIN.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </nav>

        {collapsed ? (
          <div style={{ height: 1, background: t.divider, margin: "16px 10px 8px" }} />
        ) : (
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.mut, margin: "22px 0 8px", padding: "0 12px" }}>
            Evaluate
          </div>
        )}
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_EVAL.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ height: 1, background: t.divider, margin: collapsed ? "0 10px 10px" : "0 8px 10px" }} />
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_FOOT.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} collapsed={collapsed} onNavigate={onNavigate} />
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
          <AccountBar t={t} userEmail={userEmail} authLoading={authLoading} onLogin={onLogin} onLogout={onLogout} />
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