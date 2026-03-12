import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EVAL_LIMIT = 3;
const EVAL_WINDOW_DAYS = 7;

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
// GET /api/eval-usage
// Returns how many evaluations the user has remaining
// in the current rolling 7-day window.
// ============================================
export async function GET(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const cutoff = new Date(Date.now() - EVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from("eval_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("evaluated_at", cutoff);

    if (countError) {
      console.error("Eval usage count failed:", countError);
      return NextResponse.json(
        { error: `Failed to check eval usage: ${countError.message}` },
        { status: 500 }
      );
    }

    const used = count || 0;
    const remaining = Math.max(0, EVAL_LIMIT - used);

    // Find when the oldest eval in window expires (for "next slot opens in" display)
    let nextResetTime = null;
    if (remaining === 0) {
      const { data: oldest, error: oldestError } = await supabaseAdmin
        .from("eval_usage")
        .select("evaluated_at")
        .eq("user_id", user.id)
        .gte("evaluated_at", cutoff)
        .order("evaluated_at", { ascending: true })
        .limit(1)
        .single();

      if (!oldestError && oldest) {
        const expiresAt = new Date(new Date(oldest.evaluated_at).getTime() + EVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        nextResetTime = expiresAt.toISOString();
      }
    }

    return NextResponse.json({
      used,
      remaining,
      limit: EVAL_LIMIT,
      window_days: EVAL_WINDOW_DAYS,
      next_reset_time: nextResetTime,
    });
  } catch (err) {
    console.error("Eval usage error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ============================================
// POST /api/eval-usage
// Record that the user used one evaluation.
// Called after a successful evaluation completes.
// Returns updated remaining count.
// ============================================
export async function POST(request) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Check if they're already at the limit before recording
    const cutoff = new Date(Date.now() - EVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { count: currentCount, error: countError } = await supabaseAdmin
      .from("eval_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("evaluated_at", cutoff);

    if (countError) {
      console.error("Eval usage pre-check failed:", countError);
      // Don't block the eval - just log and continue
    }

    // Insert the new usage record
    const { error: insertError } = await supabaseAdmin
      .from("eval_usage")
      .insert({
        user_id: user.id,
        evaluated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Eval usage insert failed:", insertError);
      return NextResponse.json(
        { error: `Failed to record eval usage: ${insertError.message}` },
        { status: 500 }
      );
    }

    const used = (currentCount || 0) + 1;
    const remaining = Math.max(0, EVAL_LIMIT - used);

    return NextResponse.json({
      success: true,
      used,
      remaining,
      limit: EVAL_LIMIT,
    });
  } catch (err) {
    console.error("Record eval usage error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}