// src/lib/email-log.js
// One tiny, best-effort logger for every transactional email attempt. Both the
// confirmation send (api/waitlist) and the invite send (api/waitlist/invite) call this
// after each attempt, so email delivery — which used to be visible only in Resend and
// Vercel logs — becomes a row in Supabase: readable on the /admin dashboard AND
// queryable directly. Logging is NON-FATAL by contract: it must never break a send or a
// request, so any failure here is swallowed after a console.error.
import { supabaseAdmin } from "./supabase-admin";

// kind:   "confirmation" | "invite"
// status: "sent" | "failed" | "skipped"
export async function logEmailEvent({ kind, email, status, detail = null, providerId = null }) {
  try {
    await supabaseAdmin.from("email_events").insert({
      kind,
      email,
      status,
      detail: detail == null ? null : String(detail).slice(0, 500),
      provider_id: providerId,
    });
  } catch (e) {
    console.error("email_events log failed:", e);
  }
}