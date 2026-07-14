import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const equipmentMap = {
  "هالتر": "barbell",
  "دمبل": "dumbbell",
  "دستگاه": "machine",
  "کابل": "cable",
  "بدون ابزار": "bodyweight",
  "میله": "pull_up_bar",
};

const difficultyMap = {
  "مبتدی": "beginner",
  "متوسط": "intermediate",
  "پیشرفته": "advanced",
};

const movementPatternMap = {
  squat: "squat",
  squat_pattern: "squat",
  hinge: "hinge",
  lunge: "lunge",
  single_leg: "single_leg",
  horizontal_press: "horizontal_press",
  vertical_press: "vertical_press",
  horizontal_pull: "horizontal_pull",
  vertical_pull: "vertical_pull",
  elbow_flexion: "elbow_flexion",
  elbow_extension: "elbow_extension",
  trunk_flexion: "trunk_flexion",
  anti_extension: "anti_extension",
};

function parseRange(str) {
  if (!str) return { low: null, high: null };
  const nums = str.match(/\d+/g);
  if (!nums || nums.length === 0) return { low: null, high: null };
  if (nums.length === 1) return { low: Number(nums[0]), high: Number(nums[0]) };
  return { low: Number(nums[0]), high: Number(nums[1]) };
}

const PHASE_0D_EXERCISES = [
  // Deliberately the first knee-safe squat candidate in this dataset: controlled ROM, no external load,
  // rehab-oriented execution, and intended for pain-free ranges without the knee_stress flag.
  {
    name_fa: "اسکوات بدون وزنه (دامنه کنترل‌شده)", name_en: "Bodyweight Squat (Controlled Range)",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "squat",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "12-20", default_rest_range: "45-60 ثانیه",
    progression_type: "reps", substitution_list: ["Back Squat", "Leg Press"],
    desc: "با دامنه کنترل‌شده و بدون بار خارجی اسکوات بزن، زانوها را در محدوده بدون درد نگه دار و حرکت را آرام اجرا کن.", gif: "🧍"
  },
  // First knee-safe single-leg option in this dataset: hip-dominant execution without loaded knee flexion.
  {
    name_fa: "اکستنشن تک‌پا کابل", name_en: "Cable Single-Leg Hip Extension",
    primary_muscles: ["سرینی"], secondary_muscles: ["کور", "پشت ران"], movement_pattern: "single_leg",
    equipment: "کابل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "45-75 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["Step-Up", "Dumbbell Step-Up"],
    desc: "مچ‌بند کابل را به مچ پا وصل کن، لگن را ثابت نگه دار و پا را به عقب و بالا فشار بده بدون اینکه زانو بار بگیرد.", gif: "🦿"
  },
  {
    name_fa: "پالوف پرس کابل", name_en: "Cable Pallof Press",
    primary_muscles: ["کور"], secondary_muscles: ["شکم", "سرشانه"], movement_pattern: "anti_extension",
    equipment: "کابل", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "30-45 ثانیه",
    progression_type: "reps", substitution_list: ["Plank", "Dead Bug"],
    desc: "کنار دستگاه بایست، کابل را مقابل سینه بگیر و دست‌ها را به جلو پرس کن در حالی که تنه در برابر چرخش مقاومت می‌کند.", gif: "🛡️"
  },
];

async function main() {
  const existing = new Set(
    (
      await prisma.exercise.findMany({
        where: {
          nameEn: {
            in: PHASE_0D_EXERCISES.map((exercise) => exercise.name_en),
          },
        },
        select: { nameEn: true },
      })
    ).map((exercise) => exercise.nameEn)
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const ex of PHASE_0D_EXERCISES) {
    if (existing.has(ex.name_en)) {
      console.log(`Skipping existing exercise: ${ex.name_en}`);
      skippedCount += 1;
      continue;
    }

    const repRange = parseRange(ex.default_rep_range);
    const restRange = parseRange(ex.default_rest_range);

    await prisma.exercise.create({
      data: {
        nameFa: ex.name_fa,
        nameEn: ex.name_en || null,
        description: ex.desc || null,
        icon: ex.gif || null,
        primaryMuscles: ex.primary_muscles || [],
        secondaryMuscles: ex.secondary_muscles || [],
        movementPattern: movementPatternMap[ex.movement_pattern] || null,
        equipment: equipmentMap[ex.equipment] || null,
        difficulty: difficultyMap[ex.difficulty] || null,
        complexity: ex.complexity || null,
        suitableGoals: ex.suitable_goals || [],
        contraindications: ex.contraindications || [],
        jointStressFlags: ex.joint_stress_flags || [],
        substitutionNames: ex.substitution_list || [],
        defaultRepRangeLow: repRange.low,
        defaultRepRangeHigh: repRange.high,
        defaultRestSecondsLow: restRange.low,
        defaultRestSecondsHigh: restRange.high,
        progressionType: ex.progression_type || null,
      },
    });

    console.log(`Created exercise: ${ex.name_en}`);
    createdCount += 1;
  }

  console.log(`Created ${createdCount} new exercises.`);
  console.log(`Skipped ${skippedCount} existing exercises.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
