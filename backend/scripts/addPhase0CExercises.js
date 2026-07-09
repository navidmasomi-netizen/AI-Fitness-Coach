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

const PHASE_0C_EXERCISES = [
  {
    name_fa: "لت پول‌داون دستگاه", name_en: "Lat Pulldown",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو"], movement_pattern: "vertical_pull",
    equipment: "دستگاه", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پول‌آپ", "پول‌داون کابل"],
    desc: "میله را به سمت بالای سینه بکش، کتف‌ها را پایین نگه دار و از تاب دادن تنه پرهیز کن.", gif: "📉"
  },
  {
    name_fa: "پول‌داون کابل", name_en: "Cable Pulldown",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو"], movement_pattern: "vertical_pull",
    equipment: "کابل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["لت پول‌داون دستگاه", "پول‌آپ"],
    desc: "کابل را با کنترل تا بالای سینه پایین بکش و در پایین دامنه کتف‌ها را جمع کن.", gif: "🧲"
  },
  {
    name_fa: "پول‌آپ وزنه‌دار", name_en: "Weighted Pull-Up",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو", "کور"], movement_pattern: "vertical_pull",
    equipment: "میله", difficulty: "پیشرفته", complexity: "compound",
    suitable_goals: ["strength", "hypertrophy"], contraindications: ["شانه"],
    joint_stress_flags: ["shoulder_stress"], default_rep_range: "3-6", default_rest_range: "120-180 ثانیه",
    progression_type: "load", substitution_list: ["پول‌آپ", "لت پول‌داون دستگاه"],
    desc: "وزنه را پایدار نگه دار، از تاب خوردن جلوگیری کن و با دامنه کامل بالا بکش.", gif: "⚖️"
  },
  {
    name_fa: "جلو بازو کابل", name_en: "Cable Curl",
    primary_muscles: ["بازو"], secondary_muscles: [], movement_pattern: "elbow_flexion",
    equipment: "کابل", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "45-60 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["جلو بازو"],
    desc: "آرنج‌ها را ثابت نگه دار و کابل را بدون جلو آوردن شانه‌ها تا بالا جمع کن.", gif: "💪"
  },
  {
    name_fa: "پشت بازو بالای سر دمبل", name_en: "Dumbbell Overhead Triceps Extension",
    primary_muscles: ["پشت بازو"], secondary_muscles: ["کور"], movement_pattern: "elbow_extension",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "recomposition"], contraindications: ["آرنج"],
    joint_stress_flags: ["elbow_stress"], default_rep_range: "10-15", default_rest_range: "45-60 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پشت بازو سیمکش"],
    desc: "بازوها را نزدیک سر نگه دار، دمبل را پشت سر پایین ببر و با کنترل بالا بیاور.", gif: "🫱"
  },
  {
    name_fa: "دیپ نیمکت", name_en: "Bench Dip",
    primary_muscles: ["پشت بازو"], secondary_muscles: ["سینه", "سرشانه"], movement_pattern: "elbow_extension",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["شانه", "مچ"],
    joint_stress_flags: ["shoulder_stress", "wrist_stress"], default_rep_range: "10-15", default_rest_range: "45-60 ثانیه",
    progression_type: "reps", substitution_list: ["پشت بازو سیمکش", "پشت بازو بالای سر دمبل"],
    desc: "دست‌ها را روی نیمکت ثابت بگذار، بدن را عمودی‌تر نگه دار و با کنترل بالا و پایین برو.", gif: "🪑"
  },
  {
    name_fa: "کرانچ کابل", name_en: "Cable Crunch",
    primary_muscles: ["شکم"], secondary_muscles: ["کور"], movement_pattern: "trunk_flexion",
    equipment: "کابل", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "12-20", default_rest_range: "30-45 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["کرانچ"],
    desc: "لگن را ثابت نگه دار، دنده‌ها را به سمت لگن جمع کن و حرکت را از شکم هدایت کن.", gif: "🧵"
  },
  {
    name_fa: "ددباگ", name_en: "Dead Bug",
    primary_muscles: ["کور"], secondary_muscles: ["شکم"], movement_pattern: "anti_extension",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "30-45 ثانیه",
    progression_type: "reps", substitution_list: ["پلانک"],
    desc: "کمر را به زمین بچسبان، دست و پای مخالف را آرام باز کن و تنه را ثابت نگه دار.", gif: "🐞"
  },
  {
    name_fa: "پشت پا خوابیده دستگاه", name_en: "Machine Leg Curl",
    primary_muscles: ["پشت ران"], secondary_muscles: [], movement_pattern: "hinge",
    equipment: "دستگاه", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["رومانیایی", "پل باسن"],
    desc: "لگن را به پد بچسبان، پاشنه‌ها را به سمت باسن جمع کن و در بالا مکث کوتاه داشته باش.", gif: "🛌"
  },
  {
    name_fa: "فرانت اسکوات", name_en: "Front Squat",
    primary_muscles: ["چهارسر"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "squat",
    equipment: "هالتر", difficulty: "پیشرفته", complexity: "compound",
    suitable_goals: ["strength", "hypertrophy"], contraindications: ["زانو"],
    joint_stress_flags: ["knee_stress"], default_rep_range: "3-6", default_rest_range: "150-210 ثانیه",
    progression_type: "load", substitution_list: ["اسکوات", "پرس پا"],
    desc: "آرنج‌ها را بالا نگه دار، تنه را صاف حفظ کن و با کنترل کامل در خط میانی پایین برو.", gif: "🏋️"
  },
];

async function main() {
  const existing = new Set(
    (
      await prisma.exercise.findMany({
        where: {
          nameEn: {
            in: PHASE_0C_EXERCISES.map((exercise) => exercise.name_en),
          },
        },
        select: { nameEn: true },
      })
    ).map((exercise) => exercise.nameEn)
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const ex of PHASE_0C_EXERCISES) {
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
