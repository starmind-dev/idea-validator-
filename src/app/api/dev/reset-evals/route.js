import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// POST /api/dev/reset-evals?key=YOUR_SECRET
// Resets eval usage for the logged-in user.
// Only works if the secret key matches.
// ============================================
export async function POST(request) {
  // Check secret key
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key !== process.env.DEV_SECRET_KEY) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  // Delete all eval_usage rows for this user
  const { error: deleteError } = await supabaseAdmin
    .from("eval_usage")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: `Reset failed: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Eval usage reset. Refresh the page.",
  });
}