import { Prisma } from "@prisma/client";

import prisma from "../lib/prisma.js";
import { createProgramDayRepository } from "../repositories/programDayRepository.js";
import { createProgressionRecommendationRepository } from "../repositories/progressionRecommendationRepository.js";
import { createRecommendationApplicationRepository } from "../repositories/recommendationApplicationRepository.js";
import { createUserProgramRepository } from "../repositories/userProgramRepository.js";
import { createWorkoutSessionExerciseTargetRepository } from "../repositories/workoutSessionExerciseTargetRepository.js";
import { createWorkoutSessionRepository } from "../repositories/workoutSessionRepository.js";
import { analyzeExercisePerformance } from "./exercisePerformanceAnalyzer.js";
import {
  classifyDecisionPersistability,
  mapDecisionToProgressionRecommendationData,
} from "./progressionDecisionMapping.js";
import { buildProgressionExplanation } from "./progressionExplanationBuilder.js";
import {
  createProgressionDecisionContext,
  toProgressionDecisionEngineInput,
} from "./progressionDecisionContext.js";
import {
  decideProgression,
} from "./progressionDecisionEngine.js";
import { computeRecoveryModifier } from "./recoveryEngine.js";
import {
  aggregateTrainingStateSignals,
  deriveTrainingStateSignalsFromExposures,
} from "./trainingStateAggregator.js";
import { analyzeWorkoutHistory } from "./workoutAnalyzer.js";
import {
  resolveWorkoutTarget,
  WORKOUT_TARGET_RESOLUTION_REASONS,
} from "./workoutTargetResolver.js";

const ACTIVE_WORKOUT_SESSION_STATUS = "active";
const COMPLETED_WORKOUT_SESSION_STATUS = "completed";
const DEFAULT_RECOVERY_ANALYSIS_WINDOW_DAYS = 28;
const NEUTRAL_HISTORICAL_TRAINING_SIGNALS = Object.freeze({
  completedExposureCount: 0,
  averageCompletionRatio: null,
  averageCompletedSets: null,
  latestCompletedAt: null,
  previousCompletedAt: null,
  loadTrend: "UNKNOWN",
  repTrend: "UNKNOWN",
});
const NEUTRAL_TRAINING_STATE_SIGNALS = aggregateTrainingStateSignals({
  historicalTrainingSignals: NEUTRAL_HISTORICAL_TRAINING_SIGNALS,
});

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

export class WorkoutSessionCompletionError extends Error {
  constructor(
    message,
    { statusCode = 500, code = "WORKOUT_SESSION_COMPLETION_FAILED", cause, details } = {}
  ) {
    super(message);
    this.name = "WorkoutSessionCompletionError";
    this.statusCode = statusCode;
    this.code = code;
    this.cause = cause ?? null;
    this.details = details ?? null;
  }
}

function isPrismaUniqueViolation(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
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

function buildAnalyzerSet(setLog) {
  return {
    setNumber: setLog.setNumber,
    reps: setLog.reps,
    weightKg: setLog.weightKg,
  };
}

function buildCompletionPrescription(targetSnapshot) {
  return {
    prescribedSets: targetSnapshot.targetSets,
    prescribedRepLow: targetSnapshot.targetRepRangeLow,
    prescribedRepHigh: targetSnapshot.targetRepRangeHigh,
    prescribedRestSeconds: targetSnapshot.programDayExercise?.restSeconds ?? null,
  };
}

function buildCompletionAnalyzerInput({ sourceSessionId, targetSnapshot, performedSetLogs, previousSessions }) {
  return {
    exerciseId: targetSnapshot.exerciseId,
    sourceSessionId,
    prescription: buildCompletionPrescription(targetSnapshot),
    currentSession: {
      sets: performedSetLogs.map(buildAnalyzerSet),
    },
    previousSessions: previousSessions.map((session) => ({
      sourceSessionId: session.id,
      sets: session.setLogs.map(buildAnalyzerSet),
    })),
  };
}

function buildCompletionProgressionPolicy(targetSnapshot) {
  const progressionMode =
    targetSnapshot.progressionType ||
    targetSnapshot.programDayExercise?.progressionType ||
    targetSnapshot.exercise?.progressionType ||
    "load";

  return {
    progressionMode,
    allowsLoadAdjustment: progressionMode === "load" || progressionMode === "reps_then_load",
    allowsSetAdjustment: false,
    allowsRepAdjustment: progressionMode === "reps" || progressionMode === "reps_then_load",
    validIncrement: true,
  };
}

function buildCompletionRecoveryConstraint(recoveryResult) {
  return {
    recoveryModifier: recoveryResult.recoveryModifier,
    confidence: recoveryResult.confidence,
    signalStrength: recoveryResult.signalStrength,
    reasonCode: null,
  };
}

function buildCompletionDecisionContext({
  analysis,
  trainingStateSignals,
  targetSnapshot,
  previousRecommendation,
  recoveryResult,
}) {
  return createProgressionDecisionContext({
    analysis,
    progressionPolicy: buildCompletionProgressionPolicy(targetSnapshot),
    recoveryConstraint: buildCompletionRecoveryConstraint(recoveryResult),
    previousDecisionContext: previousRecommendation
      ? {
          previousDecisionType: previousRecommendation.decisionType ?? null,
          consecutiveFailures: previousRecommendation.consecutiveFailures ?? 0,
        }
      : null,
    trainingStateSignals,
  });
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

async function hydrateCompletionResponse({
  userId,
  sessionId,
  updatedUserProgram,
  nextProgramDay,
  warning,
  progressionRecommendations,
  repositories,
}) {
  const session = await repositories.workoutSessions.findByIdWithTargets(sessionId);
  if (!session) {
    throw new WorkoutSessionCompletionError("Workout session not found after completion", {
      statusCode: 500,
      code: "WORKOUT_SESSION_NOT_FOUND_AFTER_COMPLETION",
    });
  }

  let hydratedUserProgram = updatedUserProgram;
  if (updatedUserProgram?.id && isPositiveInteger(userId)) {
    hydratedUserProgram = await repositories.userPrograms.findByIdForUser({
      userProgramId: updatedUserProgram.id,
      userId,
    });
  }

  return {
    session,
    updatedUserProgram: hydratedUserProgram ?? updatedUserProgram ?? null,
    nextProgramDay: nextProgramDay ?? null,
    warning: warning ?? null,
    progressionRecommendations,
    progressionWarning: null,
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
  analyzeExercisePerformanceImpl = analyzeExercisePerformance,
  decideProgressionImpl = decideProgression,
  analyzeWorkoutHistoryImpl = analyzeWorkoutHistory,
  computeRecoveryModifierImpl = computeRecoveryModifier,
  classifyDecisionPersistabilityImpl = classifyDecisionPersistability,
  mapDecisionToProgressionRecommendationDataImpl = mapDecisionToProgressionRecommendationData,
  buildProgressionExplanationImpl = buildProgressionExplanation,
  deriveTrainingStateSignalsFromExposuresImpl = deriveTrainingStateSignalsFromExposures,
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
    // Authoritative production entry point for progression generation and
    // persistence during workout completion.
    async completeWorkoutSession({ userId, sessionId }) {
      let transactionResult;

      try {
        transactionResult = await prismaClient.$transaction(async (tx) => {
          const repositories = createRepositories(tx);
          const completionContext = await repositories.workoutSessions.findCompletionContext(sessionId);

          if (!completionContext || completionContext.userId !== userId) {
            throw new WorkoutSessionCompletionError("Workout session not found", {
              statusCode: 404,
              code: "WORKOUT_SESSION_NOT_FOUND",
            });
          }

          if (completionContext.status !== ACTIVE_WORKOUT_SESSION_STATUS) {
            throw new WorkoutSessionCompletionError("Only an active session can be completed", {
              statusCode: 400,
              code: "WORKOUT_SESSION_NOT_ACTIVE",
            });
          }

          if (completionContext.setLogs.length === 0) {
            throw new WorkoutSessionCompletionError(
              "Log at least one set before completing the workout",
              {
                statusCode: 400,
                code: "WORKOUT_SESSION_EMPTY",
              }
            );
          }

          const completedAt = new Date();
          const completionUpdate = await repositories.workoutSessions.markCompletedIfActive({
            sessionId,
            completedAt,
          });

          if (!completionUpdate.found || !completionUpdate.transitioned || !completionUpdate.session) {
            throw new WorkoutSessionCompletionError("Only an active session can be completed", {
              statusCode: 400,
              code: "WORKOUT_SESSION_ALREADY_COMPLETED",
            });
          }

          const workoutAnalysis = await analyzeWorkoutHistoryImpl({
            userId,
            windowDays: DEFAULT_RECOVERY_ANALYSIS_WINDOW_DAYS,
          });
          const recoveryResult = computeRecoveryModifierImpl({ workoutAnalysis });

          const progressionCreateData = [];
          const progressionExplanationArtifacts = [];
          for (const targetSnapshot of completionContext.exerciseTargets) {
            const performedSetLogs = completionContext.setLogs.filter(
              (setLog) => setLog.exerciseId === targetSnapshot.exerciseId
            );

            if (performedSetLogs.length === 0) {
              continue;
            }

            const previousSessions =
              await repositories.workoutSessions.findPreviousCompletedSessionsForExercise({
                userId,
                exerciseId: targetSnapshot.exerciseId,
                excludeSessionId: sessionId,
              });
            const previousRecommendation =
              await repositories.recommendations.findLatestForExercise({
                userId,
                exerciseId: targetSnapshot.exerciseId,
                excludeSourceSessionId: sessionId,
              });
            const trainingStateSignals = await resolveTrainingStateSignals({
              completionContext,
              repositories,
              sessionId,
              targetSnapshot,
              deriveTrainingStateSignalsFromExposuresImpl,
            });

            const analysis = analyzeExercisePerformanceImpl(
              buildCompletionAnalyzerInput({
                sourceSessionId: sessionId,
                targetSnapshot,
                performedSetLogs,
                previousSessions,
              })
            );

            const decisionContext = buildCompletionDecisionContext({
                analysis,
                trainingStateSignals,
                targetSnapshot,
                previousRecommendation,
                recoveryResult,
              });
            const decision = decideProgressionImpl(
              toProgressionDecisionEngineInput(decisionContext)
            );

            if (classifyDecisionPersistabilityImpl(decision.decisionType) === "DO_NOT_PERSIST") {
              continue;
            }

            const explanation = buildProgressionExplanationImpl({ decision });
            progressionExplanationArtifacts.push(
              Object.freeze({
                exerciseId: targetSnapshot.exerciseId,
                explanation,
              })
            );

            progressionCreateData.push(
              mapDecisionToProgressionDataEntry({
                userId,
                sessionId,
                targetSnapshot,
                analysis,
                decision,
                previousRecommendation,
                mapDecisionToProgressionRecommendationDataImpl,
              })
            );
          }

          const progressionRecommendations =
            progressionCreateData.length > 0
              ? await repositories.recommendations.createNormalizedRecommendations({
                  data: progressionCreateData,
                })
              : [];

          let updatedUserProgram = null;
          let nextProgramDay = null;
          let warning = null;

          const activeUserProgram = await repositories.userPrograms.findActiveForUser(userId);

          if (!activeUserProgram) {
            warning = "No active program found; day was not advanced";
          } else if (completionContext.programId !== activeUserProgram.programId) {
            warning = "Completed session does not belong to the active program; day was not advanced";
            updatedUserProgram = activeUserProgram;
          } else {
            const programDaysCount = await repositories.programDays.countByProgramId(
              activeUserProgram.programId
            );

            if (programDaysCount === 0) {
              warning = "Active program has no days configured; day was not advanced";
              updatedUserProgram = activeUserProgram;
            } else {
              const nextDayIndex = (activeUserProgram.currentDayIndex + 1) % programDaysCount;
              const advancement =
                await repositories.userPrograms.advanceCurrentDayIndexConditionally({
                  userProgramId: activeUserProgram.id,
                  expectedCurrentDayIndex: activeUserProgram.currentDayIndex,
                  nextDayIndex,
                });

              if (advancement.matchedCount !== 1 || !advancement.userProgram) {
                throw new WorkoutSessionCompletionError("Failed to advance active program day", {
                  statusCode: 500,
                  code: "USER_PROGRAM_ADVANCEMENT_FAILED",
                });
              }

              updatedUserProgram = advancement.userProgram;
              nextProgramDay =
                await repositories.programDays.findDayBelongingToUserProgramProgram({
                  userProgramId: activeUserProgram.id,
                  dayIndex: nextDayIndex,
                });
            }
          }

          return {
            sessionId,
            updatedUserProgram,
            nextProgramDay,
            warning,
            progressionExplanationArtifacts,
            progressionRecommendations,
          };
        });
      } catch (error) {
        if (error instanceof WorkoutSessionCompletionError) {
          throw error;
        }

        throw new WorkoutSessionCompletionError("Failed to complete workout session", {
          statusCode: 500,
          code: "WORKOUT_SESSION_COMPLETION_FAILED",
          cause: error,
        });
      }

      const repositories = createRepositories(prismaClient);
      return hydrateCompletionResponse({
        userId,
        sessionId: transactionResult.sessionId,
        updatedUserProgram: transactionResult.updatedUserProgram,
        nextProgramDay: transactionResult.nextProgramDay,
        warning: transactionResult.warning,
        progressionRecommendations: transactionResult.progressionRecommendations,
        repositories,
      });
    },

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

function mapDecisionToProgressionDataEntry({
  userId,
  sessionId,
  targetSnapshot,
  analysis,
  decision,
  previousRecommendation,
  mapDecisionToProgressionRecommendationDataImpl,
}) {
  return mapDecisionToProgressionRecommendationDataImpl({
    userId,
    exerciseId: targetSnapshot.exerciseId,
    sourceSessionId: sessionId,
    decision,
    analysis,
    prescription: {
      repRangeLow: targetSnapshot.targetRepRangeLow,
      repRangeHigh: targetSnapshot.targetRepRangeHigh,
      progressionType:
        targetSnapshot.progressionType ||
        targetSnapshot.programDayExercise?.progressionType ||
        targetSnapshot.exercise?.progressionType ||
        "load",
    },
    exercise: targetSnapshot.exercise,
    previousRecommendation,
  });
}

async function resolveTrainingStateSignals({
  completionContext,
  repositories,
  sessionId,
  targetSnapshot,
  deriveTrainingStateSignalsFromExposuresImpl,
}) {
  if (
    !isPositiveInteger(completionContext?.userProgramId) ||
    !isPositiveInteger(targetSnapshot?.programDayExerciseId)
  ) {
    return NEUTRAL_TRAINING_STATE_SIGNALS;
  }

  try {
    const exposures =
      await repositories.workoutSessions.findCompletedHistoryForUserProgramDayExercise({
        userProgramId: completionContext.userProgramId,
        programDayExerciseId: targetSnapshot.programDayExerciseId,
        limit: 5,
        excludeSessionId: sessionId,
      });

    return deriveTrainingStateSignalsFromExposuresImpl(exposures);
  } catch {
    return NEUTRAL_TRAINING_STATE_SIGNALS;
  }
}

export const workoutSessionService = createWorkoutSessionService();
