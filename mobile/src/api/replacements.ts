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

export async function getReplacementRecommendations(params: {
  sessionId: number;
  targetId: number;
  context: ReplacementContextInput;
}): Promise<ReplacementRecommendationResponse> {
  const response = await apiRequest<unknown>(
    `/sessions/${params.sessionId}/exercise-targets/${params.targetId}/replacements`,
    {
      method: "POST",
      body: {
        context: params.context,
      },
    }
  );

  return replacementRecommendationResponseSchema.parse(response) as ReplacementRecommendationResponse;
}
