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

const PHASE_0B_EXERCISES = [
  {
    name_fa: "استپ آپ بدون وزنه", name_en: "Step-Up",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "single_leg",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["زانو"],
    joint_stress_flags: ["knee_stress"], default_rep_range: "10-15", default_rest_range: "45-75 ثانیه",
    progression_type: "reps", substitution_list: ["استپ آپ دمبل", "لانج معکوس بدون وزنه"],
    desc: "روی جعبه یا سکو قدم بگذار، از پاشنه فشار بده و با کنترل پایین برگرد.", gif: "🪜"
  },
  {
    name_fa: "استپ آپ دمبل", name_en: "Dumbbell Step-Up",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "single_leg",
    equipment: "دمبل", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength"], contraindications: ["زانو"],
    joint_stress_flags: ["knee_stress"], default_rep_range: "8-12", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["استپ آپ بدون وزنه", "لانج معکوس دمبل"],
    desc: "دمبل‌ها کنار بدن، با کنترل روی سکو بالا برو و لگن را در بالا کامل صاف کن.", gif: "🦿"
  },
  {
    name_fa: "شنا", name_en: "Push-Up",
    primary_muscles: ["سینه"], secondary_muscles: ["سرشانه", "پشت بازو", "کور"], movement_pattern: "horizontal_press",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["مچ"],
    joint_stress_flags: ["wrist_stress"], default_rep_range: "10-20", default_rest_range: "45-75 ثانیه",
    progression_type: "reps", substitution_list: ["پرس سینه دمبل", "پرس سینه دستگاه"],
    desc: "بدن را صاف نگه دار، آرنج‌ها را کنترل کن و سینه را تا نزدیکی زمین پایین بیاور.", gif: "⬇️"
  },
  {
    name_fa: "پرس سینه دمبل", name_en: "Dumbbell Bench Press",
    primary_muscles: ["سینه"], secondary_muscles: ["سرشانه", "پشت بازو"], movement_pattern: "horizontal_press",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["شانه"],
    joint_stress_flags: ["shoulder_stress"], default_rep_range: "8-12", default_rest_range: "90-120 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پرس سینه", "شنا"],
    desc: "دمبل‌ها را با کنترل پایین بیاور، آرنج‌ها کمی جمع باشند و در بالا بدون برخورد کامل بالا ببر.", gif: "🛏️"
  },
  {
    name_fa: "پرس سینه دستگاه", name_en: "Machine Chest Press",
    primary_muscles: ["سینه"], secondary_muscles: ["سرشانه", "پشت بازو"], movement_pattern: "horizontal_press",
    equipment: "دستگاه", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پرس سینه دمبل", "شنا"],
    desc: "کتف‌ها را به پشتی بچسبان، مسیر حرکت را کنترل کن و در بالا سینه را منقبض کن.", gif: "🛠️"
  },
  {
    name_fa: "پرس سرشانه دمبل", name_en: "Dumbbell Shoulder Press",
    primary_muscles: ["سرشانه"], secondary_muscles: ["پشت بازو", "کور"], movement_pattern: "vertical_press",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["شانه"],
    joint_stress_flags: ["shoulder_stress"], default_rep_range: "8-12", default_rest_range: "90-120 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پرس سرشانه", "پرس سرشانه دستگاه"],
    desc: "دمبل‌ها را در مسیر عمودی بالا ببر، دنده‌ها را جمع نگه دار و از قوس بیش از حد کمر پرهیز کن.", gif: "🔼"
  },
  {
    name_fa: "پرس سرشانه دستگاه", name_en: "Machine Shoulder Press",
    primary_muscles: ["سرشانه"], secondary_muscles: ["پشت بازو"], movement_pattern: "vertical_press",
    equipment: "دستگاه", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پرس سرشانه دمبل"],
    desc: "به پشتی تکیه بده، دسته‌ها را با کنترل بالا ببر و اجازه نده شانه‌ها بالا جمع شوند.", gif: "🪑"
  },
  {
    name_fa: "شنا پایک", name_en: "Pike Push-Up",
    primary_muscles: ["سرشانه"], secondary_muscles: ["پشت بازو", "کور"], movement_pattern: "vertical_press",
    equipment: "بدون ابزار", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength"], contraindications: ["شانه", "مچ"],
    joint_stress_flags: ["shoulder_stress", "wrist_stress"], default_rep_range: "6-12", default_rest_range: "60-90 ثانیه",
    progression_type: "reps", substitution_list: ["پرس سرشانه دمبل"],
    desc: "باسن را بالا نگه دار، سر را بین دست‌ها پایین بیاور و با فشار سرشانه بالا برگرد.", gif: "🔻"
  },
];

async function main() {
  const existing = new Set(
    (
      await prisma.exercise.findMany({
        where: {
          nameEn: {
            in: PHASE_0B_EXERCISES.map((exercise) => exercise.name_en),
          },
        },
        select: { nameEn: true },
      })
    ).map((exercise) => exercise.nameEn)
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const ex of PHASE_0B_EXERCISES) {
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
