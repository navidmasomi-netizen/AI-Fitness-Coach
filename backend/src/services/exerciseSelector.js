import prisma from "../lib/prisma.js";

const VALID_MOVEMENT_PATTERNS = new Set([
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
]);

const VALID_EQUIPMENT = new Set(["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"]);
const VALID_GOALS = new Set(["hypertrophy", "strength", "fat_loss", "recomposition"]);
const VALID_TRAINING_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const VALID_INJURY_FLAGS = new Set(["none", "knee", "shoulder", "wrist", "lower_back"]);

const DIFFICULTY_ORDER = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const INJURY_TO_JOINT_STRESS_MAP = {
  knee: "knee_stress",
  shoulder: "shoulder_stress",
  wrist: "wrist_stress",
  lower_back: "lower_back_stress",
};

function validateInputs({
  requiredMovementPattern,
  equipmentAccess,
  goal,
  trainingLevel,
  injuryFlags,
  exercises,
}) {
  if (!VALID_MOVEMENT_PATTERNS.has(requiredMovementPattern)) {
    throw new Error(
      `Invalid requiredMovementPattern: ${requiredMovementPattern}. Expected one of ${Array.from(
        VALID_MOVEMENT_PATTERNS
      ).join(", ")}.`
    );
  }

  if (!Array.isArray(equipmentAccess)) {
    throw new Error("Invalid equipmentAccess: expected an array of equipment values.");
  }

  for (const equipment of equipmentAccess) {
    if (!VALID_EQUIPMENT.has(equipment)) {
      throw new Error(
        `Invalid equipmentAccess entry: ${equipment}. Expected one of ${Array.from(VALID_EQUIPMENT).join(", ")}.`
      );
    }
  }

  if (!VALID_GOALS.has(goal)) {
    throw new Error(`Invalid goal: ${goal}. Expected one of ${Array.from(VALID_GOALS).join(", ")}.`);
  }

  if (!VALID_TRAINING_LEVELS.has(trainingLevel)) {
    throw new Error(
      `Invalid trainingLevel: ${trainingLevel}. Expected one of ${Array.from(VALID_TRAINING_LEVELS).join(", ")}.`
    );
  }

  if (!Array.isArray(injuryFlags)) {
    throw new Error("Invalid injuryFlags: expected an array of injury flag values.");
  }

  for (const injuryFlag of injuryFlags) {
    if (!VALID_INJURY_FLAGS.has(injuryFlag)) {
      throw new Error(
        `Invalid injuryFlags entry: ${injuryFlag}. Expected one of ${Array.from(VALID_INJURY_FLAGS).join(", ")}.`
      );
    }
  }

  if (!Array.isArray(exercises)) {
    throw new Error("Invalid exercises: expected an array of Exercise records.");
  }
}

function getExcludedStressFlags(injuryFlags) {
  return injuryFlags
    .filter((flag) => flag !== "none")
    .map((flag) => INJURY_TO_JOINT_STRESS_MAP[flag]);
}

function isAdjacentDifficulty(exerciseDifficulty, trainingLevel) {
  if (!exerciseDifficulty || !DIFFICULTY_ORDER.hasOwnProperty(exerciseDifficulty)) return false;
  return Math.abs(DIFFICULTY_ORDER[exerciseDifficulty] - DIFFICULTY_ORDER[trainingLevel]) === 1;
}

function buildScoreBreakdown(exercise, goal, trainingLevel) {
  const goalMatch = Array.isArray(exercise.suitableGoals) && exercise.suitableGoals.includes(goal);
  const exactDifficulty = exercise.difficulty === trainingLevel;
  const adjacentDifficulty = isAdjacentDifficulty(exercise.difficulty, trainingLevel);
  const beginnerIsolationPreference = trainingLevel === "beginner" && exercise.complexity === "isolation";
  const compoundPreference = exercise.complexity === "compound";

  const breakdown = {
    goalMatch: { matched: goalMatch, points: goalMatch ? 40 : 0 },
    difficulty: {
      exact: exactDifficulty,
      adjacent: adjacentDifficulty,
      points: exactDifficulty ? 25 : adjacentDifficulty ? 10 : 0,
    },
    beginnerIsolationPreference: {
      applied: beginnerIsolationPreference,
      points: beginnerIsolationPreference ? 15 : 0,
    },
    compoundPreference: {
      applied: compoundPreference,
      points: compoundPreference ? 10 : 0,
    },
  };

  breakdown.total =
    breakdown.goalMatch.points +
    breakdown.difficulty.points +
    breakdown.beginnerIsolationPreference.points +
    breakdown.compoundPreference.points;

  return breakdown;
}

function compareRankedCandidates(a, b, trainingLevel) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (trainingLevel === "beginner" && a.exercise.complexity !== b.exercise.complexity) {
    if (a.exercise.complexity === "isolation") return -1;
    if (b.exercise.complexity === "isolation") return 1;
  }

  return (a.exercise.nameEn || "").localeCompare(b.exercise.nameEn || "", "en", { sensitivity: "base" });
}

function rankCandidates(candidates, goal, trainingLevel) {
  return candidates
    .map((exercise) => {
      const scoreBreakdown = buildScoreBreakdown(exercise, goal, trainingLevel);
      return {
        exercise,
        score: scoreBreakdown.total,
        scoreBreakdown,
      };
    })
    .sort((a, b) => compareRankedCandidates(a, b, trainingLevel));
}

function buildSelectionReason(fallbackLevelUsed, selectedExercise) {
  if (fallbackLevelUsed === 0) {
    return `Selected ${selectedExercise.nameEn} at fallback level 0 after exact movement, equipment, injury-safety, goal-match, and exact-difficulty filtering.`;
  }

  if (fallbackLevelUsed === 1) {
    return `Selected ${selectedExercise.nameEn} at fallback level 1 after relaxing exact difficulty to adjacent difficulty while keeping goal match, equipment, and injury safety constraints.`;
  }

  return `Selected ${selectedExercise.nameEn} at fallback level 2 after relaxing goal and difficulty requirements while keeping movement pattern, equipment, and injury safety constraints.`;
}

function buildNoCandidateResult({
  requiredMovementPattern,
  equipmentAccess,
  goal,
  trainingLevel,
  injuryFlags,
}) {
  const reason =
    "No exercise candidate found after applying movement pattern, equipment, and injury safety constraints across fallback levels 0-3.";

  return {
    selectedExercise: null,
    rankedCandidates: [],
    fallbackLevelUsed: 3,
    reason,
    noCandidateDetails: {
      movementPattern: requiredMovementPattern,
      attemptedFallbackLevels: [0, 1, 2, 3],
      reason,
      userConstraints: {
        equipmentAccess,
        goal,
        trainingLevel,
        injuryFlags,
      },
    },
  };
}

export function selectExercise({
  requiredMovementPattern,
  equipmentAccess,
  goal,
  trainingLevel,
  injuryFlags,
  exercises,
}) {
  validateInputs({
    requiredMovementPattern,
    equipmentAccess,
    goal,
    trainingLevel,
    injuryFlags,
    exercises,
  });

  const excludedStressFlags = new Set(getExcludedStressFlags(injuryFlags));
  const baseCandidates = exercises.filter((exercise) => {
    if (exercise.movementPattern !== requiredMovementPattern) return false;
    if (!equipmentAccess.includes(exercise.equipment)) return false;

    const jointStressFlags = Array.isArray(exercise.jointStressFlags) ? exercise.jointStressFlags : [];
    return !jointStressFlags.some((flag) => excludedStressFlags.has(flag));
  });

  if (baseCandidates.length === 0) {
    return buildNoCandidateResult({
      requiredMovementPattern,
      equipmentAccess,
      goal,
      trainingLevel,
      injuryFlags,
    });
  }

  const level0Candidates = baseCandidates.filter(
    (exercise) => exercise.suitableGoals.includes(goal) && exercise.difficulty === trainingLevel
  );
  if (level0Candidates.length > 0) {
    const rankedCandidates = rankCandidates(level0Candidates, goal, trainingLevel);
    return {
      selectedExercise: rankedCandidates[0].exercise,
      rankedCandidates,
      fallbackLevelUsed: 0,
      reason: buildSelectionReason(0, rankedCandidates[0].exercise),
      noCandidateDetails: null,
    };
  }

  const level1Candidates = baseCandidates.filter(
    (exercise) => exercise.suitableGoals.includes(goal) && isAdjacentDifficulty(exercise.difficulty, trainingLevel)
  );
  if (level1Candidates.length > 0) {
    const rankedCandidates = rankCandidates(level1Candidates, goal, trainingLevel);
    return {
      selectedExercise: rankedCandidates[0].exercise,
      rankedCandidates,
      fallbackLevelUsed: 1,
      reason: buildSelectionReason(1, rankedCandidates[0].exercise),
      noCandidateDetails: null,
    };
  }

  const rankedCandidates = rankCandidates(baseCandidates, goal, trainingLevel);
  return {
    selectedExercise: rankedCandidates[0].exercise,
    rankedCandidates,
    fallbackLevelUsed: 2,
    reason: buildSelectionReason(2, rankedCandidates[0].exercise),
    noCandidateDetails: null,
  };
}

export async function selectExerciseForUser({
  requiredMovementPattern,
  equipmentAccess,
  goal,
  trainingLevel,
  injuryFlags,
}) {
  const exercises = await prisma.exercise.findMany({
    orderBy: { id: "asc" },
  });

  return selectExercise({
    requiredMovementPattern,
    equipmentAccess,
    goal,
    trainingLevel,
    injuryFlags,
    exercises,
  });
}

export { INJURY_TO_JOINT_STRESS_MAP };
