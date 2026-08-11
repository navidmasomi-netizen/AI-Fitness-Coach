import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import app from "../app.js";
import prisma from "../lib/prisma.js";
import { __setStructuredLogSinkForTest } from "../lib/structuredLogger.js";

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

function createToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

function buildContext(overrides = {}) {
  return {
    version: "replacement-context-v1",
    equipmentContext: null,
    replacementIntent: null,
    ...overrides,
  };
}

async function listenEphemeral() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, () => resolve(server));
    server.on("error", reject);
  });
}

function buildBaseUrl(server) {
  const address = server.address();
  if (address && typeof address === "object" && Number.isInteger(address.port) && address.port > 0) {
    return `http://127.0.0.1:${address.port}`;
  }

  throw new Error("Expected ephemeral server address");
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function createTestUser(suffix) {
  return prisma.user.create({
    data: {
      email: `replacement-observability-${suffix}-${TEST_RUN_NONCE}${TEST_EMAIL_DOMAIN}`,
      name: `Replacement Observability ${suffix}`,
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

async function createSessionFixture({ suffix, exerciseNames, sourceExerciseName } = {}) {
  const user = await createTestUser(`${suffix}-owner`);
  const namedExercises = await loadExercisesByName(exerciseNames);
  const exercises = exerciseNames.map((name) => namedExercises.get(name));

  const program = await prisma.program.create({
    data: {
      name: `Replacement Observability Program ${suffix}`,
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const programDay = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 1,
      name: "Replacement Observability Day",
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
          targetLoadKg: null,
          targetDurationSeconds: null,
          progressionType: "load",
        },
      })
    );
  }

  const sourceTarget = targets.find((target) => {
    const exercise = exercises.find((entry) => entry.id === target.exerciseId);
    return exercise?.nameEn === sourceExerciseName;
  });

  if (!sourceTarget) {
    throw new Error(`Expected source target "${sourceExerciseName}".`);
  }

  return {
    user,
    session,
    program,
    programDay,
    programDayExercises,
    sourceTarget,
    targets,
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

function captureStructuredLogs() {
  const events = [];
  __setStructuredLogSinkForTest((level, entry) => {
    events.push({ level, ...entry });
  });

  return {
    events,
    reset() {
      __setStructuredLogSinkForTest(null);
    },
  };
}

const cases = [
  {
    name: "1. discovery logs structured started and completed events with correlation ids",
    input: { case: "discovery success observability" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "discovery-success",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });
      const flowId = "flow-discovery-123";
      const capture = captureStructuredLogs();

      try {
        const response = await requestJson(
          baseUrl,
          `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${createToken(fixture.user)}`,
              "X-Replacement-Flow-Id": flowId,
            },
            body: JSON.stringify({
              context: buildContext({
                replacementIntent: { version: "replacement-intent-v1", type: "PREFER_VARIATION" },
              }),
            }),
          }
        );

        return { fixture, flowId, response, events: capture.events };
      } finally {
        capture.reset();
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 200);
      const started = actual.events.find((entry) => entry.event === "replacement.discovery.started");
      const completed = actual.events.find((entry) => entry.event === "replacement.discovery.completed");
      assert.ok(started);
      assert.ok(completed);
      assert.equal(started.replacementFlowId, actual.flowId);
      assert.equal(completed.replacementFlowId, actual.flowId);
      assert.equal(typeof started.requestId, "string");
      assert.equal(started.requestId.length > 0, true);
      assert.equal(started.requestId, completed.requestId);
      assert.equal(completed.contextualDecisionStatus, actual.response.body.data.contextualDecisionStatus);
      assert.equal(typeof completed.serviceDurationMs, "number");
      assert.equal(typeof completed.apiDurationMs, "number");
    },
  },
  {
    name: "2. apply success logs structured started and completed events with mutation timing",
    input: { case: "apply success observability" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "apply-success",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Leg Press", "Front Squat"],
        sourceExerciseName: "Back Squat",
      });
      const replacementExercise = await prisma.exercise.findFirst({
        where: { nameEn: "Front Squat" },
      });
      const flowId = "flow-apply-success-123";
      const capture = captureStructuredLogs();

      try {
        const response = await requestJson(
          baseUrl,
          `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${createToken(fixture.user)}`,
              "X-Replacement-Flow-Id": flowId,
            },
            body: JSON.stringify({
              replacementExerciseId: replacementExercise.id,
            }),
          }
        );

        return { fixture, flowId, response, replacementExercise, events: capture.events };
      } finally {
        capture.reset();
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 200);
      const started = actual.events.find((entry) => entry.event === "replacement.apply.started");
      const completed = actual.events.find((entry) => entry.event === "replacement.apply.completed");
      assert.ok(started);
      assert.ok(completed);
      assert.equal(started.replacementFlowId, actual.flowId);
      assert.equal(completed.replacementFlowId, actual.flowId);
      assert.equal(started.requestId, completed.requestId);
      assert.equal(completed.appliedReplacementExerciseId, actual.replacementExercise.id);
      assert.equal(completed.targetRowsChanged, 1);
      assert.equal(typeof completed.transactionDurationMs, "number");
      assert.equal(typeof completed.serviceDurationMs, "number");
      assert.equal(typeof completed.apiDurationMs, "number");
    },
  },
  {
    name: "3. apply failure logs structured conflict or validation category without changing response behavior",
    input: { case: "apply validation failure observability" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "apply-failed",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Leg Press", "Front Squat"],
        sourceExerciseName: "Back Squat",
      });
      const flowId = "flow-apply-failed-123";
      const capture = captureStructuredLogs();

      try {
        const response = await requestJson(
          baseUrl,
          `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${createToken(fixture.user)}`,
              "X-Replacement-Flow-Id": flowId,
            },
            body: JSON.stringify({
              replacementExerciseId: 999999,
            }),
          }
        );

        return { fixture, flowId, response, events: capture.events };
      } finally {
        capture.reset();
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 422);
      const failed = actual.events.find((entry) => entry.event === "replacement.apply.failed");
      assert.ok(failed);
      assert.equal(failed.replacementFlowId, actual.flowId);
      assert.equal(failed.failureCategory, "validation");
      assert.equal(failed.statusCode, 422);
      assert.equal(failed.errorCode, "REPLACEMENT_EXERCISE_INVALID");
      assert.equal(typeof failed.apiDurationMs, "number");
    },
  },
];

let passed = 0;
let failed = 0;
let server = null;

try {
  server = await listenEphemeral();
  const baseUrl = buildBaseUrl(server);

  for (const testCase of cases) {
    let fixture = null;
    try {
      const actual = await testCase.run(baseUrl);
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
} finally {
  __setStructuredLogSinkForTest(null);
  if (server) {
    await closeServer(server);
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}
