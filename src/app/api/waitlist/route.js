// src/app/api/waitlist/route.js
// Beta waitlist capture. POST-only, optional-auth (attaches user_id when a Bearer
// token is present, anonymous otherwise). Writes to public.waitlist via the
// service-role client — same server-only pattern as /api/feedback (RLS on, no
// policies, so direct client writes are denied and everything flows through here).
// A re-submit of the same email is treated as success, not a duplicate or an error.
//
// On a genuinely NEW signup it also sends a plain confirmation email via Resend.
// The send is NON-FATAL and NON-BLOCKING to correctness: if RESEND_API_KEY is unset
// (e.g. before the sending domain is verified) or the send fails, the waitlist row
// still saves and the request still returns ok. The row is load-bearing; the mail is
// best-effort. A re-submit (23505) never re-sends, so no one is emailed twice.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logEmailEvent } from "../../../lib/email-log";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = ["landing", "capacity_wall"];

// --- Sender config (the only two lines to touch to rebrand the from/reply address) ---
// FROM must be an address on a domain verified in Resend. Using the `send` sending
// subdomain keeps the root domain's Namecheap email forwarder (privacy@ / hello@)
// untouched. REPLY_TO should be a real inbox you read — hello@ forwards to your Gmail.
const MAIL_FROM = "IdeaLoop Core <emre@send.idealoopcore.com>";
const MAIL_REPLY_TO = "hello@idealoopcore.com";
const CONFIRM_SUBJECT = "You're on the IdeaLoop Core list";

function confirmText() {
  return [
    "Hey — you're on the list for the IdeaLoop Core beta.",
    "",
    "The beta runs a small number of idea loops each week, kept small on purpose so I can watch it closely. When there's room again I'll email you — nothing to do until then, and no card.",
    "",
    "If you want to tell me what you're building, or what you'd want out of it, just reply. I read every one.",
    "",
    "— Emre",
  ].join("\n");
}

function confirmHtml() {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f8;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;border:1px solid #e7e9ee;">
          <tr><td style="padding:34px 30px;">
            <p style="margin:0 0 26px;color:#8a82c2;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">IdeaLoop Core</p>
            <p style="margin:0 0 18px;color:#1a1d24;font-size:16px;line-height:1.6;">Hey — you're on the list for the IdeaLoop Core beta.</p>
            <p style="margin:0 0 18px;color:#454b57;font-size:15px;line-height:1.65;">The beta runs a small number of idea loops each week, kept small on purpose so I can watch it closely. When there's room again I'll email you — nothing to do until then, and no card.</p>
            <p style="margin:0 0 18px;color:#454b57;font-size:15px;line-height:1.65;">If you want to tell me what you're building, or what you'd want out of it, just reply. I read every one.</p>
            <p style="margin:26px 0 0;color:#1a1d24;font-size:15px;">— Emre</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Best-effort confirmation send. Never throws, never blocks correctness.
async function sendWaitlistConfirmation(email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // sender not configured yet — record it so the gap is visible, then skip
    await logEmailEvent({ kind: "confirmation", email, status: "skipped", detail: "RESEND_API_KEY unset" });
    return;
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
        subject: CONFIRM_SUBJECT,
        text: confirmText(),
        html: confirmHtml(),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("waitlist confirmation email failed:", res.status, detail);
      await logEmailEvent({ kind: "confirmation", email, status: "failed", detail: `${res.status} ${detail}` });
      return;
    }
    const data = await res.json().catch(() => ({}));
    await logEmailEvent({ kind: "confirmation", email, status: "sent", providerId: data?.id || null });
  } catch (e) {
    console.error("waitlist confirmation email error:", e);
    await logEmailEvent({ kind: "confirmation", email, status: "failed", detail: e?.message || String(e) });
  }
}

export async function POST(request) {
  try {
    let body = {};
    try { body = await request.json(); } catch (e) {}

    const email = (body.email || "").toString().trim().toLowerCase();
    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    const source = SOURCES.includes(body.source) ? body.source : null;

    // Optional auth — bind to the user when signed in, anonymous otherwise.
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const { data: authData } = token ? await supabaseAdmin.auth.getUser(token) : { data: null };
    const userId = authData?.user?.id || null;

    const { error } = await supabaseAdmin
      .from("waitlist")
      .insert({ email, source, user_id: userId });

    if (error) {
      // 23505 = unique_violation on lower(email): already on the list → success, NO re-send.
      if (error.code === "23505") return NextResponse.json({ ok: true, already: true });
      console.error("waitlist insert failed:", error);
      return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
    }

    // Genuinely new signup → send the confirmation (non-fatal, awaited so it isn't
    // killed when the serverless function returns).
    await sendWaitlistConfirmation(email);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waitlist route error:", e);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
}