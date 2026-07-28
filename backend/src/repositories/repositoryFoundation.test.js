import assert from "node:assert/strict";

import { Prisma } from "@prisma/client";

import prisma from "../lib/prisma.js";
import {
  createProgressionPersistenceRepository,
} from "./progressionPersistenceRepository.js";
import {
  createProgramDayExerciseRepository,
} from "./programDayExerciseRepository.js";
import { createProgramDayRepository } from "./programDayRepository.js";
import {
  createProgressionRecommendationRepository,
} from "./progressionRecommendationRepository.js";
import {
  createRecommendationApplicationRepository,
} from "./recommendationApplicationRepository.js";
import { createUserProgramRepository } from "./userProgramRepository.js";
import {
  createWorkoutSessionExerciseTargetRepository,
} from "./workoutSessionExerciseTargetRepository.js";
import { createWorkoutSessionRepository } from "./workoutSessionRepository.js";

const TEST_EMAIL_DOMAIN = "@example.test";
const RUN_SUFFIX = `${process.pid}-${Date.now().toString(36)}`;
let fixtureSequence = 0;

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

function nextSuffix(prefix) {
  fixtureSequence += 1;
  return `${prefix}-${RUN_SUFFIX}-${fixtureSequence}`;
}

async function cleanupFixture({ userIds = [], programIds = [] }) {
  if (userIds.length > 0) {
    const sessions = await prisma.workoutSession.findMany({
      where: { userId: { in: userIds } },
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
                userId: { in: userIds },
              },
            },
          ],
        },
      });

      await prisma.workoutSessionExerciseTarget.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
    }

    await prisma.progressionRecommendation.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.setLog.deleteMany({
      where: {
        session: {
          userId: { in: userIds },
        },
      },
    });
    await prisma.workoutSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.userProgram.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

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
    await prisma.program.deleteMany({
      where: { id: { in: programIds } },
    });
  }
}

async function createUser({ suffix }) {
  return prisma.user.create({
    data: {
      email: `repository-foundation-${suffix}${TEST_EMAIL_DOMAIN}`,
      password: "hashed-password",
      name: `Repository Foundation ${suffix}`,
    },
  });
}

async function createProgram({ suffix }) {
  return prisma.program.create({
    data: {
      name: `Repository Foundation Program ${suffix}`,
      description: `Repository Foundation Program ${suffix}`,
      splitFamily: "full_body",
      goal: "hypertrophy",
      isStatic: true,
    },
  });
}

async function createUserProgram({ userId, programId, currentDayIndex = 0 }) {
  return prisma.userProgram.create({
    data: {
      userId,
      programId,
      isActive: true,
      currentDayIndex,
    },
  });
}

async function createProgramDay({ programId, dayIndex, suffix }) {
  return prisma.programDay.create({
    data: {
      programId,
      dayIndex,
      name: `Day ${dayIndex} ${suffix}`,
    },
  });
}

async function getSeedExercise() {
  return prisma.exercise.findFirstOrThrow({
    orderBy: { id: "asc" },
  });
}

async function createProgramDayExercise({ programDayId, exerciseId, order = 1, progressionType = "load" }) {
  return prisma.programDayExercise.create({
    data: {
      programDayId,
      exerciseId,
      order,
      sets: 3,
      repRangeLow: 8,
      repRangeHigh: 10,
      restSeconds: 90,
      loadIncrementKg: "2.50",
      durationIncrementSeconds: 10,
      intensity: "moderate",
      progressionType,
    },
  });
}

async function getDifferentSeedExercise(exerciseId) {
  return prisma.exercise.findFirstOrThrow({
    where: { id: { not: exerciseId } },
    orderBy: { id: "asc" },
  });
}

async function createHistoricalExposure({
  userId,
  userProgramId,
  programId,
  programDayId,
  programDayExerciseId,
  exerciseId,
  startedAt,
  completedAt,
  status = "completed",
  setLogs = [],
}) {
  const session = await prisma.workoutSession.create({
    data: {
      userId,
      userProgramId,
      programId,
      programDayId,
      startedAt,
      completedAt,
      status,
    },
  });

  await prisma.workoutSessionExerciseTarget.create({
    data: {
      sessionId: session.id,
      programDayExerciseId,
      exerciseId,
      targetSets: 3,
      targetRepRangeLow: 8,
      targetRepRangeHigh: 10,
      exactRepTarget: 8,
      targetLoadKg: 40,
      targetDurationSeconds: null,
      progressionType: "load",
      sourceDecisionType: null,
      sourceRulesVersion: null,
    },
  });

  if (setLogs.length > 0) {
    await prisma.setLog.createMany({
      data: setLogs.map((setLog) => ({
        sessionId: session.id,
        exerciseId: setLog.exerciseId ?? exerciseId,
        setNumber: setLog.setNumber,
        reps: setLog.reps,
        weightKg: setLog.weightKg,
        loggedAt: setLog.loggedAt,
      })),
    });
  }

  return session;
}

async function main() {
  const workoutSessionRepository = createWorkoutSessionRepository(prisma);
  const userProgramRepository = createUserProgramRepository(prisma);
  const programDayRepository = createProgramDayRepository(prisma);
  const programDayExerciseRepository = createProgramDayExerciseRepository(prisma);
  const progressionRecommendationRepository =
    createProgressionRecommendationRepository(prisma);
  const targetRepository = createWorkoutSessionExerciseTargetRepository(prisma);
  const recommendationApplicationRepository =
    createRecommendationApplicationRepository(prisma);
  const progressionPersistenceRepository =
    createProgressionPersistenceRepository(prisma);

  let passed = 0;
  let failed = 0;

  const rootCompatibilitySuffix = nextSuffix("root-compat");
  const rootUser = await createUser({ suffix: `${rootCompatibilitySuffix}-user` });
  const rootProgram = await createProgram({ suffix: `${rootCompatibilitySuffix}-program` });
  const rootUserProgram = await createUserProgram({
    userId: rootUser.id,
    programId: rootProgram.id,
  });
  try {
    if (
      await runCase(
        "root PrismaClient compatibility persists userProgramId and idempotencyKey",
        { userId: rootUser.id, userProgramId: rootUserProgram.id },
        async () => {
          const created = await workoutSessionRepository.create({
            data: {
              userId: rootUser.id,
              userProgramId: rootUserProgram.id,
              programId: rootProgram.id,
              idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              status: "active",
            },
          });

          assert.equal(created.userProgramId, rootUserProgram.id);
          assert.equal(created.idempotencyKey, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

          return {
            id: created.id,
            userProgramId: created.userProgramId,
            idempotencyKey: created.idempotencyKey,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [rootUser.id], programIds: [rootProgram.id] });
  }

  const txCompatibilitySuffix = nextSuffix("tx-compat");
  const txUser = await createUser({ suffix: `${txCompatibilitySuffix}-user` });
  const txProgram = await createProgram({ suffix: `${txCompatibilitySuffix}-program` });
  const txUserProgram = await createUserProgram({
    userId: txUser.id,
    programId: txProgram.id,
  });
  try {
    if (
      await runCase(
        "transaction client compatibility supports create and lookup",
        { userId: txUser.id, userProgramId: txUserProgram.id },
        async () => {
          return prisma.$transaction(async (tx) => {
            const txWorkoutSessionRepository = createWorkoutSessionRepository(tx);
            const txUserProgramRepository = createUserProgramRepository(tx);

            const created = await txWorkoutSessionRepository.create({
              data: {
                userId: txUser.id,
                userProgramId: txUserProgram.id,
                programId: txProgram.id,
                idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                status: "active",
              },
            });

            const foundByKey =
              await txWorkoutSessionRepository.findByUserAndIdempotencyKey({
                userId: txUser.id,
                idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              });
            const activeUserProgram = await txUserProgramRepository.findActiveForUser(txUser.id);

            assert.equal(foundByKey?.id, created.id);
            assert.equal(activeUserProgram?.id, txUserProgram.id);

            return {
              createdId: created.id,
              foundId: foundByKey?.id ?? null,
              activeUserProgramId: activeUserProgram?.id ?? null,
            };
          });
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [txUser.id], programIds: [txProgram.id] });
  }

  const idempotencySuffix = nextSuffix("idempotency-lookup");
  const idempotencyUserOne = await createUser({ suffix: `${idempotencySuffix}-u1` });
  const idempotencyUserTwo = await createUser({ suffix: `${idempotencySuffix}-u2` });
  try {
    if (
      await runCase(
        "user-scoped idempotency lookup returns the correct session",
        { userIds: [idempotencyUserOne.id, idempotencyUserTwo.id] },
        async () => {
          await workoutSessionRepository.create({
            data: {
              userId: idempotencyUserOne.id,
              idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              status: "completed",
            },
          });
          const expected = await workoutSessionRepository.create({
            data: {
              userId: idempotencyUserTwo.id,
              idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              status: "active",
            },
          });

          const found = await workoutSessionRepository.findByUserAndIdempotencyKey({
            userId: idempotencyUserTwo.id,
            idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          });

          assert.equal(found?.id, expected.id);
          assert.equal(found?.userId, idempotencyUserTwo.id);

          return {
            foundId: found?.id ?? null,
            userId: found?.userId ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [idempotencyUserOne.id, idempotencyUserTwo.id] });
  }

  const activeLookupSuffix = nextSuffix("active-lookup");
  const activeLookupUser = await createUser({ suffix: `${activeLookupSuffix}-user` });
  const activeLookupProgram = await createProgram({ suffix: `${activeLookupSuffix}-program` });
  const activeLookupUserProgram = await createUserProgram({
    userId: activeLookupUser.id,
    programId: activeLookupProgram.id,
  });
  try {
    if (
      await runCase(
        "active session lookup by userProgramId returns only the active row",
        { userProgramId: activeLookupUserProgram.id },
        async () => {
          await workoutSessionRepository.create({
            data: {
              userId: activeLookupUser.id,
              userProgramId: activeLookupUserProgram.id,
              programId: activeLookupProgram.id,
              status: "completed",
              completedAt: new Date("2026-07-26T00:00:00.000Z"),
            },
          });
          const expected = await workoutSessionRepository.create({
            data: {
              userId: activeLookupUser.id,
              userProgramId: activeLookupUserProgram.id,
              programId: activeLookupProgram.id,
              status: "active",
            },
          });

          const found = await workoutSessionRepository.findActiveByUserProgramId(
            activeLookupUserProgram.id
          );
          assert.equal(found?.id, expected.id);

          return {
            foundId: found?.id ?? null,
            status: found?.status ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [activeLookupUser.id], programIds: [activeLookupProgram.id] });
  }

  const completionSuffix = nextSuffix("completion");
  const completionUser = await createUser({ suffix: `${completionSuffix}-user` });
  try {
    if (
      await runCase(
        "conditional completion does not transition a completed session twice",
        { userId: completionUser.id },
        async () => {
          const session = await workoutSessionRepository.create({
            data: {
              userId: completionUser.id,
              status: "active",
            },
          });

          const first = await workoutSessionRepository.markCompletedIfActive({
            sessionId: session.id,
            completedAt: new Date("2026-07-26T10:00:00.000Z"),
          });
          const second = await workoutSessionRepository.markCompletedIfActive({
            sessionId: session.id,
            completedAt: new Date("2026-07-26T11:00:00.000Z"),
          });

          assert.equal(first.transitioned, true);
          assert.equal(second.transitioned, false);
          assert.equal(second.found, true);
          assert.equal(second.existingSession?.status, "completed");

          return {
            firstTransitioned: first.transitioned,
            secondTransitioned: second.transitioned,
            secondExistingStatus: second.existingSession?.status ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [completionUser.id] });
  }

  const dayReadSuffix = nextSuffix("day-read");
  const dayReadUser = await createUser({ suffix: `${dayReadSuffix}-user` });
  const dayReadProgram = await createProgram({ suffix: `${dayReadSuffix}-program` });
  const dayReadUserProgram = await createUserProgram({
    userId: dayReadUser.id,
    programId: dayReadProgram.id,
    currentDayIndex: 2,
  });
  const dayReadDay = await createProgramDay({
    programId: dayReadProgram.id,
    dayIndex: 2,
    suffix: dayReadSuffix,
  });
  const dayReadExercise = await getSeedExercise();
  await createProgramDayExercise({
    programDayId: dayReadDay.id,
    exerciseId: dayReadExercise.id,
    progressionType: "reps_then_load",
  });
  try {
    if (
      await runCase(
        "program day repositories expose deterministic baseline target fields",
        { userProgramId: dayReadUserProgram.id, programDayId: dayReadDay.id },
        async () => {
          const dayWithExercises = await programDayRepository.findDayWithExercises(dayReadDay.id);
          const dayForProgram = await programDayRepository.findDayBelongingToUserProgramProgram({
            userProgramId: dayReadUserProgram.id,
            dayIndex: 2,
          });
          const exercises = await programDayExerciseRepository.findByProgramDayId(dayReadDay.id);

          assert.equal(dayWithExercises?.exercises.length, 1);
          assert.equal(dayForProgram?.id, dayReadDay.id);
          assert.equal(Number(exercises[0].loadIncrementKg), 2.5);
          assert.equal(exercises[0].durationIncrementSeconds, 10);
          assert.equal(exercises[0].exercise.id, dayReadExercise.id);

          return {
            dayId: dayWithExercises?.id ?? null,
            exerciseCount: dayWithExercises?.exercises.length ?? 0,
            progressionType: exercises[0]?.progressionType ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [dayReadUser.id], programIds: [dayReadProgram.id] });
  }

  const targetSuffix = nextSuffix("target");
  const targetUser = await createUser({ suffix: `${targetSuffix}-user` });
  const targetProgram = await createProgram({ suffix: `${targetSuffix}-program` });
  const targetUserProgram = await createUserProgram({
    userId: targetUser.id,
    programId: targetProgram.id,
  });
  const targetDay = await createProgramDay({
    programId: targetProgram.id,
    dayIndex: 0,
    suffix: targetSuffix,
  });
  const targetExercise = await getSeedExercise();
  const targetDayExercise = await createProgramDayExercise({
    programDayId: targetDay.id,
    exerciseId: targetExercise.id,
  });
  const targetSession = await workoutSessionRepository.create({
    data: {
      userId: targetUser.id,
      userProgramId: targetUserProgram.id,
      programId: targetProgram.id,
      programDayId: targetDay.id,
      status: "active",
    },
  });
  try {
    if (
      await runCase(
        "target insertion and retrieval preserves resolved target data",
        { sessionId: targetSession.id, programDayExerciseId: targetDayExercise.id },
        async () => {
          const createdTargets = await targetRepository.createManyForSession({
            sessionId: targetSession.id,
            targets: [
              {
                programDayExerciseId: targetDayExercise.id,
                exerciseId: targetExercise.id,
                targetSets: 3,
                targetRepRangeLow: 8,
                targetRepRangeHigh: 10,
                exactRepTarget: 8,
                targetLoadKg: 42.5,
                targetDurationSeconds: null,
                progressionType: "load",
                sourceDecisionType: null,
                sourceRulesVersion: null,
              },
            ],
          });
          const foundTargets = await targetRepository.findBySessionIdWithExerciseContext(
            targetSession.id
          );

          assert.equal(createdTargets.length, 1);
          assert.equal(foundTargets.length, 1);
          assert.equal(foundTargets[0].exerciseId, targetExercise.id);
          assert.equal(foundTargets[0].programDayExercise.order, 1);

          return {
            createdTargetId: createdTargets[0].id,
            foundTargetId: foundTargets[0].id,
            exerciseId: foundTargets[0].exerciseId,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [targetUser.id], programIds: [targetProgram.id] });
  }

  const recommendationSuffix = nextSuffix("recommendation");
  const recommendationUser = await createUser({ suffix: `${recommendationSuffix}-user` });
  const recommendationProgram = await createProgram({ suffix: `${recommendationSuffix}-program` });
  const recommendationUserProgram = await createUserProgram({
    userId: recommendationUser.id,
    programId: recommendationProgram.id,
  });
  const recommendationDay = await createProgramDay({
    programId: recommendationProgram.id,
    dayIndex: 0,
    suffix: recommendationSuffix,
  });
  const recommendationExercise = await getSeedExercise();
  await createProgramDayExercise({
    programDayId: recommendationDay.id,
    exerciseId: recommendationExercise.id,
  });
  const recommendationSession = await workoutSessionRepository.create({
    data: {
      userId: recommendationUser.id,
      userProgramId: recommendationUserProgram.id,
      programId: recommendationProgram.id,
      programDayId: recommendationDay.id,
      status: "completed",
      completedAt: new Date("2026-07-26T12:00:00.000Z"),
    },
  });
  try {
    if (
      await runCase(
        "recommendation lifecycle conditional update behaves deterministically",
        { sessionId: recommendationSession.id, exerciseId: recommendationExercise.id },
        async () => {
          const [createdRecommendation] =
            await progressionRecommendationRepository.createNormalizedRecommendations({
              data: [
                {
                  userId: recommendationUser.id,
                  exerciseId: recommendationExercise.id,
                  sourceSessionId: recommendationSession.id,
                  recommendationType: "maintain",
                  decisionType: "MAINTAIN",
                  loadAdjustmentSteps: 0,
                  repAdjustment: 0,
                  setAdjustment: 0,
                  durationAdjustmentSteps: 0,
                  rulesVersion: "progression_decision_rules_v4",
                  lifecycleStatus: "PENDING",
                  progressionType: "load",
                  reason: "Progression decision recorded for the next session.",
                  status: "active",
                },
              ],
            });

          const eligible =
            await progressionRecommendationRepository.findEligiblePendingForExerciseIds({
              userId: recommendationUser.id,
              exerciseIds: [recommendationExercise.id],
            });
          const firstUpdate =
            await progressionRecommendationRepository.markAppliedConditionally({
              recommendationId: createdRecommendation.id,
            });
          const secondUpdate =
            await progressionRecommendationRepository.markAppliedConditionally({
              recommendationId: createdRecommendation.id,
            });
          const bySource = await progressionRecommendationRepository.findBySourceSession({
            userId: recommendationUser.id,
            sourceSessionId: recommendationSession.id,
          });

          assert.equal(eligible.length, 1);
          assert.equal(firstUpdate.matchedCount, 1);
          assert.equal(secondUpdate.matchedCount, 0);
          assert.equal(bySource.length, 1);

          return {
            eligibleCount: eligible.length,
            firstUpdateCount: firstUpdate.matchedCount,
            secondUpdateCount: secondUpdate.matchedCount,
            lifecycleStatus: firstUpdate.recommendation?.lifecycleStatus ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({
      userIds: [recommendationUser.id],
      programIds: [recommendationProgram.id],
    });
  }

  const applicationSuffix = nextSuffix("application");
  const applicationUser = await createUser({ suffix: `${applicationSuffix}-user` });
  const applicationProgram = await createProgram({ suffix: `${applicationSuffix}-program` });
  const applicationUserProgram = await createUserProgram({
    userId: applicationUser.id,
    programId: applicationProgram.id,
  });
  const applicationDay = await createProgramDay({
    programId: applicationProgram.id,
    dayIndex: 0,
    suffix: applicationSuffix,
  });
  const applicationExercise = await getSeedExercise();
  const applicationDayExercise = await createProgramDayExercise({
    programDayId: applicationDay.id,
    exerciseId: applicationExercise.id,
  });
  const applicationSession = await workoutSessionRepository.create({
    data: {
      userId: applicationUser.id,
      userProgramId: applicationUserProgram.id,
      programId: applicationProgram.id,
      programDayId: applicationDay.id,
      status: "active",
    },
  });
  const [applicationTarget] = await targetRepository.createManyForSession({
    sessionId: applicationSession.id,
    targets: [
      {
        programDayExerciseId: applicationDayExercise.id,
        exerciseId: applicationExercise.id,
        targetSets: 3,
        targetRepRangeLow: 8,
        targetRepRangeHigh: 10,
        exactRepTarget: 8,
        targetLoadKg: 40,
        targetDurationSeconds: null,
        progressionType: "load",
        sourceDecisionType: "MAINTAIN",
        sourceRulesVersion: "progression_decision_rules_v4",
      },
    ],
  });
  const [applicationRecommendation] =
    await progressionRecommendationRepository.createNormalizedRecommendations({
      data: [
        {
          userId: applicationUser.id,
          exerciseId: applicationExercise.id,
          sourceSessionId: applicationSession.id,
          recommendationType: "maintain",
          decisionType: "MAINTAIN",
          loadAdjustmentSteps: 0,
          repAdjustment: 0,
          setAdjustment: 0,
          durationAdjustmentSteps: 0,
          rulesVersion: "progression_decision_rules_v4",
          lifecycleStatus: "PENDING",
          progressionType: "load",
          reason: "Progression decision recorded for the next session.",
          status: "active",
        },
      ],
    });
  try {
    if (
      await runCase(
        "RecommendationApplication uniqueness violations surface to the caller",
        { recommendationId: applicationRecommendation.id, workoutTargetId: applicationTarget.id },
        async () => {
          const created = await recommendationApplicationRepository.create({
            data: {
              recommendationId: applicationRecommendation.id,
              workoutSessionId: applicationSession.id,
              workoutTargetId: applicationTarget.id,
            },
          });

          let duplicateErrorCode = null;
          try {
            await recommendationApplicationRepository.create({
              data: {
                recommendationId: applicationRecommendation.id,
                workoutSessionId: applicationSession.id,
                workoutTargetId: applicationTarget.id,
              },
            });
          } catch (error) {
            duplicateErrorCode = error instanceof Prisma.PrismaClientKnownRequestError
              ? error.code
              : null;
          }

          const foundByRecommendation =
            await recommendationApplicationRepository.findByRecommendationId(
              applicationRecommendation.id
            );
          const foundBySession =
            await recommendationApplicationRepository.findBySessionId(applicationSession.id);

          assert.equal(created.id, foundByRecommendation?.id);
          assert.equal(duplicateErrorCode, "P2002");
          assert.equal(foundBySession.length, 1);

          return {
            createdId: created.id,
            duplicateErrorCode,
            sessionCount: foundBySession.length,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({
      userIds: [applicationUser.id],
      programIds: [applicationProgram.id],
    });
  }

  const advanceSuffix = nextSuffix("advance");
  const advanceUser = await createUser({ suffix: `${advanceSuffix}-user` });
  const advanceProgram = await createProgram({ suffix: `${advanceSuffix}-program` });
  const advanceUserProgram = await createUserProgram({
    userId: advanceUser.id,
    programId: advanceProgram.id,
    currentDayIndex: 0,
  });
  try {
    if (
      await runCase(
        "UserProgram conditional advancement only succeeds for the expected currentDayIndex",
        { userProgramId: advanceUserProgram.id },
        async () => {
          const foundForUser = await userProgramRepository.findByIdForUser({
            userProgramId: advanceUserProgram.id,
            userId: advanceUser.id,
          });
          const foundWithContext = await userProgramRepository.findByIdWithCurrentDayContext({
            userProgramId: advanceUserProgram.id,
            userId: advanceUser.id,
          });
          const firstAdvance =
            await userProgramRepository.advanceCurrentDayIndexConditionally({
              userProgramId: advanceUserProgram.id,
              expectedCurrentDayIndex: 0,
              nextDayIndex: 1,
            });
          const secondAdvance =
            await userProgramRepository.advanceCurrentDayIndexConditionally({
              userProgramId: advanceUserProgram.id,
              expectedCurrentDayIndex: 0,
              nextDayIndex: 2,
            });

          assert.equal(foundForUser?.id, advanceUserProgram.id);
          assert.equal(foundWithContext?.program.id, advanceProgram.id);
          assert.equal(firstAdvance.matchedCount, 1);
          assert.equal(secondAdvance.matchedCount, 0);
          assert.equal(firstAdvance.userProgram?.currentDayIndex, 1);

          return {
            firstAdvanceCount: firstAdvance.matchedCount,
            secondAdvanceCount: secondAdvance.matchedCount,
            currentDayIndex: firstAdvance.userProgram?.currentDayIndex ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [advanceUser.id], programIds: [advanceProgram.id] });
  }

  const persistenceSuffix = nextSuffix("persistence-repo");
  const persistenceUser = await createUser({ suffix: `${persistenceSuffix}-user` });
  const persistenceExercise = await getSeedExercise();
  const persistenceSession = await workoutSessionRepository.create({
    data: {
      userId: persistenceUser.id,
      status: "completed",
      completedAt: new Date("2026-07-26T13:00:00.000Z"),
    },
  });
  try {
    if (
      await runCase(
        "ProgressionPersistenceRepository create-or-recover works without parallel abstractions",
        { userId: persistenceUser.id, exerciseId: persistenceExercise.id },
        async () => {
          const identity = {
            userId: persistenceUser.id,
            exerciseId: persistenceExercise.id,
            sourceSessionId: persistenceSession.id,
          };
          const createData = {
            ...identity,
            recommendationType: "maintain",
            decisionType: "MAINTAIN",
            loadAdjustmentSteps: 0,
            repAdjustment: 0,
            setAdjustment: 0,
            durationAdjustmentSteps: 0,
            rulesVersion: "progression_decision_rules_v4",
            lifecycleStatus: "PENDING",
            progressionType: "load",
            reason: "Progression decision recorded for the next session.",
            status: "active",
          };

          const first =
            await progressionPersistenceRepository.createOrRecoverProgressionRecommendation({
              identity,
              createData,
            });
          const second =
            await progressionPersistenceRepository.createOrRecoverProgressionRecommendation({
              identity,
              createData,
            });
          const found =
            await progressionPersistenceRepository.findExistingProgressionRecommendation(
              identity
            );

          assert.equal(first.outcome, "CREATED");
          assert.equal(second.outcome, "ALREADY_EXISTS");
          assert.equal(found?.id, first.recommendation.id);

          return {
            firstOutcome: first.outcome,
            secondOutcome: second.outcome,
            foundId: found?.id ?? null,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({ userIds: [persistenceUser.id] });
  }

  const historySuffix = nextSuffix("historical-history");
  const historyUser = await createUser({ suffix: `${historySuffix}-user` });
  const historyProgram = await createProgram({ suffix: `${historySuffix}-program` });
  const historyActiveUserProgram = await createUserProgram({
    userId: historyUser.id,
    programId: historyProgram.id,
    currentDayIndex: 0,
  });
  const historyTargetDay = await createProgramDay({
    programId: historyProgram.id,
    dayIndex: 0,
    suffix: `${historySuffix}-target-day`,
  });
  const historySingleDay = await createProgramDay({
    programId: historyProgram.id,
    dayIndex: 1,
    suffix: `${historySuffix}-single-day`,
  });
  const historyUnusedDay = await createProgramDay({
    programId: historyProgram.id,
    dayIndex: 2,
    suffix: `${historySuffix}-unused-day`,
  });
  const historyTargetExercise = await getSeedExercise();
  const historyOtherExercise = await getDifferentSeedExercise(historyTargetExercise.id);
  const historyTargetProgramDayExercise = await createProgramDayExercise({
    programDayId: historyTargetDay.id,
    exerciseId: historyTargetExercise.id,
    progressionType: "load",
  });
  const historyDifferentProgramDayExercise = await createProgramDayExercise({
    programDayId: historyTargetDay.id,
    exerciseId: historyOtherExercise.id,
    order: 2,
    progressionType: "load",
  });
  const historySingleProgramDayExercise = await createProgramDayExercise({
    programDayId: historySingleDay.id,
    exerciseId: historyTargetExercise.id,
    progressionType: "load",
  });
  const historyUnusedProgramDayExercise = await createProgramDayExercise({
    programDayId: historyUnusedDay.id,
    exerciseId: historyTargetExercise.id,
    progressionType: "load",
  });
  const historyInactiveProgram = await createProgram({ suffix: `${historySuffix}-inactive-program` });
  const historyInactiveUserProgram = await prisma.userProgram.create({
    data: {
      userId: historyUser.id,
      programId: historyInactiveProgram.id,
      isActive: false,
      currentDayIndex: 0,
    },
  });
  const historyInactiveDay = await createProgramDay({
    programId: historyInactiveProgram.id,
    dayIndex: 0,
    suffix: `${historySuffix}-inactive-day`,
  });
  const historyInactiveProgramDayExercise = await createProgramDayExercise({
    programDayId: historyInactiveDay.id,
    exerciseId: historyTargetExercise.id,
    progressionType: "load",
  });
  let latestCompletedSession;
  let tieHigherIdSession;
  let tieLowerIdSession;
  let olderCompletedSession;
  let activeSession;
  let incompleteCompletedSession;
  let differentProgramDayExerciseSession;
  let inactiveUserProgramSession;
  let singleCompletedSession;
  try {
    latestCompletedSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyTargetProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-26T09:00:00.000Z"),
      completedAt: new Date("2026-07-26T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 10,
          weightKg: 40,
          loggedAt: new Date("2026-07-26T09:10:00.000Z"),
        },
        {
          setNumber: 2,
          reps: 8,
          weightKg: 42.5,
          loggedAt: new Date("2026-07-26T09:12:00.000Z"),
        },
        {
          exerciseId: historyOtherExercise.id,
          setNumber: 3,
          reps: 12,
          weightKg: 15,
          loggedAt: new Date("2026-07-26T09:14:00.000Z"),
        },
      ],
    });
    tieLowerIdSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyTargetProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-19T09:00:00.000Z"),
      completedAt: new Date("2026-07-19T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 9,
          weightKg: 40,
          loggedAt: new Date("2026-07-19T09:10:00.000Z"),
        },
      ],
    });
    tieHigherIdSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyTargetProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-19T09:00:00.000Z"),
      completedAt: new Date("2026-07-19T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 10,
          weightKg: 41.25,
          loggedAt: new Date("2026-07-19T09:11:00.000Z"),
        },
      ],
    });
    olderCompletedSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyTargetProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-12T09:00:00.000Z"),
      completedAt: new Date("2026-07-12T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 8,
          weightKg: 37.5,
          loggedAt: new Date("2026-07-12T09:10:00.000Z"),
        },
      ],
    });
    activeSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyTargetProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-27T09:00:00.000Z"),
      completedAt: null,
      status: "active",
      setLogs: [],
    });
    incompleteCompletedSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyTargetProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-18T09:00:00.000Z"),
      completedAt: null,
      status: "completed",
      setLogs: [
        {
          setNumber: 1,
          reps: 8,
          weightKg: 35,
          loggedAt: new Date("2026-07-18T09:10:00.000Z"),
        },
      ],
    });
    differentProgramDayExerciseSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historyTargetDay.id,
      programDayExerciseId: historyDifferentProgramDayExercise.id,
      exerciseId: historyOtherExercise.id,
      startedAt: new Date("2026-07-25T09:00:00.000Z"),
      completedAt: new Date("2026-07-25T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 12,
          weightKg: 15,
          loggedAt: new Date("2026-07-25T09:10:00.000Z"),
        },
      ],
    });
    inactiveUserProgramSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyInactiveUserProgram.id,
      programId: historyInactiveProgram.id,
      programDayId: historyInactiveDay.id,
      programDayExerciseId: historyInactiveProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-24T09:00:00.000Z"),
      completedAt: new Date("2026-07-24T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 10,
          weightKg: 39,
          loggedAt: new Date("2026-07-24T09:10:00.000Z"),
        },
      ],
    });
    singleCompletedSession = await createHistoricalExposure({
      userId: historyUser.id,
      userProgramId: historyActiveUserProgram.id,
      programId: historyProgram.id,
      programDayId: historySingleDay.id,
      programDayExerciseId: historySingleProgramDayExercise.id,
      exerciseId: historyTargetExercise.id,
      startedAt: new Date("2026-07-23T09:00:00.000Z"),
      completedAt: new Date("2026-07-23T09:45:00.000Z"),
      setLogs: [
        {
          setNumber: 1,
          reps: 10,
          weightKg: 38.75,
          loggedAt: new Date("2026-07-23T09:10:00.000Z"),
        },
      ],
    });

    if (
      await runCase(
        "historical completed query returns no history when no matching completed exposures exist",
        {
          userProgramId: historyActiveUserProgram.id,
          programDayExerciseId: historyUnusedProgramDayExercise.id,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historyUnusedProgramDayExercise.id,
          });

          assert.equal(found.length, 0);
          return { count: found.length };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query returns one completed exposure for a single matching boundary",
        {
          userProgramId: historyActiveUserProgram.id,
          programDayExerciseId: historySingleProgramDayExercise.id,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historySingleProgramDayExercise.id,
          });

          assert.equal(found.length, 1);
          assert.equal(found[0].id, singleCompletedSession.id);
          assert.deepEqual(Object.keys(found[0]).sort(), [
            "completedAt",
            "exerciseTargets",
            "id",
            "programDayId",
            "setLogs",
            "startedAt",
            "userProgramId",
          ]);
          assert.equal(found[0].exerciseTargets.length, 1);
          assert.deepEqual(Object.keys(found[0].exerciseTargets[0]).sort(), [
            "exactRepTarget",
            "exerciseId",
            "id",
            "programDayExerciseId",
            "progressionType",
            "sourceRecommendation",
            "targetDurationSeconds",
            "targetLoadKg",
            "targetRepRangeHigh",
            "targetRepRangeLow",
            "targetSets",
          ]);
          assert.deepEqual(Object.keys(found[0].setLogs[0]).sort(), [
            "exerciseId",
            "id",
            "loggedAt",
            "reps",
            "setNumber",
            "weightKg",
          ]);

          return {
            count: found.length,
            sessionId: found[0].id,
            targetCount: found[0].exerciseTargets.length,
            setLogCount: found[0].setLogs.length,
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query returns multiple completed exposures newest first",
        {
          userProgramId: historyActiveUserProgram.id,
          programDayExerciseId: historyTargetProgramDayExercise.id,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historyTargetProgramDayExercise.id,
          });

          assert.equal(found.length, 4);
          assert.deepEqual(
            found.map((session) => session.id),
            [
              latestCompletedSession.id,
              tieHigherIdSession.id,
              tieLowerIdSession.id,
              olderCompletedSession.id,
            ]
          );

          return {
            sessionIds: found.map((session) => session.id),
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query enforces deterministic ordering with id tie-breaker",
        {
          higherId: tieHigherIdSession.id,
          lowerId: tieLowerIdSession.id,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historyTargetProgramDayExercise.id,
            limit: 3,
          });

          assert.equal(found[1].id, tieHigherIdSession.id);
          assert.equal(found[2].id, tieLowerIdSession.id);

          return {
            orderedTieIds: [found[1].id, found[2].id],
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query respects configurable limit N",
        {
          limit: 2,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historyTargetProgramDayExercise.id,
            limit: 2,
          });

          assert.equal(found.length, 2);
          assert.deepEqual(found.map((session) => session.id), [
            latestCompletedSession.id,
            tieHigherIdSession.id,
          ]);

          return {
            sessionIds: found.map((session) => session.id),
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query excludes incomplete and active sessions",
        {
          excludedSessionIds: [activeSession.id, incompleteCompletedSession.id],
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historyTargetProgramDayExercise.id,
          });

          const foundIds = new Set(found.map((session) => session.id));
          assert.equal(foundIds.has(activeSession.id), false);
          assert.equal(foundIds.has(incompleteCompletedSession.id), false);

          return {
            foundIds: Array.from(foundIds),
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query still returns exposures for a since-deactivated UserProgram when explicitly scoped",
        {
          userProgramId: historyInactiveUserProgram.id,
          sessionId: inactiveUserProgramSession.id,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyInactiveUserProgram.id,
            programDayExerciseId: historyInactiveProgramDayExercise.id,
          });

          assert.equal(found.length, 1);
          assert.equal(found[0].id, inactiveUserProgramSession.id);
          assert.equal(found[0].userProgramId, historyInactiveUserProgram.id);

          return {
            sessionIds: found.map((session) => session.id),
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }

    if (
      await runCase(
        "historical completed query excludes exposures from a different ProgramDayExercise",
        {
          excludedSessionId: differentProgramDayExerciseSession.id,
        },
        async () => {
          const found = await workoutSessionRepository.findCompletedHistoryForUserProgramDayExercise({
            userProgramId: historyActiveUserProgram.id,
            programDayExerciseId: historyTargetProgramDayExercise.id,
          });

          assert.equal(
            found.some((session) => session.id === differentProgramDayExerciseSession.id),
            false
          );
          assert.equal(found[0].setLogs.length, 2);
          assert.equal(
            found[0].setLogs.every((setLog) => setLog.exerciseId === historyTargetExercise.id),
            true
          );

          return {
            firstSessionSetLogCount: found[0].setLogs.length,
            firstSessionExerciseIds: found[0].setLogs.map((setLog) => setLog.exerciseId),
          };
        }
      )
    ) {
      passed += 1;
    } else {
      failed += 1;
    }
  } finally {
    await cleanupFixture({
      userIds: [historyUser.id],
      programIds: [historyProgram.id, historyInactiveProgram.id],
    });
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  await prisma.$disconnect();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});
