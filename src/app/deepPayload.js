// deepPayload.js — the Deep Analysis state contract, in one place.
//
// WHY THIS FILE EXISTS
// The renderer must never decide a state. It renders what this normalizer
// resolves. Every state carries an `authority` so a reviewer can ask of any
// figure on the page: who decided this? Four values, from the round-4 brief:
//
//   "backend"       — the engine commits the field. Render it.
//   "deterministic" — computed from committed data by a mechanical rule stated
//                     here in code. No judgment.
//   "debt"          — the design wants it; the engine does not commit it yet.
//                     We render the DEGRADE state, never the target state.
//                     A debt says the page is INCOMPLETE without the field.
//   "candidate"     — consciously deferred, condition-triggered. The page is
//                     COMPLETE without it; building it awaits real-eval
//                     evidence that its absence costs understanding. Renders
//                     identically to debt (the degrade state) but is not owed.
//   "forbidden"     — would require the frontend to author analysis. Never
//                     rendered. Present here only as an explicit refusal.
//
// SHAPE TOLERANCE
// route.js streams  { classification, competition, estimates, evaluation, _pro }
// the DB persists   { scoring_json, estimates_json, competitors_json, ... }
// Both arrive here. Nothing downstream should know which one it got.
//
// DOCTRINE NOTE (open amendment): prompt-stage-or.js and route.js both still
// state that the frontend never reads `_internal`. V5.11 already broke that,
// and this file depends on it structurally (archetype -> rung, components ->
// cap, binding_* -> duels). Until the NarrativeContract is amended, treat every
// `_internal` read here as contract-fragile: an enum rename upstream degrades
// the ladder silently. Every lookup below therefore fails soft to null and the
// renderer must handle a null rung — it must never crash and never guess.
//
// V2 additions (chunk 1):
//   - `risks`        one unified ledger closing III — all threat agents.
//   - `notes`        per-metric geographic/trajectory notes.
//   - `internal`     raw _internal passed through per finding, so SourcesStrip
//                    can resolve its evidence trail without a second unpack.
//   - `competitors`  raw Stage 1 array at top level (SourcesStrip's resolver
//                    takes it as the shared evidence reference).
//   - `WT_ANCHORS`   the change-walkthrough anchor keys, named once here so the
//                    markers can be mounted mechanically when their homes are
//                    decided. Nothing is placed yet.
//
// V2.1 (2026-07-19, payload-only, display-neutral):
//   - `anchorState`  four-value anchor COVERAGE state per finding, splitting
//                    "measured and qualified" from "never measured." See the
//                    block in buildFinding. `anchorStatus` is unchanged in
//                    meaning and null-ness; no renderer behaviour moves until
//                    the not-measured display is designed and approved.

// ---------------------------------------------------------------- ladders ----
// Archetype enums -> rung position. Transcribed from the scorer prompts.
// MD: 7 rungs (prompt-stage-md.js). MO / OR: 6 rungs on an identical grid.

export const MD_LADDER = {
  speculative_need:                            { rung: 1, label: "Speculative need" },
  category_validated_entrant_unspecific:       { rung: 2, label: "Category-validated, unspecific demand" },
  clear_pain_weak_pull:                        { rung: 3, label: "Clear pain, weak pull" },
  specific_buyer_unresolved_adoption_friction: { rung: 4, label: "Specific buyer, unresolved friction" },
  specific_buyer_with_active_trigger:          { rung: 5, label: "Specific buyer, active trigger" },
  demonstrated_pull_with_friction_survival:    { rung: 6, label: "Demonstrated pull, friction survived" },
  demonstrated_pull_with_capturable_density:   { rung: 7, label: "Demonstrated pull, capturable density" },
};

export const MO_LADDER = {
  insufficient_evidence:        { rung: 1, label: "Insufficient payment evidence" },
  founder_articulated:          { rung: 2, label: "Founder-stated model" },
  category_grounded:            { rung: 3, label: "Category-level evidence" },
  partial_segment_grounded:     { rung: 4, label: "Partial segment evidence" },
  direct_precedent_grounded:    { rung: 5, label: "Comparable priced precedent" },
  sustained_adoption_evidenced: { rung: 6, label: "Sustained paid adoption" },
};

export const OR_LADDER = {
  no_defensibility_component:     { rung: 1, label: "No defensibility component" },
  articulated_defensibility:      { rung: 2, label: "Articulated defensibility" },
  emerging_defensibility:         { rung: 3, label: "Emerging defensibility" },
  established_defensibility:      { rung: 4, label: "Established defensibility" },
  sustained_defensibility:        { rung: 5, label: "Sustained defensibility" },
  self_reinforcing_defensibility: { rung: 6, label: "Self-reinforcing defensibility" },
};

const LADDERS = {
  market_demand: { map: MD_LADDER, of: 7, key: "demand_archetype" },
  monetization:  { map: MO_LADDER, of: 6, key: "monetization_archetype" },
  originality:   { map: OR_LADDER, of: 6, key: "originality_archetype" },
};

export const METRIC_KEYS = ["market_demand", "monetization", "originality"];

// Stage 3's locked 8-value bottleneck enum (prompt-stage3.js, V9.7).
export const BOTTLENECK_ENUM = [
  "Specification", "Technical build", "Distribution", "Buyer access",
  "Trust/credibility", "Compliance", "Capital/runway", "Data acquisition",
];

// Only ONE of the eight is a build wall. This single fact drives Ⅳ's
// relationship state, so it is stated once, here.
const TECHNICAL_BOTTLENECK = "Technical build";

// --------------------------------------------------- walkthrough anchor keys --
// walkthroughData.anchors is a bundle keyed by these names. The old surface had
// one titled card per anchor, so each ChangeMarker had an obvious host. The new
// page deleted those titles deliberately, so `verdict` and `overall` mount
// cleanly and the rest need a design decision about where a "this changed"
// marker belongs on a page whose argument is that the evidence moved.
// Named here so wiring is mechanical once those homes are chosen.
export const WT_ANCHORS = {
  verdict: "verdict",                            // -> I headline        (placeable)
  overall: "overall",                            // -> I composite       (placeable)
  market_demand: "market_demand",                // -> II                (home TBD)
  monetization: "monetization",                  // -> II                (home TBD)
  originality: "originality",                    // -> II                (home TBD)
  technical_complexity: "technical_complexity",  // -> IV readout        (home TBD)
  mb: "mb",                                      // -> IV readout        (home TBD)
  risks: "risks",                                // -> III "What could break this" ledger
  compare: "compare",                            // -> comparison view, not this page
};

// ------------------------------------------------------------------ utils ----
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
import { validateHinge, deriveHingeShape, isMergedDoor } from "../lib/contracts/hinge";

const txt = (v) => (typeof v === "string" && v.trim().length ? v.trim() : null);
const arr = (v) => (Array.isArray(v) ? v : []);

const humanise = (s) =>
  typeof s === "string" && s.length
    ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : null;

// --------------------------------------------------------------- shape ------
// Accept the live SSE analysis object OR a persisted evaluations row.
function unpack(source) {
  if (!source || typeof source !== "object") return null;

  // Live: route.js `analysis`
  if (source.evaluation && typeof source.evaluation === "object") {
    return {
      shape: "live",
      ev: source.evaluation,
      classification: source.classification || null,
      estimates: source.estimates || null,
      competition: source.competition || null,
      // SHAPE SEAM (matrix catch, 2026-07-19): the SSE stream carries `_pro`
      // at the TOP level, but buildDeepAnalysis (ideas.js) spreads scoring_json
      // into `evaluation` — so on every SAVED load `_pro` arrives at
      // evaluation._pro and the top-level read came back null. Evidence
      // packets (anchor flags) and the sparse flag were silently dropped on
      // every reopened eval; the weak-anchor line rendered only on the live
      // stream, never again. Tolerating both homes is exactly this file's
      // job ("nothing downstream should know which shape it got").
      pro: source._pro || source.evaluation._pro || null,
    };
  }
  // Saved: DB row
  if (source.scoring_json && typeof source.scoring_json === "object") {
    return {
      shape: "saved",
      ev: source.scoring_json,
      classification: source.classification || source.scoring_json.classification || null,
      estimates: source.estimates_json || null,
      competition: source.competitors_json || null,
      pro: source.scoring_json._pro || null,
    };
  }
  return null;
}

// Stage 1's competitor array lives under different keys depending on shape.
function competitorArray(competition) {
  if (!competition) return [];
  if (Array.isArray(competition)) return competition;
  if (Array.isArray(competition.competitors)) return competition.competitors;
  return [];
}

// ------------------------------------------------------------- movement I ----
function buildRead(ev, packets, opts, classification) {
  const composite = isNum(ev.overall_score) ? ev.overall_score : null;

  // Composite completeness. The UI must never reweight, zero, or show a stale
  // number when a metric could not be placed. (state-matrix review section 4)
  const unplaceable = METRIC_KEYS.filter((k) => !isNum(ev[k] && ev[k].score));
  const compositeState =
    composite === null ? "unavailable"
    : unplaceable.length ? "partial_not_scored"
    : "complete";

  const es = ev.evidence_strength || {};

  return {
    headline: txt(ev.verdict_headline),           // backend
    lead: txt(ev.verdict_lead),                   // backend (compressor pass)
    detail: txt(ev.verdict_detail),               // backend, usually null
    summary: txt(ev.summary),                     // backend - the full read
    synthesisDegraded: ev.synthesis_degraded === true,
    composite,
    compositeState,                               // deterministic
    unplaceable,
    grounding: {
      level: txt(es.level),                       // backend: LOW | MEDIUM | HIGH
      reason: txt(es.reason),
      // thin_dimensions is emitted ONLY at LOW and is described upstream as a
      // frontend-rendering signal for the early-read callout.
      thinDimensions: arr(es.thin_dimensions),
    },
    // read_history is supplied by the caller (hub/lineage), not the engine.
    // readHistory entries are OBJECTS from the hub, not bare numbers:
    // { id, score, headline, kind, original_created_at, superseded_at, ... }.
    // Explore reads live in the same array but are a different species — an
    // explore envelope with no score — so they are filtered out rather than
    // rendered as a gap. Anything without a numeric score is dropped: a missing
    // score must not become a dash in a progression line that implies movement.
    history: arr(opts.readHistory)
      .filter((r) => !(r && typeof r === "object" && r.kind === "explore"))
      .map((r) => (isNum(r) ? r : r && typeof r === "object" ? r.score : null))
      .filter(isNum),                              // deterministic; [] => render nothing
    // Stage 1 classification, shown as the second half of the eyebrow pill.
    // Absent => the pill renders "DEEP" alone rather than "DEEP · ".
    ideaType: classification || null,
    marketplaceNote: txt(ev.marketplace_note),
    wtAnchors: { verdict: WT_ANCHORS.verdict, overall: WT_ANCHORS.overall },
    authority: {
      headline: "backend", composite: "backend",
      compositeState: "deterministic",
      grounding: "backend", history: "deterministic",
    },
  };
}

// ------------------------------------------------------------ movement II ----
function buildFinding(metricKey, ev, packets) {
  const m = ev[metricKey];
  if (!m || typeof m !== "object") return null;

  const spec = LADDERS[metricKey];
  const internal = m._internal || null;
  const archetype = internal ? internal[spec.key] : null;
  const entry = archetype ? spec.map[archetype] : null;

  // The cap is OR-only and real: components_committed is an array whose length
  // is the count the design renders as "admits on N of 6 components".
  const components = internal ? arr(internal.components_committed) : [];
  const cap =
    metricKey === "originality" && internal
      ? { committed: components.length, of: 6, components }
      : null;

  // The duel. NOTE THE ASYMMETRY - this is a real authority boundary:
  // the BINDING side carries committed prose (`why_binding`); the subordinate
  // side carries ONLY an enum name. Authoring a sentence for the subordinate
  // card would be frontend analysis. It renders name-only.
  const bindingObj =
    (internal && (internal.binding_friction ||
                  internal.binding_payment_constraint ||
                  internal.binding_constraint)) || null;

  const duel = bindingObj
    ? {
        binding: {
          subtype: txt(bindingObj.subtype) || txt(bindingObj.primary_subtype),
          label: humanise(bindingObj.subtype || bindingObj.primary_subtype),
          why: txt(bindingObj.why_binding) || txt(bindingObj.why_primary),
          evidenceCited: txt(bindingObj.evidence_cited),
          authority: "backend",
        },
        // Each scorer names this differently — verified against the three
        // prompts: MD `other_frictions_present`, MO `secondary_mechanisms`,
        // OR `secondary_subtypes`. Same concept, three keys.
        subordinates: arr(
          bindingObj.other_frictions_present ||
          bindingObj.secondary_mechanisms ||
          bindingObj.secondary_subtypes
        ).map((s) => ({
          subtype: typeof s === "string" ? s : txt(s && s.subtype),
          label: humanise(typeof s === "string" ? s : (s && s.subtype)),
          // Deliberately no prose. See above.
          why: null,
          authority: "backend-name-only",
        })),
      }
    : null;

  // ---- anchor coverage: FOUR states, not two -------------------------------
  // `anchor_status` is the scorer's committed read of what supports the
  // position (qualified | weak | no_qualified_anchor), and "no qualified
  // anchor" is a line the product never softens. It lives on the evidence
  // packet, which lives under `_pro` — and `_pro` is absent from 34 of 58
  // production rows (every eval before 2026-06-23). Reading it as
  // `packet ? txt(...) : null` collapsed TWO different facts into one silent
  // render: a read whose anchor coverage was MEASURED AND QUALIFIED, and a
  // read where it was NEVER MEASURED AT ALL. The second is not a quiet pass.
  //
  // This is the same distinction buildBuild already makes for the founder
  // profile (undefined -> unknown, say nothing; null -> measured and empty,
  // say so), applied to the field that carries the stronger doctrinal claim.
  // Asserting an absence you did not measure is the failure the engine
  // refuses everywhere; failing to flag an absence you also did not measure
  // is its mirror, and it was live.
  //
  //   "unknown"     -> no packet bundle on the payload. Pre-packet save. We
  //                    know nothing about anchor coverage. A silent pass here
  //                    would claim the read was anchored, which is unsupported.
  //   "absent"      -> bundle present, no packet for THIS metric. Measured at
  //                    the eval level, empty at the metric level.
  //   "uncommitted" -> packet present, anchor_status not committed.
  //   "committed"   -> packet present with a committed value; `anchorStatus`
  //                    carries it verbatim.
  //
  // DISPLAY IS NOT DECIDED HERE. `anchorStatus` keeps its exact prior meaning
  // and prior null-ness, so every existing renderer check is byte-unaffected;
  // this adds the state a renderer may act on once its design is approved.
  // Zero production rows currently sit in "absent" or "uncommitted" — they are
  // defensive, and would be produced by upstream packet-shape drift, not by
  // bad data.
  const packetsMeasured = !!packets && typeof packets === "object";
  const packet = packetsMeasured ? packets[metricKey] : null;
  const packetPresent = !!(packet && typeof packet === "object");
  const anchorCommitted = packetPresent ? txt(packet.anchor_status) : null;

  const anchorState = !packetsMeasured
    ? "unknown"                                  // not measured - say nothing yet
    : !packetPresent
      ? "absent"                                 // measured, no packet for this metric
      : anchorCommitted
        ? "committed"
        : "uncommitted";                         // packet present, value not committed

  return {
    key: metricKey,
    score: isNum(m.score) ? m.score : null,
    // MO only - code-derived at final assembly. Render displayScore ?? score.
    displayScore: isNum(m.display_score) ? m.display_score : null,
    rung: entry ? { n: entry.rung, of: spec.of, label: entry.label } : null,
    rungAuthority: entry ? "backend" : "debt",  // null rung => render no ruler
    cap,
    // qualified | weak | no_qualified_anchor. UNANCHORED IS NOT LOW.
    // Meaning and null-ness UNCHANGED: the committed value, or null. Resolved
    // on the single path above, so it can never disagree with `anchorState`.
    anchorStatus: anchorCommitted,
    // unknown | absent | uncommitted | committed. See the block above.
    anchorState,
    anchorStateAuthority: "deterministic",
    prose: {
      case: txt(m.diagnosis) || txt(m.differentiation_basis_diagnosis),
      defensibility: txt(m.defensibility_diagnosis),      // OR only
      wall: txt(m.binding_friction_explanation) ||
            txt(m.binding_payment_constraint_explanation) ||
            txt(m.binding_constraint_explanation),
      direction: txt(m.direction),
      joined: txt(m.explanation),                          // degrade target
    },
    duel,
    // Trailing qualifiers the old DeepMetricCard passed as `notes`.
    notes: [txt(m.geographic_note), txt(m.trajectory_note)].filter(Boolean),
    // Raw _internal, passed through so SourcesStrip can resolve its evidence
    // trail without unpacking the payload a second time.
    internal,
    overrideApplied: internal ? internal.override_applied || null : null,
    wtAnchor: WT_ANCHORS[metricKey],
  };
}

// ----------------------------------------------------------- movement III ----
function buildField(competition, ev) {
  // KEY ALIAS (verified against production competitors_json, July 18): saved
  // Stage 1 objects commit `competitor_type`, not `type`. Filtering on `type`
  // alone left every band empty — Terrain returned null and, because the list
  // was non-empty, the "no competitor evidence" degrade never fired either:
  // movement III rendered as a bare header. Normalize the alias here once.
  const list = competitorArray(competition).map((c) =>
    c && typeof c === "object" && !c.type && c.competitor_type
      ? { ...c, type: c.competitor_type }
      : c
  );
  const by = (type) => list.filter((c) => c && c.type === type);

  const direct = by("direct");
  const adjacent = by("adjacent");
  const substitute = by("substitute");

  // What we may derive mechanically, and nothing more.
  let topology = null;
  if (!list.length) topology = "unformed";
  else if (!direct.length && substitute.length) topology = "substitute";
  else if (direct.length) topology = "competitive";
  else topology = "fragmented";

  return {
    competitors: { direct, adjacent, substitute, all: list },
    // DIRECT band is OMITTED when empty - never drawn as an empty row.
    hasDirect: direct.length > 0,
    topology,
    topologyAuthority: "deterministic",
    // "One actor controls access" is NOT derivable - no gatekeeper role exists
    // in the competitor schema, and doctrine forbids inferring the keystone
    // from a repeated actor name (same entity, different causal roles).
    // RECLASSIFIED debt -> candidate (July 19, 2026): the contractual page is
    // COMPLETE without an actor keystone. The hinge (which evidence
    // requirements share a fact) plus competitive_position's `exposed` cell
    // (which actor undercuts the position) carry the signal on the cases
    // where it matters. field_shape's one novel claim — the market routes
    // through a named actor — reopens only when real evaluations repeatedly
    // produce platform-gated reads the current render visibly undersells.
    // Building it means a prompt change and a new payload generation; that
    // decision belongs to a V10 line, not to this page.
    fieldShape: null,
    fieldShapeAuthority: "candidate",
    platformRenderable: false,
    // competitive_position is a Stage 2c OBJECT — {headline, overlap,
    // you_win, exposed} — not a string. The handoff (and the mockup's
    // UNMAPPED tags) had this wrong; verified against prompt-stage2c.js
    // (A13 schema) and production July 18: 22 evals carry the 4-key object,
    // 33 carry null — the schema's NULL CONDITION ("no genuine rival — do
    // NOT manufacture a you-win"). txt() on the object returned null, which
    // silently erased the headline and the tri-split from the page.
    // A bare-string value is treated as headline-only, defensively.
    position: (() => {
      const raw = ev.competitive_position;
      const cp =
        raw && typeof raw === "object"
          ? { headline: txt(raw.headline), overlap: txt(raw.overlap), youWin: txt(raw.you_win), exposed: txt(raw.exposed) }
          : { headline: txt(raw), overlap: null, youWin: null, exposed: null };
      return cp.headline || cp.overlap || cp.youWin || cp.exposed ? cp : null;
    })(),
    // The three walls are the three scorers' binding constraints — committed
    // whenever the metric committed. What actor they converge ON (the
    // keystone) is the parked field_shape candidate; wall existence is not.
    // The Terrain therefore lands each wall SEPARATELY on the baseline —
    // drawing them into one point would visually claim the convergence that
    // Movement V's hinge contract carefully refuses to infer.
    walls: {
      demand: !!(ev && ev.market_demand),
      payment: !!(ev && ev.monetization),
      position: !!(ev && ev.originality),
    },
    authority: { position: "backend", walls: "deterministic" },
  };
}

// ------------------------------------------------------------ movement IV ----
function buildBuild(ev, estimates, opts) {
  const tc = ev.technical_complexity || {};
  const est = estimates || {};

  const base = isNum(tc.base_score) ? tc.base_score : null;
  const adjustment = isNum(tc.adjustment_value) ? tc.adjustment_value : null;
  const effective = isNum(tc.score) ? tc.score : null;

  // Profile state. `0` must never be shown as an assessment when no profile
  // was supplied - that falsely implies the founder was read and added nothing.
  // Deterministic from ideas.profile_context_json, passed in by the caller.
  //
  // FOUR states, not three. The distinction that matters is between "measured
  // and empty" and "not measured at all":
  //
  //   undefined  -> UNKNOWN. The caller did not pass the field - the prop is
  //                 missing, or /api/ideas/list does not select the column.
  //                 We know nothing. Render nothing. Claiming "absent" here
  //                 would assert that the founder supplied no profile, which
  //                 is false for 101 of 106 live ideas. Asserting an absence
  //                 you did not measure is the exact failure the engine
  //                 refuses everywhere else.
  //   null / {}  -> ABSENT. Measured, genuinely empty. The adjustment is
  //                 unavailable and we say so.
  //   populated  -> PRESENT, split on whether the adjustment actually moves.
  const pc = opts.profileContext;

  const profileMeasured = pc !== undefined;
  const profileSupplied =
    profileMeasured && pc !== null &&
    !(typeof pc === "object" && Object.keys(pc).length === 0);

  const profileState = !profileMeasured
    ? "unknown"                                   // not measured - say nothing
    : !profileSupplied
      ? "absent"                                  // measured, empty
      : adjustment && adjustment !== 0
        ? "present_adjusted"                      // the subtraction moves
        : "present_zero";                         // does not shorten THIS build

  const bottleneck = txt(est.main_bottleneck);

  // LOW evidence forces Specification: no duration, no difficulty, and the
  // three trailing beats are blanked upstream. IV must render as one diagnosis
  // sentence and NO numbers.
  const specification = bottleneck === "Specification";

  // Relationship: same wall iff the bottleneck is the build itself. Seven of
  // eight enum values are non-technical, so `different` is the common case.
  const relationship = !bottleneck
    ? "indeterminate"
    : bottleneck === TECHNICAL_BOTTLENECK ? "same" : "different";

  const amb = est.mb_ambiguity || {};
  const closeCall = amb.is_close_call === true
    ? {
        runnerUp: txt(amb.runner_up),
        rationale: txt(amb.runner_up_rationale),   // committed prose - unlike II
        tippingSignal: txt(amb.tipping_signal),
        authority: "backend",
      }
    : null;                                        // false => NO duel is drawn

  return {
    base, adjustment, effective,
    profileState,                                  // deterministic
    bottleneck,
    bottleneckExplanation: txt(est.main_bottleneck_explanation),
    duration: specification ? null : txt(est.duration),
    difficulty: specification ? null : txt(est.difficulty),
    specification,
    relationship,                                  // deterministic
    closeCall,
    beats: {
      whyThisScore: txt(tc.base_score_explanation),
      adjustmentReason: txt(tc.adjustment_explanation),
      blocker: txt(est.constraint_diagnosis),
      clearing: txt(est.commitment_explanation),
      profile: txt(est.profile_calibration),
      timeline: txt(est.position_basis),
      joined: txt(est.explanation),                // degrade target
    },
    // Nullable by design. Absent => the branch does not render at all.
    branch: txt(tc.incremental_note),
    wtAnchors: { tc: WT_ANCHORS.technical_complexity, mb: WT_ANCHORS.mb },
    authority: {
      equation: "backend", profileState: "deterministic",
      relationship: "deterministic", closeCall: "backend",
    },
  };
}

// ------------------------------------------------------------- movement V ----
// Display order for doors. Fixed, mechanical, no tie-break: a door sorts by
// its leftmost metric member. Ordering is PRESENTATION, so it is resolved
// here - the renderer receives final order and never sorts.
const HINGE_METRIC_ORDER = { market_demand: 0, monetization: 1, originality: 2 };

function buildHinge(ev, estimates, findings) {
  // Convergence MUST NOT be inferred by counting a repeated company name
  // across gap strings - a repeated entity may play different causal roles
  // (incumbent / channel owner / certifier). Stage 3 commits the mapping
  // (estimates.hinge); this file only validates it through the SHARED
  // contract module (same validator the route runs - server and client
  // cannot drift) and derives the display shape mechanically. Saved payloads
  // can be old, malformed, altered, or prior-contract: invalid or absent -->
  // the committed-nothing degrade, claiming nothing about convergence in
  // either direction. Never repair.
  const est = estimates || {};
  const gaps = findings
    .filter(Boolean)
    .filter((f) => f.prose.direction)
    .map((f) => ({
      origin: f.key,
      requirement: f.prose.direction,
      rung: f.rung,
    }));

  const committed = validateHinge(est.hinge, {
    metricDirections: {
      market_demand: ev.market_demand && ev.market_demand.direction,
      monetization: ev.monetization && ev.monetization.direction,
      originality: ev.originality && ev.originality.direction,
    },
    evidenceLevel: (ev.evidence_strength || {}).level,
    mainBottleneck: est.main_bottleneck,
  });

  if (committed) {
    const shape = deriveHingeShape(committed);
    const wall = committed.wall_joins_door;
    const gapByKey = new Map(gaps.map((g) => [g.origin, g]));

    // Every per-door display fact resolved ONCE, here. `merged` decides
    // whether the graphic draws a convergence ring, and it is the contract's
    // own predicate - not a second implementation of it in the component.
    // `members` is a mechanical lookup, but re-joining metric_waits against
    // gaps on every render would put that join in the renderer, which does
    // not decide state in this file's model.
    const doors = committed.doors
      .map((door) => ({
        id: door.id,
        label: door.label,
        fact: door.fact,            // null on solo doors - display uses the
        body: door.body,            // scorer's committed direction verbatim
        metricWaits: door.metric_waits,
        merged: isMergedDoor(door, wall),
        wallJoins: wall === door.id,
        members: door.metric_waits.map((k) => gapByKey.get(k)).filter(Boolean),
      }))
      .sort((a, b) => {
        const ai = Math.min(...a.metricWaits.map((k) => HINGE_METRIC_ORDER[k] ?? 99));
        const bi = Math.min(...b.metricWaits.map((k) => HINGE_METRIC_ORDER[k] ?? 99));
        return ai - bi;
      });

    return {
      state: shape,               // backend-committed mapping, shape derived in code
      stateAuthority: "backend",
      // Curves follow actual membership - the build curve exists only when
      // wallJoinsDoor is set, never by shape default.
      convergenceRenderable: shape !== "insufficient",
      doors,
      // Ring count. The graphic keys on this, not on `state`: a one-door
      // mapping can be SOLO (single with no ring), and a three-door mapping
      // can carry a ring when the wall joins one of them.
      mergedCount: doors.filter((d) => d.merged).length,
      wallJoinsDoor: wall,
      // The wall's committed name, for the build origin's label in the
      // collect graphic. Stage 3 owns it; nothing here infers it.
      wallLabel: txt(est.main_bottleneck),
      insufficient: committed.type === "insufficient",
      label: null,
      question: null,
      gaps,
      gapsAuthority: "backend",
    };
  }

  return {
    state: "uncommitted",         // absence of commitment - NOT a distributed claim
    stateAuthority: "debt",
    convergenceRenderable: false,
    doors: null,
    mergedCount: 0,
    wallJoinsDoor: null,
    wallLabel: null,
    insufficient: false,
    label: null,
    question: null,
    gaps,
    gapsAuthority: "backend",
  };
}

// ------------------------------------------------------------------ risks ----
// failure_risks — Stage 2c's committed threat array, rendered as ONE unified
// ledger closing movement III (risks-ledger-final.html, approved July 19).
// All three threat agents in one schedule, committed array order, no folds:
// the whole text always renders. `lead`/`rest` is a TYPOGRAPHIC split only
// (bright/dim), not a claim about B8's LEAD/CONTINUATION structure.
//
// SHAPE (verified against production): { slot, text, archetype }. `archetype`
// is carried but NEVER rendered — inter-stage routing vocabulary (Stage 3
// reads the A/B/C/D/E enum); the A value additionally collapses subtypes.
// `idx` is the committed array position — the render number is a count, not
// a rank (2c commits no priority; repeated slots valid; never re-sort).
// Legacy pre-slot shapes normalize with slot:null — neutral row, no label
// invented, never dropped.
//
// SENTENCE SPLIT: Intl.Segmenter (ICU sentence model) — no hand-kept
// abbreviation list. Split only when segmentation is confident (>=2 sentences,
// first >=25 chars); otherwise the whole text renders in lead tone. A
// segmentation miss can only cost the dimming — it can never hide text or
// dim mid-sentence.
function splitRiskProse(text) {
  try {
    const segs = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)]
      .map((x) => x.segment.trim())
      .filter(Boolean);
    if (segs.length < 2 || segs[0].length < 25) return { lead: text, rest: null };
    return { lead: segs[0], rest: segs.slice(1).join(" ") };
  } catch {
    return { lead: text, rest: null };
  }
}

function buildRisks(ev) {
  const all = arr(ev.failure_risks)
    .map((r, idx) => {
      let text = null;
      let slot = null;
      let archetype = null;
      if (typeof r === "string") text = txt(r);
      else if (r && typeof r === "object") {
        text = txt(r.text) || txt(r.risk) || txt(r.description);
        slot = txt(r.slot);
        archetype = txt(r.archetype);
      }
      if (!text) return null;
      const { lead, rest } = splitRiskProse(text);
      return { idx, slot, archetype, text, lead, rest };
    })
    .filter(Boolean);

  return { all, hasAny: all.length > 0 };
}

// ------------------------------------------------------------------ main ----
/**
 * @param {object} source  live `analysis` OR a persisted evaluations row
 * @param {object} [opts]
 * @param {Array}  [opts.readHistory]     prior scores, from lineage. [] => no history line
 * @param {object} [opts.profileContext]  ideas.profile_context_json; undefined => absent
 */
export function normalizeDeep(source, opts = {}) {
  const u = unpack(source);
  if (!u) return null;

  const { shape, ev, estimates, competition, pro } = u;
  const packets = (pro && pro.evidence_packets) || null;

  const findings = METRIC_KEYS
    .map((k) => buildFinding(k, ev, packets))
    .filter(Boolean);

  const model = {
    shape,
    read: buildRead(ev, packets, opts, u.classification),
    findings,
    field: buildField(competition, ev),
    build: buildBuild(ev, estimates, opts),
    hinge: buildHinge(ev, estimates, findings),
    // Ready to wire, deliberately unplaced.
    risks: buildRisks(ev),
    // Shared evidence reference - SourcesStrip's resolver takes this alongside
    // each finding's `internal` to produce receipt rows.
    competitors: competitorArray(competition),
    // Surfaced so the UI can show honest absence and a reviewer can see what
    // the page is NOT drawing. field_shape left this list July 19, 2026 —
    // reclassified as a parked candidate (see fieldShapeAuthority above);
    // the page is complete without it.
    debts: null, // assigned below — hinge is a debt only while uncommitted
    sparse: !!(pro && pro.sparse_input_triggered),
  };
  // hinge leaves the debt list the moment a valid committed mapping is in the
  // payload. An empty list is the target state: nothing owed.
  model.debts = model.hinge.stateAuthority === "backend" ? [] : ["hinge"];
  return model;
}

export default normalizeDeep;