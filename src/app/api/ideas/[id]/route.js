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
// GET /api/ideas/[id] — Load full idea + evaluation
// Returns the reconstructed analysis object that page.js renders.
// Fetches the LATEST evaluation for this idea (supports future
// re-evaluation where one idea has multiple evaluation snapshots).
// Now also returns evaluation_id for progress tracking.
// ============================================
export async function GET(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: ideaId } = await params;

    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    // Fetch idea — must belong to this user
    const { data: idea, error: ideaError } = await supabaseAdmin
      .from("ideas")
      .select("id, title, raw_idea_text, profile_context_json, status, created_at")
      .eq("id", ideaId)
      .eq("user_id", user.id)
      .single();

    if (ideaError || !idea) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }

    // Fetch latest evaluation for this idea
    const { data: evaluation, error: evalError } = await supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("idea_id", ideaId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
    }

    // Reconstruct the analysis object in the exact shape page.js expects.
    const analysis = {
      evaluation: {
        overall_score: evaluation.weighted_overall_score,
        market_demand: evaluation.scoring_json?.market_demand || {
          score: evaluation.market_demand_score,
          explanation: "",
        },
        monetization: evaluation.scoring_json?.monetization || {
          score: evaluation.monetization_score,
          explanation: "",
        },
        originality: evaluation.scoring_json?.originality || {
          score: evaluation.originality_score,
          explanation: "",
        },
        technical_complexity: evaluation.scoring_json?.technical_complexity || {
          score: evaluation.technical_complexity_score,
          explanation: "",
        },
        marketplace_note: evaluation.scoring_json?.marketplace_note || null,
        summary: evaluation.summary_text || "",
      },
      competition: {
        competitors: evaluation.competitors_json || [],
        differentiation: evaluation.competition_summary || "",
        data_source: evaluation.data_source || "llm_generated",
      },
      phases: evaluation.roadmap_json || [],
      tools: evaluation.tools_json || [],
      estimates: evaluation.estimates_json || {},
      classification: evaluation.classification || "commercial",
      scope_warning: evaluation.scope_warning || false,
      _meta: evaluation.meta_json || {},
    };

    return NextResponse.json({
      idea,
      analysis,
      evaluation_id: evaluation.id,
      profile: idea.profile_context_json || {},
    });
  } catch (err) {
    console.error("Get idea error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ============================================
// DELETE /api/ideas/[id] — Soft-delete (archive) an idea
// ============================================
export async function DELETE(request, { params }) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id: ideaId } = await params;

    if (!ideaId) {
      return NextResponse.json({ error: "Missing idea ID." }, { status: 400 });
    }

    // Soft delete: set status to 'archived'
    const { error: archiveError } = await supabaseAdmin
      .from("ideas")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", ideaId)
      .eq("user_id", user.id);

    if (archiveError) {
      return NextResponse.json(
        { error: `Failed to archive: ${archiveError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Archive idea error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}