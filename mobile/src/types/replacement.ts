export type CatalogEquipment =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "bench"
  | "rack"
  | "cable"
  | "selectorized_machine"
  | "leg_press_machine"
  | "pull_up_bar"
  | "step_platform";

export type ReplacementIntentType =
  | "UNKNOWN"
  | "NO_EQUIPMENT"
  | "EQUIPMENT_BUSY"
  | "EXERCISE_UNAVAILABLE"
  | "PREFER_VARIATION"
  | "DISCOMFORT";

export interface ReplacementIntentInput {
  version: "replacement-intent-v1";
  type: ReplacementIntentType;
}

export interface ReplacementEquipmentContextInput {
  availableEquipment: CatalogEquipment[];
}

export interface ReplacementContextInput {
  version: "replacement-context-v1";
  equipmentContext: ReplacementEquipmentContextInput | null;
  replacementIntent: ReplacementIntentInput | null;
}

export interface WorkoutSessionExerciseTargetExercise {
  id: number;
  nameFa?: string;
  nameEn?: string | null;
  equipment?: string | null;
  [key: string]: unknown;
}

export interface WorkoutSessionExerciseTarget {
  id: number;
  exerciseId: number;
  programDayExerciseId: number;
  exercise?: WorkoutSessionExerciseTargetExercise | null;
  sourceDecisionType?: string | null;
}

export type ReplacementApiReasonCode =
  | "REPLACEMENT_RECOMMENDED"
  | "REPLACEMENT_RECOMMENDED_WITH_WARNING"
  | "REPLACEMENT_NO_CONTEXTUAL_REPLACEMENT"
  | "REPLACEMENT_EQUIPMENT_AVAILABLE"
  | "REPLACEMENT_EQUIPMENT_UNAVAILABLE"
  | "REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN"
  | "REPLACEMENT_EQUIPMENT_METADATA_UNAVAILABLE"
  | "REPLACEMENT_INTEGRITY_WARNING"
  | "REPLACEMENT_CONTEXTUAL_FALLBACK";

export type ContextualDecisionStatus =
  | "RECOMMENDED"
  | "RECOMMENDED_WITH_WARNING"
  | "NO_CONTEXTUAL_REPLACEMENT";

export type EquipmentAvailabilityStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "CONTEXT_UNKNOWN"
  | "METADATA_UNAVAILABLE";

export interface ReplacementCandidateTraceability {
  eligibility: {
    eligible: boolean;
    passedRuleIds: string[];
  };
  similarity: {
    status: string;
  };
  ranking: {
    rank: number;
    rankingScore: number | null;
  };
  integrity: {
    status: "PASS" | "WARN" | "BLOCK";
  };
  context: {
    equipmentAvailabilityStatus: EquipmentAvailabilityStatus;
    replacementIntentType: ReplacementIntentType | null;
  };
}

export interface ReplacementCandidateSummary {
  exerciseId: number;
  nameEn: string | null;
  nameFa: string;
  rank: number;
  rankingScore: number | null;
  integrityStatus: "PASS" | "WARN" | "BLOCK";
  equipmentAvailabilityStatus: EquipmentAvailabilityStatus;
  reasonCodes: ReplacementApiReasonCode[];
  traceability: ReplacementCandidateTraceability;
}

export interface ContextRejectedReplacementCandidateSummary extends ReplacementCandidateSummary {
  rejectionReasonCodes: ReplacementApiReasonCode[];
}

export interface ReplacementRecommendationResponse {
  version: "replacement-api-v1";
  source: {
    sessionId: number;
    sessionExerciseTargetId: number;
    exercise: {
      exerciseId: number;
      nameEn: string | null;
      nameFa: string;
    };
  };
  contextualDecisionStatus: ContextualDecisionStatus;
  recommendedReplacement: ReplacementCandidateSummary | null;
  alternatives: ReplacementCandidateSummary[];
  contextRejectedCandidates: ContextRejectedReplacementCandidateSummary[];
  reasonCodes: ReplacementApiReasonCode[];
  context: ReplacementContextInput;
}
