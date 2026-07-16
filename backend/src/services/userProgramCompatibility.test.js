import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { getProgramById, getRegenerationRecommendation } from "../controllers/programs.js";
import { getMyActiveProgram } from "../controllers/userPrograms.js";
import { getUserWorkoutSessions, startFromActiveProgram } from "../controllers/workouts.js";
import { generateProgramForUser } from "./programGenerator.js";

const TEST_EMAIL_DOMAIN = "@example.com";

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

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function buildCompleteProfileData(overrides = {}) {
  return {
    goal: "hypertrophy",
    trainingLevel: "intermediate",
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
    wizardCompletedAt: new Date(),
    lastCompletedStep: 20,
    ...overrides,
  };
}

async function createTestUser({ profileData, suffix }) {
  const user = await prisma.user.create({
    data: {
      email: `user-program-compat-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `User Program Compat ${suffix}`,
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

async function snapshotCounts() {
  const [
    userProgram,
    userProgramProfileSnapshot,
    program,
    programDay,
    programDayExercise,
    workoutSession,
    setLog,
    progressionRecommendation,
    user,
    userProfile,
  ] = await Promise.all([
    prisma.userProgram.count(),
    prisma.userProgramProfileSnapshot.count(),
    prisma.program.count(),
    prisma.programDay.count(),
    prisma.programDayExercise.count(),
    prisma.workoutSession.count(),
    prisma.setLog.count(),
    prisma.progressionRecommendation.count(),
    prisma.user.count(),
    prisma.userProfile.count(),
  ]);

  return {
    userProgram,
    userProgramProfileSnapshot,
    program,
    programDay,
    programDayExercise,
    workoutSession,
    setLog,
    progressionRecommendation,
    user,
    userProfile,
  };
}

async function getActiveUserProgram(userId) {
  return prisma.userProgram.findFirstOrThrow({
    where: { userId, isActive: true },
  });
}

async function createHistoricalUserProgram({
  userId,
  snapshotData = null,
  currentDayIndex = 0,
  goal = "hypertrophy",
}) {
  const exercise = await prisma.exercise.findFirstOrThrow({
    orderBy: { id: "asc" },
  });

  const program = await prisma.program.create({
    data: {
      name: `Historical Program ${userId} ${Date.now()}`,
      description: "Historical compatibility fixture",
      splitFamily: "upper_lower",
      goal,
      isStatic: false,
    },
  });

  const day = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 0,
      name: "Historical Day",
    },
  });

  await prisma.programDayExercise.create({
    data: {
      programDayId: day.id,
      exerciseId: exercise.id,
      order: 0,
      sets: 3,
      repRangeLow: 8,
      repRangeHigh: 12,
      restSeconds: 90,
      intensity: null,
      progressionType: exercise.progressionType ?? null,
    },
  });

  const userProgram = await prisma.userProgram.create({
    data: {
      userId,
      programId: program.id,
      currentDayIndex,
      activatedAt: new Date("2026-05-01T09:00:00.000Z"),
      isActive: false,
    },
  });

  if (snapshotData) {
    await prisma.userProgramProfileSnapshot.create({
      data: {
        userProgramId: userProgram.id,
        ...snapshotData,
      },
    });
  }

  return { program, day, userProgram };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const beforeCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_BEFORE: ${serializeForLog(beforeCounts)}`);

  const cases = [
    {
      name: "active/inactive coexistence -> getMyActiveProgram returns only the active row",
      input: "one archived row and one active row for the same user",
      fn: async () => {
        const suffix = `coexist-current-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const activeProgram = await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgram(user.id);
          const historical = await createHistoricalUserProgram({ userId: user.id });
          const res = createMockRes();

          await getMyActiveProgram({ userId: user.id }, res);

          assert.equal(res.statusCode, 200);
          assert.equal(res.body.success, true);
          assert(res.body.data);
          assert.equal(res.body.data.id, activeUserProgram.id);
          assert.equal(res.body.data.programId, activeProgram.id);
          assert.notEqual(res.body.data.id, historical.userProgram.id);

          return {
            activeUserProgramId: activeUserProgram.id,
            returnedProgramId: res.body.data.programId,
            archivedUserProgramId: historical.userProgram.id,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "inactive-only -> treated as no active program by active-program and regeneration endpoints",
      input: "user has only archived UserProgram rows",
      fn: async () => {
        const suffix = `inactive-only-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await createHistoricalUserProgram({ userId: user.id });
          await createHistoricalUserProgram({ userId: user.id, goal: "strength" });

          const activeProgramRes = createMockRes();
          const regenerationRes = createMockRes();

          await getMyActiveProgram({ userId: user.id }, activeProgramRes);
          await getRegenerationRecommendation({ userId: user.id }, regenerationRes);

          assert.equal(activeProgramRes.statusCode, 200);
          assert.equal(activeProgramRes.body.success, true);
          assert.equal(activeProgramRes.body.data, null);

          assert.equal(regenerationRes.statusCode, 200);
          assert.equal(regenerationRes.body.success, true);
          assert.equal(regenerationRes.body.data.regenerationRecommended, false);
          assert.equal(regenerationRes.body.data.urgency, "none");
          assert.deepEqual(
            regenerationRes.body.data.knownLimitations.map((entry) => entry.dimension).sort(),
            ["equipmentAccess", "injuryFlags", "trainingDaysPerWeek"]
          );

          return {
            activeProgramResponse: activeProgramRes.body,
            regenerationResponse: regenerationRes.body,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "regeneration recommendation -> uses active snapshot, not archived snapshot",
      input: "archived snapshot differs from active snapshot",
      fn: async () => {
        const suffix = `regen-active-snapshot-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData({
            trainingDaysPerWeek: 4,
          }),
        });

        try {
          await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgram(user.id);

          await createHistoricalUserProgram({
            userId: user.id,
            snapshotData: {
              goal: "hypertrophy",
              equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
              injuryFlags: ["none"],
              trainingDaysPerWeek: 2,
            },
          });

          await prisma.userProfile.update({
            where: { userId: user.id },
            data: { trainingDaysPerWeek: 2 },
          });

          const res = createMockRes();
          await getRegenerationRecommendation({ userId: user.id }, res);

          const trainingDaysFactor = res.body.data.triggeringFactors.find(
            (factor) => factor.factor === "profile_drift_training_days_per_week"
          );

          assert.equal(res.statusCode, 200);
          assert.equal(res.body.success, true);
          assert(trainingDaysFactor);
          assert.equal(
            trainingDaysFactor.detail,
            "Program snapshot trainingDaysPerWeek=4 while current user trainingDaysPerWeek=2."
          );

          return {
            activeUserProgramId: activeUserProgram.id,
            response: res.body,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "startFromActiveProgram -> resolves only the active row when archived rows coexist",
      input: "active and archived rows point at different programs",
      fn: async () => {
        const suffix = `start-active-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const activeProgram = await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgram(user.id);
          await createHistoricalUserProgram({ userId: user.id });

          const res = createMockRes();
          await startFromActiveProgram({ userId: user.id }, res);

          assert.equal(res.statusCode, 200);
          assert.equal(res.body.success, true);
          assert.equal(res.body.data.resumed, false);
          assert.equal(res.body.data.session.programId, activeUserProgram.programId);
          assert.equal(res.body.data.program.id, activeProgram.id);
          assert.equal(res.body.data.programDay.programId, activeProgram.id);

          return res.body;
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "historical listings -> inactive program history remains queryable and unchanged",
      input: "completed session attached to archived program",
      fn: async () => {
        const suffix = `historical-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const historical = await createHistoricalUserProgram({ userId: user.id });
          const exerciseRow = await prisma.programDayExercise.findFirstOrThrow({
            where: { programDayId: historical.day.id },
            orderBy: { order: "asc" },
          });

          const session = await prisma.workoutSession.create({
            data: {
              userId: user.id,
              programId: historical.program.id,
              programDayId: historical.day.id,
              startedAt: new Date("2026-07-10T09:00:00.000Z"),
              completedAt: new Date("2026-07-10T09:45:00.000Z"),
              status: "completed",
            },
          });

          await prisma.setLog.create({
            data: {
              sessionId: session.id,
              exerciseId: exerciseRow.exerciseId,
              setNumber: 1,
              weightKg: 40,
              reps: 10,
              loggedAt: new Date("2026-07-10T09:10:00.000Z"),
            },
          });

          const sessionsRes = createMockRes();
          await getUserWorkoutSessions(
            { userId: user.id, params: { userId: String(user.id) }, query: {} },
            sessionsRes
          );

          const programRes = createMockRes();
          await getProgramById(
            { params: { id: String(historical.program.id) } },
            programRes
          );

          const returnedSession = sessionsRes.body.data.find((entry) => entry.id === session.id);

          assert.equal(sessionsRes.statusCode, 200);
          assert.equal(programRes.statusCode, 200);
          assert(returnedSession);
          assert.equal(returnedSession.program.id, historical.program.id);
          assert.equal(returnedSession.programDay.id, historical.day.id);
          assert.equal(programRes.body.data.id, historical.program.id);

          return {
            workoutSessionsResponse: sessionsRes.body,
            programResponse: programRes.body,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const afterCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_AFTER: ${serializeForLog(afterCounts)}`);
  assert.deepEqual(afterCounts, beforeCounts);

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  await prisma.$disconnect();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
