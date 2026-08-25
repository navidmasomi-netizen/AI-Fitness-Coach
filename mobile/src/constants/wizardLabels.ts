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
  desk_job: "Mostly sitting",
  active_job: "Mostly on my feet",
  mixed: "A mix of both",
  student: "Light daily activity",
  unemployed: "Mostly at home",
};

export const OCCUPATION_TYPE_SUB_COPY: Record<string, string> = {
  desk_job: "Office, remote work, or study",
  active_job: "Retail, trades, healthcare",
  mixed: "Some desk, some moving around",
  student: "Classes with low physical demand",
  unemployed: "Minimal structured activity",
};

export const RECOVERY_QUALITY_LABELS: Record<string, string> = {
  low: "I'm often still sore or tired",
  medium: "I recover fairly well",
  high: "I recover quickly",
};

export const RECOVERY_QUALITY_SUB_COPY: Record<string, string> = {
  low: "Recovery is slow after workouts or busy days",
  medium: "Some fatigue, but usually ready by the next session",
  high: "I usually feel fresh and ready to train again",
};

export const NUTRITION_HABITS_LABELS: Record<string, string> = {
  strict: "Very structured",
  moderate: "Mostly consistent",
  flexible: "Relaxed and intuitive",
  unstructured: "No fixed routine",
};

export const NUTRITION_HABITS_SUB_COPY: Record<string, string> = {
  strict: "I follow consistent meals, macros, or a set plan",
  moderate: "I follow general targets but allow flexibility",
  flexible: "I usually eat by feel without a fixed plan",
  unstructured: "Meal timing and choices vary day to day",
};

export const CARDIO_PREFERENCE_LABELS: Record<string, string> = {
  none: "No cardio",
  low_intensity: "Low intensity",
  hiit: "High-intensity intervals",
  mixed: "A mix of both",
};

export const CARDIO_PREFERENCE_SUB_COPY: Record<string, string> = {
  none: "I mainly focus on strength training",
  low_intensity: "Walking, cycling, or easy steady-state cardio",
  hiit: "Short, hard efforts like sprints or circuits",
  mixed: "A combination of steady and intense cardio",
};

export const SUPPLEMENT_LABELS: Record<string, string> = {
  none: "I don't take supplements",
  protein: "Protein",
  creatine: "Creatine",
  omega3: "Omega-3",
  multivitamin: "Multivitamin",
  vitamin_d: "Vitamin D",
  magnesium: "Magnesium",
  fish_oil: "Fish oil",
  electrolytes: "Electrolytes",
  pre_workout: "Pre-workout",
  other: "Other",
};

export const INJURY_FLAG_LABELS: Record<string, string> = {
  knee: "Knee",
  shoulder: "Shoulder",
  lower_back: "Lower back",
  wrist: "Wrist",
  none: "No injuries or limitations",
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
