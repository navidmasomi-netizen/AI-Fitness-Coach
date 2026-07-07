export const GOAL_LABELS: Record<string, string> = {
  hypertrophy: "Muscle Growth",
  strength: "Strength",
  fat_loss: "Fat Loss",
  recomposition: "Body Recomposition",
};

export const TRAINING_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  pull_up_bar: "Pull-Up Bar",
};

export const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
};

export const OCCUPATION_TYPE_LABELS: Record<string, string> = {
  desk_job: "Desk Job",
  active_job: "Active Job",
  mixed: "Mixed Activity",
  student: "Student",
  unemployed: "Unemployed",
};

export const RECOVERY_QUALITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const NUTRITION_HABITS_LABELS: Record<string, string> = {
  strict: "Strict",
  moderate: "Moderate",
  flexible: "Flexible",
  unstructured: "Unstructured",
};

export const CARDIO_PREFERENCE_LABELS: Record<string, string> = {
  none: "None",
  low_intensity: "Low Intensity",
  hiit: "HIIT",
  mixed: "Mixed",
};

export const SUPPLEMENT_LABELS: Record<string, string> = {
  none: "None",
  protein: "Protein",
  creatine: "Creatine",
  omega3: "Omega-3",
  multivitamin: "Multivitamin",
  vitamin_d: "Vitamin D",
  magnesium: "Magnesium",
  fish_oil: "Fish Oil",
  electrolytes: "Electrolytes",
  pre_workout: "Pre-Workout",
  other: "Other",
};

export const INJURY_FLAG_LABELS: Record<string, string> = {
  knee: "Knee",
  shoulder: "Shoulder",
  lower_back: "Lower Back",
  wrist: "Wrist",
  none: "None",
};

export function getWizardTotalSteps(supplementUse: string[]): number {
  return supplementUse.includes("other") ? 19 : 18;
}

export function getWizardStepNumber(baseStep: number, supplementUse: string[]): number {
  if (supplementUse.includes("other") && baseStep >= 16) {
    return baseStep + 1;
  }

  return baseStep;
}

export function getLabel(map: Record<string, string>, value: string | null): string {
  if (!value) return "Not provided";
  return map[value] || value;
}

export function getLabelList(map: Record<string, string>, values: string[]): string {
  if (!values || values.length === 0) return "Not provided";
  return values.map((value) => map[value] || value).join(", ");
}
