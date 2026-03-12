import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // ------------------------------------------------
    // 1. Authenticate
    // ------------------------------------------------
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    // ------------------------------------------------
    // 2. Fetch ideas with their latest evaluation scores
    // ------------------------------------------------
    const { data: ideas, error: fetchError } = await supabaseAdmin
      .from("ideas")
      .select(`
        id,
        title,
        raw_idea_text,
        profile_context_json,
        status,
        created_at,
        updated_at,
        evaluations (
          id,
          weighted_overall_score,
          market_demand_score,
          monetization_score,
          originality_score,
          technical_complexity_score,
          classification,
          data_source,
          summary_text,
          roadmap_json,
          created_at
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Fetch ideas failed:", fetchError);
      return NextResponse.json(
        { error: `Failed to load ideas: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 3. Fetch progress for all evaluations
    // ------------------------------------------------
    const evaluationIds = (ideas || [])
      .flatMap((idea) => (idea.evaluations || []).map((e) => e.id))
      .filter(Boolean);

    let progressMap = {};
    if (evaluationIds.length > 0) {
      const { data: progressRows, error: progressError } = await supabaseAdmin
        .from("progress")
        .select("evaluation_id, phase_key, completed")
        .eq("user_id", user.id)
        .in("evaluation_id", evaluationIds);

      if (!progressError && progressRows) {
        // Build a map: evaluation_id -> { completed: N, total: N, completed_phases: ["phase_1", "phase_3"] }
        progressRows.forEach((row) => {
          if (!progressMap[row.evaluation_id]) {
            progressMap[row.evaluation_id] = { completed: 0, total: 0, completed_phases: [] };
          }
          progressMap[row.evaluation_id].total++;
          if (row.completed) {
            progressMap[row.evaluation_id].completed++;
            progressMap[row.evaluation_id].completed_phases.push(row.phase_key);
          }
        });
      }
    }

    // ------------------------------------------------
    // 4. Attach progress + total phases to each idea
    // ------------------------------------------------
    const ideasWithProgress = (ideas || []).map((idea) => {
      const eval_ = idea.evaluations?.[0];
      const totalPhases = eval_?.roadmap_json?.length || 0;
      const evalProgress = eval_ ? progressMap[eval_.id] : null;

      return {
        ...idea,
        progress: {
          completed: evalProgress?.completed || 0,
          total_phases: totalPhases,
          has_progress: (evalProgress?.total || 0) > 0,
          completed_phases: evalProgress?.completed_phases || [],
        },
      };
    });

    return NextResponse.json({
      ideas: ideasWithProgress,
      count: ideasWithProgress.length,
    });
  } catch (err) {
    console.error("List ideas error:", err);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}