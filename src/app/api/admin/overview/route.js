// src/app/api/admin/overview/route.js
// The single read-only stats endpoint behind the /admin dashboard. Bearer-protected
// against WAITLIST_ADMIN_SECRET (the same secret the invite route uses — one admin
// key, not two). Reads everything server-side via the service-role client and returns
// one JSON blob. It reuses getGlobalSpendUsd() + inviteBatchSize() so the capacity
// numbers on the dashboard are the EXACT numbers the budget guard and the invite gate
// act on — never a second calculation that could drift.
//
// Every section is wrapped so a single failing/absent table degrades that card to
// "unavailable" instead of blanking the whole page.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGlobalSpendUsd } from "../../../../lib/services/entitlements";
import {
  GLOBAL_WEEKLY_BUDGET_USD,
  INVITE_CEILING_USD,
  INVITE_HEADROOM_BUFFER_USD,
  EST_LOOP_COST_USD,
  INVITE_MAX_BATCH,
  inviteBatchSize,
} from "../../../../lib/plans";

// Own the client inline (same pattern as /api/waitlist) so this route depends on no
// shared module. Service-role: waitlist/feedback have RLS on with no policies, so
// reads must come through a server route holding this key.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Matches the guard's trailing-7-day spend window, so "this week" here == the window
// getGlobalSpendUsd() sums over.
const USAGE_WINDOW_DAYS = 7;
const WINDOW_MS = USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { console.error("admin section error:", e); return fallback; }
}

function authOk(request) {
  const secret = process.env.WAITLIST_ADMIN_SECRET;
  if (!secret) return { ok: false, status: 500, msg: "Admin not configured (set WAITLIST_ADMIN_SECRET)." };
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || token !== secret) return { ok: false, status: 401, msg: "Unauthorized." };
  return { ok: true };
}

export async function GET(request) {
  const auth = authOk(request);
  if (!auth.ok) return NextResponse.json({ error: auth.msg }, { status: auth.status });

  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();

  // capacity / money (the same numbers the guard + invite gate use)
  const spend = await safe(() => getGlobalSpendUsd(), null);
  const capacity = spend == null
    ? { available: false }
    : {
        available: true,
        spendUsd: round2(spend),
        guardUsd: GLOBAL_WEEKLY_BUDGET_USD,
        inviteCeilingUsd: INVITE_CEILING_USD,
        bufferUsd: INVITE_HEADROOM_BUFFER_USD,
        headroomUsd: round2(Math.max(0, INVITE_CEILING_USD - spend)),
        pctOfGuard: Math.min(100, Math.round((spend / GLOBAL_WEEKLY_BUDGET_USD) * 100)),
        pctCeiling: Math.round((INVITE_CEILING_USD / GLOBAL_WEEKLY_BUDGET_USD) * 100),
        atCapacity: spend >= GLOBAL_WEEKLY_BUDGET_USD,
        estLoopCostUsd: EST_LOOP_COST_USD,
        inviteBatchAvailable: inviteBatchSize(spend),
        maxBatch: INVITE_MAX_BATCH,
      };

  // waitlist
  const waitlist = await safe(async () => {
    const [totalRes, notifiedRes, recentRes] = await Promise.all([
      supabaseAdmin.from("waitlist").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("waitlist").select("id", { count: "exact", head: true }).eq("notified", true),
      supabaseAdmin.from("waitlist").select("email, source, notified, created_at").order("created_at", { ascending: false }).limit(6),
    ]);
    const total = totalRes.count || 0;
    const notified = notifiedRes.count || 0;
    return {
      available: true,
      total,
      notified,
      unnotified: Math.max(0, total - notified),
      recent: (recentRes.data || []).map((r) => ({
        email: r.email, source: r.source, notified: r.notified, created_at: r.created_at,
      })),
    };
  }, { available: false });

  // runs this window, counted by whatever action values appear
  const runs = await safe(async () => {
    const { data } = await supabaseAdmin
      .from("eval_usage").select("action, evaluated_at").gte("evaluated_at", sinceIso);
    const byAction = {};
    (data || []).forEach((r) => { const a = r.action || "other"; byAction[a] = (byAction[a] || 0) + 1; });
    return { available: true, windowTotal: (data || []).length, byAction };
  }, { available: false });

  // feedback
  const feedback = await safe(async () => {
    const [totalRes, recentRes] = await Promise.all([
      supabaseAdmin.from("feedback").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("feedback").select("category, message, reply_email, created_at").order("created_at", { ascending: false }).limit(4),
    ]);
    return {
      available: true,
      total: totalRes.count || 0,
      recent: (recentRes.data || []).map((r) => ({
        category: r.category, message: (r.message || "").slice(0, 240),
        reply_email: r.reply_email, created_at: r.created_at,
      })),
    };
  }, { available: false });

  // email delivery — the send outcomes logged by both mailers
  const emails = await safe(async () => {
    const [winRes, recentRes] = await Promise.all([
      supabaseAdmin.from("email_events").select("status").gte("created_at", sinceIso),
      supabaseAdmin.from("email_events").select("kind, email, status, detail, created_at").order("created_at", { ascending: false }).limit(6),
    ]);
    const counts = { sent: 0, failed: 0, skipped: 0 };
    (winRes.data || []).forEach((r) => { if (counts[r.status] != null) counts[r.status]++; });
    return {
      available: true,
      windowCounts: counts,
      recent: (recentRes.data || []).map((r) => ({
        kind: r.kind, email: r.email, status: r.status,
        detail: (r.detail || "").slice(0, 120), created_at: r.created_at,
      })),
    };
  }, { available: false });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowDays: USAGE_WINDOW_DAYS,
    capacity, waitlist, runs, feedback, emails,
  });
}