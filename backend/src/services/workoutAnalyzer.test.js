import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "./programGenerator.js";
import {
  analyzeWorkoutHistory,
  computePatternSummaries,
  computePerformanceTrend,
  computeSessionConsistency,
  normalizeHistory,
} from "./workoutAnalyzer.js";

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

async function cleanupUserArtifacts(userId) {
  const recommendationSessions = await prisma.workoutSession.findMany({
    where: { userId },
    select: { id: true },
  });

  const sessionIds = recommendationSessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await prisma.progressionRecommendation.deleteMany({
      where: { sourceSessionId: { in: sessionIds } },
    });
  }

  await prisma.progressionRecommendation.deleteMany({ where: { userId } });
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

  await prisma.userProgram.deleteMany({ where: { userId } });

  const programIds = userPrograms.map((entry) => entry.programId);
  if (programIds.length > 0) {
    await prisma.programDayExercise.deleteMany({
      where: {
        programDay: {
          programId: { in: programIds },
        },
      },
    });
    await prisma.programDay.deleteMany({
      where: { programId: { in: programIds } },
    });
    await prisma.program.deleteMany({ where: { id: { in: programIds } } });
  }

  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function createTestUser({ profileData, suffix }) {
  const user = await prisma.user.create({
    data: {
      email: `workout-analyzer-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Workout Analyzer ${suffix}`,
      password: "hashed-password",
    },
  });

  if (profileData) {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        goal: profileData.goal ?? "hypertrophy",
        trainingLevel: profileData.trainingLevel ?? "beginner",
        trainingDaysPerWeek: profileData.trainingDaysPerWeek ?? 4,
        sessionDurationMin: profileData.sessionDurationMin ?? 60,
        equipmentAccess:
          profileData.equipmentAccess ??
          ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
        age: profileData.age ?? 30,
        sex: profileData.sex ?? "male",
        heightCm: profileData.heightCm ?? 178,
        weightKg: profileData.weightKg ?? 78,
        occupationType: profileData.occupationType ?? "desk",
        recoveryQuality: profileData.recoveryQuality ?? "medium",
        nutritionHabits: profileData.nutritionHabits ?? "balanced",
        mealFrequency: profileData.mealFrequency ?? 3,
        supplementUse: profileData.supplementUse ?? ["none"],
        cardioPreference: profileData.cardioPreference ?? "walking",
        injuryFlags: profileData.injuryFlags ?? ["none"],
        injuryNotes: profileData.injuryNotes ?? null,
        preferredLanguage: profileData.preferredLanguage ?? "en",
        timezone: profileData.timezone ?? "UTC",
        units: profileData.units ?? "metric",
        wizardCompleted: profileData.wizardCompleted ?? true,
        wizardCompletedAt: profileData.wizardCompletedAt ?? new Date(),
        lastCompletedStep: profileData.lastCompletedStep ?? 20,
      },
    });
  }

  return user;
}

async function snapshotCounts() {
  const [
    workoutSession,
    setLog,
    program,
    programDay,
    programDayExercise,
    userProgram,
    user,
    userProfile,
  ] = await Promise.all([
    prisma.workoutSession.count(),
    prisma.setLog.count(),
    prisma.program.count(),
    prisma.programDay.count(),
    prisma.programDayExercise.count(),
    prisma.userProgram.count(),
    prisma.user.count(),
    prisma.userProfile.count(),
  ]);

  return {
    workoutSession,
    setLog,
    program,
    programDay,
    programDayExercise,
    userProgram,
    user,
    userProfile,
  };
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

function buildNormalizedFixture() {
  const sessions = [
    {
      id: 10,
      startedAt: new Date("2026-07-01T10:00:00.000Z"),
      completedAt: new Date("2026-07-01T10:45:00.000Z"),
      status: "completed",
    },
    {
      id: 11,
      startedAt: new Date("2026-07-08T10:00:00.000Z"),
      completedAt: new Date("2026-07-08T10:45:00.000Z"),
      status: "completed",
    },
    {
      id: 12,
      startedAt: new Date("2026-07-15T10:00:00.000Z"),
      completedAt: new Date("2026-07-15T10:45:00.000Z"),
      status: "completed",
    },
  ];

  return {
    sessions,
    setLogs: [
      {
        sessionId: 10,
        exerciseId: 101,
        exerciseName: "Bench Press",
        movementPattern: "horizontal_press",
        date: new Date("2026-07-01T10:15:00.000Z"),
        weightKg: 60,
        reps: 10,
      },
      {
        sessionId: 11,
        exerciseId: 101,
        exerciseName: "Bench Press",
        movementPattern: "horizontal_press",
        date: new Date("2026-07-08T10:15:00.000Z"),
        weightKg: 60,
        reps: 12,
      },
      {
        sessionId: 12,
        exerciseId: 101,
        exerciseName: "Bench Press",
        movementPattern: "horizontal_press",
        date: new Date("2026-07-15T10:15:00.000Z"),
        weightKg: 62.5,
        reps: 12,
      },
      {
        sessionId: 11,
        exerciseId: 102,
        exerciseName: "Chest Fly",
        movementPattern: "horizontal_press",
        date: new Date("2026-07-08T10:20:00.000Z"),
        weightKg: 15,
        reps: 12,
      },
      {
        sessionId: 12,
        exerciseId: 103,
        exerciseName: "Cable Curl",
        movementPattern: "elbow_flexion",
        date: new Date("2026-07-15T10:25:00.000Z"),
        weightKg: 10,
        reps: 15,
      },
    ],
    prescribedExercises: [
      {
        exerciseId: 101,
        exerciseName: "Bench Press",
        movementPattern: "horizontal_press",
        dayType: "Upper A",
        repRangeHigh: 12,
      },
      {
        exerciseId: 102,
        exerciseName: "Chest Fly",
        movementPattern: "horizontal_press",
        dayType: "Upper A",
        repRangeHigh: 15,
      },
      {
        exerciseId: 104,
        exerciseName: "Incline Press",
        movementPattern: "horizontal_press",
        dayType: "Upper B",
        repRangeHigh: 12,
      },
    ],
    programDayCount: 3,
    hasActiveProgram: true,
    weeksInWindow: 2,
    windowStart: new Date("2026-07-01T00:00:00.000Z"),
    windowEnd: new Date("2026-07-28T00:00:00.000Z"),
  };
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

async function main() {
  let passed = 0;
  let failed = 0;

  const pureCases = [
    {
      name: "computePerformanceTrend -> insufficient_data at N-1 sessions",
      input: {
        sessionSnapshots: [
          { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
          { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 12 },
        ],
        prescribedRepRangeHigh: 12,
      },
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 12 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.deepEqual(actual, {
          direction: "insufficient_data",
          confidence: 0,
          reason: "insufficient_sessions",
        });
        return actual;
      },
    },
    {
      name: "computePerformanceTrend -> increasing via weight_increase",
      input: "3 sessions, weight rises, rep target met",
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 3, date: new Date("2026-07-15T10:00:00.000Z"), topWeightKg: 70, topRepsAtTopWeight: 12 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 67.5, topRepsAtTopWeight: 12 },
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 65, topRepsAtTopWeight: 12 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.deepEqual(actual, {
          direction: "increasing",
          confidence: 1,
          reason: "weight_increase",
        });
        return actual;
      },
    },
    {
      name: "computePerformanceTrend -> increasing via rep_increase",
      input: "3 sessions, same weight, reps rise to target",
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 3, date: new Date("2026-07-15T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 12 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 11 },
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.deepEqual(actual, {
          direction: "increasing",
          confidence: 1,
          reason: "rep_increase",
        });
        return actual;
      },
    },
    {
      name: "computePerformanceTrend -> decreasing via weight_drop",
      input: "3 sessions, weight drops",
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 3, date: new Date("2026-07-15T10:00:00.000Z"), topWeightKg: 62.5, topRepsAtTopWeight: 12 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 65, topRepsAtTopWeight: 12 },
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 67.5, topRepsAtTopWeight: 12 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.deepEqual(actual, {
          direction: "decreasing",
          confidence: 1,
          reason: "weight_drop",
        });
        return actual;
      },
    },
    {
      name: "computePerformanceTrend -> decreasing via rep_drop",
      input: "3 sessions, same weight, reps drop",
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 3, date: new Date("2026-07-15T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 8 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 12 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.deepEqual(actual, {
          direction: "decreasing",
          confidence: 1,
          reason: "rep_drop",
        });
        return actual;
      },
    },
    {
      name: "computePerformanceTrend -> flat via stable_load",
      input: "3 sessions, same weight and reps",
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 3, date: new Date("2026-07-15T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 10 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.deepEqual(actual, {
          direction: "flat",
          confidence: 1,
          reason: "stable_load",
        });
        return actual;
      },
    },
    {
      name: "computePerformanceTrend -> weight precedence over rep change",
      input: "weight increases while reps also change",
      fn: () => {
        const actual = computePerformanceTrend({
          sessionSnapshots: [
            { sessionId: 3, date: new Date("2026-07-15T10:00:00.000Z"), topWeightKg: 65, topRepsAtTopWeight: 13 },
            { sessionId: 2, date: new Date("2026-07-08T10:00:00.000Z"), topWeightKg: 62.5, topRepsAtTopWeight: 12 },
            { sessionId: 1, date: new Date("2026-07-01T10:00:00.000Z"), topWeightKg: 60, topRepsAtTopWeight: 12 },
          ],
          prescribedRepRangeHigh: 12,
        });
        assert.equal(actual.reason, "weight_increase");
        assert.equal(actual.direction, "increasing");
        return actual;
      },
    },
    {
      name: "computeSessionConsistency -> zero history with no active program",
      input: "empty normalized history",
      fn: () => {
        const actual = computeSessionConsistency({
          sessions: [],
          setLogs: [],
          prescribedExercises: [],
          programDayCount: 0,
          hasActiveProgram: false,
          weeksInWindow: 4,
          windowStart: new Date("2026-07-01T00:00:00.000Z"),
          windowEnd: new Date("2026-07-28T00:00:00.000Z"),
        });
        assert.deepEqual(actual, {
          scheduledSessions: 0,
          completedSessions: 0,
          completionRate: null,
          missedSessionGaps: [],
        });
        return actual;
      },
    },
    {
      name: "computeSessionConsistency -> recently activated program with zero completed sessions",
      input: "active less than one day, scheduled sessions should stay zero",
      fn: () => {
        const actual = computeSessionConsistency({
          sessions: [],
          setLogs: [],
          prescribedExercises: [],
          programDayCount: 4,
          hasActiveProgram: true,
          activeDaysInWindow: 0,
          weeksInWindow: 4,
          windowStart: new Date("2026-07-01T00:00:00.000Z"),
          windowEnd: new Date("2026-07-28T00:00:00.000Z"),
        });
        assert.deepEqual(actual, {
          scheduledSessions: 0,
          completedSessions: 0,
          completionRate: null,
          missedSessionGaps: [],
        });
        return actual;
      },
    },
    {
      name: "computeSessionConsistency -> partial adherence with same-day multiple sessions",
      input: "4 scheduled, 3 completed, same-day sessions preserved",
      fn: () => {
        const actual = computeSessionConsistency({
          sessions: [
            { id: 1, startedAt: new Date("2026-07-01T09:00:00.000Z"), completedAt: new Date("2026-07-01T10:00:00.000Z"), status: "completed" },
            { id: 2, startedAt: new Date("2026-07-01T17:00:00.000Z"), completedAt: new Date("2026-07-01T18:00:00.000Z"), status: "completed" },
            { id: 3, startedAt: new Date("2026-07-10T09:00:00.000Z"), completedAt: new Date("2026-07-10T10:00:00.000Z"), status: "completed" },
          ],
          setLogs: [],
          prescribedExercises: [],
          programDayCount: 2,
          hasActiveProgram: true,
          weeksInWindow: 2,
          windowStart: new Date("2026-07-01T00:00:00.000Z"),
          windowEnd: new Date("2026-07-14T00:00:00.000Z"),
        });
        assert.equal(actual.scheduledSessions, 4);
        assert.equal(actual.completedSessions, 3);
        assert.equal(actual.completionRate, 0.75);
        assert.equal(actual.missedSessionGaps.length, 1);
        return actual;
      },
    },
    {
      name: "computeSessionConsistency -> full adherence",
      input: "4 scheduled, 4 completed",
      fn: () => {
        const actual = computeSessionConsistency({
          sessions: [
            { id: 1, startedAt: new Date("2026-07-01T09:00:00.000Z"), completedAt: new Date("2026-07-01T10:00:00.000Z"), status: "completed" },
            { id: 2, startedAt: new Date("2026-07-08T09:00:00.000Z"), completedAt: new Date("2026-07-08T10:00:00.000Z"), status: "completed" },
            { id: 3, startedAt: new Date("2026-07-15T09:00:00.000Z"), completedAt: new Date("2026-07-15T10:00:00.000Z"), status: "completed" },
            { id: 4, startedAt: new Date("2026-07-22T09:00:00.000Z"), completedAt: new Date("2026-07-22T10:00:00.000Z"), status: "completed" },
          ],
          setLogs: [],
          prescribedExercises: [],
          programDayCount: 1,
          hasActiveProgram: true,
          weeksInWindow: 4,
          windowStart: new Date("2026-07-01T00:00:00.000Z"),
          windowEnd: new Date("2026-07-28T00:00:00.000Z"),
        });
        assert.equal(actual.scheduledSessions, 4);
        assert.equal(actual.completedSessions, 4);
        assert.equal(actual.completionRate, 1);
        assert.deepEqual(actual.missedSessionGaps, []);
        return actual;
      },
    },
    {
      name: "computePatternSummaries -> aggregates shared movement patterns correctly",
      input: "multiple exercises share horizontal_press",
      fn: () => {
        const actual = computePatternSummaries(buildNormalizedFixture());
        assert.deepEqual(actual, [
          {
            movementPattern: "elbow_flexion",
            adherenceRate: null,
            consistencyScore: 0,
          },
          {
            movementPattern: "horizontal_press",
            adherenceRate: 0.5,
            consistencyScore: 0.5,
          },
        ]);
        return actual;
      },
    },
    {
      name: "normalizeHistory -> translates raw Prisma-shaped fixture",
      input: "raw fixture with sessions, setLogs, activeProgram",
      fn: () => {
        const rawHistory = {
          activeProgram: {
            activatedAt: new Date("2026-06-30T00:00:00.000Z"),
            program: {
              days: [
                {
                  name: "Upper A",
                  exercises: [
                    {
                      exerciseId: 101,
                      repRangeHigh: 12,
                      exercise: {
                        nameEn: "Bench Press",
                        movementPattern: "horizontal_press",
                      },
                    },
                  ],
                },
              ],
            },
          },
          sessions: [
            {
              id: 1,
              startedAt: new Date("2026-07-01T10:00:00.000Z"),
              completedAt: new Date("2026-07-01T10:45:00.000Z"),
              status: "completed",
              setLogs: [
                {
                  exerciseId: 101,
                  weightKg: 60,
                  reps: 10,
                  loggedAt: new Date("2026-07-01T10:15:00.000Z"),
                  exercise: {
                    nameEn: "Bench Press",
                    movementPattern: "horizontal_press",
                  },
                },
              ],
            },
          ],
        };

        const actual = normalizeHistory(rawHistory, {
          windowStart: new Date("2026-07-01T00:00:00.000Z"),
          windowEnd: new Date("2026-07-28T00:00:00.000Z"),
          windowDays: 28,
        });

        assert.deepEqual(actual, {
          sessions: [
            {
              id: 1,
              startedAt: new Date("2026-07-01T10:00:00.000Z"),
              completedAt: new Date("2026-07-01T10:45:00.000Z"),
              status: "completed",
            },
          ],
          setLogs: [
            {
              sessionId: 1,
              exerciseId: 101,
              exerciseName: "Bench Press",
              movementPattern: "horizontal_press",
              date: new Date("2026-07-01T10:15:00.000Z"),
              weightKg: 60,
              reps: 10,
            },
          ],
          prescribedExercises: [
            {
              exerciseId: 101,
              exerciseName: "Bench Press",
              movementPattern: "horizontal_press",
              dayType: "Upper A",
              repRangeHigh: 12,
            },
          ],
          programDayCount: 1,
          hasActiveProgram: true,
          activeDaysInWindow: 28,
          weeksInWindow: 4,
          windowStart: new Date("2026-07-01T00:00:00.000Z"),
          windowEnd: new Date("2026-07-28T00:00:00.000Z"),
        });
        return actual;
      },
    },
    {
      name: "determinism -> repeated identical input yields byte-identical output",
      input: "computePatternSummaries fixture repeated twice",
      fn: () => {
        const fixture = buildNormalizedFixture();
        const first = computePatternSummaries(fixture);
        const second = computePatternSummaries(fixture);
        assert.equal(serializeForLog(first), serializeForLog(second));
        return first;
      },
    },
  ];

  for (const testCase of pureCases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const beforeCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_BEFORE: ${serializeForLog(beforeCounts)}`);

  const integrationCases = [
    {
      name: "integration -> zero history, no active program",
      input: "user with no profile program or sessions",
      fn: async () => {
        const suffix = `zero-${Date.now()}`;
        const user = await createTestUser({ profileData: null, suffix });
        try {
          const actual = await analyzeWorkoutHistory({ userId: user.id, windowDays: 28 });
          assert.equal(actual.hasActiveProgram, false);
          assert.deepEqual(actual.exerciseSummaries, []);
          assert.deepEqual(actual.patternSummaries, []);
          assert.deepEqual(actual.sessionConsistency, {
            scheduledSessions: 0,
            completedSessions: 0,
            completionRate: null,
            missedSessionGaps: [],
          });
          return actual;
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "integration -> partial adherence with real generated program",
      input: "one completed session against multi-day generated program",
      fn: async () => {
        const suffix = `partial-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 4,
            recoveryQuality: "medium",
            sessionDurationMin: 60,
            equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
            injuryFlags: ["none"],
            wizardCompleted: true,
            wizardCompletedAt: new Date(),
          },
        });

        try {
          const program = await generateProgramForUser(user.id);
          await prisma.userProgram.update({
            where: { userId: user.id },
            data: { activatedAt: new Date("2026-06-18T09:00:00.000Z") },
          });
          const firstDay = program.days[0];
          const firstExercise = firstDay.exercises[0];

          const session = await prisma.workoutSession.create({
            data: {
              userId: user.id,
              programId: program.id,
              programDayId: firstDay.id,
              startedAt: new Date("2026-07-10T09:00:00.000Z"),
              completedAt: new Date("2026-07-10T09:50:00.000Z"),
              status: "completed",
            },
          });

          await prisma.setLog.createMany({
            data: [
              {
                sessionId: session.id,
                exerciseId: firstExercise.exerciseId,
                setNumber: 1,
                weightKg: 40,
                reps: 10,
                loggedAt: new Date("2026-07-10T09:10:00.000Z"),
              },
              {
                sessionId: session.id,
                exerciseId: firstExercise.exerciseId,
                setNumber: 2,
                weightKg: 42.5,
                reps: 10,
                loggedAt: new Date("2026-07-10T09:15:00.000Z"),
              },
            ],
          });

          const actual = await analyzeWorkoutHistory({ userId: user.id, windowDays: 28 });
          const summary = actual.exerciseSummaries.find(
            (entry) => entry.exerciseId === firstExercise.exerciseId
          );

          assert.equal(actual.hasActiveProgram, true);
          assert.equal(actual.sessionConsistency.scheduledSessions, program.days.length * 4);
          assert.equal(actual.sessionConsistency.completedSessions, 1);
          assert(summary);
          assert.equal(summary.timesLogged, 1);
          assert.equal(summary.performanceTrend.reason, "insufficient_sessions");
          return actual;
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "integration -> full adherence with increasing weight trend",
      input: "three completed sessions, same prescribed exercise, all scheduled sessions met",
      fn: async () => {
        const suffix = `full-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 1,
            recoveryQuality: "medium",
            sessionDurationMin: 60,
            equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
            injuryFlags: ["none"],
            wizardCompleted: true,
            wizardCompletedAt: new Date(),
          },
        });

        try {
          const program = await generateProgramForUser(user.id);
          await prisma.userProgram.update({
            where: { userId: user.id },
            data: { activatedAt: new Date("2026-06-18T09:00:00.000Z") },
          });
          const firstDay = program.days[0];
          const firstExercise = firstDay.exercises[0];

          const sessionInputs = [
            {
              startedAt: new Date("2026-06-20T09:00:00.000Z"),
              completedAt: new Date("2026-06-20T09:45:00.000Z"),
              weightKg: 40,
              reps: firstExercise.repRangeHigh,
            },
            {
              startedAt: new Date("2026-06-27T09:00:00.000Z"),
              completedAt: new Date("2026-06-27T09:45:00.000Z"),
              weightKg: 42.5,
              reps: firstExercise.repRangeHigh,
            },
            {
              startedAt: new Date("2026-07-04T09:00:00.000Z"),
              completedAt: new Date("2026-07-04T09:45:00.000Z"),
              weightKg: 45,
              reps: firstExercise.repRangeHigh,
            },
            {
              startedAt: new Date("2026-07-11T09:00:00.000Z"),
              completedAt: new Date("2026-07-11T09:45:00.000Z"),
              weightKg: 47.5,
              reps: firstExercise.repRangeHigh,
            },
          ];

          for (const [index, sessionInput] of sessionInputs.entries()) {
            const session = await prisma.workoutSession.create({
              data: {
                userId: user.id,
                programId: program.id,
                programDayId: firstDay.id,
                startedAt: sessionInput.startedAt,
                completedAt: sessionInput.completedAt,
                status: "completed",
              },
            });

            await prisma.setLog.create({
              data: {
                sessionId: session.id,
                exerciseId: firstExercise.exerciseId,
                setNumber: 1,
                weightKg: sessionInput.weightKg,
                reps: sessionInput.reps,
                loggedAt: new Date(sessionInput.startedAt.getTime() + (index + 1) * 60000),
              },
            });
          }

          const actual = await analyzeWorkoutHistory({ userId: user.id, windowDays: 28 });
          const summary = actual.exerciseSummaries.find(
            (entry) => entry.exerciseId === firstExercise.exerciseId
          );

          assert.equal(actual.hasActiveProgram, true);
          assert.equal(actual.sessionConsistency.scheduledSessions, 4);
          assert.equal(actual.sessionConsistency.completedSessions, 4);
          assert.equal(actual.sessionConsistency.completionRate, 1);
          assert(summary);
          assert.equal(summary.timesLogged, 4);
          assert.equal(summary.performanceTrend.direction, "increasing");
          assert.equal(summary.performanceTrend.reason, "weight_increase");
          return actual;
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
  ];

  for (const testCase of integrationCases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const afterCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_AFTER: ${serializeForLog(afterCounts)}`);
  assert.deepEqual(afterCounts, beforeCounts);

  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
