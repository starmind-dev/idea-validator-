// src/app/api/waitlist/invite/route.js
// The "there's room again" waitlist mailer — the second half of the promise the
// landing makes (the first half, the confirmation, ships in ../route.js).
//
// MANUAL-FIRST by design. There are no seats: the only gate on a real run is the
// global budget guard in entitlements.js, which refuses everyone at
// GLOBAL_WEEKLY_BUDGET_USD. So "a spot opened" doesn't mean a seat freed — it means
// the trailing-7-day spend has fallen back with enough room to admit a batch
// WITHOUT re-tripping the guard on their first click. This route reads that same
// live spend (getGlobalSpendUsd) and sizes the batch against INVITE_CEILING_USD
// (below the guard, with a buffer), so a whole invited batch returning at once
// still can't cross the guard. It never emails up to the ceiling.
//
// Two modes, POST-only, bearer-protected against WAITLIST_ADMIN_SECRET:
//   { "mode": "preview" }            -> compute + return the exact batch, send NOTHING, flip NOTHING (default)
//   { "mode": "send", "limit": N }   -> email that batch (oldest-first), flip notified=true ONLY on delivered rows
// `limit` is optional and can only make a batch SMALLER (finer manual control).
//
// Ordering choice: send-then-flip, per row. A row is only marked notified after its
// email actually delivered, so a failed send is retried next run rather than being
// silently marked "notified" and dropped. Re-running is safe: notified rows are
// excluded, so no one is emailed twice.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { logEmailEvent } from "../../../../lib/email-log";
import { getGlobalSpendUsd } from "../../../../lib/services/entitlements";
import {
  GLOBAL_WEEKLY_BUDGET_USD,
  INVITE_HEADROOM_BUFFER_USD,
  INVITE_CEILING_USD,
  EST_LOOP_COST_USD,
  INVITE_MAX_BATCH,
  inviteBatchSize,
} from "../../../../lib/plans";

// --- mail config (kept identical to the confirmation send in ../route.js) --------
const MAIL_FROM = "IdeaLoop Core <emre@send.idealoopcore.com>";
const MAIL_REPLY_TO = "hello@idealoopcore.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://idealoopcore.com";
const ROOM_SUBJECT = "There's room in the IdeaLoop Core beta";

function round2(n) { return Math.round(Number(n) * 100) / 100; }

function roomText() {
  return [
    "Hey — there's room in the IdeaLoop Core beta again, and you're in.",
    "",
    "Nothing to set up and no card. Just open ILC and run an idea through a loop — take a rough one somewhere, or pressure-test one you're serious about:",
    "",
    APP_URL,
    "",
    "The beta's kept small on purpose, so if you have a minute I'd like to hear what you run and how it lands. Just reply — I read every one.",
    "",
    "— Emre",
  ].join("\n");
}

function roomHtml() {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f8;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;border:1px solid #e7e9ee;">
          <tr><td style="padding:34px 30px;">
            <p style="margin:0 0 26px;color:#8a82c2;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">IdeaLoop Core</p>
            <p style="margin:0 0 18px;color:#1a1d24;font-size:16px;line-height:1.6;">Hey — there's room in the IdeaLoop Core beta again, and you're in.</p>
            <p style="margin:0 0 24px;color:#454b57;font-size:15px;line-height:1.65;">Nothing to set up and no card. Just open ILC and run an idea through a loop — take a rough one somewhere, or pressure-test one you're serious about.</p>
            <p style="margin:0 0 26px;">
              <a href="${APP_URL}" style="display:inline-block;background:#8a82c2;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">Open IdeaLoop Core</a>
            </p>
            <p style="margin:0 0 18px;color:#454b57;font-size:15px;line-height:1.65;">The beta's kept small on purpose, so if you have a minute I'd like to hear what you run and how it lands. Just reply — I read every one.</p>
            <p style="margin:26px 0 0;color:#1a1d24;font-size:15px;">— Emre</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Best-effort per-address send. Returns true only on a delivered (2xx) response, so
// the caller flips notified=true for that row; false leaves the row for a retry.
async function sendRoomEmail(email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("invite: RESEND_API_KEY unset — cannot send");
    await logEmailEvent({ kind: "invite", email, status: "skipped", detail: "RESEND_API_KEY unset" });
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [email],
        reply_to: MAIL_REPLY_TO,
        subject: ROOM_SUBJECT,
        text: roomText(),
        html: roomHtml(),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("invite email failed:", email, res.status, detail);
      await logEmailEvent({ kind: "invite", email, status: "failed", detail: `${res.status} ${detail}` });
      return false;
    }
    const data = await res.json().catch(() => ({}));
    await logEmailEvent({ kind: "invite", email, status: "sent", providerId: data?.id || null });
    return true;
  } catch (e) {
    console.error("invite email error:", email, e);
    await logEmailEvent({ kind: "invite", email, status: "failed", detail: e?.message || String(e) });
    return false;
  }
}

// oldest-first unnotified rows, at most `n`. n<=0 -> [] without hitting the DB.
async function fetchUnnotified(n) {
  if (!n || n <= 0) return [];
  const { data, error } = await supabaseAdmin
    .from("waitlist")
    .select("id, email, created_at")
    .eq("notified", false)
    .order("created_at", { ascending: true })
    .limit(n);
  if (error) throw new Error(error.message);
  return data || [];
}

async function countUnnotified() {
  const { count, error } = await supabaseAdmin
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("notified", false);
  if (error) throw new Error(error.message);
  return count || 0;
}

function authOk(request) {
  const secret = process.env.WAITLIST_ADMIN_SECRET;
  if (!secret) return { ok: false, status: 500, msg: "Invite route not configured (set WAITLIST_ADMIN_SECRET)." };
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || token !== secret) return { ok: false, status: 401, msg: "Unauthorized." };
  return { ok: true };
}

export async function POST(request) {
  const auth = authOk(request);
  if (!auth.ok) return NextResponse.json({ error: auth.msg }, { status: auth.status });

  try {
    let body = {};
    try { body = await request.json(); } catch (e) {}

    const mode = body.mode === "send" ? "send" : "preview";
    const rawLimit = Number(body.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit >= 0 ? Math.floor(rawLimit) : null;

    // Live spend from the SAME source the guard reads — never a second model.
    const spend = await getGlobalSpendUsd();
    const byBudget = inviteBatchSize(spend);                 // clamped by ceiling + INVITE_MAX_BATCH
    const planned = limit == null ? byBudget : Math.min(byBudget, limit);

    const [batch, unnotifiedTotal] = await Promise.all([
      fetchUnnotified(planned),
      countUnnotified(),
    ]);

    const snapshot = {
      guardUsd: GLOBAL_WEEKLY_BUDGET_USD,
      bufferUsd: INVITE_HEADROOM_BUFFER_USD,
      inviteCeilingUsd: INVITE_CEILING_USD,
      estLoopCostUsd: EST_LOOP_COST_USD,
      maxBatch: INVITE_MAX_BATCH,
      spendUsd: round2(spend),
      headroomUsd: round2(Math.max(0, INVITE_CEILING_USD - spend)),
      atCapacity: spend >= GLOBAL_WEEKLY_BUDGET_USD,
      unnotifiedTotal,
    };

    if (mode === "preview") {
      return NextResponse.json({
        mode: "preview",
        ...snapshot,
        batchSize: batch.length,
        wouldEmail: batch.map((r) => ({ id: r.id, email: r.email, created_at: r.created_at })),
        note: batch.length
          ? 'Nothing sent. Re-run with {"mode":"send"} to email exactly this batch (or add "limit" to send fewer).'
          : (snapshot.atCapacity
              ? "No room right now — spend is at the guard. Try again once it falls back."
              : "No unnotified signups to invite."),
      });
    }

    // mode === "send"
    if (!batch.length) {
      return NextResponse.json({
        mode: "send", ...snapshot, batchSize: 0, sent: 0, emailed: [], failed: [],
        note: snapshot.atCapacity ? "No room right now — nothing sent." : "No one to invite — nothing sent.",
      });
    }

    const results = await Promise.all(
      batch.map(async (r) => ({ id: r.id, email: r.email, ok: await sendRoomEmail(r.email) }))
    );
    const delivered = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    // Flip notified=true ONLY for rows that actually delivered.
    if (delivered.length) {
      const { error } = await supabaseAdmin
        .from("waitlist")
        .update({ notified: true })
        .in("id", delivered.map((r) => r.id));
      if (error) {
        // Emails went out but the flip failed — surface loudly so it can be fixed
        // before the next run (which would otherwise re-email these rows).
        console.error("invite: notified flip failed after send:", error, delivered.map((r) => r.email));
        return NextResponse.json({
          error: "Emails sent but the notified flag failed to update — do NOT re-run until fixed, or these rows re-send.",
          emailed: delivered.map((r) => r.email),
          failed: failed.map((r) => r.email),
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      mode: "send",
      ...snapshot,
      batchSize: batch.length,
      sent: delivered.length,
      emailed: delivered.map((r) => r.email),
      failed: failed.map((r) => r.email),
      remainingUnnotified: Math.max(0, unnotifiedTotal - delivered.length),
      note: failed.length
        ? "Some sends failed and were left unnotified — they'll be picked up on the next run."
        : "Batch sent and marked notified.",
    });
  } catch (e) {
    console.error("invite route error:", e);
    return NextResponse.json({ error: "Invite run failed. Check logs." }, { status: 500 });
  }
}