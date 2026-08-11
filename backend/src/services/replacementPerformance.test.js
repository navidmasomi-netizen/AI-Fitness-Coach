import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import prisma from "../lib/prisma.js";
import { buildReplacementCandidatesV1 } from "./exerciseCandidates/index.js";
import { rankReplacementCandidatesV1 } from "./exerciseRanking/index.js";
import { createReplacementApplyService } from "./replacementApplyService.js";
import { getWorkoutExerciseReplacementsV1 } from "./replacementRecommendationService.js";

const TEST_EMAIL_DOMAIN = "@example.com";
const TEST_RUN_NONCE = `${process.pid}-${Date.now()}`;

const PERFORMANCE_BUDGETS = Object.freeze({
  recommendationQueryCount: 2,
  applyQueryCount: 8,
  recommendationResponseBytes: 4 * 1024,
  applyResponseBytes: 32 * 1024,
});

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

function createCounter() {
  return {
    total: 0,
    operations: [],
    transactionDurationsMs: [],
  };
}

function wrapPrismaClient(client, counter) {
  const modelCache = new WeakMap();

  function wrapModel(modelName, model) {
    if (!model || typeof model !== "object") {
      return model;
    }

    if (modelCache.has(model)) {
      return modelCache.get(model);
    }

    const proxy = new Proxy(model, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") {
          return value;
        }

        return async (...args) => {
          counter.total += 1;
          counter.operations.push(`${modelName}.${String(prop)}`);
          return value.apply(target, args);
        };
      },
    });

    modelCache.set(model, proxy);
    return proxy;
  }

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "$transaction") {
        const value = Reflect.get(target, prop, receiver);
        return async (arg, ...rest) => {
          if (typeof arg !== "function") {
            counter.total += 1;
            counter.operations.push("$transaction.batch");
            return value.call(target, arg, ...rest);
          }

          const startedAt = performance.now();
          return value.call(target, async (tx) => arg(wrapPrismaClient(tx, counter)), ...rest).finally(() => {
            counter.transactionDurationsMs.push(Number((performance.now() - startedAt).toFixed(3)));
          });
        };
      }

      if (prop === "$queryRaw" || prop === "$executeRaw" || prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") {
          return value;
        }

        return async (...args) => {
          counter.total += 1;
          counter.operations.push(String(prop));
          return value.apply(target, args);
        };
      }

      const value = Reflect.get(target, prop, receiver);
      if (value && typeof value === "object") {
        return wrapModel(String(prop), value);
      }

      return value;
    },
  });
}

function buildContext() {
  return {
    version: "replacement-context-v1",
    equipmentContext: null,
    replacementIntent: null,
  };
}

async function createTestUser(suffix) {
  return prisma.user.create({
    data: {
      email: `replacement-performance-${suffix}-${TEST_RUN_NONCE}${TEST_EMAIL_DOMAIN}`,
      name: `Replacement Performance ${suffix}`,
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

async function createFixture({ suffix } = {}) {
  const user = await createTestUser(`${suffix}-owner`);
  const seededExercises = await loadExercisesByName([
    "Back Squat",
    "Romanian Deadlift",
    "Machine Leg Curl",
    "Bench Press",
    "Front Squat",
  ]);

  const exercises = ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"].map((name) =>
    seededExercises.get(name)
  );
  const replacementExercise = seededExercises.get("Front Squat");

  const program = await prisma.program.create({
    data: {
      name: `Replacement Performance Program ${suffix}`,
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const programDay = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 1,
      name: "Replacement Performance Day",
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
      notes: "performance fixture notes",
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
        include: {
          exercise: true,
        },
      })
    );
  }

  await prisma.setLog.create({
    data: {
      sessionId: session.id,
      exerciseId: targets[0].exerciseId,
      setNumber: 1,
      reps: 8,
      weightKg: 100,
    },
  });

  return {
    user,
    program,
    programDay,
    programDayExercises,
    session,
    sourceTarget: targets[0],
    replacementExercise,
  };
}

async function cleanupFixture(fixture) {
  if (!fixture) {
    return;
  }

  const sessionId = fixture.session?.id ?? null;
  const programId = fixture.program?.id ?? null;
  const programDayId = fixture.programDay?.id ?? null;
  const programDayExerciseIds = fixture.programDayExercises?.map((entry) => entry.id) ?? [];
  const userId = fixture.user?.id ?? null;

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

  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
}

const cases = [
  {
    name: "1. recommendation query count is fixed with no N+1 per candidate and payload stays within V1 budget",
    input: { source: "Back Squat" },
    run: async () => {
      const fixture = await createFixture({ suffix: "recommendation" });

      try {
        const activeCatalog = await prisma.exercise.findMany({
          where: { catalogLifecycle: "ACTIVE" },
          orderBy: [{ id: "asc" }],
        });
        const candidateResults = buildReplacementCandidatesV1(fixture.sourceTarget.exercise, activeCatalog);
        const eligibleRankingEntries = candidateResults.candidates
          .filter((candidate) => candidate.eligibility)
          .map((candidateResult) => ({
            candidateExercise: activeCatalog.find((exercise) => exercise.id === candidateResult.exerciseId),
            candidateResult,
          }));
        const rankedResults = rankReplacementCandidatesV1(fixture.sourceTarget.exercise, eligibleRankingEntries);

        const counter = createCounter();
        const startedAt = performance.now();
        const actual = await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: buildContext(),
          db: wrapPrismaClient(prisma, counter),
        });

        return {
          durationMs: Number((performance.now() - startedAt).toFixed(3)),
          queryCount: counter.total,
          operations: counter.operations,
          activeCatalogRowsLoaded: activeCatalog.length,
          candidateCountEvaluated: candidateResults.candidates.length,
          eligibleCandidateCount: eligibleRankingEntries.length,
          rankedCandidateCount: rankedResults.rankedCandidates.length,
          responseBytes: Buffer.byteLength(JSON.stringify(actual), "utf8"),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.queryCount, PERFORMANCE_BUDGETS.recommendationQueryCount);
      assert.deepEqual(actual.operations, ["workoutSession.findUnique", "exercise.findMany"]);
      assert.equal(actual.activeCatalogRowsLoaded, actual.candidateCountEvaluated);
      assert.equal(actual.rankedCandidateCount, actual.eligibleCandidateCount);
      assert.ok(actual.responseBytes <= PERFORMANCE_BUDGETS.recommendationResponseBytes);
    },
  },
  {
    name: "2. apply query count is bounded, independent of catalog size, and payload stays within V1 budget",
    input: { source: "Back Squat", replacement: "Front Squat" },
    run: async () => {
      const fixture = await createFixture({ suffix: "apply" });

      try {
        const counter = createCounter();
        const service = createReplacementApplyService({
          prismaClient: wrapPrismaClient(prisma, counter),
        });

        const startedAt = performance.now();
        const actual = await service.applyWorkoutExerciseReplacementV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          replacementExerciseId: fixture.replacementExercise.id,
        });

        return {
          durationMs: Number((performance.now() - startedAt).toFixed(3)),
          transactionDurationMs: counter.transactionDurationsMs[0] ?? null,
          queryCount: counter.total,
          operations: counter.operations,
          targetRowsChanged: actual.session.exerciseTargets.filter((entry) => entry.id === fixture.sourceTarget.id).length,
          setLogRowsChanged: actual.session.setLogs.filter(
            (entry) => entry.exerciseId === fixture.replacementExercise.id
          ).length,
          responseBytes: Buffer.byteLength(JSON.stringify(actual), "utf8"),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.queryCount, PERFORMANCE_BUDGETS.applyQueryCount);
      assert.deepEqual(actual.operations, [
        "$queryRaw",
        "workoutSession.findUnique",
        "exercise.findUnique",
        "workoutSessionExerciseTarget.updateMany",
        "setLog.updateMany",
        "workoutSession.findUnique",
        "program.findUnique",
        "programDay.findUnique",
      ]);
      assert.equal(actual.targetRowsChanged, 1);
      assert.equal(actual.setLogRowsChanged, 1);
      assert.ok(actual.responseBytes <= PERFORMANCE_BUDGETS.applyResponseBytes);
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    testCase.assertResult(actual);
    printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
    passed += 1;
  } catch (error) {
    printCaseResult({ name: testCase.name, input: testCase.input, error, status: "FAIL" });
    failed += 1;
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  throw new Error(`${failed} replacement performance test case(s) failed`);
}
