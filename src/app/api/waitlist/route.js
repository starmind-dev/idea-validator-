// src/app/api/waitlist/route.js
// Beta waitlist capture. POST-only, optional-auth (attaches user_id when a Bearer
// token is present, anonymous otherwise). Writes to public.waitlist via the
// service-role client — same server-only pattern as /api/feedback (RLS on, no
// policies, so direct client writes are denied and everything flows through here).
// A re-submit of the same email is treated as success, not a duplicate or an error.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = ["landing", "capacity_wall"];

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
      // 23505 = unique_violation on lower(email): already on the list → success.
      if (error.code === "23505") return NextResponse.json({ ok: true, already: true });
      console.error("waitlist insert failed:", error);
      return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("waitlist route error:", e);
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
  }
}