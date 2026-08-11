import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import app from "../app.js";
import prisma from "../lib/prisma.js";

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

  const connectionKey = typeof server._connectionKey === "string" ? server._connectionKey : "";
  const match = connectionKey.match(/:(\d+)$/);
  if (match) {
    return `http://127.0.0.1:${match[1]}`;
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
      email: `replacement-route-${suffix}-${TEST_RUN_NONCE}${TEST_EMAIL_DOMAIN}`,
      name: `Replacement Route ${suffix}`,
      password: "hashed-password",
    },
  });
}

async function cleanupFixture(fixture) {
  if (!fixture) {
    return;
  }

  const sessionId = fixture.session?.id ?? null;
  const programId = fixture.program?.id ?? null;
  const programDayId = fixture.programDay?.id ?? null;
  const programDayExerciseIds = fixture.programDayExercises?.map((entry) => entry.id) ?? [];
  const customExerciseIds = fixture.customExercises?.map((entry) => entry.id) ?? [];
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

  if (customExerciseIds.length > 0) {
    await prisma.exercise.deleteMany({ where: { id: { in: customExerciseIds } } });
  }

  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
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
  const otherUser = await createTestUser(`${suffix}-other`);
  const namedExercises = await loadExercisesByName(exerciseNames);
  const exercises = exerciseNames.map((name) => namedExercises.get(name));

  const program = await prisma.program.create({
    data: {
      name: `Replacement Route Program ${suffix}`,
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const programDay = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 1,
      name: "Replacement Route Day",
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
    otherUser,
    session,
    program,
    programDay,
    programDayExercises,
    sourceTarget,
    targets,
    customExercises: [],
  };
}

const cases = [
  {
    name: "1. authenticated success returns contextual recommendation projection",
    input: { path: "success" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "success",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        const before = await prisma.workoutSession.findUnique({
          where: { id: fixture.session.id },
          include: { exerciseTargets: true },
        });

        const response = await requestJson(
          baseUrl,
          `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${createToken(fixture.user)}`,
            },
            body: JSON.stringify({ context: buildContext() }),
          }
        );

        const after = await prisma.workoutSession.findUnique({
          where: { id: fixture.session.id },
          include: { exerciseTargets: true },
        });

        return { response, before, after, fixture };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response, before, after }) => {
      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.source.exercise.nameEn, "Back Squat");
      assert.equal(response.body.data.recommendedReplacement.nameEn, "Front Squat");
      assert.equal("similarityBreakdown" in response.body.data.recommendedReplacement, false);
      assert.equal(before.exerciseTargets.length, after.exerciseTargets.length);
    },
  },
  {
    name: "2. missing auth is rejected by middleware",
    input: { auth: "missing" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "missing-auth",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return {
          response: await requestJson(
            baseUrl,
            `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ context: buildContext() }),
            }
          ),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 401);
      assert.equal(response.body.success, false);
    },
  },
  {
    name: "3. malformed context returns 400",
    input: { context: { version: "wrong" } },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "bad-context",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return {
          response: await requestJson(
            baseUrl,
            `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${createToken(fixture.user)}`,
              },
              body: JSON.stringify({ context: { version: "wrong" } }),
            }
          ),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "REPLACEMENT_CONTEXT_INVALID");
    },
  },
  {
    name: "4. invalid intent value returns 400",
    input: { replacementIntent: "INJURY" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "bad-intent",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return {
          response: await requestJson(
            baseUrl,
            `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${createToken(fixture.user)}`,
              },
              body: JSON.stringify({
                context: buildContext({
                  replacementIntent: {
                    version: "replacement-intent-v1",
                    type: "INJURY",
                  },
                }),
              }),
            }
          ),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "REPLACEMENT_CONTEXT_INVALID");
    },
  },
  {
    name: "5. session not found returns 404",
    input: { sessionId: 999999 },
    run: async (baseUrl) => {
      const user = await createTestUser("session-not-found");
      try {
        return {
          response: await requestJson(baseUrl, "/api/sessions/999999/exercise-targets/1/replacements", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${createToken(user)}`,
            },
            body: JSON.stringify({ context: buildContext() }),
          }),
        };
      } finally {
        await prisma.user.deleteMany({ where: { id: user.id } });
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 404);
      assert.equal(response.body.code, "WORKOUT_SESSION_NOT_FOUND");
    },
  },
  {
    name: "6. source occurrence not found returns 404",
    input: { targetId: 999999 },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "target-not-found",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return {
          response: await requestJson(
            baseUrl,
            `/api/sessions/${fixture.session.id}/exercise-targets/999999/replacements`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${createToken(fixture.user)}`,
              },
              body: JSON.stringify({ context: buildContext() }),
            }
          ),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 404);
      assert.equal(response.body.code, "WORKOUT_SESSION_EXERCISE_TARGET_NOT_FOUND");
    },
  },
  {
    name: "7. ownership mismatch follows existing session convention and returns 404",
    input: { owner: "other-user" },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "ownership",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return {
          response: await requestJson(
            baseUrl,
            `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${createToken(fixture.otherUser)}`,
              },
              body: JSON.stringify({ context: buildContext() }),
            }
          ),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 404);
      assert.equal(response.body.code, "WORKOUT_SESSION_NOT_FOUND");
    },
  },
  {
    name: "8. valid no-replacement outcome returns 200 rather than an error",
    input: { noReplacement: true },
    run: async (baseUrl) => {
      const fixture = await createSessionFixture({
        suffix: "no-replacement",
        exerciseNames: ["Cable Curl", "Bench Press", "Romanian Deadlift", "Front Squat"],
        sourceExerciseName: "Cable Curl",
      });

      try {
        return {
          response: await requestJson(
            baseUrl,
            `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${createToken(fixture.user)}`,
              },
              body: JSON.stringify({
                context: buildContext({
                  equipmentContext: { availableEquipment: [] },
                  replacementIntent: {
                    version: "replacement-intent-v1",
                    type: "NO_EQUIPMENT",
                  },
                }),
              }),
            }
          ),
        };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ response }) => {
      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.contextualDecisionStatus, "NO_CONTEXTUAL_REPLACEMENT");
      assert.equal(response.body.data.recommendedReplacement, null);
    },
  },
];

const server = await listenEphemeral();
const baseUrl = buildBaseUrl(server);

let passed = 0;
let failed = 0;

try {
  for (const testCase of cases) {
    try {
      const actual = await testCase.run(baseUrl);
      testCase.assertResult(actual);
      printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
      passed += 1;
    } catch (error) {
      printCaseResult({ name: testCase.name, input: testCase.input, error, status: "FAIL" });
      failed += 1;
    }
  }
} finally {
  await closeServer(server);
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}
