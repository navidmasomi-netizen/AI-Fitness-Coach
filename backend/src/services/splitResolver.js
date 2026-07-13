export const GENERATOR_VERSION = "1.0";

const VALID_GOALS = new Set(["hypertrophy", "strength", "fat_loss", "recomposition"]);
const VALID_TRAINING_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const VALID_RECOVERY_QUALITIES = new Set(["low", "medium", "high"]);

function validateInputs({ trainingDaysPerWeek, goal, trainingLevel, recoveryQuality }) {
  if (!Number.isInteger(trainingDaysPerWeek) || trainingDaysPerWeek < 1 || trainingDaysPerWeek > 7) {
    throw new Error(`Invalid trainingDaysPerWeek: ${trainingDaysPerWeek}. Expected an integer between 1 and 7.`);
  }

  if (!VALID_GOALS.has(goal)) {
    throw new Error(
      `Invalid goal: ${goal}. Expected one of ${Array.from(VALID_GOALS).join(", ")}.`
    );
  }

  if (!VALID_TRAINING_LEVELS.has(trainingLevel)) {
    throw new Error(
      `Invalid trainingLevel: ${trainingLevel}. Expected one of ${Array.from(VALID_TRAINING_LEVELS).join(", ")}.`
    );
  }

  if (!VALID_RECOVERY_QUALITIES.has(recoveryQuality)) {
    throw new Error(
      `Invalid recoveryQuality: ${recoveryQuality}. Expected one of ${Array.from(VALID_RECOVERY_QUALITIES).join(", ")}.`
    );
  }
}

function buildResult({
  splitFamily,
  splitName,
  numberOfTrainingDays,
  dayTypes,
  recoveryOrCardioDay = false,
  recoveryAdjusted = false,
}) {
  return {
    splitFamily,
    splitName,
    numberOfTrainingDays,
    dayTypes,
    recoveryOrCardioDay,
    recoveryAdjusted,
    generatorVersion: GENERATOR_VERSION,
  };
}

function resolveSixDaySplit(trainingLevel, recoveryQuality) {
  const shouldRecoveryAdjust =
    recoveryQuality === "low" && (trainingLevel === "intermediate" || trainingLevel === "advanced");

  if (trainingLevel === "beginner" || shouldRecoveryAdjust) {
    return buildResult({
      splitFamily: "upper_lower",
      splitName: "Upper/Lower (Reduced Volume x3)",
      numberOfTrainingDays: 6,
      dayTypes: [
        "upper_a_light",
        "lower_a_light",
        "upper_b_light",
        "lower_b_light",
        "upper_c_light",
        "lower_c_light",
      ],
      recoveryAdjusted: shouldRecoveryAdjust,
    });
  }

  return buildResult({
    splitFamily: "ppl",
    splitName: "Push/Pull/Legs",
    numberOfTrainingDays: 6,
    dayTypes: ["push_a", "pull_a", "legs_a", "push_b", "pull_b", "legs_b"],
  });
}

export function resolveSplit({ trainingDaysPerWeek, goal, trainingLevel, recoveryQuality }) {
  validateInputs({ trainingDaysPerWeek, goal, trainingLevel, recoveryQuality });

  switch (trainingDaysPerWeek) {
    case 1:
      return buildResult({
        splitFamily: "full_body",
        splitName: "Full Body",
        numberOfTrainingDays: 1,
        dayTypes: ["full_body"],
      });
    case 2:
      return buildResult({
        splitFamily: "full_body",
        splitName: "Full Body A/B",
        numberOfTrainingDays: 2,
        dayTypes: ["full_body_a", "full_body_b"],
      });
    case 3:
      if (goal === "strength") {
        return buildResult({
          splitFamily: "strength_split",
          splitName: "Full Body Strength",
          numberOfTrainingDays: 3,
          dayTypes: ["full_body_strength_a", "full_body_strength_b", "full_body_strength_c"],
        });
      }

      return buildResult({
        splitFamily: "full_body",
        splitName: "Full Body A/B/C",
        numberOfTrainingDays: 3,
        dayTypes: ["full_body_a", "full_body_b", "full_body_c"],
      });
    case 4:
      return buildResult({
        splitFamily: "upper_lower",
        splitName: "Upper/Lower",
        numberOfTrainingDays: 4,
        dayTypes: ["upper_a", "lower_a", "upper_b", "lower_b"],
      });
    case 5:
      if (trainingLevel === "advanced") {
        return buildResult({
          splitFamily: "upper_lower",
          splitName: "Upper/Lower + Weak Point/Conditioning",
          numberOfTrainingDays: 5,
          dayTypes: ["upper_a", "lower_a", "upper_b", "lower_b", "weak_point_or_conditioning"],
        });
      }

      return buildResult({
        splitFamily: "upper_lower",
        splitName: "Upper/Lower + Full Body",
        numberOfTrainingDays: 5,
        dayTypes: ["upper_a", "lower_a", "upper_b", "lower_b", "full_body"],
      });
    case 6:
      return resolveSixDaySplit(trainingLevel, recoveryQuality);
    case 7: {
      const sixDayBase = resolveSixDaySplit(trainingLevel, recoveryQuality);
      return {
        ...sixDayBase,
        dayTypes: [...sixDayBase.dayTypes, "recovery_or_cardio"],
        recoveryOrCardioDay: true,
      };
    }
    default:
      throw new Error(`Unhandled trainingDaysPerWeek: ${trainingDaysPerWeek}`);
  }
}
