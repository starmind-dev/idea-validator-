import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: authenticate request
async function authenticate(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

// ============================================
// POST /api/profile
// Save/update user profile using admin client.
// Fixes the RLS issue where frontend anon client
// can't upsert into the profiles table.
// Body: { coding_level, ai_experience, education }
// ============================================
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const { coding_level, ai_experience, education } = body;

    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: user.id,
        coding_level: coding_level || null,
        ai_experience: ai_experience || null,
        education: education || null,
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error("Profile upsert failed:", upsertError);
      return NextResponse.json(
        { error: `Failed to save profile: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Profile save error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}