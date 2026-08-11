import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import prisma from "../lib/prisma.js";
import {
  APPLY_REPLACEMENT_AUDIT_VERSION,
  APPLY_REPLACEMENT_DECISION_TYPE,
  APPLY_REPLACEMENT_V1_VERSION,
  ApplyReplacementError,
  createReplacementApplyService,
} from "./replacementApplyService.js";

const TEST_EMAIL_DOMAIN = "@example.com";
const TEST_RUN_NONCE = `${process.pid}-${Date.now()}`;

function printCaseResult({ name, input, actual, error, status }) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${JSON.stringify(input)}`);
  if (actual !== undefined) {
    console.log(`ACTUAL: ${JSON.stringify(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error.stack || error.message}`);
  }
  console.log(`RESULT: ${status}`);
  console.log("---");
}

async function createTestUser(suffix) {
  return prisma.user.create({
    data: {
      email: `replacement-apply-${suffix}-${TEST_RUN_NONCE}${TEST_EMAIL_DOMAIN}`,
      name: `Replacement Apply ${suffix}`,
      password: "hashed-password",
    },
  });
}

async function loadExercisesByName(names) {
  const rows = await prisma.exercise.findMany({
    where: {
      nameEn: { in: names },
    },
    orderBy: [{ id: "asc" }],
  });

  const byName = new Map(rows.map((row) => [row.nameEn, row]));
  for (const name of names) {
    if (!byName.has(name)) {
      throw new Error(`Expected seeded exercise "${name}" to exist.`);
    }
  }

  return byName;
}

async function createFixture({
  suffix,
  exerciseNames = ["Back Squat", "Romanian Deadlift", "Leg Press"],
  sourceExerciseName = "Back Squat",
  replacementExerciseName = "Front Squat",
  duplicateSource = false,
  withSetLogs = true,
} = {}) {
  const user = await createTestUser(`${suffix}-owner`);
  const otherUser = await createTestUser(`${suffix}-other`);
  const names = duplicateSource ? [sourceExerciseName, sourceExerciseName, ...exerciseNames.filter((name) => name !== sourceExerciseName)] : exerciseNames;
  const seededExercises = await loadExercisesByName([...new Set([...names, replacementExerciseName])]);
  const exercises = names.map((name) => seededExercises.get(name));
  const replacementExercise = seededExercises.get(replacementExerciseName);

  const program = await prisma.program.create({
    data: {
      name: `Replacement Apply Program ${suffix}`,
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const programDay = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 1,
      name: "Replacement Apply Day",
    },
  });

  const programDayExercises = [];
  for (const [index, exercise] of exercises.entries()) {
    programDayExercises.push(
      await prisma.programDayExercise.create({
        data: {
          programDayId: programDay.id,
          exerciseId: exercise.id,
          order: index + 1,
          sets: 3,
          repRangeLow: 8,
          repRangeHigh: 10,
          restSeconds: 90,
          progressionType: "load",
        },
      })
    );
  }

  const session = await prisma.workoutSession.create({
    data: {
      userId: user.id,
      programId: program.id,
      programDayId: programDay.id,
      status: "active",
      notes: "keep these notes",
    },
  });

  const targets = [];
  for (const [index, exercise] of exercises.entries()) {
    targets.push(
      await prisma.workoutSessionExerciseTarget.create({
        data: {
          sessionId: session.id,
          programDayExerciseId: programDayExercises[index].id,
          exerciseId: exercise.id,
          targetSets: 3,
          targetRepRangeLow: 8,
          targetRepRangeHigh: 10,
          exactRepTarget: 8,
          targetLoadKg: 100,
          targetDurationSeconds: null,
          progressionType: "load",
          sourceDecisionType: index === 0 ? "MAINTAIN" : null,
          sourceRulesVersion: index === 0 ? "progression_decision_rules_v5" : null,
        },
      })
    );
  }

  const sourceTarget = targets.find((target) => target.exerciseId === seededExercises.get(sourceExerciseName).id) ?? null;

  const setLogs = [];
  if (withSetLogs) {
    setLogs.push(
      await prisma.setLog.create({
        data: {
          sessionId: session.id,
          exerciseId: sourceTarget.exerciseId,
          setNumber: 1,
          reps: 8,
          weightKg: 100,
        },
      })
    );
  }

  return {
    user,
    otherUser,
    program,
    programDay,
    programDayExercises,
    session,
    targets,
    sourceTarget,
    replacementExercise,
    setLogs,
  };
}

async function cleanupFixture(fixture) {
  if (!fixture) return;

  const sessionId = fixture.session?.id ?? null;
  const programId = fixture.program?.id ?? null;
  const programDayId = fixture.programDay?.id ?? null;
  const programDayExerciseIds = fixture.programDayExercises?.map((entry) => entry.id) ?? [];
  const userIds = [fixture.user?.id, fixture.otherUser?.id].filter(Boolean);

  if (sessionId) {
    await prisma.recommendationApplication.deleteMany({ where: { workoutSessionId: sessionId } });
    await prisma.workoutSessionExerciseTarget.deleteMany({ where: { sessionId } });
    await prisma.setLog.deleteMany({ where: { sessionId } });
    await prisma.workoutSession.deleteMany({ where: { id: sessionId } });
  }

  if (programDayExerciseIds.length > 0) {
    await prisma.programDayExercise.deleteMany({ where: { id: { in: programDayExerciseIds } } });
  }

  if (programDayId) {
    await prisma.programDay.deleteMany({ where: { id: programDayId } });
  }

  if (programId) {
    await prisma.program.deleteMany({ where: { id: programId } });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

const defaultService = createReplacementApplyService();

const cases = [
  {
    name: "1. successful apply updates only the specified target occurrence and preserves workout metadata",
    input: { case: "success" },
    run: async () => {
      const fixture = await createFixture({ suffix: "success" });
      const beforeTarget = await prisma.workoutSessionExerciseTarget.findUnique({ where: { id: fixture.sourceTarget.id } });
      const result = await defaultService.applyWorkoutExerciseReplacementV1({
        userId: fixture.user.id,
        sessionId: fixture.session.id,
        targetId: fixture.sourceTarget.id,
        replacementExerciseId: fixture.replacementExercise.id,
      });
      const updatedTarget = await prisma.workoutSessionExerciseTarget.findUnique({
        where: { id: fixture.sourceTarget.id },
      });
      const updatedSetLogs = await prisma.setLog.findMany({
        where: { sessionId: fixture.session.id },
        orderBy: [{ setNumber: "asc" }, { id: "asc" }],
      });
      return { fixture, beforeTarget, result, updatedTarget, updatedSetLogs };
    },
    assertResult: (actual) => {
      assert.equal(actual.result.version, APPLY_REPLACEMENT_V1_VERSION);
      assert.equal(actual.updatedTarget.exerciseId, actual.fixture.replacementExercise.id);
      assert.equal(actual.updatedTarget.targetSets, actual.beforeTarget.targetSets);
      assert.equal(actual.updatedTarget.targetRepRangeLow, actual.beforeTarget.targetRepRangeLow);
      assert.equal(actual.updatedTarget.targetRepRangeHigh, actual.beforeTarget.targetRepRangeHigh);
      assert.equal(actual.updatedTarget.sourceDecisionType, APPLY_REPLACEMENT_DECISION_TYPE);
      assert.equal(actual.result.session.notes, "keep these notes");
      assert.equal(actual.result.session.exerciseTargets[0].targetSets, 3);
      assert.equal(actual.updatedSetLogs[0].exerciseId, actual.fixture.replacementExercise.id);
      assert.equal(actual.updatedSetLogs[0].reps, 8);
      assert.equal(actual.updatedSetLogs[0].weightKg, 100);
    },
  },
  {
    name: "2. ownership mismatch is rejected",
    input: { case: "ownership" },
    run: async () => {
      const fixture = await createFixture({ suffix: "ownership" });
      try {
        await defaultService.applyWorkoutExerciseReplacementV1({
          userId: fixture.otherUser.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          replacementExerciseId: fixture.replacementExercise.id,
        });
        throw new Error("Expected ownership mismatch to fail");
      } catch (error) {
        return { fixture, error };
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.error instanceof ApplyReplacementError, true);
      assert.equal(actual.error.statusCode, 404);
      assert.equal(actual.error.code, "WORKOUT_SESSION_NOT_FOUND");
    },
  },
  {
    name: "3. duplicate apply returns conflict",
    input: { case: "duplicate apply" },
    run: async () => {
      const fixture = await createFixture({ suffix: "duplicate" });
      await defaultService.applyWorkoutExerciseReplacementV1({
        userId: fixture.user.id,
        sessionId: fixture.session.id,
        targetId: fixture.sourceTarget.id,
        replacementExerciseId: fixture.replacementExercise.id,
      });
      try {
        await defaultService.applyWorkoutExerciseReplacementV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          replacementExerciseId: fixture.replacementExercise.id,
        });
        throw new Error("Expected duplicate apply to fail");
      } catch (error) {
        return { fixture, error };
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.error instanceof ApplyReplacementError, true);
      assert.equal(actual.error.statusCode, 409);
      assert.equal(actual.error.code, "REPLACEMENT_ALREADY_APPLIED");
    },
  },
  {
    name: "4. invalid replacement exercise is rejected without recomputing discovery",
    input: { case: "invalid replacement" },
    run: async () => {
      const fixture = await createFixture({ suffix: "invalid" });
      try {
        await defaultService.applyWorkoutExerciseReplacementV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          replacementExerciseId: 999999,
        });
        throw new Error("Expected invalid replacement to fail");
      } catch (error) {
        return { fixture, error };
      }
    },
    assertResult: async (actual) => {
      assert.equal(actual.error instanceof ApplyReplacementError, true);
      assert.equal(actual.error.statusCode, 422);
      assert.equal(actual.error.code, "REPLACEMENT_EXERCISE_INVALID");
      const target = await prisma.workoutSessionExerciseTarget.findUnique({ where: { id: actual.fixture.sourceTarget.id } });
      assert.equal(target.exerciseId, actual.fixture.sourceTarget.exerciseId);
    },
  },
  {
    name: "5. transaction rollback preserves original workout state on internal failure",
    input: { case: "rollback" },
    run: async () => {
      const fixture = await createFixture({ suffix: "rollback" });
      const service = createReplacementApplyService({
        afterTargetUpdateImpl: async () => {
          throw new Error("forced rollback");
        },
      });
      try {
        await service.applyWorkoutExerciseReplacementV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          replacementExerciseId: fixture.replacementExercise.id,
        });
        throw new Error("Expected rollback failure");
      } catch (error) {
        const target = await prisma.workoutSessionExerciseTarget.findUnique({ where: { id: fixture.sourceTarget.id } });
        const setLogs = await prisma.setLog.findMany({ where: { sessionId: fixture.session.id } });
        return { fixture, error, target, setLogs };
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.error.message, "forced rollback");
      assert.equal(actual.target.exerciseId, actual.fixture.sourceTarget.exerciseId);
      assert.equal(actual.target.sourceDecisionType, "MAINTAIN");
      assert.equal(actual.setLogs[0].exerciseId, actual.fixture.sourceTarget.exerciseId);
    },
  },
  {
    name: "6. audit persistence is structured and durable on the target occurrence",
    input: { case: "audit" },
    run: async () => {
      const fixture = await createFixture({ suffix: "audit" });
      await defaultService.applyWorkoutExerciseReplacementV1({
        userId: fixture.user.id,
        sessionId: fixture.session.id,
        targetId: fixture.sourceTarget.id,
        replacementExerciseId: fixture.replacementExercise.id,
      });
      const target = await prisma.workoutSessionExerciseTarget.findUnique({ where: { id: fixture.sourceTarget.id } });
      return { fixture, target, audit: JSON.parse(target.sourceRulesVersion) };
    },
    assertResult: (actual) => {
      assert.equal(actual.target.sourceDecisionType, APPLY_REPLACEMENT_DECISION_TYPE);
      assert.equal(actual.audit.version, APPLY_REPLACEMENT_AUDIT_VERSION);
      assert.equal(actual.audit.targetId, actual.fixture.sourceTarget.id);
      assert.equal(actual.audit.previousExerciseId, actual.fixture.sourceTarget.exerciseId);
      assert.equal(actual.audit.replacementExerciseId, actual.fixture.replacementExercise.id);
    },
  },
  {
    name: "7. ambiguous logged source occurrences fail loudly instead of guessing",
    input: { case: "ambiguous duplicates" },
    run: async () => {
      const fixture = await createFixture({
        suffix: "ambiguous",
        duplicateSource: true,
        withSetLogs: true,
      });
      try {
        await defaultService.applyWorkoutExerciseReplacementV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          replacementExerciseId: fixture.replacementExercise.id,
        });
        throw new Error("Expected ambiguous apply to fail");
      } catch (error) {
        return { fixture, error };
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.error instanceof ApplyReplacementError, true);
      assert.equal(actual.error.statusCode, 409);
      assert.equal(actual.error.code, "REPLACEMENT_SOURCE_LOGS_AMBIGUOUS");
    },
  },
  {
    name: "8. apply service does not import discovery, ranking, or similarity engines",
    input: { case: "static dependency audit" },
    run: async () => {
      const fileContent = await readFile(new URL("./replacementApplyService.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/replacementRecommendationService/i.test(actual.fileContent), false);
      assert.equal(/exerciseRanking/i.test(actual.fileContent), false);
      assert.equal(/exerciseSimilarity/i.test(actual.fileContent), false);
      assert.equal(/replacementDecision/i.test(actual.fileContent), false);
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  let fixture = null;
  try {
    const actual = await testCase.run();
    fixture = actual.fixture ?? null;
    await testCase.assertResult(actual);
    printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
    passed += 1;
  } catch (error) {
    printCaseResult({ name: testCase.name, input: testCase.input, error, status: "FAIL" });
    failed += 1;
  } finally {
    await cleanupFixture(fixture);
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}
