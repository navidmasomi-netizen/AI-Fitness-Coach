import { Prisma } from "@prisma/client";

import prisma from "../lib/prisma.js";
import { createProgramDayRepository } from "../repositories/programDayRepository.js";
import { createProgressionRecommendationRepository } from "../repositories/progressionRecommendationRepository.js";
import { createRecommendationApplicationRepository } from "../repositories/recommendationApplicationRepository.js";
import { createUserProgramRepository } from "../repositories/userProgramRepository.js";
import { createWorkoutSessionExerciseTargetRepository } from "../repositories/workoutSessionExerciseTargetRepository.js";
import { createWorkoutSessionRepository } from "../repositories/workoutSessionRepository.js";
import {
  resolveWorkoutTarget,
  WORKOUT_TARGET_RESOLUTION_REASONS,
} from "./workoutTargetResolver.js";

const ACTIVE_WORKOUT_SESSION_STATUS = "active";

export class WorkoutSessionStartError extends Error {
  constructor(message, { statusCode = 500, code = "WORKOUT_SESSION_START_FAILED", cause, details } = {}) {
    super(message);
    this.name = "WorkoutSessionStartError";
    this.statusCode = statusCode;
    this.code = code;
    this.cause = cause ?? null;
    this.details = details ?? null;
  }
}

function isPrismaUniqueViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeIdempotencyKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function deriveBaselineTarget(programDayExercise) {
  const progressionType =
    programDayExercise.progressionType ||
    programDayExercise.exercise?.progressionType ||
    "load";

  if (progressionType === "time") {
    return {
      targetSets: programDayExercise.sets,
      prescribedRepLow: null,
      prescribedRepHigh: null,
      exactRepTarget: null,
      targetLoadKg: null,
      targetDurationSeconds: programDayExercise.repRangeLow,
      progressionType,
    };
  }

  return {
    targetSets: programDayExercise.sets,
    prescribedRepLow: programDayExercise.repRangeLow,
    prescribedRepHigh: programDayExercise.repRangeHigh,
    exactRepTarget: programDayExercise.repRangeLow,
    targetLoadKg: null,
    targetDurationSeconds: null,
    progressionType,
  };
}

function buildPrescriptionMetadata(programDayExercise) {
  return {
    loadIncrementKg: programDayExercise.loadIncrementKg,
    durationIncrementSeconds: programDayExercise.durationIncrementSeconds,
  };
}

function selectLatestRecommendationsByExerciseId(recommendations) {
  const selectedRecommendations = new Map();

  for (const recommendation of recommendations) {
    if (!selectedRecommendations.has(recommendation.exerciseId)) {
      selectedRecommendations.set(recommendation.exerciseId, recommendation);
    }
  }

  return selectedRecommendations;
}

function buildTargetCreateData({ programDayExercise, recommendation, resolvedTarget }) {
  return {
    programDayExerciseId: programDayExercise.id,
    exerciseId: programDayExercise.exerciseId,
    priorTargetId: null,
    sourceRecommendationId: recommendation?.id ?? null,
    targetSets: resolvedTarget.target.targetSets,
    targetRepRangeLow: resolvedTarget.target.targetRepRangeLow,
    targetRepRangeHigh: resolvedTarget.target.targetRepRangeHigh,
    exactRepTarget: resolvedTarget.target.exactRepTarget,
    targetLoadKg: resolvedTarget.target.targetLoadKg,
    targetDurationSeconds: resolvedTarget.target.targetDurationSeconds,
    progressionType: resolvedTarget.target.progressionType,
    sourceDecisionType: resolvedTarget.target.sourceDecisionType,
    sourceRulesVersion: resolvedTarget.target.sourceRulesVersion,
  };
}

async function hydrateStartSessionResponse({
  userId,
  sessionId,
  fallbackUserProgram,
  repositories,
}) {
  const session = await repositories.workoutSessions.findByIdWithTargets(sessionId);
  if (!session) {
    throw new WorkoutSessionStartError("Workout session not found after start-session operation", {
      statusCode: 500,
      code: "WORKOUT_SESSION_NOT_FOUND_AFTER_START",
    });
  }

  const userProgramContext = session.userProgramId
    ? await repositories.userPrograms.findByIdWithCurrentDayContext({
        userProgramId: session.userProgramId,
        userId,
      })
    : fallbackUserProgram
      ? await repositories.userPrograms.findByIdWithCurrentDayContext({
          userProgramId: fallbackUserProgram.id,
          userId,
        })
      : null;

  const programDay = session.programDayId
    ? await repositories.programDays.findDayWithExercises(session.programDayId)
    : null;

  const program =
    userProgramContext?.program && session.programId === userProgramContext.program.id
      ? userProgramContext.program
      : fallbackUserProgram?.program && session.programId === fallbackUserProgram.program.id
        ? fallbackUserProgram.program
        : null;

  return {
    session,
    program,
    programDay,
    exercises: programDay?.exercises ?? [],
  };
}

export function createWorkoutSessionService({
  prismaClient = prisma,
  createWorkoutSessionRepositoryImpl = createWorkoutSessionRepository,
  createUserProgramRepositoryImpl = createUserProgramRepository,
  createProgramDayRepositoryImpl = createProgramDayRepository,
  createProgressionRecommendationRepositoryImpl = createProgressionRecommendationRepository,
  createWorkoutSessionExerciseTargetRepositoryImpl = createWorkoutSessionExerciseTargetRepository,
  createRecommendationApplicationRepositoryImpl = createRecommendationApplicationRepository,
  resolveWorkoutTargetImpl = resolveWorkoutTarget,
} = {}) {
  function createRepositories(db) {
    return {
      workoutSessions: createWorkoutSessionRepositoryImpl(db),
      userPrograms: createUserProgramRepositoryImpl(db),
      programDays: createProgramDayRepositoryImpl(db),
      recommendations: createProgressionRecommendationRepositoryImpl(db),
      targets: createWorkoutSessionExerciseTargetRepositoryImpl(db),
      recommendationApplications: createRecommendationApplicationRepositoryImpl(db),
    };
  }

  async function replayExistingSession({
    userId,
    sessionId,
    fallbackUserProgram,
    resumed,
  }) {
    const repositories = createRepositories(prismaClient);
    const responseData = await hydrateStartSessionResponse({
      userId,
      sessionId,
      fallbackUserProgram,
      repositories,
    });

    return {
      ...responseData,
      resumed,
    };
  }

  async function recoverFromDuplicateStart({ userId, idempotencyKey }) {
    const repositories = createRepositories(prismaClient);
    const activeUserProgram = await repositories.userPrograms.findActiveForUser(userId);
    if (!activeUserProgram) {
      throw new WorkoutSessionStartError("No active program found", {
        statusCode: 404,
        code: "ACTIVE_USER_PROGRAM_NOT_FOUND",
      });
    }

    if (idempotencyKey) {
      const idempotentSession =
        await repositories.workoutSessions.findByUserAndIdempotencyKey({
          userId,
          idempotencyKey,
        });
      if (idempotentSession) {
        return replayExistingSession({
          userId,
          sessionId: idempotentSession.id,
          fallbackUserProgram: activeUserProgram,
          resumed: true,
        });
      }
    }

    const activeSessionForProgram =
      await repositories.workoutSessions.findActiveByUserProgramId(activeUserProgram.id);
    if (activeSessionForProgram) {
      return replayExistingSession({
        userId,
        sessionId: activeSessionForProgram.id,
        fallbackUserProgram: activeUserProgram,
        resumed: true,
      });
    }

    const legacyActiveSession = await repositories.workoutSessions.findLatestActiveByUser(userId);
    if (legacyActiveSession) {
      return replayExistingSession({
        userId,
        sessionId: legacyActiveSession.id,
        fallbackUserProgram: activeUserProgram,
        resumed: true,
      });
    }

    throw null;
  }

  return {
    async startFromActiveProgram({ userId, idempotencyKey }) {
      const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
      const rootRepositories = createRepositories(prismaClient);
      const rootActiveUserProgram = await rootRepositories.userPrograms.findActiveForUser(userId);

      if (!rootActiveUserProgram) {
        throw new WorkoutSessionStartError("No active program found", {
          statusCode: 404,
          code: "ACTIVE_USER_PROGRAM_NOT_FOUND",
        });
      }

      if (normalizedIdempotencyKey) {
        const existingByIdempotency =
          await rootRepositories.workoutSessions.findByUserAndIdempotencyKey({
            userId,
            idempotencyKey: normalizedIdempotencyKey,
          });

        if (existingByIdempotency) {
          return replayExistingSession({
            userId,
            sessionId: existingByIdempotency.id,
            fallbackUserProgram: rootActiveUserProgram,
            resumed: true,
          });
        }
      }

      const activeSessionForProgram =
        await rootRepositories.workoutSessions.findActiveByUserProgramId(rootActiveUserProgram.id);
      if (activeSessionForProgram) {
        return replayExistingSession({
          userId,
          sessionId: activeSessionForProgram.id,
          fallbackUserProgram: rootActiveUserProgram,
          resumed: true,
        });
      }

      const legacyActiveSession =
        await rootRepositories.workoutSessions.findLatestActiveByUser(userId);
      if (legacyActiveSession) {
        return replayExistingSession({
          userId,
          sessionId: legacyActiveSession.id,
          fallbackUserProgram: rootActiveUserProgram,
          resumed: true,
        });
      }

      let transactionResult;
      try {
        transactionResult = await prismaClient.$transaction(async (tx) => {
          const repositories = createRepositories(tx);
          const activeUserProgram = await repositories.userPrograms.findActiveForUser(userId);

          if (!activeUserProgram) {
            throw new WorkoutSessionStartError("No active program found", {
              statusCode: 404,
              code: "ACTIVE_USER_PROGRAM_NOT_FOUND",
            });
          }

          if (normalizedIdempotencyKey) {
            const existingByKey =
              await repositories.workoutSessions.findByUserAndIdempotencyKey({
                userId,
                idempotencyKey: normalizedIdempotencyKey,
              });

            if (existingByKey) {
              return {
                mode: "replayed",
                sessionId: existingByKey.id,
                userProgram: activeUserProgram,
              };
            }
          }

          const activeSession =
            await repositories.workoutSessions.findActiveByUserProgramId(activeUserProgram.id);
          if (activeSession) {
            return {
              mode: "replayed",
              sessionId: activeSession.id,
              userProgram: activeUserProgram,
            };
          }

          const legacySession =
            await repositories.workoutSessions.findLatestActiveByUser(userId);
          if (legacySession) {
            return {
              mode: "replayed",
              sessionId: legacySession.id,
              userProgram: activeUserProgram,
            };
          }

          const programDay = await repositories.programDays.findDayBelongingToUserProgramProgram({
            userProgramId: activeUserProgram.id,
            dayIndex: activeUserProgram.currentDayIndex,
          });

          if (!programDay) {
            throw new WorkoutSessionStartError("Program day not found for current index", {
              statusCode: 404,
              code: "PROGRAM_DAY_NOT_FOUND",
            });
          }

          const recommendations =
            await repositories.recommendations.findEligiblePendingForExerciseIds({
              userId,
              exerciseIds: programDay.exercises.map((exerciseRow) => exerciseRow.exerciseId),
            });
          const selectedRecommendations =
            selectLatestRecommendationsByExerciseId(recommendations);

          const session = await repositories.workoutSessions.create({
            data: {
              userId,
              userProgramId: activeUserProgram.id,
              programId: activeUserProgram.programId,
              programDayId: programDay.id,
              idempotencyKey: normalizedIdempotencyKey,
              status: ACTIVE_WORKOUT_SESSION_STATUS,
            },
          });

          const targetRows = [];
          for (const programDayExercise of programDay.exercises) {
            const recommendation =
              selectedRecommendations.get(programDayExercise.exerciseId) ?? null;
            const baselineTarget = deriveBaselineTarget(programDayExercise);
            const resolvedTarget = resolveWorkoutTargetImpl({
              baselineTarget,
              recommendation,
              prescriptionMetadata: buildPrescriptionMetadata(programDayExercise),
            });

            if (resolvedTarget.status === "unresolved") {
              throw new WorkoutSessionStartError("Failed to resolve workout target", {
                statusCode: 500,
                code: "WORKOUT_TARGET_UNRESOLVED",
                details: {
                  reason: resolvedTarget.reason,
                  programDayExerciseId: programDayExercise.id,
                  exerciseId: programDayExercise.exerciseId,
                },
              });
            }

            targetRows.push(
              buildTargetCreateData({
                programDayExercise,
                recommendation,
                resolvedTarget,
              })
            );
          }

          const createdTargets = await repositories.targets.createManyForSession({
            sessionId: session.id,
            targets: targetRows,
          });

          const applications = createdTargets
            .filter((target) => target.sourceRecommendationId)
            .map((target) => ({
              recommendationId: target.sourceRecommendationId,
              workoutSessionId: session.id,
              workoutTargetId: target.id,
            }));

          if (applications.length > 0) {
            await repositories.recommendationApplications.createMany({
              data: applications,
            });

            for (const application of applications) {
              const lifecycleUpdate =
                await repositories.recommendations.markAppliedConditionally({
                  recommendationId: application.recommendationId,
                });

              if (lifecycleUpdate.matchedCount !== 1) {
                throw new WorkoutSessionStartError(
                  "Failed to transition progression recommendation lifecycle",
                  {
                    statusCode: 500,
                    code: "RECOMMENDATION_LIFECYCLE_CONFLICT",
                    details: {
                      recommendationId: application.recommendationId,
                    },
                  }
                );
              }
            }
          }

          return {
            mode: "created",
            sessionId: session.id,
            userProgram: activeUserProgram,
          };
        });
      } catch (error) {
        if (isPrismaUniqueViolation(error)) {
          const replayed = await recoverFromDuplicateStart({
            userId,
            idempotencyKey: normalizedIdempotencyKey,
          });
          if (replayed) {
            return replayed;
          }
        }

        if (error instanceof WorkoutSessionStartError) {
          throw error;
        }

        throw new WorkoutSessionStartError("Failed to start workout session", {
          statusCode: 500,
          code: "WORKOUT_SESSION_START_FAILED",
          cause: error,
        });
      }

      return replayExistingSession({
        userId,
        sessionId: transactionResult.sessionId,
        fallbackUserProgram: transactionResult.userProgram,
        resumed: transactionResult.mode === "replayed",
      });
    },
  };
}

export const workoutSessionService = createWorkoutSessionService();
