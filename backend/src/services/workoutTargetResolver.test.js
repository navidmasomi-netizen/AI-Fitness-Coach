import assert from "node:assert/strict";

import { DECISION_TYPES, PROGRESSION_RULES_VERSION } from "./progressionDecisionEngine.js";
import {
  RECOMMENDATION_LIFECYCLE_STATUSES,
  WORKOUT_TARGET_RESOLUTION_REASONS,
  WorkoutTargetResolverValidationError,
  resolveWorkoutTarget,
} from "./workoutTargetResolver.js";

function serializeForLog(value) {
  return JSON.stringify(value, null, 2);
}

function printCaseStart(name, input) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${serializeForLog(input)}`);
}

function printCaseResult(passed, actual, error) {
  if (typeof actual !== "undefined") {
    console.log(`ACTUAL: ${serializeForLog(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error.stack || error.message}`);
  }
  console.log(`RESULT: ${passed ? "PASS" : "FAIL"}`);
  console.log("---");
}

async function runCase(name, input, fn) {
  printCaseStart(name, input);
  try {
    const actual = await fn();
    printCaseResult(true, actual);
    return true;
  } catch (error) {
    printCaseResult(false, undefined, error);
    return false;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return value;
}

function buildBaselineTarget(overrides = {}) {
  return {
    targetSets: 4,
    prescribedRepLow: 8,
    prescribedRepHigh: 12,
    exactRepTarget: 10,
    targetLoadKg: 42.5,
    targetDurationSeconds: null,
    progressionType: "load",
    ...overrides,
  };
}

function buildRecommendation(overrides = {}) {
  return {
    decisionType: DECISION_TYPES.MAINTAIN,
    loadAdjustmentSteps: 0,
    repAdjustment: 0,
    setAdjustment: 0,
    durationAdjustmentSteps: 0,
    rulesVersion: PROGRESSION_RULES_VERSION,
    lifecycleStatus: RECOMMENDATION_LIFECYCLE_STATUSES.PENDING,
    ...overrides,
  };
}

function buildPrescriptionMetadata(overrides = {}) {
  return {
    loadIncrementKg: "2.50",
    durationIncrementSeconds: 15,
    ...overrides,
  };
}

function buildInput(overrides = {}) {
  return {
    baselineTarget: buildBaselineTarget(),
    recommendation: null,
    prescriptionMetadata: buildPrescriptionMetadata(),
    ...overrides,
  };
}

function assertUnresolved(actual, reason) {
  assert.deepEqual(actual, {
    status: "unresolved",
    reason,
  });
}

function assertZeroAdjustments(actual) {
  assert.deepEqual(actual.target.appliedAdjustments, {
    loadAdjustmentSteps: 0,
    repAdjustment: 0,
    setAdjustment: 0,
    durationAdjustmentSteps: 0,
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "no recommendation returns unchanged baseline",
      input: "baseline target with no recommendation",
      fn: () => {
        const actual = resolveWorkoutTarget(buildInput());
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetSets, 4);
        assert.equal(actual.target.targetRepRangeLow, 8);
        assert.equal(actual.target.targetRepRangeHigh, 12);
        assert.equal(actual.target.exactRepTarget, 10);
        assert.equal(actual.target.targetLoadKg, 42.5);
        assert.equal(actual.target.targetDurationSeconds, null);
        assert.equal(actual.target.progressionType, "load");
        assert.equal(actual.target.sourceDecisionType, null);
        assert.equal(actual.target.sourceRulesVersion, null);
        assertZeroAdjustments(actual);
        return actual;
      },
    },
    {
      name: "maintain returns unchanged baseline",
      input: "pending maintain recommendation",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.MAINTAIN,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 42.5);
        assert.equal(actual.target.exactRepTarget, 10);
        assert.equal(actual.target.sourceDecisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.target.sourceRulesVersion, PROGRESSION_RULES_VERSION);
        return actual;
      },
    },
    {
      name: "increase load resolves one step",
      input: "load mode with single positive load step",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 45);
        assert.equal(actual.target.exactRepTarget, 10);
        return actual;
      },
    },
    {
      name: "increase load resolves multiple steps",
      input: "load mode with two load steps",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 2,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 47.5);
        return actual;
      },
    },
    {
      name: "increase load uses decimal-safe arithmetic",
      input: "load mode with 0.1 baseline and 0.2 increment expressed as strings",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              targetLoadKg: 0.1,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 1,
            }),
            prescriptionMetadata: buildPrescriptionMetadata({
              loadIncrementKg: "0.20",
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 0.3);
        return actual;
      },
    },
    {
      name: "reps then load resets exact rep target to prescribed low",
      input: "hybrid mode load increase resets exact reps after increasing load",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps_then_load",
              exactRepTarget: 12,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 45);
        assert.equal(actual.target.exactRepTarget, 8);
        assert.equal(actual.target.targetRepRangeLow, 8);
        assert.equal(actual.target.targetRepRangeHigh, 12);
        return actual;
      },
    },
    {
      name: "increase reps increments exact rep target",
      input: "rep-capable mode with valid positive rep adjustment",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.exactRepTarget, 11);
        assert.equal(actual.target.targetLoadKg, 42.5);
        return actual;
      },
    },
    {
      name: "increase reps resolves exactly at the upper bound",
      input: "rep increase reaches the prescribed high bound",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
              exactRepTarget: 11,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.exactRepTarget, 12);
        return actual;
      },
    },
    {
      name: "increase reps fails closed when it would exceed the upper bound",
      input: "rep adjustment pushes exact reps above prescribed high",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
              exactRepTarget: 12,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 1,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
        return actual;
      },
    },
    {
      name: "increase duration resolves one step",
      input: "time mode with valid positive duration step",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 45,
              exactRepTarget: null,
              prescribedRepLow: null,
              prescribedRepHigh: null,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_DURATION,
              durationAdjustmentSteps: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetDurationSeconds, 60);
        assert.equal(actual.target.targetLoadKg, null);
        return actual;
      },
    },
    {
      name: "increase duration resolves multiple steps",
      input: "time mode with two duration steps",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 45,
              exactRepTarget: null,
              prescribedRepLow: null,
              prescribedRepHigh: null,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_DURATION,
              durationAdjustmentSteps: 2,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetDurationSeconds, 75);
        return actual;
      },
    },
    {
      name: "increase load fails closed when load increment is missing",
      input: "load increase without increment metadata",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 1,
            }),
            prescriptionMetadata: buildPrescriptionMetadata({
              loadIncrementKg: null,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_LOAD_INCREMENT);
        return actual;
      },
    },
    {
      name: "increase load fails closed when load increment is non-positive",
      input: "load increase with zero increment metadata",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 1,
            }),
            prescriptionMetadata: buildPrescriptionMetadata({
              loadIncrementKg: "0.00",
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_LOAD_INCREMENT);
        return actual;
      },
    },
    {
      name: "increase duration fails closed when duration increment is missing",
      input: "time mode duration increase without increment metadata",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 45,
              exactRepTarget: null,
              prescribedRepLow: null,
              prescribedRepHigh: null,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_DURATION,
              durationAdjustmentSteps: 1,
            }),
            prescriptionMetadata: buildPrescriptionMetadata({
              durationIncrementSeconds: null,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_DURATION_INCREMENT);
        return actual;
      },
    },
    {
      name: "increase duration fails closed when duration increment is non-positive",
      input: "time mode duration increase with zero increment metadata",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 45,
              exactRepTarget: null,
              prescribedRepLow: null,
              prescribedRepHigh: null,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_DURATION,
              durationAdjustmentSteps: 1,
            }),
            prescriptionMetadata: buildPrescriptionMetadata({
              durationIncrementSeconds: 0,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_DURATION_INCREMENT);
        return actual;
      },
    },
    {
      name: "null decision type fails closed as legacy recommendation",
      input: "recommendation missing decision type",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: null,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.LEGACY_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "null rules version fails closed",
      input: "recommendation missing rules version",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              rulesVersion: null,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_RULES_VERSION);
        return actual;
      },
    },
    {
      name: "null lifecycle status fails closed",
      input: "recommendation lifecycle is null",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              lifecycleStatus: null,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.LEGACY_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "applied lifecycle status is ineligible",
      input: "recommendation was already applied",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              lifecycleStatus: RECOMMENDATION_LIFECYCLE_STATUSES.APPLIED,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.NON_PENDING_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "superseded lifecycle status is ineligible",
      input: "recommendation was superseded",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              lifecycleStatus: RECOMMENDATION_LIFECYCLE_STATUSES.SUPERSEDED,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.NON_PENDING_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "invalid lifecycle status is ineligible",
      input: "recommendation was invalidated",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              lifecycleStatus: RECOMMENDATION_LIFECYCLE_STATUSES.INVALID,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.NON_PENDING_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "legacy unresolvable lifecycle fails closed",
      input: "recommendation lifecycle marks legacy-unresolvable",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              lifecycleStatus: RECOMMENDATION_LIFECYCLE_STATUSES.LEGACY_UNRESOLVABLE,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.LEGACY_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "ignored lifecycle status is ineligible",
      input: "recommendation was ignored previously",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              lifecycleStatus: RECOMMENDATION_LIFECYCLE_STATUSES.IGNORED,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.NON_PENDING_RECOMMENDATION);
        return actual;
      },
    },
    {
      name: "unknown decision fails closed",
      input: "unsupported recommendation decision type",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: "UNKNOWN_DECISION",
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_DECISION);
        return actual;
      },
    },
    {
      name: "negative increase load step fails closed",
      input: "load increase carries a negative step count",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: -1,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
        return actual;
      },
    },
    {
      name: "fractional rep adjustment fails closed",
      input: "rep increase carries a fractional step count",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 1.5,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
        return actual;
      },
    },
    {
      name: "missing exact rep target fails closed for rep adjustment",
      input: "rep adjustment without a baseline exact rep target",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
              exactRepTarget: null,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 1,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_EXACT_REP_TARGET);
        return actual;
      },
    },
    {
      name: "invalid baseline rep range fails closed",
      input: "baseline has rep high lower than rep low",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              prescribedRepLow: 12,
              prescribedRepHigh: 8,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE);
        return actual;
      },
    },
    {
      name: "resolved exact reps stay within the prescribed bounds",
      input: "successful rep increase preserves exact reps within range",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
              exactRepTarget: 9,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 2,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.exactRepTarget, 11);
        assert.ok(actual.target.exactRepTarget >= actual.target.targetRepRangeLow);
        assert.ok(actual.target.exactRepTarget <= actual.target.targetRepRangeHigh);
        return actual;
      },
    },
    {
      name: "resolved load never becomes negative",
      input: "deload would push the load below zero",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              targetLoadKg: 2.5,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.DELOAD,
              loadAdjustmentSteps: -2,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE);
        return actual;
      },
    },
    {
      name: "time mode deload remains unresolved",
      input: "time mode deload with zero duration adjustment from current engine semantics",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 45,
              exactRepTarget: null,
              prescribedRepLow: null,
              prescribedRepHigh: null,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.DELOAD,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.TIME_DELOAD_UNRESOLVED);
        return actual;
      },
    },
    {
      name: "unsupported mode fails closed",
      input: "baseline progression type is outside the approved set",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "sets",
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_MODE);
        return actual;
      },
    },
    {
      name: "reps then load increase reps applies below the upper bound",
      input: "hybrid mode rep increase preserves load and increments exact reps below cap",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps_then_load",
              exactRepTarget: 10,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_REPS,
              repAdjustment: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.exactRepTarget, 11);
        assert.equal(actual.target.targetLoadKg, 42.5);
        return actual;
      },
    },
    {
      name: "rep deload resolves using existing abstract payload semantics",
      input: "reps mode deload with repAdjustment -1",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps",
              exactRepTarget: 10,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.DELOAD,
              repAdjustment: -1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.exactRepTarget, 9);
        return actual;
      },
    },
    {
      name: "load deload resolves using existing abstract payload semantics",
      input: "load mode deload with loadAdjustmentSteps -1",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.DELOAD,
              loadAdjustmentSteps: -1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 40);
        return actual;
      },
    },
    {
      name: "reps then load deload resolves as a load decrement",
      input: "hybrid mode deload uses loadAdjustmentSteps -1",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            baselineTarget: buildBaselineTarget({
              progressionType: "reps_then_load",
              exactRepTarget: 12,
            }),
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.DELOAD,
              loadAdjustmentSteps: -1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetLoadKg, 40);
        assert.equal(actual.target.exactRepTarget, 12);
        return actual;
      },
    },
    {
      name: "baseline input object is not mutated",
      input: "resolver preserves baseline object identity and values",
      fn: () => {
        const baselineTarget = deepFreeze(
          buildBaselineTarget({
            progressionType: "reps",
          })
        );
        const recommendation = deepFreeze(
          buildRecommendation({
            decisionType: DECISION_TYPES.INCREASE_REPS,
            repAdjustment: 1,
          })
        );
        const prescriptionMetadata = deepFreeze(buildPrescriptionMetadata());
        const actual = resolveWorkoutTarget({
          baselineTarget,
          recommendation,
          prescriptionMetadata,
        });
        assert.equal(actual.status, "resolved");
        assert.equal(baselineTarget.exactRepTarget, 10);
        assert.equal(recommendation.repAdjustment, 1);
        assert.equal(prescriptionMetadata.loadIncrementKg, "2.50");
        return actual;
      },
    },
    {
      name: "same input produces deeply equal output",
      input: "resolver is deterministic for the same valid input",
      fn: () => {
        const input = buildInput({
          baselineTarget: buildBaselineTarget({
            progressionType: "reps",
          }),
          recommendation: buildRecommendation({
            decisionType: DECISION_TYPES.INCREASE_REPS,
            repAdjustment: 1,
          }),
        });
        const first = resolveWorkoutTarget(input);
        const second = resolveWorkoutTarget(input);
        assert.deepEqual(first, second);
        return first;
      },
    },
    {
      name: "unrelated target fields remain unchanged after load increase",
      input: "load increase changes only targetLoadKg in load mode",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.INCREASE_LOAD,
              loadAdjustmentSteps: 1,
            }),
          })
        );
        assert.equal(actual.status, "resolved");
        assert.equal(actual.target.targetSets, 4);
        assert.equal(actual.target.targetRepRangeLow, 8);
        assert.equal(actual.target.targetRepRangeHigh, 12);
        assert.equal(actual.target.exactRepTarget, 10);
        assert.equal(actual.target.targetDurationSeconds, null);
        return actual;
      },
    },
    {
      name: "maintain with non-zero adjustments fails closed",
      input: "maintain recommendation carries an invalid adjustment payload",
      fn: () => {
        const actual = resolveWorkoutTarget(
          buildInput({
            recommendation: buildRecommendation({
              decisionType: DECISION_TYPES.MAINTAIN,
              loadAdjustmentSteps: 1,
            }),
          })
        );
        assertUnresolved(actual, WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
        return actual;
      },
    },
    {
      name: "top-level malformed input throws validation error",
      input: "non-object resolver input indicates a programmer error",
      fn: () => {
        assert.throws(() => resolveWorkoutTarget(null), WorkoutTargetResolverValidationError);
        return { threw: true };
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
