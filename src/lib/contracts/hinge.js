// src/lib/contracts/hinge.js
// ============================================================================
// HINGE CONTRACT — shared pure module. Spec: hinge-stage3-spec-v2 (+ round-3
// contract changes: strict entailment lives in the prompt; context-aware
// validation and label discipline live here and in the prompt respectively).
//
// Used by BOTH consumers so server/client validation cannot drift:
//   - app/api/analyze-pro/route.js  — immediately after Stage 3 parse
//   - app/deepPayload.js            — on whatever estimates_json.hinge holds
//                                     (old, malformed, altered, or
//                                     prior-contract payloads all reach it)
//
// DOCTRINE: validation never repairs. Any violation returns null and the
// caller drops the field — the UI renders the committed-nothing degrade.
// A repaired mapping is an authored mapping.
//
// The scorers own each metric's `direction` (the next-evidence requirement).
// Stage 3 owns only the causal joins and whether the Main Bottleneck joins
// one. Display shape (single / clustered / distributed / insufficient) is
// DERIVED here mechanically — code is the display authority, the model
// commits structure only.
// ============================================================================

export const HINGE_METRIC_KEYS = ["market_demand", "monetization", "originality"];

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const sentenceCount = (s) =>
  s
    .trim()
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean).length;

/**
 * A door is MERGED iff its metric members plus the wall (when it joins this
 * door) total >= 2. A solo-metric door that the wall joins IS a convergence
 * claim and carries fact + body like any merged door.
 */
export function isMergedDoor(door, wallJoinsDoor) {
  return door.metric_waits.length + (wallJoinsDoor === door.id ? 1 : 0) >= 2;
}

/**
 * Internal single logic path. Returns null when valid, or a short reason
 * string naming the FIRST violation found. Both public functions wrap this,
 * so validation and its explanation can never disagree.
 */
function firstViolation(rawHinge, context) {
  const ctx = context || {};
  const dirs = ctx.metricDirections || {};

  if (!rawHinge || typeof rawHinge !== "object" || Array.isArray(rawHinge)) return "hinge is not an object";
  if (rawHinge.type !== "mapped" && rawHinge.type !== "insufficient") return `unknown type "${rawHinge.type}"`;
  if (!Array.isArray(rawHinge.doors)) return "doors is not an array";
  if (rawHinge.wall_joins_door !== null && !isNonEmptyString(rawHinge.wall_joins_door))
    return "wall_joins_door is neither null nor a nonempty string";

  // ---- forced-insufficient invariants (context-aware) ----
  const forcedInsufficient = ctx.evidenceLevel === "LOW" || ctx.mainBottleneck === "Specification";
  if (forcedInsufficient) {
    return rawHinge.type === "insufficient" &&
      rawHinge.doors.length === 0 &&
      rawHinge.wall_joins_door === null
      ? null
      : "LOW evidence / Specification requires canonical insufficient shape";
  }

  // ---- canonical insufficient shape ----
  if (rawHinge.type === "insufficient") {
    return rawHinge.doors.length === 0 && rawHinge.wall_joins_door === null
      ? null
      : "insufficient must have doors [] and wall_joins_door null";
  }

  // ---- mapped ----
  if (rawHinge.doors.length === 0) return "mapped with empty doors";

  const ids = new Set();
  const seenMetrics = new Set();

  for (const door of rawHinge.doors) {
    if (!door || typeof door !== "object" || Array.isArray(door)) return "door is not an object";

    if (!isNonEmptyString(door.id)) return "door id missing or empty";
    if (ids.has(door.id)) return `duplicate door id "${door.id}"`;
    ids.add(door.id);

    if (!isNonEmptyString(door.label)) return `door "${door.id}": label missing`;
    const lw = wordCount(door.label);
    if (lw < 2 || lw > 4) return `door "${door.id}": label is ${lw} words (must be 2-4)`;

    if (!Array.isArray(door.metric_waits) || door.metric_waits.length === 0)
      return `door "${door.id}": metric_waits empty or not an array`;
    const local = new Set();
    for (const k of door.metric_waits) {
      if (!HINGE_METRIC_KEYS.includes(k)) return `door "${door.id}": unknown metric key "${k}"`;
      if (local.has(k)) return `door "${door.id}": metric "${k}" duplicated within metric_waits`;
      local.add(k);
      if (seenMetrics.has(k)) return `metric "${k}" appears in more than one door`;
      seenMetrics.add(k);
      if (!isNonEmptyString(dirs[k])) return `metric "${k}" has no committed direction — cannot be partitioned`;
    }
  }

  const expected = HINGE_METRIC_KEYS.filter((k) => isNonEmptyString(dirs[k]));
  if (expected.length === 0) return "no metric has a committed direction";
  if (seenMetrics.size !== expected.length || !expected.every((k) => seenMetrics.has(k)))
    return "partition is not exact over the direction-bearing metrics";

  if (rawHinge.doors.length > expected.length)
    return `${rawHinge.doors.length} doors exceed ${expected.length} partitioned metrics`;

  if (rawHinge.wall_joins_door !== null && !ids.has(rawHinge.wall_joins_door))
    return `wall_joins_door "${rawHinge.wall_joins_door}" matches no door id`;

  for (const door of rawHinge.doors) {
    if (isMergedDoor(door, rawHinge.wall_joins_door)) {
      if (!isNonEmptyString(door.fact)) return `merged door "${door.id}": fact missing`;
      const fw = wordCount(door.fact);
      // 24, not 20 (v2.1): the first live commitment showed a three-member
      // fact legitimately needs its qualifiers — the price figure carries the
      // monetization entailment, the deployment clause carries originality.
      // At 20 the cap fights the entailment fence it exists to serve.
      if (fw > 24) return `merged door "${door.id}": fact is ${fw} words (max 24)`;
      if (!isNonEmptyString(door.body)) return `merged door "${door.id}": body missing`;
      const sc = sentenceCount(door.body);
      if (sc < 1 || sc > 3) return `merged door "${door.id}": body is ${sc} sentences (must be 1-3)`;
    } else {
      if (door.fact !== null) return `solo door "${door.id}": fact must be exactly null`;
      if (door.body !== null) return `solo door "${door.id}": body must be exactly null`;
    }
  }

  return null;
}

/**
 * validateHinge(rawHinge, context) -> hinge | null
 *
 * context = {
 *   metricDirections: { market_demand, monetization, originality },  // committed `direction` strings (or null)
 *   evidenceLevel:    "LOW" | "MEDIUM" | "HIGH" | null,
 *   mainBottleneck:   string | null,
 * }
 *
 * Returns the SAME object reference when valid (no cloning, no mutation),
 * null on any violation. Never repairs.
 */
export function validateHinge(rawHinge, context) {
  return firstViolation(rawHinge, context) === null ? rawHinge : null;
}

/**
 * hingeViolation(rawHinge, context) -> string | null
 * The reason the mapping would be rejected — for logs only. Shares the exact
 * logic path with validateHinge, so the two cannot disagree.
 */
export function hingeViolation(rawHinge, context) {
  return firstViolation(rawHinge, context);
}

/**
 * deriveHingeShape(validHinge) -> "single" | "clustered" | "distributed" | "insufficient"
 * Assumes a hinge that already passed validateHinge. Mechanical; no judgment.
 *
 * Render nuance (spec §5): curves follow actual membership — a single door
 * holding three metrics with wall_joins_door null draws THREE curves; the
 * build curve exists only when wall_joins_door is set, never by shape default.
 */
export function deriveHingeShape(hinge) {
  if (!hinge || hinge.type === "insufficient") return "insufficient";
  if (hinge.doors.length === 1) return "single";
  const anyMerged = hinge.doors.some((d) => isMergedDoor(d, hinge.wall_joins_door));
  return anyMerged ? "clustered" : "distributed";
}