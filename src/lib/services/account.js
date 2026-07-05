// src/lib/services/account.js
//
// ACCOUNT LIFECYCLE — the KVKK/GDPR "right to erasure" verb.
// SERVER ONLY — uses the service-role client (bypasses RLS). Never import from
// a client component.
//
// deleteAccount(userId, email) permanently erases a user and ALL their data.
//
// MOST of the erasure is done by the DATABASE, not this code: every user-owned
// table's foreign key to profiles / auth.users is ON DELETE CASCADE, so deleting
// the auth user removes profiles + ideas + evaluations + progress + eval_usage +
// folders + activity + signals + read_history automatically.
//
// THREE tables are NOT covered by that cascade — their FK to auth.users is
// SET NULL (or absent), so the row would SURVIVE with personal data in it. We
// delete those explicitly, by user_id AND by email, BEFORE the auth delete
// (once auth.users is gone, user_id is nulled and can no longer be matched):
//     • feedback      — reply_email (+ user_id)
//     • waitlist      — email       (+ user_id)
//     • email_events  — email       (no FK at all)
//
// stage2b_qc_events is intentionally RETAINED: anonymous engine QC telemetry
// (no name / no email), pseudonymous once the account is gone.

import { supabaseAdmin } from "../supabase-admin";

// Optional safety net: comma-separated user IDs that may NEVER be deleted
// (e.g. your own dev account while testing). Set PROTECTED_USER_IDS in env to
// make it impossible to nuke a protected account through this route.
const PROTECTED = (process.env.PROTECTED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Await a delete builder and turn a Supabase error into a thrown one, so a
// partial/failed purge can NEVER be reported to the user as a success.
async function purge(builder, label) {
  const { error } = await builder;
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function deleteAccount(userId, email) {
  if (!userId) throw new Error("No user id.");
  if (PROTECTED.includes(userId)) {
    throw new Error("This account is protected from deletion.");
  }

  // 1) Purge the three PII-bearing tables the cascade does NOT reach. Done
  //    FIRST, while user_id still resolves. By user_id and (if present) by email
  //    — the email match also catches anonymous rows they left (e.g. feedback
  //    with a reply_email, a pre-signup waitlist entry).
  await purge(supabaseAdmin.from("feedback").delete().eq("user_id", userId), "feedback(user)");
  await purge(supabaseAdmin.from("waitlist").delete().eq("user_id", userId), "waitlist(user)");
  if (email) {
    await purge(supabaseAdmin.from("feedback").delete().eq("reply_email", email), "feedback(email)");
    await purge(supabaseAdmin.from("waitlist").delete().eq("email", email), "waitlist(email)");
    await purge(supabaseAdmin.from("email_events").delete().eq("email", email), "email_events(email)");
  }

  // 2) Delete the auth user. This CASCADES through profiles to every user-owned
  //    table (ideas, evaluations, progress, eval_usage, folders, activity,
  //    signals, read_history) via the ON DELETE CASCADE foreign keys.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`auth.deleteUser: ${error.message}`);

  // 3) OPTIONAL follow-up (not wired): a "your account and data have been
  //    deleted" confirmation email. Drop your existing Resend helper here,
  //    best-effort / non-fatal, once you want it. The `email` is still in scope.

  return { ok: true };
}