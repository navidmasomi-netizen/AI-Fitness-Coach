import { z } from "zod";

import { apiRequest } from "./client";
import {
  ReplacementRecommendationResponse,
  ReplacementContextInput,
} from "../types/replacement";

const replacementIntentSchema = z.object({
  version: z.literal("replacement-intent-v1"),
  type: z.enum([
    "UNKNOWN",
    "NO_EQUIPMENT",
    "EQUIPMENT_BUSY",
    "EXERCISE_UNAVAILABLE",
    "PREFER_VARIATION",
    "DISCOMFORT",
  ]),
});

const replacementContextSchema = z.object({
  version: z.literal("replacement-context-v1"),
  equipmentContext: z
    .object({
      availableEquipment: z.array(
        z.enum([
          "bodyweight",
          "dumbbell",
          "barbell",
          "bench",
          "rack",
          "cable",
          "selectorized_machine",
          "leg_press_machine",
          "pull_up_bar",
          "step_platform",
        ])
      ),
    })
    .nullable(),
  replacementIntent: replacementIntentSchema.nullable(),
});

const traceabilitySchema = z.object({
  eligibility: z.object({
    eligible: z.boolean(),
    passedRuleIds: z.array(z.string()),
  }),
  similarity: z.object({
    status: z.string(),
  }),
  ranking: z.object({
    rank: z.number().int().positive(),
    rankingScore: z.number().nullable(),
  }),
  integrity: z.object({
    status: z.enum(["PASS", "WARN", "BLOCK"]),
  }),
  context: z.object({
    equipmentAvailabilityStatus: z.enum([
      "AVAILABLE",
      "UNAVAILABLE",
      "CONTEXT_UNKNOWN",
      "METADATA_UNAVAILABLE",
    ]),
    replacementIntentType: replacementIntentSchema.shape.type.nullable(),
  }),
});

const candidateSummarySchema = z.object({
  exerciseId: z.number().int().positive(),
  nameEn: z.string().nullable(),
  nameFa: z.string(),
  rank: z.number().int().positive(),
  rankingScore: z.number().nullable(),
  integrityStatus: z.enum(["PASS", "WARN", "BLOCK"]),
  equipmentAvailabilityStatus: z.enum([
    "AVAILABLE",
    "UNAVAILABLE",
    "CONTEXT_UNKNOWN",
    "METADATA_UNAVAILABLE",
  ]),
  reasonCodes: z.array(
    z.enum([
      "REPLACEMENT_RECOMMENDED",
      "REPLACEMENT_RECOMMENDED_WITH_WARNING",
      "REPLACEMENT_NO_CONTEXTUAL_REPLACEMENT",
      "REPLACEMENT_EQUIPMENT_AVAILABLE",
      "REPLACEMENT_EQUIPMENT_UNAVAILABLE",
      "REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN",
      "REPLACEMENT_EQUIPMENT_METADATA_UNAVAILABLE",
      "REPLACEMENT_INTEGRITY_WARNING",
      "REPLACEMENT_CONTEXTUAL_FALLBACK",
    ])
  ),
  traceability: traceabilitySchema,
});

const replacementRecommendationResponseSchema = z.object({
  version: z.literal("replacement-api-v1"),
  source: z.object({
    sessionId: z.number().int().positive(),
    sessionExerciseTargetId: z.number().int().positive(),
    exercise: z.object({
      exerciseId: z.number().int().positive(),
      nameEn: z.string().nullable(),
      nameFa: z.string(),
    }),
  }),
  contextualDecisionStatus: z.enum([
    "RECOMMENDED",
    "RECOMMENDED_WITH_WARNING",
    "NO_CONTEXTUAL_REPLACEMENT",
  ]),
  recommendedReplacement: candidateSummarySchema.nullable(),
  alternatives: z.array(candidateSummarySchema),
  contextRejectedCandidates: z.array(
    candidateSummarySchema.extend({
      rejectionReasonCodes: z.array(
        z.enum([
          "REPLACEMENT_RECOMMENDED",
          "REPLACEMENT_RECOMMENDED_WITH_WARNING",
          "REPLACEMENT_NO_CONTEXTUAL_REPLACEMENT",
          "REPLACEMENT_EQUIPMENT_AVAILABLE",
          "REPLACEMENT_EQUIPMENT_UNAVAILABLE",
          "REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN",
          "REPLACEMENT_EQUIPMENT_METADATA_UNAVAILABLE",
          "REPLACEMENT_INTEGRITY_WARNING",
          "REPLACEMENT_CONTEXTUAL_FALLBACK",
        ])
      ),
    })
  ),
  reasonCodes: z.array(
    z.enum([
      "REPLACEMENT_RECOMMENDED",
      "REPLACEMENT_RECOMMENDED_WITH_WARNING",
      "REPLACEMENT_NO_CONTEXTUAL_REPLACEMENT",
      "REPLACEMENT_EQUIPMENT_AVAILABLE",
      "REPLACEMENT_EQUIPMENT_UNAVAILABLE",
      "REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN",
      "REPLACEMENT_EQUIPMENT_METADATA_UNAVAILABLE",
      "REPLACEMENT_INTEGRITY_WARNING",
      "REPLACEMENT_CONTEXTUAL_FALLBACK",
    ])
  ),
  context: replacementContextSchema,
});

const exerciseSchema = z.object({
  id: z.number().int().positive(),
  nameFa: z.string(),
  nameEn: z.string().nullable(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  movementPattern: z.string().nullable(),
  equipment: z.string().nullable(),
  difficulty: z.string().nullable(),
  complexity: z.string().nullable(),
  suitableGoals: z.array(z.string()),
  contraindications: z.array(z.string()),
  jointStressFlags: z.array(z.string()),
  substitutionNames: z.array(z.string()),
  defaultRepRangeLow: z.number().nullable(),
  defaultRepRangeHigh: z.number().nullable(),
  defaultRestSecondsLow: z.number().nullable(),
  defaultRestSecondsHigh: z.number().nullable(),
  progressionType: z.string().nullable(),
});

const workoutSessionExerciseTargetSchema = z.object({
  id: z.number().int().positive(),
  exerciseId: z.number().int().positive(),
  programDayExerciseId: z.number().int().positive(),
  exercise: exerciseSchema.nullable().optional(),
});

const setLogSchema = z.object({
  id: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  exerciseId: z.number().int().positive(),
  setNumber: z.number().int().positive(),
  weightKg: z.number().nullable(),
  reps: z.number().int().positive(),
  loggedAt: z.string(),
  exercise: exerciseSchema.optional(),
});

const workoutSessionSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  programId: z.number().int().positive().nullable(),
  programDayId: z.number().int().positive().nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  status: z.enum(["active", "completed"]),
  notes: z.string().nullable(),
  setLogs: z.array(setLogSchema).optional(),
  exerciseTargets: z.array(workoutSessionExerciseTargetSchema).optional(),
});

const programSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  splitFamily: z.string(),
  goal: z.string(),
  isStatic: z.boolean(),
});

const programDayExerciseSchema = z.object({
  id: z.number().int().positive(),
  order: z.number().int().nonnegative(),
  sets: z.number().int().positive(),
  repRangeLow: z.number().int().positive(),
  repRangeHigh: z.number().int().positive(),
  restSeconds: z.number().int().nonnegative(),
  intensity: z.string().nullable(),
  progressionType: z.string().nullable(),
  exercise: exerciseSchema,
});

const programDaySchema = z.object({
  id: z.number().int().positive(),
  dayIndex: z.number().int().nonnegative(),
  name: z.string(),
  exercises: z.array(programDayExerciseSchema),
});

const applyReplacementResponseSchema = z.object({
  version: z.literal("replacement-apply-v1"),
  session: workoutSessionSchema,
  program: programSchema.nullable(),
  programDay: programDaySchema.nullable(),
  exercises: z.array(programDayExerciseSchema),
  appliedReplacement: z.object({
    targetId: z.number().int().positive(),
    previousExerciseId: z.number().int().positive(),
    replacementExerciseId: z.number().int().positive(),
    sourceDecisionType: z.literal("REPLACEMENT_APPLY_V1"),
    audit: z.object({
      version: z.literal("replacement-apply-audit-v1"),
      sessionId: z.number().int().positive(),
      targetId: z.number().int().positive(),
      appliedByUserId: z.number().int().positive(),
      appliedAt: z.string(),
      previousExerciseId: z.number().int().positive(),
      replacementExerciseId: z.number().int().positive(),
      previousSourceDecisionType: z.string().nullable(),
      previousSourceRulesVersion: z.string().nullable(),
    }),
  }),
});

export async function getReplacementRecommendations(params: {
  sessionId: number;
  targetId: number;
  context: ReplacementContextInput;
  flowId?: string | null;
}): Promise<ReplacementRecommendationResponse> {
  const response = await apiRequest<unknown>(
    `/sessions/${params.sessionId}/exercise-targets/${params.targetId}/replacements`,
    {
      method: "POST",
      headers: params.flowId ? { "X-Replacement-Flow-Id": params.flowId } : undefined,
      body: {
        context: params.context,
      },
    }
  );

  return replacementRecommendationResponseSchema.parse(response) as ReplacementRecommendationResponse;
}

export async function applyReplacementSelection(params: {
  sessionId: number;
  targetId: number;
  replacementExerciseId: number;
  flowId?: string | null;
}) {
  const response = await apiRequest<unknown>(
    `/sessions/${params.sessionId}/exercise-targets/${params.targetId}/replacements/apply`,
    {
      method: "POST",
      headers: params.flowId ? { "X-Replacement-Flow-Id": params.flowId } : undefined,
      body: {
        replacementExerciseId: params.replacementExerciseId,
      },
    }
  );

  return applyReplacementResponseSchema.parse(response);
}
