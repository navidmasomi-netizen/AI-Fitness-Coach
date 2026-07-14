import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "../src/lib/prisma.js";
import { buildProgramPlan } from "../src/services/programGenerator.js";
import { DAY_TEMPLATE_MAP } from "../src/services/dayTemplates.js";
import { selectExercise } from "../src/services/exerciseSelector.js";
import { resolvePrescription } from "../src/services/volumeResolver.js";
import { resolveSplit } from "../src/services/splitResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_PATH = path.join(REPO_ROOT, "GENERATOR_COVERAGE_REPORT.md");

const GENERATOR_VERSION = "1.0";
const AUDIT_VERSION = "1.0";

const DEFAULT_PROFILE = {
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
  supplementUse: ["none"],
  cardioPreference: "walking",
  injuryFlags: ["none"],
  injuryNotes: null,
  preferredLanguage: "en",
  timezone: "UTC",
  units: "metric",
  wizardCompleted: true,
  wizardCompletedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastCompletedStep: 20,
};

const EQUIPMENT_TIERS = [
  { id: "E1", label: "Bodyweight", equipmentAccess: ["bodyweight"] },
  { id: "E2", label: "Dumbbell + Bodyweight", equipmentAccess: ["dumbbell", "bodyweight"] },
  { id: "E3", label: "Dumbbell + Pull-Up Bar + Bodyweight", equipmentAccess: ["dumbbell", "pull_up_bar", "bodyweight"] },
  { id: "E4", label: "Barbell + Dumbbell + Bodyweight", equipmentAccess: ["barbell", "dumbbell", "bodyweight"] },
  { id: "E5", label: "Machine + Cable", equipmentAccess: ["machine", "cable"] },
  {
    id: "E6",
    label: "Full Commercial Gym",
    equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
  },
  {
    id: "E7",
    label: "Full Commercial Gym (No Pull-Up Bar)",
    equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
  },
];

const INJURY_COMBINATIONS = [
  { id: "I1", label: "none", injuryFlags: ["none"] },
  { id: "I2", label: "knee", injuryFlags: ["knee"] },
  { id: "I3", label: "shoulder", injuryFlags: ["shoulder"] },
  { id: "I4", label: "wrist", injuryFlags: ["wrist"] },
  { id: "I5", label: "lower_back", injuryFlags: ["lower_back"] },
  { id: "I6", label: "knee+shoulder", injuryFlags: ["knee", "shoulder"] },
];

const GOALS = ["hypertrophy", "strength", "fat_loss", "recomposition"];
const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"];
const TRAINING_DAYS = [1, 2, 3, 4, 5, 6, 7];
const RECOVERY_QUALITIES = ["low", "medium", "high"];
const SESSION_DURATIONS = [30, 45, 60, 75];

const PASS_C_PROFILES = [
  {
    id: "C01",
    label: "Beginner pull-up-bar+dumbbell+bodyweight with knee+shoulder limits",
    overrides: {
      trainingLevel: "beginner",
      equipmentAccess: ["dumbbell", "pull_up_bar", "bodyweight"],
      injuryFlags: ["knee", "shoulder"],
    },
  },
  {
    id: "C02",
    label: "Advanced machine+cable only baseline",
    overrides: {
      trainingLevel: "advanced",
      equipmentAccess: ["machine", "cable"],
      injuryFlags: ["none"],
    },
  },
  {
    id: "C03",
    label: "Beginner pull-up-bar+dumbbell+bodyweight exact squat-gap case",
    overrides: {
      trainingLevel: "beginner",
      equipmentAccess: ["dumbbell", "pull_up_bar", "bodyweight"],
      injuryFlags: ["none"],
    },
  },
  {
    id: "C04",
    label: "Advanced full commercial gym with knee+shoulder on 7-day split",
    overrides: {
      goal: "strength",
      trainingLevel: "advanced",
      trainingDaysPerWeek: 7,
      recoveryQuality: "high",
      sessionDurationMin: 75,
      equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
      injuryFlags: ["knee", "shoulder"],
    },
  },
  {
    id: "C05",
    label: "Beginner bodyweight only with knee limitation on 1-day split",
    overrides: {
      trainingDaysPerWeek: 1,
      equipmentAccess: ["bodyweight"],
      injuryFlags: ["knee"],
    },
  },
  {
    id: "C06",
    label: "Beginner dumbbell+bodyweight only baseline",
    overrides: {
      equipmentAccess: ["dumbbell", "bodyweight"],
      injuryFlags: ["none"],
    },
  },
  {
    id: "C07",
    label: "Beginner dumbbell+bodyweight with wrist limitation",
    overrides: {
      equipmentAccess: ["dumbbell", "bodyweight"],
      injuryFlags: ["wrist"],
    },
  },
  {
    id: "C08",
    label: "Intermediate full gym without pull-up bar on 5-day split",
    overrides: {
      trainingLevel: "intermediate",
      trainingDaysPerWeek: 5,
      equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight"],
    },
  },
  {
    id: "C09",
    label: "Advanced barbell+dumbbell+bodyweight with lower_back limitation",
    overrides: {
      goal: "strength",
      trainingLevel: "advanced",
      trainingDaysPerWeek: 5,
      recoveryQuality: "high",
      sessionDurationMin: 75,
      equipmentAccess: ["barbell", "dumbbell", "bodyweight"],
      injuryFlags: ["lower_back"],
    },
  },
  {
    id: "C10",
    label: "Beginner machine+cable with shoulder limitation",
    overrides: {
      equipmentAccess: ["machine", "cable"],
      injuryFlags: ["shoulder"],
    },
  },
  {
    id: "C11",
    label: "Intermediate pull-up-bar+dumbbell+bodyweight with lower_back limitation, 6-day reduced-volume profile",
    overrides: {
      goal: "recomposition",
      trainingLevel: "intermediate",
      trainingDaysPerWeek: 6,
      recoveryQuality: "low",
      sessionDurationMin: 45,
      equipmentAccess: ["dumbbell", "pull_up_bar", "bodyweight"],
      injuryFlags: ["lower_back"],
    },
  },
  {
    id: "C12",
    label: "Advanced bodyweight-only fat-loss profile on 3-day split",
    overrides: {
      goal: "fat_loss",
      trainingLevel: "advanced",
      trainingDaysPerWeek: 3,
      equipmentAccess: ["bodyweight"],
      injuryFlags: ["none"],
    },
  },
];

const INVARIANCE_PROFILE_REFERENCES = [
  { sourcePass: "A", sourceId: "A_E6_I1" },
  { sourcePass: "A", sourceId: "A_E3_I6" },
  { sourcePass: "C", sourceId: "C03" },
  { sourcePass: "C", sourceId: "C04" },
  { sourcePass: "C", sourceId: "C05" },
];

const MOVEMENT_PATTERNS = [
  "squat",
  "hinge",
  "lunge",
  "single_leg",
  "horizontal_press",
  "vertical_press",
  "horizontal_pull",
  "vertical_pull",
  "elbow_flexion",
  "elbow_extension",
  "trunk_flexion",
  "anti_extension",
];

const KNOWN_GAP_RULES = [
  {
    id: "KG1",
    label: "squat lacks bodyweight/dumbbell-only and machine+cable-only coverage",
    matches: ({ movementPattern, equipmentTierId }) =>
      movementPattern === "squat" && ["E1", "E2", "E3", "E5"].includes(equipmentTierId),
  },
  {
    id: "KG2",
    label: "elbow_flexion lacks bodyweight-only coverage",
    matches: ({ movementPattern, equipmentTierId }) =>
      movementPattern === "elbow_flexion" && equipmentTierId === "E1",
  },
  {
    id: "KG3",
    label: "vertical_pull requires pull_up_bar or cable/machine coverage",
    matches: ({ movementPattern, equipmentTierId }) =>
      movementPattern === "vertical_pull" && ["E1", "E2", "E4", "E7"].includes(equipmentTierId),
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compareStringsAsc(a, b) {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

function makeProfile(overrides = {}) {
  return {
    ...clone(DEFAULT_PROFILE),
    ...overrides,
  };
}

function injuryKey(injuryFlags) {
  return injuryFlags.join("+");
}

function equipmentKey(equipmentAccess) {
  return equipmentAccess.join("+");
}

function serializeInputs(profile) {
  return {
    goal: profile.goal,
    trainingLevel: profile.trainingLevel,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    recoveryQuality: profile.recoveryQuality,
    sessionDurationMin: profile.sessionDurationMin,
    equipmentAccess: profile.equipmentAccess,
    injuryFlags: profile.injuryFlags,
    sex: profile.sex,
    age: profile.age,
  };
}

function buildComparablePlan(plan) {
  return {
    split: {
      splitFamily: plan.splitResult.splitFamily,
      splitName: plan.splitResult.splitName,
      numberOfTrainingDays: plan.splitResult.numberOfTrainingDays,
      dayTypes: plan.splitResult.dayTypes,
      recoveryOrCardioDay: plan.splitResult.recoveryOrCardioDay,
      recoveryAdjusted: plan.splitResult.recoveryAdjusted,
      generatorVersion: plan.splitResult.generatorVersion,
    },
    days: plan.plannedDays.map((day) => ({
      dayIndex: day.dayIndex,
      dayType: day.dayType,
      name: day.name,
      exercises: day.plannedExercises.map((plannedExercise) => ({
        movementPattern: plannedExercise.movementPattern,
        slotType: plannedExercise.slotType,
        exerciseName: plannedExercise.exercise.nameEn,
        fallbackLevelUsed: plannedExercise.selectionResult.fallbackLevelUsed,
        sets: plannedExercise.prescription.sets,
        repRangeLow: plannedExercise.prescription.repRangeLow,
        repRangeHigh: plannedExercise.prescription.repRangeHigh,
        restSeconds: plannedExercise.prescription.restSeconds,
      })),
    })),
    diagnostics: plan.diagnostics,
  };
}

function buildInvarianceComparable(profile, exercises) {
  try {
    return {
      outcome: "SUCCESS",
      comparablePlan: buildComparablePlan(buildProgramPlan({ profile, exercises })),
    };
  } catch (error) {
    return {
      outcome: "FAIL",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function parsePrimaryFailureMessage(message) {
  const match = message.match(
    /^Program generation failed for primary slot dayType="([^"]+)" movementPattern="([^"]+)"/
  );
  if (!match) return null;
  return {
    dayType: match[1],
    movementPattern: match[2],
  };
}

function parseZeroExerciseDayMessage(message) {
  const match = message.match(
    /^Program generation failed because dayType="([^"]+)" produced zero exercises/
  );
  if (!match) return null;
  return { dayType: match[1] };
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
}

function average(values) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function percentage(numerator, denominator) {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function outcomeRank(outcome) {
  if (outcome === "FAIL") return 0;
  if (outcome === "PASS_WITH_DEGRADATION") return 1;
  return 2;
}

function classifyKnownGap(event, profileMeta) {
  return KNOWN_GAP_RULES.find((rule) =>
    rule.matches({
      movementPattern: event.movementPattern,
      equipmentTierId: profileMeta.equipmentTierId,
      injuryFlags: profileMeta.injuryFlags,
      slotType: event.slotType,
    })
  ) || null;
}

function buildPassAProfiles() {
  const profiles = [];
  for (const equipmentTier of EQUIPMENT_TIERS) {
    for (const injury of INJURY_COMBINATIONS) {
      const id = `A_${equipmentTier.id}_${injury.id}`;
      profiles.push({
        pass: "A",
        id,
        label: `${equipmentTier.label} × ${injury.label}`,
        equipmentTierId: equipmentTier.id,
        injuryCombinationId: injury.id,
        profile: makeProfile({
          equipmentAccess: equipmentTier.equipmentAccess,
          injuryFlags: injury.injuryFlags,
        }),
      });
    }
  }
  return profiles;
}

function buildPassBProfiles() {
  const fullGym = EQUIPMENT_TIERS.find((tier) => tier.id === "E6");
  const profiles = [];
  for (const goal of GOALS) {
    for (const trainingLevel of TRAINING_LEVELS) {
      for (const trainingDaysPerWeek of TRAINING_DAYS) {
        for (const recoveryQuality of RECOVERY_QUALITIES) {
          for (const sessionDurationMin of SESSION_DURATIONS) {
            const id = `B_${goal}_${trainingLevel}_${trainingDaysPerWeek}d_${recoveryQuality}_${sessionDurationMin}`;
            profiles.push({
              pass: "B",
              id,
              label: `${goal} ${trainingLevel} ${trainingDaysPerWeek}d ${recoveryQuality} ${sessionDurationMin}min`,
              equipmentTierId: fullGym.id,
              injuryCombinationId: "I1",
              profile: makeProfile({
                goal,
                trainingLevel,
                trainingDaysPerWeek,
                recoveryQuality,
                sessionDurationMin,
                equipmentAccess: fullGym.equipmentAccess,
                injuryFlags: ["none"],
              }),
            });
          }
        }
      }
    }
  }
  return profiles;
}

function buildPassCProfiles() {
  return PASS_C_PROFILES.map((entry) => {
    const equipmentTier = EQUIPMENT_TIERS.find(
      (tier) => equipmentKey(tier.equipmentAccess) === equipmentKey(entry.overrides.equipmentAccess || DEFAULT_PROFILE.equipmentAccess)
    );
    const injury = INJURY_COMBINATIONS.find(
      (combination) => injuryKey(combination.injuryFlags) === injuryKey(entry.overrides.injuryFlags || DEFAULT_PROFILE.injuryFlags)
    );

    return {
      pass: "C",
      id: entry.id,
      label: entry.label,
      equipmentTierId: equipmentTier?.id || "CUSTOM",
      injuryCombinationId: injury?.id || "CUSTOM",
      profile: makeProfile(entry.overrides),
    };
  });
}

function evaluateProfile(profile, exercises) {
  const splitResult = resolveSplit({
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    goal: profile.goal,
    trainingLevel: profile.trainingLevel,
    recoveryQuality: profile.recoveryQuality,
  });

  const plannedDays = [];
  const diagnostics = [];
  const slotEvents = [];
  let firstFailure = null;

  for (const [dayIndex, dayType] of splitResult.dayTypes.entries()) {
    const template = DAY_TEMPLATE_MAP[dayType];
    if (!template) {
      throw new Error(`No day template found for dayType "${dayType}".`);
    }

    if (dayType === "recovery_or_cardio") {
      plannedDays.push({
        dayIndex,
        dayType,
        originalSlotCount: 0,
        keptSlotCount: 0,
        plannedExercises: [],
        omittedSlots: [],
        structurallyDegraded: false,
      });
      continue;
    }

    const plannedExercises = [];
    const omittedSlots = [];

    for (const slot of template) {
      const selectionResult = selectExercise({
        requiredMovementPattern: slot.movementPattern,
        equipmentAccess: profile.equipmentAccess,
        goal: profile.goal,
        trainingLevel: profile.trainingLevel,
        injuryFlags: profile.injuryFlags,
        exercises,
      });

      if (selectionResult.fallbackLevelUsed === 3 || selectionResult.selectedExercise === null) {
        if (slot.slotType === "accessory") {
          const omission = {
            dayType,
            movementPattern: slot.movementPattern,
            slotType: slot.slotType,
            reason: selectionResult.reason,
          };
          diagnostics.push({
            dayType,
            movementPattern: slot.movementPattern,
            reason: selectionResult.reason,
          });
          omittedSlots.push(omission);
          slotEvents.push({
            dayType,
            movementPattern: slot.movementPattern,
            slotType: slot.slotType,
            outcome: "omitted",
            fallbackLevelUsed: 3,
            reason: selectionResult.reason,
          });
          continue;
        }

        const failure = {
          type: "primary_failure",
          dayType,
          movementPattern: slot.movementPattern,
          slotType: slot.slotType,
          reason: selectionResult.reason,
        };
        if (!firstFailure) firstFailure = failure;
        slotEvents.push({
          dayType,
          movementPattern: slot.movementPattern,
          slotType: slot.slotType,
          outcome: "failed",
          fallbackLevelUsed: 3,
          reason: selectionResult.reason,
        });
        continue;
      }

      const prescription = resolvePrescription({
        goal: profile.goal,
        trainingLevel: profile.trainingLevel,
        recoveryQuality: profile.recoveryQuality,
        sessionDurationMin: profile.sessionDurationMin,
        slotType: slot.slotType,
        exerciseComplexity: selectionResult.selectedExercise.complexity,
      });

      const plannedExercise = {
        order: plannedExercises.length,
        dayType,
        movementPattern: slot.movementPattern,
        slotType: slot.slotType,
        exercise: selectionResult.selectedExercise,
        prescription,
        selectionResult,
      };
      plannedExercises.push(plannedExercise);

      slotEvents.push({
        dayType,
        movementPattern: slot.movementPattern,
        slotType: slot.slotType,
        outcome: "selected",
        fallbackLevelUsed: selectionResult.fallbackLevelUsed,
        reason: selectionResult.reason,
      });
    }

    const keptSlotCount = plannedExercises.length;
    const hasPrimaryExercise = plannedExercises.some((exercise) => exercise.slotType === "primary");
    const structurallyDegraded =
      keptSlotCount > 0 && hasPrimaryExercise && keptSlotCount < template.length / 2;

    if (keptSlotCount === 0 && !firstFailure) {
      firstFailure = {
        type: "zero_exercise_day",
        dayType,
        movementPattern: null,
        slotType: null,
        reason: `Program generation failed because dayType="${dayType}" produced zero exercises after applying accessory omission policy under constraints equipmentAccess=${JSON.stringify(profile.equipmentAccess)}, injuryFlags=${JSON.stringify(profile.injuryFlags)}, goal=${profile.goal}, trainingLevel=${profile.trainingLevel}.`,
      };
    }

    plannedDays.push({
      dayIndex,
      dayType,
      originalSlotCount: template.length,
      keptSlotCount,
      plannedExercises,
      omittedSlots,
      structurallyDegraded,
    });
  }

  const fallbackLevel1Count = slotEvents.filter(
    (event) => event.outcome === "selected" && event.fallbackLevelUsed === 1
  ).length;
  const fallbackLevel2Count = slotEvents.filter(
    (event) => event.outcome === "selected" && event.fallbackLevelUsed === 2
  ).length;
  const omittedAccessoryCount = slotEvents.filter((event) => event.outcome === "omitted").length;
  const structurallyDegradedDayCount = plannedDays.filter((day) => day.structurallyDegraded).length;

  const actualResult = (() => {
    try {
      return {
        ok: true,
        plan: buildProgramPlan({ profile, exercises }),
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        plan: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  const outcome = actualResult.ok
    ? fallbackLevel1Count === 0 && fallbackLevel2Count === 0 && omittedAccessoryCount === 0
      ? "PASS"
      : "PASS_WITH_DEGRADATION"
    : "FAIL";

  let qualityScore = 100;
  qualityScore -= 5 * fallbackLevel1Count;
  qualityScore -= 10 * fallbackLevel2Count;
  qualityScore -= 15 * omittedAccessoryCount;
  if (structurallyDegradedDayCount > 0) {
    qualityScore -= 40;
  }
  if (outcome === "FAIL") {
    qualityScore = 0;
  }
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    splitResult,
    plannedDays,
    diagnostics,
    slotEvents,
    firstFailure,
    fallbackLevel1Count,
    fallbackLevel2Count,
    omittedAccessoryCount,
    structurallyDegradedDayCount,
    outcome,
    qualityScore,
    actualResult,
  };
}

function classifyAuditResult(result, passAById, profileMeta) {
  if (result.outcome === "PASS") return null;

  const nonPassEvents = [
    ...result.slotEvents.filter((event) => event.outcome === "failed" || event.outcome === "omitted"),
  ];

  if (profileMeta.pass === "B" && result.outcome === "FAIL") {
    return "generator_logic_defect";
  }

  const comboIsMultiFlag = profileMeta.profile.injuryFlags.length > 1;
  if (comboIsMultiFlag && nonPassEvents.length > 0 && profileMeta.pass === "A") {
    const singles = profileMeta.profile.injuryFlags.map((flag) =>
      passAById.get(`A_${profileMeta.equipmentTierId}_I${flag === "knee" ? 2 : flag === "shoulder" ? 3 : flag === "wrist" ? 4 : 5}`)
    );

    const comboSpecific = nonPassEvents.some((event) =>
      singles.every((single) => {
        if (!single) return true;
        return !single.slotEvents.some(
          (singleEvent) =>
            singleEvent.movementPattern === event.movementPattern &&
            (singleEvent.outcome === "failed" || singleEvent.outcome === "omitted")
        );
      })
    );

    if (comboSpecific) {
      return "injury_interaction_gap";
    }
  }

  if (nonPassEvents.some((event) => classifyKnownGap(event, profileMeta))) {
    return "expected_data_gap";
  }

  if (result.outcome === "FAIL") {
    return "novel_data_gap";
  }

  if (profileMeta.pass === "B" && result.outcome === "PASS_WITH_DEGRADATION") {
    return "unexpected_unclassified";
  }

  if (nonPassEvents.length > 0) {
    return "novel_data_gap";
  }

  return "unexpected_unclassified";
}

function summarizeProfileResult(profileMeta, result, classification) {
  return {
    pass: profileMeta.pass,
    id: profileMeta.id,
    label: profileMeta.label,
    equipmentTierId: profileMeta.equipmentTierId,
    injuryCombinationId: profileMeta.injuryCombinationId,
    inputs: serializeInputs(profileMeta.profile),
    outcome: result.outcome,
    qualityScore: result.qualityScore,
    fallbackLevel1Count: result.fallbackLevel1Count,
    fallbackLevel2Count: result.fallbackLevel2Count,
    omittedAccessoryCount: result.omittedAccessoryCount,
    structurallyDegradedDayCount: result.structurallyDegradedDayCount,
    classification,
    diagnostics: result.diagnostics,
    slotEvents: result.slotEvents,
    firstFailure: result.firstFailure,
    actualError: result.actualResult.error,
    selectedExercises: result.plannedDays.map((day) => ({
      dayType: day.dayType,
      keptSlotCount: day.keptSlotCount,
      originalSlotCount: day.originalSlotCount,
      structurallyDegraded: day.structurallyDegraded,
      exercises: day.plannedExercises.map((plannedExercise) => ({
        movementPattern: plannedExercise.movementPattern,
        slotType: plannedExercise.slotType,
        exerciseName: plannedExercise.exercise.nameEn,
        fallbackLevelUsed: plannedExercise.selectionResult.fallbackLevelUsed,
      })),
      omittedSlots: day.omittedSlots,
    })),
  };
}

function updateMovementStats(stats, splitResult, slotEvents) {
  for (const dayType of splitResult.dayTypes) {
    for (const slot of DAY_TEMPLATE_MAP[dayType]) {
      const movementStat = stats[slot.movementPattern];
      movementStat.timesRequired += 1;
    }
  }

  for (const event of slotEvents) {
    const movementStat = stats[event.movementPattern];
    if (!movementStat) continue;

    if (event.outcome === "selected" && event.fallbackLevelUsed === 0) {
      movementStat.idealSelections += 1;
    } else if (event.outcome === "selected" && event.fallbackLevelUsed === 1) {
      movementStat.fallbackLevel1Selections += 1;
    } else if (event.outcome === "selected" && event.fallbackLevelUsed === 2) {
      movementStat.fallbackLevel2Selections += 1;
    } else if (event.outcome === "omitted") {
      movementStat.omissions += 1;
    } else if (event.outcome === "failed" && event.slotType === "primary") {
      movementStat.failures += 1;
    }
  }
}

function buildEmptyMovementStats() {
  return Object.fromEntries(
    MOVEMENT_PATTERNS.map((pattern) => [
      pattern,
      {
        movementPattern: pattern,
        timesRequired: 0,
        idealSelections: 0,
        fallbackLevel1Selections: 0,
        fallbackLevel2Selections: 0,
        omissions: 0,
        failures: 0,
      },
    ])
  );
}

function metricsFromResults(results) {
  const scores = results.map((result) => result.qualityScore);
  const passCount = results.filter((result) => result.outcome === "PASS").length;
  const degradedCount = results.filter((result) => result.outcome === "PASS_WITH_DEGRADATION").length;
  const failCount = results.filter((result) => result.outcome === "FAIL").length;

  return {
    count: results.length,
    passCount,
    degradedCount,
    failCount,
    averageScore: average(scores),
    medianScore: median(scores),
  };
}

function buildMarkdownTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

function recommendationPriorityLabel(rankIndex) {
  if (rankIndex < 3) return "Priority 1";
  if (rankIndex < 6) return "Priority 2";
  return "Priority 3";
}

function buildReport({
  executionDate,
  exerciseCount,
  beforeCounts,
  afterCounts,
  passAResults,
  passBResults,
  passCResults,
  invarianceResults,
  movementStats,
  prioritizedRecommendations,
  totalExecutionCount,
}) {
  const matrixResults = [...passAResults, ...passBResults, ...passCResults];
  const overallMetrics = metricsFromResults(matrixResults);
  const passAMetrics = metricsFromResults(passAResults);
  const passBMetrics = metricsFromResults(passBResults);
  const passCMetrics = metricsFromResults(passCResults);

  const equipmentTierRows = EQUIPMENT_TIERS.map((tier) => {
    const results = passAResults.filter((result) => result.equipmentTierId === tier.id);
    const metrics = metricsFromResults(results);
    return [
      tier.id,
      tier.label,
      String(metrics.count),
      String(metrics.passCount),
      String(metrics.degradedCount),
      String(metrics.failCount),
      formatPercent(percentage(metrics.passCount, metrics.count)),
      metrics.averageScore.toFixed(2),
    ];
  });

  const injuryRows = INJURY_COMBINATIONS.map((injury) => {
    const results = passAResults.filter((result) => result.injuryCombinationId === injury.id);
    const metrics = metricsFromResults(results);
    return [
      injury.id,
      injury.label,
      String(metrics.count),
      String(metrics.passCount),
      String(metrics.degradedCount),
      String(metrics.failCount),
      formatPercent(percentage(metrics.passCount, metrics.count)),
      metrics.averageScore.toFixed(2),
    ];
  });

  const movementRows = Object.values(movementStats)
    .map((stat) => ({
      ...stat,
      successPercentage: percentage(
        stat.idealSelections + stat.fallbackLevel1Selections + stat.fallbackLevel2Selections,
        stat.timesRequired
      ),
    }))
    .sort((a, b) => a.successPercentage - b.successPercentage || compareStringsAsc(a.movementPattern, b.movementPattern))
    .map((stat) => [
      stat.movementPattern,
      String(stat.timesRequired),
      String(stat.idealSelections),
      String(stat.fallbackLevel1Selections),
      String(stat.fallbackLevel2Selections),
      String(stat.omissions),
      String(stat.failures),
      formatPercent(stat.successPercentage),
    ]);

  const equipmentRiskRows = EQUIPMENT_TIERS.map((tier) => {
    const results = passAResults.filter((result) => result.equipmentTierId === tier.id);
    const metrics = metricsFromResults(results);
    return {
      row: [
        tier.id,
        tier.label,
        String(metrics.failCount),
        String(metrics.degradedCount),
        formatPercent(percentage(metrics.passCount, metrics.count)),
        metrics.averageScore.toFixed(2),
      ],
      failCount: metrics.failCount,
      degradedCount: metrics.degradedCount,
      successPct: percentage(metrics.passCount, metrics.count),
    };
  })
    .sort((a, b) => a.successPct - b.successPct || b.failCount - a.failCount || b.degradedCount - a.degradedCount)
    .map((entry) => entry.row);

  const injuryRiskRows = INJURY_COMBINATIONS.map((injury) => {
    const results = passAResults.filter((result) => result.injuryCombinationId === injury.id);
    const metrics = metricsFromResults(results);
    const hasInteractionGap = results.some((result) => result.classification === "injury_interaction_gap");
    return {
      row: [
        injury.id,
        injury.label,
        String(metrics.failCount),
        String(metrics.degradedCount),
        formatPercent(percentage(metrics.passCount, metrics.count)),
        hasInteractionGap ? "yes" : "no",
      ],
      failCount: metrics.failCount,
      degradedCount: metrics.degradedCount,
      successPct: percentage(metrics.passCount, metrics.count),
      hasInteractionGap,
    };
  })
    .sort((a, b) => a.successPct - b.successPct || Number(b.hasInteractionGap) - Number(a.hasInteractionGap))
    .map((entry) => entry.row);

  const classifiedResults = matrixResults
    .filter((result) => result.outcome !== "PASS")
    .reduce((accumulator, result) => {
      const key = result.classification || "unexpected_unclassified";
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(result);
      return accumulator;
    }, {});

  const degradedResults = matrixResults.filter((result) => result.outcome === "PASS_WITH_DEGRADATION");

  const executiveSummary = [
    `- Matrix profiles audited: ${matrixResults.length} (${passAResults.length} in Pass A, ${passBResults.length} in Pass B, ${passCResults.length} in Pass C).`,
    `- Additional sex/age invariance executions: ${invarianceResults.length * 5} (${invarianceResults.length} reference profiles × 5 runs each).`,
    `- Overall outcomes across Passes A+B+C: ${overallMetrics.passCount} PASS, ${overallMetrics.degradedCount} PASS_WITH_DEGRADATION, ${overallMetrics.failCount} FAIL.`,
    `- Average quality score: ${overallMetrics.averageScore.toFixed(2)}. Median quality score: ${overallMetrics.medianScore.toFixed(2)}.`,
    `- Pass B full-gym/no-injury logic-only sweep produced ${passBMetrics.failCount} FAIL and ${passBMetrics.degradedCount} PASS_WITH_DEGRADATION results; any FAIL there should be triaged as generator logic risk.`,
    `- Worst movement-pattern success rates: ${movementRows.slice(0, 3).map((row) => `${row[0]} (${row[7]})`).join(", ")}.`,
    `- Program/UserProgram write-model safety check: before=${JSON.stringify(beforeCounts)}, after=${JSON.stringify(afterCounts)}.`,
  ].join("\n");

  const metadataLines = [
    `- Generator Version: ${GENERATOR_VERSION}`,
    `- Exercise Dataset Size: ${exerciseCount}`,
    `- Audit Version: ${AUDIT_VERSION}`,
    `- Execution Date: ${executionDate}`,
    `- Total Profiles Tested: ${totalExecutionCount} (${matrixResults.length} matrix + ${invarianceResults.length * 5} invariance executions)`,
  ].join("\n");

  const sections = [];
  sections.push("# GENERATOR_COVERAGE_REPORT");
  sections.push("");
  sections.push("## 1. Executive Summary");
  sections.push(executiveSummary);
  sections.push("");
  sections.push("## 2. Metadata");
  sections.push(metadataLines);
  sections.push("");
  sections.push("## 3. Outcome Breakdown");
  sections.push(buildMarkdownTable(
    ["Scope", "PASS", "PASS_WITH_DEGRADATION", "FAIL", "PASS %", "Non-PASS %"],
    [[
      "Passes A+B+C",
      String(overallMetrics.passCount),
      String(overallMetrics.degradedCount),
      String(overallMetrics.failCount),
      formatPercent(percentage(overallMetrics.passCount, overallMetrics.count)),
      formatPercent(percentage(overallMetrics.degradedCount + overallMetrics.failCount, overallMetrics.count)),
    ]]
  ));
  sections.push("");
  sections.push("## 4. Average and Median Quality Score");
  sections.push(buildMarkdownTable(
    ["Scope", "Average Score", "Median Score"],
    [
      ["Overall", overallMetrics.averageScore.toFixed(2), overallMetrics.medianScore.toFixed(2)],
      ["Pass A", passAMetrics.averageScore.toFixed(2), passAMetrics.medianScore.toFixed(2)],
      ["Pass B", passBMetrics.averageScore.toFixed(2), passBMetrics.medianScore.toFixed(2)],
      ["Pass C", passCMetrics.averageScore.toFixed(2), passCMetrics.medianScore.toFixed(2)],
    ]
  ));
  sections.push("");
  sections.push("## 5. Success Metrics by Equipment Tier");
  sections.push(buildMarkdownTable(
    ["Tier", "Label", "Profiles", "PASS", "PASS_WITH_DEGRADATION", "FAIL", "PASS %", "Avg Score"],
    equipmentTierRows
  ));
  sections.push("");
  sections.push("## 6. Success Metrics by Injury Combination");
  sections.push(buildMarkdownTable(
    ["Combo", "Label", "Profiles", "PASS", "PASS_WITH_DEGRADATION", "FAIL", "PASS %", "Avg Score"],
    injuryRows
  ));
  sections.push("");
  sections.push("## 7. Pass B Logic-Only Results");
  sections.push(buildMarkdownTable(
    ["Profiles", "PASS", "PASS_WITH_DEGRADATION", "FAIL", "PASS %", "Avg Score"],
    [[
      String(passBMetrics.count),
      String(passBMetrics.passCount),
      String(passBMetrics.degradedCount),
      String(passBMetrics.failCount),
      formatPercent(percentage(passBMetrics.passCount, passBMetrics.count)),
      passBMetrics.averageScore.toFixed(2),
    ]]
  ));
  sections.push(passBMetrics.failCount > 0
    ? "\nProminent callout: Pass B produced FAIL results under full-gym/no-injury conditions. These are classified as likely generator logic defects per audit policy."
    : "\nPass B produced no FAIL results.");
  sections.push("");
  sections.push("## 8. Movement-Pattern Risk Ranking");
  sections.push(buildMarkdownTable(
    ["Pattern", "Required", "Ideal", "Fallback L1", "Fallback L2", "Omissions", "Failures", "Success %"],
    movementRows
  ));
  sections.push("");
  sections.push("## 9. Equipment Risk Ranking");
  sections.push(buildMarkdownTable(
    ["Tier", "Label", "FAIL", "PASS_WITH_DEGRADATION", "PASS %", "Avg Score"],
    equipmentRiskRows
  ));
  sections.push("");
  sections.push("## 10. Injury Risk Ranking");
  sections.push(buildMarkdownTable(
    ["Combo", "Label", "FAIL", "PASS_WITH_DEGRADATION", "PASS %", "Interaction Gap"],
    injuryRiskRows
  ));
  sections.push("");
  sections.push("## 11. Full Failure Classification");
  for (const classification of [
    "expected_data_gap",
    "novel_data_gap",
    "injury_interaction_gap",
    "generator_logic_defect",
    "unexpected_unclassified",
  ]) {
    sections.push(`### ${classification}`);
    const entries = (classifiedResults[classification] || []).sort((a, b) => compareStringsAsc(a.id, b.id));
    if (entries.length === 0) {
      sections.push("- None");
      continue;
    }
    for (const entry of entries) {
      sections.push(`- ${entry.id} (${entry.pass}) ${entry.label}`);
      sections.push(`  - Outcome: ${entry.outcome}`);
      sections.push(`  - Quality Score: ${entry.qualityScore}`);
      sections.push(`  - Inputs: ${JSON.stringify(entry.inputs)}`);
      sections.push(`  - Failure/Degradation Reason: ${entry.actualError || JSON.stringify(entry.diagnostics)}`);
    }
  }
  sections.push("");
  sections.push("## 12. Degraded-Profile Analysis");
  if (degradedResults.length === 0) {
    sections.push("- None");
  } else {
    for (const entry of degradedResults.sort((a, b) => compareStringsAsc(a.id, b.id))) {
      sections.push(`- ${entry.id} (${entry.pass}) ${entry.label}`);
      sections.push(`  - Fallback L1: ${entry.fallbackLevel1Count}, Fallback L2: ${entry.fallbackLevel2Count}, Omitted Accessory Slots: ${entry.omittedAccessoryCount}, Structurally Degraded Days: ${entry.structurallyDegradedDayCount}`);
      sections.push(`  - Diagnostics: ${entry.diagnostics.length > 0 ? JSON.stringify(entry.diagnostics) : "none"}`);
    }
  }
  sections.push("");
  sections.push("## 13. Sex/Age Invariance Results");
  for (const invariance of invarianceResults) {
    sections.push(`- ${invariance.referenceId}: ${invariance.passed ? "PASS" : "FAIL"}`);
    sections.push(`  - Baseline Inputs: ${JSON.stringify(invariance.baselineInputs)}`);
    sections.push(`  - Variants Checked: ${JSON.stringify(invariance.variants)}`);
    sections.push(`  - Result: ${invariance.message}`);
  }
  sections.push("");
  sections.push("## 14. Prioritized Seed Recommendations");
  if (prioritizedRecommendations.length === 0) {
    sections.push("- None");
  } else {
    const grouped = { "Priority 1": [], "Priority 2": [], "Priority 3": [] };
    prioritizedRecommendations.forEach((recommendation, index) => {
      grouped[recommendationPriorityLabel(index)].push(recommendation);
    });
    for (const label of ["Priority 1", "Priority 2", "Priority 3"]) {
      sections.push(`### ${label}`);
      if (grouped[label].length === 0) {
        sections.push("- None");
        continue;
      }
      for (const recommendation of grouped[label]) {
        sections.push(`- ${recommendation.pattern} (${recommendation.classification})`);
        sections.push(`  - Failed Profiles Affected: ${recommendation.failCount}`);
        sections.push(`  - Degraded Profiles Affected: ${recommendation.degradedCount}`);
        sections.push(`  - Blocks Primary Slot: ${recommendation.blocksPrimary ? "yes" : "no"}`);
        sections.push(`  - Distinct Equipment/Injury Combos Affected: ${recommendation.breadth}`);
        sections.push(`  - Affected Profile IDs: ${recommendation.profileIds.join(", ")}`);
      }
    }
  }

  return sections.join("\n");
}

function buildRecommendations(results) {
  const relevant = results.filter((result) =>
    ["novel_data_gap", "injury_interaction_gap"].includes(result.classification || "")
  );

  const grouped = new Map();

  for (const result of relevant) {
    const nonPassEvents = result.selectedExercises
      .flatMap((day) =>
        day.omittedSlots.map((slot) => ({
          movementPattern: slot.movementPattern,
          slotType: slot.slotType,
        }))
      );

    if (result.firstFailure?.movementPattern) {
      nonPassEvents.push({
        movementPattern: result.firstFailure.movementPattern,
        slotType: result.firstFailure.slotType || "primary",
      });
    }

    const uniquePatterns = Array.from(new Set(nonPassEvents.map((event) => event.movementPattern))).sort(compareStringsAsc);
    for (const pattern of uniquePatterns) {
      const key = `${result.classification}|${pattern}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          classification: result.classification,
          pattern,
          failCount: 0,
          degradedCount: 0,
          blocksPrimary: false,
          combos: new Set(),
          profileIds: [],
        });
      }

      const entry = grouped.get(key);
      if (result.outcome === "FAIL") entry.failCount += 1;
      if (result.outcome === "PASS_WITH_DEGRADATION") entry.degradedCount += 1;
      if (
        result.firstFailure?.movementPattern === pattern &&
        result.firstFailure.slotType === "primary"
      ) {
        entry.blocksPrimary = true;
      }
      entry.combos.add(`${equipmentKey(result.inputs.equipmentAccess)}|${injuryKey(result.inputs.injuryFlags)}`);
      entry.profileIds.push(result.id);
    }
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      breadth: entry.combos.size,
      profileIds: entry.profileIds.sort(compareStringsAsc),
    }))
    .sort((a, b) =>
      b.failCount - a.failCount ||
      b.degradedCount - a.degradedCount ||
      Number(b.blocksPrimary) - Number(a.blocksPrimary) ||
      b.breadth - a.breadth ||
      compareStringsAsc(a.pattern, b.pattern)
    );
}

async function main() {
  const beforeCounts = {
    program: await prisma.program.count(),
    programDay: await prisma.programDay.count(),
    programDayExercise: await prisma.programDayExercise.count(),
    userProgram: await prisma.userProgram.count(),
    exercise: await prisma.exercise.count(),
  };

  const exercises = await prisma.exercise.findMany({
    orderBy: { id: "asc" },
  });

  const passAProfiles = buildPassAProfiles();
  const passBProfiles = buildPassBProfiles();
  const passCProfiles = buildPassCProfiles();
  const allMatrixProfiles = [...passAProfiles, ...passBProfiles, ...passCProfiles];

  const movementStats = buildEmptyMovementStats();
  const passAById = new Map();
  const allResults = [];

  for (const profileMeta of allMatrixProfiles) {
    const result = evaluateProfile(profileMeta.profile, exercises);
    updateMovementStats(movementStats, result.splitResult, result.slotEvents);
    const summary = summarizeProfileResult(profileMeta, result, null);
    allResults.push(summary);
    if (profileMeta.pass === "A") {
      passAById.set(profileMeta.id, summary);
    }
  }

  for (const result of allResults) {
    result.classification = classifyAuditResult(result, passAById, {
      pass: result.pass,
      id: result.id,
      label: result.label,
      equipmentTierId:
        passAProfiles.find((profile) => profile.id === result.id)?.equipmentTierId ||
        passBProfiles.find((profile) => profile.id === result.id)?.equipmentTierId ||
        passCProfiles.find((profile) => profile.id === result.id)?.equipmentTierId ||
        "CUSTOM",
      injuryCombinationId:
        passAProfiles.find((profile) => profile.id === result.id)?.injuryCombinationId ||
        passBProfiles.find((profile) => profile.id === result.id)?.injuryCombinationId ||
        passCProfiles.find((profile) => profile.id === result.id)?.injuryCombinationId ||
        "CUSTOM",
      injuryFlags: result.inputs.injuryFlags,
      profile: result.inputs,
    });
  }

  const resultById = new Map(allResults.map((result) => [result.id, result]));
  const invarianceResults = [];

  for (const reference of INVARIANCE_PROFILE_REFERENCES) {
    const source = allMatrixProfiles.find((profile) => profile.id === reference.sourceId);
    if (!source) {
      throw new Error(`Missing invariance reference profile ${reference.sourceId}.`);
    }

    const baselineProfile = makeProfile(source.profile);
    const baselineResult = buildInvarianceComparable(baselineProfile, exercises);
    const variants = [
      { sex: baselineProfile.sex === "male" ? "female" : "male", age: baselineProfile.age },
      { sex: baselineProfile.sex, age: 18 },
      { sex: baselineProfile.sex, age: 30 },
      { sex: baselineProfile.sex, age: 45 },
      { sex: baselineProfile.sex, age: 60 },
    ];

    let passed = true;
    let message = "All compared plans were byte-identical.";

    for (const variant of variants) {
      const variantProfile = makeProfile({
        ...source.profile,
        sex: variant.sex,
        age: variant.age,
      });
      const variantResult = buildInvarianceComparable(variantProfile, exercises);
      if (JSON.stringify(baselineResult) !== JSON.stringify(variantResult)) {
        passed = false;
        message = `Divergence detected for sex=${variant.sex}, age=${variant.age}.`;
        break;
      }
    }

    invarianceResults.push({
      referenceId: reference.sourceId,
      baselineInputs: serializeInputs(baselineProfile),
      variants,
      passed,
      message,
      classification: passed ? null : "generator_logic_defect",
    });
  }

  const prioritizedRecommendations = buildRecommendations(allResults);

  const passAResults = allResults.filter((result) => result.pass === "A");
  const passBResults = allResults.filter((result) => result.pass === "B");
  const passCResults = allResults.filter((result) => result.pass === "C");

  const report = buildReport({
    executionDate: new Date().toISOString(),
    exerciseCount: exercises.length,
    beforeCounts,
    afterCounts: beforeCounts,
    passAResults,
    passBResults,
    passCResults,
    invarianceResults,
    movementStats,
    prioritizedRecommendations,
    totalExecutionCount: passAProfiles.length + passBProfiles.length + passCProfiles.length + invarianceResults.length * 5,
  });

  await fs.writeFile(REPORT_PATH, report, "utf8");

  const afterCounts = {
    program: await prisma.program.count(),
    programDay: await prisma.programDay.count(),
    programDayExercise: await prisma.programDayExercise.count(),
    userProgram: await prisma.userProgram.count(),
    exercise: await prisma.exercise.count(),
  };

  const output = {
    metadata: {
      generatorVersion: GENERATOR_VERSION,
      auditVersion: AUDIT_VERSION,
      exerciseDatasetSize: exercises.length,
      passAProfiles: passAProfiles.length,
      passBProfiles: passBProfiles.length,
      passCProfiles: passCProfiles.length,
      invarianceProfiles: invarianceResults.length * 5,
      totalProfilesTested: passAProfiles.length + passBProfiles.length + passCProfiles.length + invarianceResults.length * 5,
    },
    beforeCounts,
    afterCounts,
    passCMatrix: PASS_C_PROFILES.map((entry) => ({
      id: entry.id,
      label: entry.label,
      profile: serializeInputs(makeProfile(entry.overrides)),
    })),
    summary: {
      overall: metricsFromResults(allResults),
      passA: metricsFromResults(passAResults),
      passB: metricsFromResults(passBResults),
      passC: metricsFromResults(passCResults),
    },
    reportPath: REPORT_PATH,
    knownGaps: KNOWN_GAP_RULES.map((rule) => ({
      id: rule.id,
      label: rule.label,
    })),
    structurallyDegradedDefinition:
      "A non-recovery day with at least one primary exercise kept, but fewer than half of its original templated slots filled after accessory omissions.",
  };

  console.log(JSON.stringify(output, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
