import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FREE_TIER_IDEA_LIMIT = 5;

export async function POST(request) {
  try {
    // ------------------------------------------------
    // 1. Authenticate
    // ------------------------------------------------
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in to save ideas." },
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
        { error: "Invalid session. Please log in again." },
        { status: 401 }
      );
    }

    // ------------------------------------------------
    // 2. Parse request body
    // ------------------------------------------------
    const body = await request.json();
    const { idea_text, idea_name, profile, analysis } = body;

    if (!idea_text || !analysis) {
      return NextResponse.json(
        { error: "Missing required data (idea_text, analysis)." },
        { status: 400 }
      );
    }

    // ------------------------------------------------
    // 3. Check free tier limit: 5 saved ideas total
    // ------------------------------------------------
    const { count, error: countError } = await supabaseAdmin
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (countError) {
      console.error("Count check failed:", countError);
      return NextResponse.json(
        { error: `Failed to check saved ideas count: ${countError.message}` },
        { status: 500 }
      );
    }

    if (count >= FREE_TIER_IDEA_LIMIT) {
      return NextResponse.json(
        {
          error: `You've reached the free tier limit of ${FREE_TIER_IDEA_LIMIT} saved ideas.`,
          limit_reached: true,
          saved_count: count,
        },
        { status: 403 }
      );
    }

    // ------------------------------------------------
    // 4. Determine title: use user-provided name, fall back to auto-derive
    // ------------------------------------------------
    const deriveTitle = (text) => {
      const firstSentence = text.split(/[.!?\n]/)[0].trim();
      if (firstSentence.length <= 80) return firstSentence;
      return firstSentence.substring(0, 77) + "...";
    };

    const title = idea_name && idea_name.trim()
      ? idea_name.trim().substring(0, 80)
      : deriveTitle(idea_text);

    // ------------------------------------------------
    // 5. Insert idea row
    // ------------------------------------------------
    const { data: ideaRow, error: ideaError } = await supabaseAdmin
      .from("ideas")
      .insert({
        user_id: user.id,
        title,
        raw_idea_text: idea_text,
        profile_context_json: profile || {},
        status: "active",
      })
      .select("id")
      .single();

    if (ideaError) {
      console.error("Idea insert failed:", ideaError);
      return NextResponse.json(
        { error: `Failed to save idea: ${ideaError.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 6. Insert evaluation row
    // ------------------------------------------------
    const eval_ = analysis.evaluation;

    const { data: evalRow, error: evalError } = await supabaseAdmin
      .from("evaluations")
      .insert({
        idea_id: ideaRow.id,
        user_id: user.id,
        evaluation_mode: "single_call",
        prompt_version: "v2",
        search_strategy_version: "v2_multi_query",
        score_formula_version: "v2_weighted",
        keywords_used: analysis._meta?.keywords_used || [],
        evidence_json: analysis._meta || {},
        meta_json: analysis._meta || {},
        competitors_json: analysis.competition?.competitors || [],
        competition_summary: analysis.competition?.differentiation || null,
        data_source: analysis.competition?.data_source || "llm_generated",
        classification: analysis.classification || "commercial",
        scope_warning: analysis.scope_warning || false,
        scoring_json: {
          market_demand: eval_.market_demand,
          monetization: eval_.monetization,
          originality: eval_.originality,
          technical_complexity: eval_.technical_complexity,
          marketplace_note: eval_.marketplace_note || null,
        },
        roadmap_json: analysis.phases || [],
        tools_json: analysis.tools || [],
        estimates_json: analysis.estimates || {},
        market_demand_score: eval_.market_demand?.score || 0,
        originality_score: eval_.originality?.score || 0,
        monetization_score: eval_.monetization?.score || 0,
        technical_complexity_score: eval_.technical_complexity?.score || 0,
        weighted_overall_score: eval_.overall_score || 0,
        summary_text: eval_.summary || "",
      })
      .select("id")
      .single();

    if (evalError) {
      // Rollback: delete the idea row if evaluation insert fails
      await supabaseAdmin.from("ideas").delete().eq("id", ideaRow.id);
      console.error("Evaluation insert failed:", evalError);
      return NextResponse.json(
        { error: `Failed to save evaluation: ${evalError.message}` },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 7. Return success with both IDs
    // ------------------------------------------------
    return NextResponse.json({
      success: true,
      idea_id: ideaRow.id,
      evaluation_id: evalRow.id,
      saved_count: count + 1,
      remaining: FREE_TIER_IDEA_LIMIT - (count + 1),
    });
  } catch (err) {
    console.error("Save idea error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}