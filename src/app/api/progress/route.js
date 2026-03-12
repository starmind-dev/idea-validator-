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
// GET /api/progress?evaluation_id=xxx
// Load all progress rows for a given evaluation.
// Returns an object keyed by phase_key for easy lookup.
// ============================================
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const evaluationId = searchParams.get("evaluation_id");

    if (!evaluationId) {
      return NextResponse.json({ error: "Missing evaluation_id." }, { status: 400 });
    }

    const { data: rows, error: fetchError } = await supabaseAdmin
      .from("progress")
      .select("id, phase_key, completed, completed_at, note")
      .eq("evaluation_id", evaluationId)
      .eq("user_id", user.id);

    if (fetchError) {
      console.error("Fetch progress failed:", fetchError);
      return NextResponse.json(
        { error: `Failed to load progress: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Convert to object keyed by phase_key for easy frontend lookup
    const progress = {};
    (rows || []).forEach((row) => {
      progress[row.phase_key] = {
        id: row.id,
        completed: row.completed,
        completed_at: row.completed_at,
        note: row.note || "",
      };
    });

    return NextResponse.json({ progress });
  } catch (err) {
    console.error("Get progress error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ============================================
// PATCH /api/progress
// Upsert a progress row: toggle completed or update note.
// Body: { evaluation_id, idea_id, phase_key, completed?, note? }
//
// Uses upsert with the unique constraint (user_id, evaluation_id, phase_key).
// Only updates the fields provided.
// ============================================
export async function PATCH(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const { evaluation_id, idea_id, phase_key, completed, note } = body;

    if (!evaluation_id || !idea_id || !phase_key) {
      return NextResponse.json(
        { error: "Missing required fields (evaluation_id, idea_id, phase_key)." },
        { status: 400 }
      );
    }

    // Verify this evaluation belongs to the user
    const { data: evalRow, error: evalCheckError } = await supabaseAdmin
      .from("evaluations")
      .select("id")
      .eq("id", evaluation_id)
      .eq("user_id", user.id)
      .single();

    if (evalCheckError || !evalRow) {
      return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
    }

    // Build the upsert payload
    const upsertData = {
      user_id: user.id,
      idea_id,
      evaluation_id,
      phase_key,
    };

    if (typeof completed === "boolean") {
      upsertData.completed = completed;
      upsertData.completed_at = completed ? new Date().toISOString() : null;
    }

    if (typeof note === "string") {
      upsertData.note = note;
    }

    // Upsert: if a row with (user_id, evaluation_id, phase_key) exists, update it.
    // Otherwise, insert a new row.
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("progress")
      .upsert(upsertData, {
        onConflict: "user_id,evaluation_id,phase_key",
      })
      .select("id, phase_key, completed, completed_at, note")
      .single();

    if (upsertError) {
      console.error("Progress upsert failed:", upsertError);
      return NextResponse.json(
        { error: `Failed to update progress: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      progress: {
        id: upserted.id,
        phase_key: upserted.phase_key,
        completed: upserted.completed,
        completed_at: upserted.completed_at,
        note: upserted.note || "",
      },
    });
  } catch (err) {
    console.error("Update progress error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}