import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import app from "../app.js";
import prisma from "../lib/prisma.js";
import { APPLY_REPLACEMENT_AUDIT_VERSION, APPLY_REPLACEMENT_DECISION_TYPE } from "../services/replacementApplyService.js";

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
      email: `replacement-apply-route-${suffix}-${TEST_RUN_NONCE}${TEST_EMAIL_DOMAIN}`,
      name: `Replacement Apply Route ${suffix}`,
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
  const otherUser = await createTestUser(`${suffix}-other`);
  const seededExercises = await loadExercisesByName(["Back Squat", "Romanian Deadlift", "Front Squat"]);
  const exercises = ["Back Squat", "Romanian Deadlift"].map((name) => seededExercises.get(name));
  const replacementExercise = seededExercises.get("Front Squat");

  const program = await prisma.program.create({
    data: {
      name: `Replacement Apply Route Program ${suffix}`,
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const programDay = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 1,
      name: "Replacement Apply Route Day",
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
          sourceDecisionType: "MAINTAIN",
          sourceRulesVersion: "progression_decision_rules_v5",
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
    otherUser,
    program,
    programDay,
    programDayExercises,
    session,
    sourceTarget: targets[0],
    replacementExercise,
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

const cases = [
  {
    name: "1. successful apply mutates the targeted workout occurrence and returns the updated workout",
    input: { case: "success" },
    run: async ({ baseUrl }) => {
      const fixture = await createFixture({ suffix: "success" });
      const response = await requestJson(
        baseUrl,
        `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createToken(fixture.user)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replacementExerciseId: fixture.replacementExercise.id,
          }),
        }
      );
      const updatedTarget = await prisma.workoutSessionExerciseTarget.findUnique({
        where: { id: fixture.sourceTarget.id },
      });
      return { fixture, response, updatedTarget, audit: JSON.parse(updatedTarget.sourceRulesVersion) };
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 200);
      assert.equal(actual.response.body.success, true);
      assert.equal(actual.updatedTarget.exerciseId, actual.fixture.replacementExercise.id);
      assert.equal(actual.updatedTarget.sourceDecisionType, APPLY_REPLACEMENT_DECISION_TYPE);
      assert.equal(actual.audit.version, APPLY_REPLACEMENT_AUDIT_VERSION);
    },
  },
  {
    name: "2. missing auth returns 401",
    input: { auth: "missing" },
    run: async ({ baseUrl }) => {
      const fixture = await createFixture({ suffix: "auth" });
      const response = await requestJson(
        baseUrl,
        `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replacementExerciseId: fixture.replacementExercise.id,
          }),
        }
      );
      return { fixture, response };
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 401);
    },
  },
  {
    name: "3. ownership mismatch returns 404",
    input: { owner: "other-user" },
    run: async ({ baseUrl }) => {
      const fixture = await createFixture({ suffix: "ownership" });
      const response = await requestJson(
        baseUrl,
        `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createToken(fixture.otherUser)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replacementExerciseId: fixture.replacementExercise.id,
          }),
        }
      );
      return { fixture, response };
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 404);
      assert.equal(actual.response.body.code, "WORKOUT_SESSION_NOT_FOUND");
    },
  },
  {
    name: "4. invalid selected replacement returns 422",
    input: { replacementExerciseId: 999999 },
    run: async ({ baseUrl }) => {
      const fixture = await createFixture({ suffix: "invalid" });
      const response = await requestJson(
        baseUrl,
        `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createToken(fixture.user)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replacementExerciseId: 999999,
          }),
        }
      );
      return { fixture, response };
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 422);
      assert.equal(actual.response.body.code, "REPLACEMENT_EXERCISE_INVALID");
    },
  },
  {
    name: "5. duplicate apply returns 409",
    input: { case: "duplicate" },
    run: async ({ baseUrl }) => {
      const fixture = await createFixture({ suffix: "duplicate" });
      await requestJson(
        baseUrl,
        `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createToken(fixture.user)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replacementExerciseId: fixture.replacementExercise.id,
          }),
        }
      );
      const response = await requestJson(
        baseUrl,
        `/api/sessions/${fixture.session.id}/exercise-targets/${fixture.sourceTarget.id}/replacements/apply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createToken(fixture.user)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            replacementExerciseId: fixture.replacementExercise.id,
          }),
        }
      );
      return { fixture, response };
    },
    assertResult: (actual) => {
      assert.equal(actual.response.status, 409);
      assert.equal(actual.response.body.code, "REPLACEMENT_ALREADY_APPLIED");
    },
  },
];

const server = await listenEphemeral();
const baseUrl = buildBaseUrl(server);

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  let fixture = null;
  try {
    const actual = await testCase.run({ baseUrl });
    fixture = actual.fixture ?? null;
    testCase.assertResult(actual);
    printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
    passed += 1;
  } catch (error) {
    printCaseResult({ name: testCase.name, input: testCase.input, error, status: "FAIL" });
    failed += 1;
  } finally {
    await cleanupFixture(fixture);
  }
}

await closeServer(server);

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}
