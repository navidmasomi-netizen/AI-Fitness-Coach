import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { computeRecoveryModifier, deriveSignalStrength } from "./recoveryEngine.js";
import { evaluateProgression } from "./progression.js";

function serializeForLog(value) {
  return JSON.stringify(
    value,
    (key, currentValue) => {
      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }
      return currentValue;
    },
    2
  );
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

function buildWorkoutAnalysis(overrides = {}) {
  return {
    userId: 1,
    windowStart: new Date("2026-06-16T00:00:00.000Z"),
    windowEnd: new Date("2026-07-14T00:00:00.000Z"),
    hasActiveProgram: true,
    exerciseSummaries: [
      {
        exerciseId: 1,
        exerciseName: "Exercise 1",
        movementPattern: "squat",
        timesPrescribed: 4,
        timesLogged: 4,
        adherenceRate: 1,
        performanceTrend: {
          direction: "flat",
          confidence: 1,
          reason: "stable_load",
        },
        lastLoggedAt: new Date("2026-07-12T09:00:00.000Z"),
        recentSets: [{ date: new Date("2026-07-12T09:00:00.000Z"), weightKg: 40, reps: 10 }],
      },
    ],
    patternSummaries: [],
    sessionConsistency: {
      scheduledSessions: 4,
      completedSessions: 3,
      completionRate: 0.75,
      missedSessionGaps: [],
    },
    ...overrides,
  };
}

function buildProgressionInput(overrides = {}) {
  return {
    exerciseSummary: {
      exerciseId: 1,
      exerciseName: "Exercise 1",
      movementPattern: "squat",
      timesPrescribed: 4,
      timesLogged: 4,
      adherenceRate: 1,
      performanceTrend: {
        direction: "increasing",
        confidence: 1,
        reason: "weight_increase",
      },
      lastLoggedAt: new Date("2026-07-12T09:00:00.000Z"),
      recentSets: [{ date: new Date("2026-07-12T09:00:00.000Z"), weightKg: 40, reps: 12 }],
    },
    prescription: {
      repRangeLow: 8,
      repRangeHigh: 12,
      progressionType: "load",
    },
    exercise: {
      movementPattern: "squat",
      complexity: "compound",
      progressionType: "load",
    },
    isBeginner: true,
    staticRecoveryQuality: "medium",
    previousRecommendation: null,
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "computeRecoveryModifier -> caution from low completion rate alone",
      input: "completionRate=0.35, zero decreasing exercises",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 1,
              completionRate: 0.35,
              missedSessionGaps: [],
            },
          }),
        });
        assert.equal(actual.recoveryModifier, "caution");
        assert.equal(actual.trace.because.includes("threshold:caution_completion_rate_below_0.5"), true);
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> caution from decreasing cluster alone",
      input: "completionRate=0.75, two decreasing exercises",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "decreasing", confidence: 0.67, reason: "weight_drop" },
              },
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                exerciseId: 2,
                performanceTrend: { direction: "decreasing", confidence: 1, reason: "rep_drop" },
              },
            ],
          }),
        });
        assert.equal(actual.recoveryModifier, "caution");
        assert.equal(actual.trace.because.includes("threshold:caution_two_or_more_decreasing_exercises"), true);
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> caution from both conditions",
      input: "completionRate=0.2 and two decreasing exercises",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 1,
              completionRate: 0.2,
              missedSessionGaps: [],
            },
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "decreasing", confidence: 1, reason: "weight_drop" },
              },
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                exerciseId: 2,
                performanceTrend: { direction: "decreasing", confidence: 1, reason: "weight_drop" },
              },
            ],
          }),
        });
        assert.equal(actual.recoveryModifier, "caution");
        assert.equal(actual.trace.because.includes("threshold:caution_both_signals"), true);
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> supportive when all conditions hold",
      input: "completionRate=1, one increasing, zero decreasing",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 4,
              completionRate: 1,
              missedSessionGaps: [],
            },
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "increasing", confidence: 0.67, reason: "weight_increase" },
              },
            ],
          }),
        });
        assert.equal(actual.recoveryModifier, "supportive");
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> supportive blocked when completionRate is missing",
      input: "completionRate=0.89, increasing present, zero decreasing",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 3,
              completionRate: 0.89,
              missedSessionGaps: [],
            },
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "increasing", confidence: 1, reason: "weight_increase" },
              },
            ],
          }),
        });
        assert.notEqual(actual.recoveryModifier, "supportive");
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> supportive blocked when no increasing exercise exists",
      input: "completionRate=1, zero increasing, zero decreasing",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 4,
              completionRate: 1,
              missedSessionGaps: [],
            },
          }),
        });
        assert.notEqual(actual.recoveryModifier, "supportive");
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> supportive blocked when any decreasing exercise exists",
      input: "completionRate=1, increasing present, one decreasing present",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 4,
              completionRate: 1,
              missedSessionGaps: [],
            },
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "increasing", confidence: 1, reason: "weight_increase" },
              },
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                exerciseId: 2,
                performanceTrend: { direction: "decreasing", confidence: 0.67, reason: "weight_drop" },
              },
            ],
          }),
        });
        assert.notEqual(actual.recoveryModifier, "supportive");
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> neutral from null completionRate",
      input: "hasActiveProgram=false, completionRate=null",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            hasActiveProgram: false,
            sessionConsistency: {
              scheduledSessions: 0,
              completedSessions: 0,
              completionRate: null,
              missedSessionGaps: [],
            },
          }),
        });
        assert.equal(actual.recoveryModifier, "neutral");
        assert.equal(actual.confidence, 0);
        assert.equal(actual.signalStrength, "weak");
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> neutral from unremarkable behavior",
      input: "completionRate=0.75, no increasing, one decreasing below threshold",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "decreasing", confidence: 0.66, reason: "weight_drop" },
              },
            ],
          }),
        });
        assert.equal(actual.recoveryModifier, "neutral");
        assert(actual.confidence > 0);
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> caution precedence wins over supportive overlap",
      input: "completionRate=0.4, increasing present, zero decreasing",
      fn: () => {
        const actual = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 2,
              completionRate: 0.4,
              missedSessionGaps: [],
            },
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "increasing", confidence: 1, reason: "weight_increase" },
              },
            ],
          }),
        });
        assert.equal(actual.recoveryModifier, "caution");
        return actual;
      },
    },
    {
      name: "computeRecoveryModifier -> boundary checks for completion and exercise confidence",
      input: "completionRate=0.5, completionRate=0.9, exercise confidence=0.67",
      fn: () => {
        const cautionBoundary = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 2,
              completionRate: 0.5,
              missedSessionGaps: [],
            },
          }),
        });
        const supportiveBoundary = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 4,
              completionRate: 0.9,
              missedSessionGaps: [],
            },
            exerciseSummaries: [
              {
                ...buildWorkoutAnalysis().exerciseSummaries[0],
                performanceTrend: { direction: "increasing", confidence: 0.67, reason: "weight_increase" },
              },
            ],
          }),
        });
        assert.notEqual(cautionBoundary.recoveryModifier, "caution");
        assert.equal(supportiveBoundary.recoveryModifier, "supportive");
        return { cautionBoundary, supportiveBoundary };
      },
    },
    {
      name: "deriveSignalStrength -> boundary assignments",
      input: "0.33, 0.34, 0.66, 0.67",
      fn: () => {
        const actual = {
          "0.33": deriveSignalStrength(0.33),
          "0.34": deriveSignalStrength(0.34),
          "0.66": deriveSignalStrength(0.66),
          "0.67": deriveSignalStrength(0.67),
        };
        assert.deepEqual(actual, {
          "0.33": "weak",
          "0.34": "moderate",
          "0.66": "moderate",
          "0.67": "strong",
        });
        return actual;
      },
    },
    {
      name: "deriveSignalStrength -> varied bucket coverage",
      input: "0, 0.2, 0.5, 0.8, 1",
      fn: () => {
        const actual = [0, 0.2, 0.5, 0.8, 1].map((value) => ({
          value,
          signalStrength: deriveSignalStrength(value),
        }));
        assert.deepEqual(actual, [
          { value: 0, signalStrength: "weak" },
          { value: 0.2, signalStrength: "weak" },
          { value: 0.5, signalStrength: "moderate" },
          { value: 0.8, signalStrength: "strong" },
          { value: 1, signalStrength: "strong" },
        ]);
        return actual;
      },
    },
    {
      name: "signalStrength -> non influence on progression branching",
      input: "same recoveryModifier=caution with different confidence",
      fn: () => {
        const lowSignal = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 1,
              completionRate: 0.48,
              missedSessionGaps: [],
            },
          }),
        });
        const highSignal = computeRecoveryModifier({
          workoutAnalysis: buildWorkoutAnalysis({
            sessionConsistency: {
              scheduledSessions: 4,
              completedSessions: 1,
              completionRate: 0.2,
              missedSessionGaps: [],
            },
          }),
        });
        const lowDecision = evaluateProgression(
          buildProgressionInput({
            recoveryModifier: lowSignal.recoveryModifier,
          })
        );
        const highDecision = evaluateProgression(
          buildProgressionInput({
            recoveryModifier: highSignal.recoveryModifier,
          })
        );
        assert.equal(lowSignal.recoveryModifier, "caution");
        assert.equal(highSignal.recoveryModifier, "caution");
        assert.notEqual(lowSignal.signalStrength, highSignal.signalStrength);
        assert.equal(lowDecision.recommendationType, highDecision.recommendationType);
        return { lowSignal, highSignal, lowDecision, highDecision };
      },
    },
    {
      name: "recoveryEngine -> zero UserProfile-shaped fields referenced",
      input: "grep file content for user-profile field names",
      fn: async () => {
        const fileContent = await readFile(
          new URL("./recoveryEngine.js", import.meta.url),
          "utf8"
        );
        const forbiddenFields = [
          "trainingLevel",
          "recoveryQuality",
          "equipmentAccess",
          "injuryFlags",
          "goal",
          "sessionDurationMin",
          "trainingDaysPerWeek",
        ];
        const foundFields = forbiddenFields.filter((field) => fileContent.includes(field));
        assert.deepEqual(foundFields, []);
        return { foundFields };
      },
    },
    {
      name: "computeRecoveryModifier -> deterministic identical input",
      input: "same workoutAnalysis twice",
      fn: () => {
        const input = buildWorkoutAnalysis();
        const first = computeRecoveryModifier({ workoutAnalysis: input });
        const second = computeRecoveryModifier({ workoutAnalysis: input });
        assert.equal(serializeForLog(first), serializeForLog(second));
        return first;
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
