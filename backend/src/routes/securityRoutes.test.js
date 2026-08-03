import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import app from "../app.js";
import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "../services/programGenerator.js";

const TEST_EMAIL_DOMAIN = "@example.com";

function buildCompleteProfileData() {
  return {
    goal: "hypertrophy",
    trainingLevel: "beginner",
    trainingDaysPerWeek: 4,
    sessionDurationMin: 60,
    equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
    age: 30,
    sex: "male",
    heightCm: 178,
    weightKg: 78,
    occupationType: "desk",
    recoveryQuality: "medium",
    nutritionHabits: "balanced",
    mealFrequency: 3,
    supplementUse: [],
    cardioPreference: "walking",
    injuryFlags: ["none"],
    injuryNotes: null,
    preferredLanguage: "en",
    timezone: "UTC",
    units: "metric",
    wizardCompleted: true,
    wizardCompletedAt: new Date("2026-07-01T00:00:00.000Z"),
    lastCompletedStep: 20,
  };
}

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

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

async function createTestUser({ suffix, profileData = null }) {
  const user = await prisma.user.create({
    data: {
      email: `security-routes-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Security Routes ${suffix}`,
      password: "hashed-password",
    },
  });

  if (profileData) {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        ...profileData,
      },
    });
  }

  return user;
}

async function cleanupUserArtifacts(userId) {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    select: { id: true },
  });
  const sessionIds = sessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await prisma.recommendationApplication.deleteMany({
      where: {
        OR: [
          { workoutSessionId: { in: sessionIds } },
          {
            recommendation: {
              sourceSessionId: { in: sessionIds },
            },
          },
        ],
      },
    });

    await prisma.workoutSessionExerciseTarget.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });

    await prisma.progressionRecommendation.deleteMany({
      where: {
        OR: [
          { userId },
          { sourceSessionId: { in: sessionIds } },
        ],
      },
    });
  } else {
    await prisma.progressionRecommendation.deleteMany({ where: { userId } });
  }

  await prisma.setLog.deleteMany({
    where: {
      session: {
        userId,
      },
    },
  });
  await prisma.workoutSession.deleteMany({ where: { userId } });

  const userPrograms = await prisma.userProgram.findMany({
    where: { userId },
    select: { programId: true },
  });
  const programIds = [...new Set(userPrograms.map((entry) => entry.programId))];

  await prisma.userProgram.deleteMany({ where: { userId } });

  if (programIds.length > 0) {
    const dynamicPrograms = await prisma.program.findMany({
      where: {
        id: { in: programIds },
        isStatic: false,
      },
      select: { id: true },
    });
    const dynamicProgramIds = dynamicPrograms.map((entry) => entry.id);

    if (dynamicProgramIds.length > 0) {
      await prisma.programDayExercise.deleteMany({
        where: {
          programDay: {
            programId: { in: dynamicProgramIds },
          },
        },
      });

      await prisma.programDay.deleteMany({
        where: {
          programId: { in: dynamicProgramIds },
        },
      });

      await prisma.program.deleteMany({
        where: {
          id: { in: dynamicProgramIds },
        },
      });
    }
  }

  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function addSetLogsForSession({ sessionId, exerciseId, sets }) {
  for (const [index, set] of sets.entries()) {
    await prisma.setLog.create({
      data: {
        sessionId,
        exerciseId,
        setNumber: index + 1,
        reps: set.reps,
        weightKg: set.weightKg,
      },
    });
  }
}

function buildBaseUrl(server) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral server port");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function listenEphemeral() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      resolve(server);
    });

    server.on("error", reject);
  });
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body,
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

async function main() {
  let passed = 0;
  let failed = 0;
  const createdUserIds = new Set();
  const server = await listenEphemeral();
  const baseUrl = buildBaseUrl(server);

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  async function test(name, input, fn) {
    const didPass = await runCase(name, input, fn);
    if (didPass) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  try {
    await test("POST /api/sessions rejects unauthenticated requests", {}, async () => {
      const response = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 401);
      assert.equal(response.body.success, false);
      return response.body;
    });

    await test("POST /api/sessions creates only for the authenticated user", {}, async () => {
      const user = await createTestUser({
        suffix: `owner-${Date.now()}`,
        profileData: buildCompleteProfileData(),
      });
      createdUserIds.add(user.id);
      await generateProgramForUser(user.id);

      const response = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(user)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.userId, user.id);
      assert.equal(response.body.data.status, "active");
      assert.equal(Object.prototype.hasOwnProperty.call(response.body.data, "program"), false);
      return response.body;
    });

    await test("POST /api/sessions rejects cross-user body ownership", {}, async () => {
      const owner = await createTestUser({
        suffix: `owner-${Date.now()}-a`,
        profileData: buildCompleteProfileData(),
      });
      const other = await createTestUser({ suffix: `owner-${Date.now()}-b` });
      createdUserIds.add(owner.id);
      createdUserIds.add(other.id);
      await generateProgramForUser(owner.id);

      const response = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(owner)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: other.id }),
      });

      assert.equal(response.status, 403);
      assert.equal(response.body.success, false);
      return response.body;
    });

    await test("POST /api/sessions rejects unsupported legacy fields", {}, async () => {
      const user = await createTestUser({
        suffix: `unsupported-${Date.now()}`,
        profileData: buildCompleteProfileData(),
      });
      createdUserIds.add(user.id);
      await generateProgramForUser(user.id);

      const response = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(user)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ programId: 123 }),
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.success, false);
      return response.body;
    });

    await test("POST /api/sessions preserves the active-program invariant", {}, async () => {
      const user = await createTestUser({ suffix: `no-program-${Date.now()}` });
      createdUserIds.add(user.id);

      const response = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(user)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.equal(response.status, 404);
      assert.equal(response.body.success, false);
      return response.body;
    });

    await test("POST /api/sessions preserves active-session replay behavior", {}, async () => {
      const user = await createTestUser({
        suffix: `replay-${Date.now()}`,
        profileData: buildCompleteProfileData(),
      });
      createdUserIds.add(user.id);
      await generateProgramForUser(user.id);

      const first = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(user)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const second = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(user)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(first.body.data.id, second.body.data.id);
      return {
        first: first.body.data.id,
        second: second.body.data.id,
      };
    });

    await test("PATCH /api/sessions/:sessionId/complete exposes additive public explanations only on fresh completion", {}, async () => {
      const user = await createTestUser({
        suffix: `complete-${Date.now()}`,
        profileData: buildCompleteProfileData(),
      });
      createdUserIds.add(user.id);
      await generateProgramForUser(user.id);

      const startResponse = await requestJson(baseUrl, "/api/sessions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${createToken(user)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.equal(startResponse.status, 200);

      const [firstTarget, secondTarget] = startResponse.body.data.exerciseTargets.slice(0, 2);
      await addSetLogsForSession({
        sessionId: startResponse.body.data.id,
        exerciseId: firstTarget.exerciseId,
        sets: [{ reps: 10, weightKg: 40 }],
      });
      await addSetLogsForSession({
        sessionId: startResponse.body.data.id,
        exerciseId: secondTarget.exerciseId,
        sets: [{ reps: 12, weightKg: 0 }],
      });

      const completeResponse = await requestJson(
        baseUrl,
        `/api/sessions/${startResponse.body.data.id}/complete`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${createToken(user)}`,
          },
        }
      );

      assert.equal(completeResponse.status, 200);
      assert.equal(completeResponse.body.success, true);
      assert.equal(Array.isArray(completeResponse.body.data.progressionRecommendations), true);
      assert.equal(Object.hasOwn(completeResponse.body.data, "progressionWarning"), true);

      for (const recommendation of completeResponse.body.data.progressionRecommendations) {
        assert.equal(typeof recommendation.explanation?.messageKey, "string");
        assert.equal(typeof recommendation.explanation?.userSummary, "string");
        assert.equal(Object.hasOwn(recommendation.explanation, "developerSummary"), false);
        assert.equal(Object.hasOwn(recommendation.explanation, "primaryReason"), false);
        assert.equal(Object.hasOwn(recommendation.explanation, "secondaryReasons"), false);
        assert.equal(Object.hasOwn(recommendation, "programDayExerciseId"), false);
      }

      return {
        responseKeys: Object.keys(completeResponse.body.data),
        recommendationSummaries: completeResponse.body.data.progressionRecommendations.map(
          (recommendation) => ({
            exerciseId: recommendation.exerciseId,
            reasonCode: recommendation.reasonCode,
            explanation: recommendation.explanation,
          })
        ),
      };
    });

    await test("GET /api/users is unavailable", {}, async () => {
      const response = await requestJson(baseUrl, "/api/users");
      assert.equal(response.status, 404);
      return response.body;
    });

    await test("GET /api/users/:id is unavailable", {}, async () => {
      const response = await requestJson(baseUrl, "/api/users/1");
      assert.equal(response.status, 404);
      return response.body;
    });

    await test("GET /api/profile remains protected and unchanged", {}, async () => {
      const user = await createTestUser({ suffix: `profile-${Date.now()}` });
      createdUserIds.add(user.id);

      const response = await requestJson(baseUrl, "/api/profile", {
        headers: {
          authorization: `Bearer ${createToken(user)}`,
        },
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data, null);
      return response.body;
    });
  } finally {
    await closeServer(server);

    for (const userId of createdUserIds) {
      await cleanupUserArtifacts(userId);
    }
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  console.log("SUMMARY: 0 passed, 1 failed, 1 total");
  process.exitCode = 1;
});
