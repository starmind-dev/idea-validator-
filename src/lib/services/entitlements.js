// src/lib/services/entitlements.js
// The seam between "money / allowance" and the domain. ideas.js never imports this
// and never learns what a plan costs; the analyze / eval / compare routes call
// assertCanRun() before running a pipeline and recordRun() after it succeeds. Plan
// resolution is indirected through getUserPlan() so Polar can slot in later — a
// subscriptions table, or a webhook that writes profiles.plan_type — with nothing
// in here (or in the domain) to rewire.

import { supabaseAdmin } from "../supabase-admin";
import {
  getPlan, runsPerWeek,
  METERED_ACTIONS, ACTION_COST_USD,
  GLOBAL_WEEKLY_BUDGET_USD, USAGE_WINDOW_DAYS, ANON_RUNS_PER_WINDOW,
} from "../plans";

const WEEK_MS = USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
function windowStartIso() { return new Date(Date.now() - WEEK_MS).toISOString(); }

// ── plan resolution (the future-proof seam) ──────────────────────────────────
// Today: profiles.plan_type. Later: read a subscriptions table here instead — the
// return shape (a PLANS entry) and every caller stay identical.
export async function getUserPlan(userId) {
  const { data, error } = await supabaseAdmin
    .from("profiles").select("plan_type").eq("id", userId).single();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return getPlan(data?.plan_type);
}

// per-user metered runs in the trailing window. Returns the timestamps (not just a
// count) so we can also say when the next run frees up — one query, both facts.
async function meteredRunsInWindow(userId) {
  const { data, error } = await supabaseAdmin
    .from("eval_usage")
    .select("evaluated_at")
    .eq("user_id", userId)
    .in("action", METERED_ACTIONS)
    .gte("evaluated_at", windowStartIso())
    .order("evaluated_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// global estimated spend across ALL users in the trailing window — the hard guard.
// Summed in JS: fine at beta scale (a few thousand rows at most). Swap for a SQL
// aggregate or a running counter if volume ever makes this heavy.
async function globalSpendUsd() {
  const { data, error } = await supabaseAdmin
    .from("eval_usage")
    .select("est_cost_usd")
    .gte("evaluated_at", windowStartIso());
  if (error) throw new Error(error.message);
  return (data || []).reduce((sum, r) => sum + Number(r.est_cost_usd || 0), 0);
}

// anonymous metered runs from one IP in the trailing window — the per-IP trial cap.
// No IP (shouldn't happen behind Vercel) => treat as at-limit, fail safe.
async function anonRunsForIp(ip) {
  if (!ip) return ANON_RUNS_PER_WINDOW;
  const { count, error } = await supabaseAdmin
    .from("eval_usage")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .eq("ip", ip)
    .in("action", METERED_ACTIONS)
    .gte("evaluated_at", windowStartIso());
  if (error) throw new Error(error.message);
  return count || 0;
}

// The full entitlement snapshot — what the eval-usage route + My Plan render, and
// what assertCanRun decides on.
export async function getEntitlement(userId) {
  const plan = await getUserPlan(userId);

  if (plan.unlimited) {
    return {
      plan: plan.id, unlimited: true,
      weeklyLoops: null, runsPerWeek: null,
      runsUsed: 0, runsLeft: null, nextRunFreesAt: null,
      windowDays: USAGE_WINDOW_DAYS, capacityOk: true,
    };
  }

  const [runs, spend] = await Promise.all([meteredRunsInWindow(userId), globalSpendUsd()]);
  const cap = runsPerWeek(plan);
  const used = runs.length;
  const left = Math.max(0, cap - used);
  const nextRunFreesAt =
    left <= 0 && runs[0]
      ? new Date(new Date(runs[0].evaluated_at).getTime() + WEEK_MS).toISOString()
      : null;

  return {
    plan: plan.id, unlimited: false,
    weeklyLoops: plan.weeklyLoops, runsPerWeek: cap,
    runsUsed: used, runsLeft: left, nextRunFreesAt,
    windowDays: USAGE_WINDOW_DAYS,
    capacityOk: spend < GLOBAL_WEEKLY_BUDGET_USD,
  };
}

// ── the gate: call at the TOP of a metered route, before the pipeline runs ────
// Evaluating never requires an account. A userId binds to that user's weekly
// allowance; without one the run is anonymous and capped per IP. Either way the
// global budget guard applies, so the open pipeline can't be flooded. Free actions
// (compare) are never blocked. Throws a user-facing Error with a .code the route
// can branch on. Pass the client IP in ctx for the anonymous path: assertCanRun(id, action, { ip }).
export async function assertCanRun(userId, action, ctx = {}) {
  if (!METERED_ACTIONS.includes(action)) return; // compare & anything free: pass

  // global budget guard — everyone, logged-in or anonymous.
  const spend = await globalSpendUsd();
  if (spend >= GLOBAL_WEEKLY_BUDGET_USD) {
    const err = new Error("ILC is at capacity for this week — new runs open back up shortly.");
    err.code = "CAPACITY";
    throw err;
  }

  // logged-in — per-user weekly allowance (dev is unlimited).
  if (userId) {
    const plan = await getUserPlan(userId);
    if (plan.unlimited) return;
    const runs = await meteredRunsInWindow(userId);
    if (runs.length >= runsPerWeek(plan)) {
      const err = new Error("You've used your runs for this week. Your allowance refills as the week rolls forward.");
      err.code = "LIMIT";
      throw err;
    }
    return;
  }

  // anonymous — per-IP trial cap. Over it, invite sign-up (saving needs an account anyway).
  const used = await anonRunsForIp(ctx.ip || null);
  if (used >= ANON_RUNS_PER_WINDOW) {
    const err = new Error("You've used your free evaluations. Sign up to keep going — it's free during beta.");
    err.code = "ANON_LIMIT";
    throw err;
  }
}

// ── the record: call AFTER the action succeeds ───────────────────────────────
// Logs every action with its estimated cost — one row per run. Metered actions
// count against the user's allowance; free ones (compare) don't, but they're still
// logged so their cost counts toward the global budget guard. userId may be null
// for an anonymous run; pass the client IP via opts so the anonymous per-IP cap can
// see it. opts also accepts { ideaId }. Backward compatible: a null/legacy third
// argument is treated as no opts.
export async function recordRun(userId, action, opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  const est = ACTION_COST_USD[action] ?? 0;
  const { error } = await supabaseAdmin
    .from("eval_usage")
    .insert({
      user_id: userId || null,
      ip: userId ? null : (o.ip || null),
      action,
      est_cost_usd: est,
      idea_id: o.ideaId || null,
    });
  if (error) throw new Error(error.message);
}

// ── waitlist invite support ──────────────────────────────────────────────────
// Exposes the SAME trailing-window global spend the budget guard reads, so the
// "there's room again" waitlist mailer sizes its batch against real numbers and can
// never claim room the guard would then refuse. Read-only; no second capacity model.
export async function getGlobalSpendUsd() {
  return globalSpendUsd();
}