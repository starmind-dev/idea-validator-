// src/app/api/account/delete/route.js
//
// KVKK/GDPR erasure endpoint. Thin: authenticate the CALLER from the verified
// bearer token, then delegate to the account service — which erases ONLY that
// caller's own account and data. The user id comes from the TOKEN, never from
// the request body, so no one can delete another person's account.
//
//   POST /api/account/delete  ->  { ok: true }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { deleteAccount } from "../../../../lib/services/account";

async function authUser(request) {
  const h = request.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(h.replace("Bearer ", ""));
  return error ? null : user;
}

export async function POST(request) {
  try {
    const user = await authUser(request);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    await deleteAccount(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/delete error:", err);
    return NextResponse.json({ error: err.message || "Could not delete account." }, { status: 500 });
  }
}