"use client";
// src/app/admin/page.js
// The ILC ops dashboard — one window onto the Supabase truth (capacity/money,
// waitlist, runs, feedback). Prompts for the admin key once (stored in localStorage),
// passes it as a Bearer to /api/admin/overview, and renders simple cards. Run it
// locally (npm run dev -> localhost:3000/admin) against live prod data, or open it at
// /admin on the deployed site. It renders nothing without the key; the endpoint
// refuses without it, so the page shell being reachable is harmless.
import { useState, useEffect, useCallback, useRef } from "react";

const C = {
  bg: "#0b0e14", card: "#10141c", cardAlt: "#0e121a",
  border: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.14)",
  text: "#e7e7ea", muted: "#8a8a93", dim: "#5c5c66",
  mint: "#34d8a8", violet: "#8a82c2", amber: "#e0a52e", red: "#e05a5a", blue: "#60a5fa",
};

function relTime(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return Math.floor(s) + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function Card({ title, right, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted }}>{title}</div>
        {right != null && <div style={{ fontSize: 12, color: C.dim }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || C.text, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Capacity({ c }) {
  if (!c || !c.available) return <div style={{ color: C.dim, fontSize: 13 }}>Unavailable — check the endpoint / Supabase.</div>;
  const barColor = c.atCapacity ? C.red : c.spendUsd >= c.inviteCeilingUsd ? C.amber : C.mint;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: barColor }}>${c.spendUsd}</div>
        <div style={{ fontSize: 14, color: C.muted }}>of ${c.guardUsd} this week</div>
        {c.atCapacity && <div style={{ marginLeft: "auto", fontSize: 11, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: "2px 8px" }}>AT CAPACITY</div>}
      </div>
      <div style={{ position: "relative", height: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden", margin: "10px 0 6px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${c.pctOfGuard}%`, background: barColor, borderRadius: 6 }} />
        <div style={{ position: "absolute", left: `${c.pctCeiling}%`, top: -2, bottom: -2, width: 2, background: C.violet }} title="invite ceiling" />
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 11, color: C.dim, marginBottom: 16 }}>
        <span>invite ceiling ${c.inviteCeilingUsd}</span><span style={{ color: C.violet }}>|</span><span>${c.bufferUsd} buffer to guard</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Stat label="headroom" value={`$${c.headroomUsd}`} color={C.mint} />
        <Stat label="invites available now" value={c.inviteBatchAvailable} color={c.inviteBatchAvailable > 0 ? C.violet : C.dim} />
        <Stat label={`per loop · cap ${c.maxBatch}`} value={`$${c.estLoopCostUsd}`} color={C.muted} />
      </div>
    </div>
  );
}

function MiniBars({ data, colorMap }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 58, fontSize: 12, color: C.muted }}>{k}</div>
          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 5 }}>
            <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: colorMap[k] || C.blue, borderRadius: 5, minWidth: v > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: 26, textAlign: "right", fontSize: 13, color: C.text }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function SourceTag({ s }) {
  const label = s || "—";
  const col = s === "capacity_wall" ? C.amber : s === "landing" ? C.mint : C.dim;
  return <span style={{ fontSize: 10.5, color: col, border: `1px solid ${col}55`, borderRadius: 5, padding: "1px 6px" }}>{label}</span>;
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [, force] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    const k = typeof window !== "undefined" ? window.localStorage.getItem("ilc_admin_key") : "";
    if (k) setKey(k);
  }, []);

  const load = useCallback(async (k) => {
    const useKey = k || key;
    if (!useKey) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${useKey}` } });
      if (res.status === 401) { setErr("Wrong key."); setKey(""); window.localStorage.removeItem("ilc_admin_key"); setData(null); return; }
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || `Error ${res.status}`); return; }
      setData(await res.json()); setFetchedAt(Date.now());
    } catch (e) { setErr("Network error."); }
    finally { setLoading(false); }
  }, [key]);

  useEffect(() => { if (key) load(key); }, [key, load]);

  useEffect(() => {
    if (!key) return;
    timer.current = setInterval(() => load(key), 30000);
    const tick = setInterval(() => force((n) => n + 1), 1000);
    return () => { clearInterval(timer.current); clearInterval(tick); };
  }, [key, load]);

  const submitKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    window.localStorage.setItem("ilc_admin_key", k);
    setKey(k);
  };

  const wrap = { maxWidth: 900, margin: "0 auto", paddingTop: 40, paddingRight: 20, paddingBottom: 40, paddingLeft: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" };

  if (!key) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
        <div style={{ ...wrap, maxWidth: 380, paddingTop: 120 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 18 }}>ILC · admin</div>
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitKey(); }}
            placeholder="admin key" autoFocus
            style={{ width: "100%", background: C.cardAlt, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: "12px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          <button onClick={submitKey} style={{ marginTop: 12, width: "100%", background: C.mint, color: "#062b22", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Open</button>
          {err && <div style={{ color: C.red, fontSize: 12, marginTop: 12 }}>{err}</div>}
          <div style={{ color: C.dim, fontSize: 11.5, marginTop: 18, lineHeight: 1.6 }}>Same value as WAITLIST_ADMIN_SECRET. Stored only in this browser.</div>
        </div>
      </div>
    );
  }

  const c = data?.capacity, wl = data?.waitlist, rn = data?.runs, fb = data?.feedback, em = data?.emails;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>IdeaLoop Core</div>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted }}>admin</div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: C.dim }}>{fetchedAt ? `updated ${relTime(new Date(fetchedAt).toISOString())}` : ""}</span>
            <button onClick={() => load(key)} disabled={loading} style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>{loading ? "…" : "Refresh"}</button>
          </div>
        </div>

        {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>{err}</div>}
        {!data && loading && <div style={{ color: C.dim }}>Loading…</div>}

        {data && (
          <div style={{ display: "grid", gap: 16 }}>
            <Card title="Capacity · this week" right={`$175 guard · ${data.windowDays}d rolling`}>
              <Capacity c={c} />
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card title="Waitlist">
                {wl?.available ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
                      <Stat label="total" value={wl.total} />
                      <Stat label="waiting" value={wl.unnotified} color={C.mint} />
                      <Stat label="invited" value={wl.notified} color={C.violet} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {wl.recent.map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, background: r.notified ? C.violet : C.mint, flexShrink: 0 }} />
                          <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{r.email}</span>
                          <SourceTag s={r.source} />
                          <span style={{ color: C.dim, width: 52, textAlign: "right" }}>{relTime(r.created_at)}</span>
                        </div>
                      ))}
                      {wl.recent.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>No signups yet.</div>}
                    </div>
                  </>
                ) : <div style={{ color: C.dim, fontSize: 13 }}>Unavailable.</div>}
              </Card>

              <Card title="Runs · this week" right={rn?.available ? `${rn.windowTotal} total` : ""}>
                {rn?.available ? (
                  Object.keys(rn.byAction).length ? (
                    <MiniBars data={rn.byAction} colorMap={{ explore: C.blue, deep: C.violet, reeval: C.amber, compare: C.mint }} />
                  ) : <div style={{ color: C.dim, fontSize: 12 }}>No runs this week.</div>
                ) : <div style={{ color: C.dim, fontSize: 13 }}>Unavailable.</div>}
              </Card>
            </div>

            <Card title="Email sends · this week" right={em?.available ? `${(em.windowCounts.sent || 0) + (em.windowCounts.failed || 0) + (em.windowCounts.skipped || 0)} attempts` : ""}>
              {em?.available ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
                    <Stat label="sent" value={em.windowCounts.sent} color={C.mint} />
                    <Stat label="failed" value={em.windowCounts.failed} color={em.windowCounts.failed > 0 ? C.red : C.dim} />
                    <Stat label="skipped" value={em.windowCounts.skipped} color={em.windowCounts.skipped > 0 ? C.amber : C.dim} />
                  </div>
                  {em.recent.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {em.recent.map((r, i) => {
                        const col = r.status === "sent" ? C.mint : r.status === "failed" ? C.red : C.amber;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: col, flexShrink: 0 }} />
                            <span style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", width: 78 }}>{r.kind}</span>
                            <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{r.email}</span>
                            {r.status !== "sent" && r.detail ? <span style={{ color: C.dim, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{r.detail}</span> : null}
                            <span style={{ color: col, fontSize: 11, width: 48, textAlign: "right" }}>{r.status}</span>
                            <span style={{ color: C.dim, width: 50, textAlign: "right" }}>{relTime(r.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div style={{ color: C.dim, fontSize: 12 }}>No sends yet.</div>}
                </>
              ) : <div style={{ color: C.dim, fontSize: 13 }}>Unavailable.</div>}
            </Card>

            <Card title="Feedback" right={fb?.available ? `${fb.total} total` : ""}>
              {fb?.available ? (
                fb.recent.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {fb.recent.map((r, i) => (
                      <div key={i} style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                          <span style={{ fontSize: 10.5, color: C.amber, textTransform: "uppercase", letterSpacing: "0.08em" }}>{r.category || "note"}</span>
                          <span style={{ fontSize: 11, color: C.dim }}>{relTime(r.created_at)}</span>
                          {r.reply_email && <span style={{ fontSize: 11, color: C.blue }}>{r.reply_email}</span>}
                        </div>
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{r.message}</div>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ color: C.dim, fontSize: 12 }}>No feedback yet.</div>
              ) : <div style={{ color: C.dim, fontSize: 13 }}>Unavailable.</div>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}