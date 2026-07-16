import assert from "node:assert/strict";
import fs from "node:fs/promises";

import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "./programGenerator.js";
import { evaluateSessionProgression } from "./progression.js";
import {
  evaluateRegenerationEligibility,
  evaluateSustainedProgressionStagnation,
  evaluateTrainingDaysPerWeekDrift,
  evaluateProgramAge,
  isStagnationSession,
} from "./regenerationOrchestrator.js";

const TEST_EMAIL_DOMAIN = "@example.com";
const ORCHESTRATOR_FILE_PATH =
  "/Users/user/Desktop/AI-Fitness-Coach/backend/src/services/regenerationOrchestrator.js";

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
      email: `regeneration-v1-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Regeneration V1 ${suffix}`,
      password: "hashed-password",
    },
  });

  await prisma.userProfile.create({
    data: {
      userId: user.id,
      goal: profileData.goal ?? "hypertrophy",
      trainingLevel: profileData.trainingLevel ?? "beginner",
      trainingDaysPerWeek: profileData.trainingDaysPerWeek ?? 3,
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
      wizardCompleted: true,
      wizardCompletedAt: new Date(),
      lastCompletedStep: 20,
    },
  });

  return user;
}

async function getActiveUserProgram(userId) {
  return prisma.userProgram.findFirstOrThrow({
    where: { userId, isActive: true },
  });
}

async function snapshotCounts() {
  const [
    workoutSession,
    setLog,
    progressionRecommendation,
    program,
    programDay,
    programDayExercise,
    userProgram,
    user,
    userProfile,
  ] = await Promise.all([
    prisma.workoutSession.count(),
    prisma.setLog.count(),
    prisma.progressionRecommendation.count(),
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
    progressionRecommendation,
    program,
    programDay,
    programDayExercise,
    userProgram,
    user,
    userProfile,
  };
}

function buildRecentCompletedSessions(overrides = []) {
  return overrides;
}

function buildBaseEligibilityInput(overrides = {}) {
  return {
    recentCompletedSessions: buildRecentCompletedSessions([
      {
        sessionId: 301,
        completedAt: "2026-07-12T09:00:00.000Z",
        progressionRecommendations: [
          { recommendationType: "maintain" },
          { recommendationType: "maintain" },
          { recommendationType: "increase" },
        ],
      },
      {
        sessionId: 300,
        completedAt: "2026-07-05T09:00:00.000Z",
        progressionRecommendations: [
          { recommendationType: "maintain" },
          { recommendationType: "deload" },
          { recommendationType: "increase" },
        ],
      },
      {
        sessionId: 299,
        completedAt: "2026-06-28T09:00:00.000Z",
        progressionRecommendations: [
          { recommendationType: "maintain" },
          { recommendationType: "maintain" },
          { recommendationType: "increase" },
        ],
      },
    ]),
    recoveryModifier: {
      recoveryModifier: "neutral",
      confidence: 0.4,
      signalStrength: "moderate",
      reason: "Recent training behavior is unremarkable, so no additional recovery modifier was applied.",
      trace: { because: ["threshold:neutral_no_behavioral_trigger"] },
    },
    currentProgram: {
      goal: "hypertrophy",
      splitFamily: "upper_lower",
      isStatic: false,
      createdAt: "2026-05-01T09:00:00.000Z",
    },
    userProgram: {
      currentDayIndex: 1,
      activatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
    userProfile: {
      goal: "hypertrophy",
      equipmentAccess: ["barbell", "dumbbell"],
      injuryFlags: ["none"],
      trainingDaysPerWeek: 3,
    },
    programProfileSnapshot: {
      goal: null,
      equipmentAccess: undefined,
      injuryFlags: undefined,
      trainingDaysPerWeek: undefined,
    },
    ...overrides,
  };
}

async function readOrchestratorSource() {
  return fs.readFile(ORCHESTRATOR_FILE_PATH, "utf8");
}

async function buildRecentCompletedSessionsFromDatabase(userId) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "completed",
      completedAt: { not: null },
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: 3,
  });

  return Promise.all(
    sessions.map(async (session) => {
      const progressionRecommendations = await prisma.progressionRecommendation.findMany({
        where: { sourceSessionId: session.id, userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { recommendationType: true },
      });

      return {
        sessionId: session.id,
        completedAt: session.completedAt,
        progressionRecommendations,
      };
    })
  );
}

async function createStagnationHistory({ userId }) {
  const program = await generateProgramForUser(userId);
  const firstDay = program.days[0];
  const targetExercise = firstDay.exercises[0];

  const sessionDates = [
    new Date("2026-06-21T09:00:00.000Z"),
    new Date("2026-06-28T09:00:00.000Z"),
    new Date("2026-07-05T09:00:00.000Z"),
  ];

  for (const [index, startedAt] of sessionDates.entries()) {
    const session = await prisma.workoutSession.create({
      data: {
        userId,
        programId: program.id,
        programDayId: firstDay.id,
        startedAt,
        completedAt: new Date(startedAt.getTime() + 45 * 60 * 1000),
        status: "completed",
      },
    });

    await prisma.setLog.create({
      data: {
        sessionId: session.id,
        exerciseId: targetExercise.exerciseId,
        setNumber: 1,
        weightKg: 40,
        reps: Math.max(1, targetExercise.repRangeLow - 1),
        loggedAt: new Date(startedAt.getTime() + (index + 1) * 60 * 1000),
      },
    });

    await evaluateSessionProgression(session.id, userId);
  }

  return program;
}

async function main() {
  let passed = 0;
  let failed = 0;

  const unitCases = [
    {
      name: "stagnation session -> exactly 50 percent does not count",
      input: "2 stagnant of 4 total recommendations",
      fn: () => {
        const actual = isStagnationSession({
          sessionId: 1,
          progressionRecommendations: [
            { recommendationType: "maintain" },
            { recommendationType: "deload" },
            { recommendationType: "increase" },
            { recommendationType: "increase" },
          ],
        });
        assert.equal(actual.isStagnationSession, false);
        return actual;
      },
    },
    {
      name: "stagnation session -> just over 50 percent counts",
      input: "3 stagnant of 5 total recommendations",
      fn: () => {
        const actual = isStagnationSession({
          sessionId: 2,
          progressionRecommendations: [
            { recommendationType: "maintain" },
            { recommendationType: "maintain" },
            { recommendationType: "deload" },
            { recommendationType: "increase" },
            { recommendationType: "increase" },
          ],
        });
        assert.equal(actual.isStagnationSession, true);
        return actual;
      },
    },
    {
      name: "stagnation session -> zero recommendations does not count",
      input: "0 recommendations",
      fn: () => {
        const actual = isStagnationSession({
          sessionId: 3,
          progressionRecommendations: [],
        });
        assert.equal(actual.isStagnationSession, false);
        return actual;
      },
    },
    {
      name: "sustained stagnation -> fewer than 3 sessions is insufficient",
      input: "2 completed sessions only",
      fn: () => {
        const actual = evaluateSustainedProgressionStagnation(
          buildRecentCompletedSessions(buildBaseEligibilityInput().recentCompletedSessions.slice(0, 2))
        );
        assert.equal(actual.evaluable, false);
        assert.equal(actual.triggered, false);
        return actual;
      },
    },
    {
      name: "sustained stagnation -> exactly 3 stagnation sessions fires",
      input: "3 of 3 sessions stagnate",
      fn: () => {
        const actual = evaluateSustainedProgressionStagnation(
          buildBaseEligibilityInput().recentCompletedSessions
        );
        assert.equal(actual.evaluable, true);
        assert.equal(actual.triggered, true);
        return actual;
      },
    },
    {
      name: "sustained stagnation -> 2 of 3 sessions stagnate does not fire",
      input: "third session below threshold",
      fn: () => {
        const sessions = buildBaseEligibilityInput().recentCompletedSessions.map((session) => ({
          ...session,
          progressionRecommendations: [...session.progressionRecommendations],
        }));
        sessions[2].progressionRecommendations = [
          { recommendationType: "maintain" },
          { recommendationType: "increase" },
          { recommendationType: "increase" },
        ];
        const actual = evaluateSustainedProgressionStagnation(sessions);
        assert.equal(actual.triggered, false);
        return actual;
      },
    },
    {
      name: "goal drift -> fires when goals differ",
      input: "program goal strength, user goal hypertrophy",
      fn: () => {
        const actual = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
            currentProgram: {
              goal: "strength",
              splitFamily: "upper_lower",
              isStatic: false,
              createdAt: "2026-05-01T09:00:00.000Z",
            },
          })
        );
        assert.equal(actual.regenerationRecommended, true);
        assert.equal(actual.urgency, "moderate");
        assert(actual.triggeringFactors.some((item) => item.factor === "profile_drift_goal"));
        return actual;
      },
    },
    {
      name: "goal drift -> does not fire when goals match",
      input: "program goal and user goal both hypertrophy",
      fn: () => {
        const actual = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
          })
        );
        assert.equal(actual.regenerationRecommended, false);
        assert.equal(
          actual.triggeringFactors.some((item) => item.factor === "profile_drift_goal"),
          false
        );
        return actual;
      },
    },
    {
      name: "trainingDaysPerWeek drift -> public path currently non firing without snapshot",
      input: "missing programProfileSnapshot.trainingDaysPerWeek",
      fn: () => {
        const actual = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
          })
        );
        assert.equal(actual.regenerationRecommended, false);
        assert.equal(
          actual.triggeringFactors.some(
            (item) => item.factor === "profile_drift_training_days_per_week"
          ),
          false
        );
        assert(
          actual.trace.because.includes(
            "training_days_per_week_drift:not_evaluable:insufficient_snapshot_data"
          )
        );
        return actual;
      },
    },
    {
      name: "trainingDaysPerWeek drift -> helper is ready when snapshot exists",
      input: "snapshot=4 current=3",
      fn: () => {
        const actual = evaluateTrainingDaysPerWeekDrift({
          programProfileSnapshot: { trainingDaysPerWeek: 4 },
          userProfile: { trainingDaysPerWeek: 3 },
        });
        assert.equal(actual.evaluable, true);
        assert.equal(actual.drifted, true);
        return actual;
      },
    },
    {
      name: "recovery caution -> fires only on caution",
      input: "recoveryModifier=caution",
      fn: () => {
        const caution = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
            recoveryModifier: {
              recoveryModifier: "caution",
              confidence: 0.7,
              signalStrength: "strong",
              reason: "caution",
              trace: { because: [] },
            },
          })
        );
        const neutral = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
            recoveryModifier: {
              recoveryModifier: "neutral",
              confidence: 0.4,
              signalStrength: "moderate",
              reason: "neutral",
              trace: { because: [] },
            },
          })
        );
        const supportive = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
            recoveryModifier: {
              recoveryModifier: "supportive",
              confidence: 0.8,
              signalStrength: "strong",
              reason: "supportive",
              trace: { because: [] },
            },
          })
        );

        assert(caution.triggeringFactors.some((item) => item.factor === "recovery_caution"));
        assert.equal(
          neutral.triggeringFactors.some((item) => item.factor === "recovery_caution"),
          false
        );
        assert.equal(
          supportive.triggeringFactors.some((item) => item.factor === "recovery_caution"),
          false
        );

        return { caution, neutral, supportive };
      },
    },
    {
      name: "program age -> fires at or above 56 days",
      input: "activatedAt 56 days ago",
      fn: () => {
        const actual = evaluateProgramAge({
          currentDayIndex: 2,
          activatedAt: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000),
        });
        assert.equal(actual.triggered, true);
        return actual;
      },
    },
    {
      name: "program age -> does not fire below 56 days",
      input: "activatedAt 55 days ago",
      fn: () => {
        const actual = evaluateProgramAge({
          currentDayIndex: 2,
          activatedAt: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
        });
        assert.equal(actual.triggered, false);
        return actual;
      },
    },
    {
      name: "multiple triggers -> all reasons captured and highest urgency selected",
      input: "goal drift + sustained stagnation + recovery caution + program age",
      fn: () => {
        const actual = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            currentProgram: {
              goal: "strength",
              splitFamily: "upper_lower",
              isStatic: false,
              createdAt: "2026-05-01T09:00:00.000Z",
            },
            recoveryModifier: {
              recoveryModifier: "caution",
              confidence: 0.6,
              signalStrength: "moderate",
              reason: "caution",
              trace: { because: [] },
            },
            userProgram: {
              currentDayIndex: 2,
              activatedAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
            },
          })
        );
        assert.equal(actual.regenerationRecommended, true);
        assert.equal(actual.urgency, "moderate");
        assert.equal(actual.reasons.length, 4);
        assert.equal(actual.triggeringFactors.length, 4);
        return actual;
      },
    },
    {
      name: "no active program -> safe false and program age skipped",
      input: "userProgram=null and no other triggers",
      fn: () => {
        const actual = evaluateRegenerationEligibility(
          buildBaseEligibilityInput({
            recentCompletedSessions: [],
            userProgram: null,
          })
        );
        assert.equal(actual.regenerationRecommended, false);
        assert.equal(actual.urgency, "none");
        return actual;
      },
    },
    {
      name: "determinism -> repeated identical input returns identical output",
      input: "same payload twice",
      fn: () => {
        const input = buildBaseEligibilityInput({
          recentCompletedSessions: [],
          userProgram: {
            currentDayIndex: 2,
            activatedAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
          },
        });
        const first = evaluateRegenerationEligibility(input);
        const second = evaluateRegenerationEligibility(input);
        assert.equal(serializeForLog(first), serializeForLog(second));
        return first;
      },
    },
    {
      name: "static check -> zero Prisma or database calls in orchestrator file",
      input: "grep source contents",
      fn: async () => {
        const source = await readOrchestratorSource();
        assert.equal(/\bprisma\b/i.test(source), false);
        assert.equal(/findMany|findUnique|create\(|update\(|delete\(|\$transaction/.test(source), false);
        return { prismaMention: /\bprisma\b/i.test(source), databaseCallPattern: /findMany|findUnique|create\(|update\(|delete\(|\$transaction/.test(source) };
      },
    },
    {
      name: "static check -> zero generator service calls in orchestrator file",
      input: "grep source contents",
      fn: async () => {
        const source = await readOrchestratorSource();
        assert.equal(/generateProgramForUser|regenerateProgramForUser|persistProgramPlan|buildProgramPlan/.test(source), false);
        return {
          generatorMention: /generateProgramForUser|regenerateProgramForUser|persistProgramPlan|buildProgramPlan/.test(source),
        };
      },
    },
  ];

  for (const testCase of unitCases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const beforeCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_BEFORE: ${serializeForLog(beforeCounts)}`);

  const integrationCases = [
    {
      name: "integration -> real persisted progression rows produce sustained stagnation",
      input: "3 real completed sessions evaluated through progression service",
      fn: async () => {
        const suffix = `real-stagnation-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 3,
            recoveryQuality: "medium",
            sessionDurationMin: 60,
            equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
            injuryFlags: ["none"],
          },
        });

        try {
          const program = await createStagnationHistory({ userId: user.id });
          const recentCompletedSessions = await buildRecentCompletedSessionsFromDatabase(user.id);
          const userProgram = await getActiveUserProgram(user.id);
          const userProfile = await prisma.userProfile.findUniqueOrThrow({
            where: { userId: user.id },
          });

          const actual = evaluateRegenerationEligibility({
            recentCompletedSessions,
            recoveryModifier: {
              recoveryModifier: "neutral",
              confidence: 0.4,
              signalStrength: "moderate",
              reason: "Recent training behavior is unremarkable, so no additional recovery modifier was applied.",
              trace: { because: ["threshold:neutral_no_behavioral_trigger"] },
            },
            currentProgram: {
              goal: program.goal,
              splitFamily: program.splitFamily,
              isStatic: program.isStatic,
              createdAt: program.createdAt,
            },
            userProgram: {
              currentDayIndex: userProgram.currentDayIndex,
              activatedAt: userProgram.activatedAt,
            },
            userProfile: {
              goal: userProfile.goal,
              equipmentAccess: userProfile.equipmentAccess,
              injuryFlags: userProfile.injuryFlags,
              trainingDaysPerWeek: userProfile.trainingDaysPerWeek,
            },
            programProfileSnapshot: {
              goal: null,
              equipmentAccess: undefined,
              injuryFlags: undefined,
              trainingDaysPerWeek: undefined,
            },
          });

          assert.equal(recentCompletedSessions.length, 3);
          assert.equal(actual.regenerationRecommended, true);
          assert(
            actual.triggeringFactors.some(
              (item) => item.factor === "sustained_progression_stagnation"
            )
          );
          assert.equal(actual.urgency, "moderate");

          return {
            recentCompletedSessions,
            result: actual,
          };
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
