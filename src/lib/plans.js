// src/lib/plans.js
// Single source of truth for plans, allowances, metering weights, and the global
// budget guard. Everything money- or allowance-shaped reads from here — the
// entitlements service, the eval-usage route, My Plan, the waitlist invite gate,
// and (later) the landing pricing + the Polar webhook. Keeping it in one config is
// what stops the landing numbers and the real entitlement model from drifting apart
// (the pricing-reconciliation trust-blocker): reconcile here, once, and everything
// else reads it.

// A "loop" is the unit users think in (Explore -> Deep -> Re-evaluate -> Compare).
// The meter counts "runs": the three evaluation actions. Compare is always free —
// it's cheap and it's the payoff of the loop, so it never costs a user a run.
export const METERED_ACTIONS = ["explore", "deep", "reeval"];
export const RUNS_PER_LOOP = METERED_ACTIONS.length; // 3

// ── cost model (USD, per action) ─────────────────────────────────────────────
// The guard meters on ACTION_COST_USD below. It's split into its two real parts so
// each can be re-measured independently and neither is a black box.

// (1) LLM cost — Anthropic tokens only. Measured 2026-07-01 on 3–4k-word inputs
// (the heavy end of the curve; a short idea runs cheaper).
export const ACTION_LLM_USD = { explore: 0.25, deep: 0.75, reeval: 0.85, compare: 0.06 };

// (2) Retrieval cost — the four-source Stage 1 fan-out that every eval fires:
// 2× Tavily + 2× Exa + 2× Serper + 2× GitHub(free). Derived from published API
// rates (2026-07-02), rounded UP to the advanced-Tavily worst case so the guard
// errs toward stopping early, never late: Tavily ~$0.032 + Exa ~$0.014 + Serper
// ~$0.002 ≈ $0.05/eval. Compare fires NO retrieval (it reads two finished
// analyses), so its retrieval is 0. Explore/Deep/Re-eval all run the same Stage 1,
// so they carry the same retrieval cost.
export const ACTION_RETRIEVAL_USD = { explore: 0.05, deep: 0.05, reeval: 0.05, compare: 0 };

// All-in estimated cost per action = LLM + retrieval. This is the real money a run
// spends and the ONLY thing the global budget guard meters on. Never shown to
// users. recordRun() writes this into eval_usage.est_cost_usd, so folding retrieval
// in here is what makes the guard honest — before this it under-counted by ~$0.05
// a run (LLM-only). Re-measure and tune the two parts above as inputs vary.
export const ACTION_COST_USD = {
  explore: ACTION_LLM_USD.explore + ACTION_RETRIEVAL_USD.explore, // 0.30
  deep:    ACTION_LLM_USD.deep    + ACTION_RETRIEVAL_USD.deep,    // 0.80
  reeval:  ACTION_LLM_USD.reeval  + ACTION_RETRIEVAL_USD.reeval,  // 0.90
  compare: ACTION_LLM_USD.compare + ACTION_RETRIEVAL_USD.compare, // 0.06
};

// The hard money guarantee. If estimated spend across ALL users in any trailing
// 7-day window crosses this, new runs are refused until it falls back under. This
// is what actually protects your bank account in beta — not the per-user allowance.
// It meters the ALL-IN est_cost_usd (LLM + retrieval), so Tavily / Exa / Serper are
// ALREADY counted here — not just Anthropic tokens.
//
// $175/week ceiling (trimmed from $200): a deliberate hedge on the two things the
// per-run number can't see — (a) that $0.05 retrieval figure is rounded to a
// worst-case single eval and can run hotter, and (b) the FIXED monthly tool
// subscriptions (Serper / Exa / Tavily plans) aren't in a per-run guard at all. The
// guard is also check-then-act: a run in flight when the check passes can nudge
// actual spend a run or two ($0.30–0.90) over, so the trim doubles as overshoot
// headroom. Tune to whatever you're willing to eat per week.
export const GLOBAL_WEEKLY_BUDGET_USD = 175;

// ── waitlist invite gate (the "there's room again" mailer) ───────────────────
// The invite mailer NEVER emails up to the guard. It plans against a LOWER ceiling
// and leaves a buffer, so a whole invited batch returning at once still can't cross
// the guard and hand new arrivals a CAPACITY wall on their first run — the "there's
// room" email would become a lie the moment it was believed. Invites are sized
// against INVITE_CEILING_USD, never GLOBAL_WEEKLY_BUDGET_USD. The buffer is the
// hysteresis: it also stops the gate flapping open/shut right at the ceiling.
export const INVITE_HEADROOM_BUFFER_USD = 25;
export const INVITE_CEILING_USD = GLOBAL_WEEKLY_BUDGET_USD - INVITE_HEADROOM_BUFFER_USD; // 150

// One invited person is assumed to run one full loop (explore + deep + reeval).
// Derived from the same cost model so it stays honest if the per-action costs move.
export const EST_LOOP_COST_USD =
  ACTION_COST_USD.explore + ACTION_COST_USD.deep + ACTION_COST_USD.reeval; // 2.00

// Hard cap on a SINGLE manual send, regardless of how much headroom exists — keeps
// the beta "small on purpose" and every batch eyeball-reviewable. To let more in,
// run the invite again: it re-reads live headroom each time, so repeated small
// sends drip invites in without ever over-committing the budget in one shot.
export const INVITE_MAX_BATCH = 20;

// Rolling window — NOT a calendar week. Each run ages out 7 days after it ran, so
// allowances refill smoothly instead of every user refreshing at once (which would
// stampede the global guard every Monday morning).
export const USAGE_WINDOW_DAYS = 7;

// Evaluating never requires an account — it's the hook; SAVING an idea requires
// sign-up. Anonymous runs are capped per IP in the rolling window so the open
// pipeline can't be flooded, and (like every run) they count against the global
// budget above. Tunable: raise for a more generous trial, lower to spend less on
// people who never sign up.
export const ANON_RUNS_PER_WINDOW = 1;

// profiles.plan_type maps to one of these. 'free' is the beta default (already the
// column default). 'dev' bypasses every cap. Paid plans slot in here at the
// beta->paid step; the Polar webhook just sets profiles.plan_type to one of these
// ids — nothing else changes. Prices stay null until reconciled: no invented
// numbers ship from this file.
//
// Beta allowance lever: 'free' is 1 loop (3 runs) per rolling 7 days. The GLOBAL
// guard above is your real financial floor; this per-user number only controls
// fairness. Leave it at 1 unless the guard starts tripping every week well before
// the window closes — only then throttle (drop to a shorter allowance / longer
// window). Don't pre-throttle for a crowd that may not come.
export const PLANS = {
  free: { id: "free", label: "Beta",      weeklyLoops: 1,    price: null, unlimited: false },
  dev:  { id: "dev",  label: "Developer", weeklyLoops: null, price: null, unlimited: true  },
  // paid: { id: "paid", label: "...", weeklyLoops: N, price: <reconciled>, unlimited: false },
};

export function getPlan(planType) {
  return PLANS[planType] || PLANS.free;
}

// Metered runs allowed per rolling window for a plan. Infinity for unlimited plans.
export function runsPerWeek(plan) {
  if (!plan || plan.unlimited) return Infinity;
  return (plan.weeklyLoops || 0) * RUNS_PER_LOOP;
}

// Batch size the invite gate would send at a given live global spend: fill the
// headroom up to INVITE_CEILING_USD in whole loops, clamped to the manual cap.
// Returns 0 when there's no room. Pure function of the constants above — the route
// reads live spend, this turns it into a count. Never returns a batch that, if it
// all came back and ran a full loop, could push spend past the guard.
export function inviteBatchSize(spendUsd) {
  const headroom = INVITE_CEILING_USD - (Number(spendUsd) || 0);
  const byBudget = Math.floor(headroom / EST_LOOP_COST_USD);
  return Math.max(0, Math.min(byBudget, INVITE_MAX_BATCH));
}