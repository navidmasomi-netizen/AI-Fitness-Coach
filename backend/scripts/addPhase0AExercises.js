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

const PHASE_0A_EXERCISES = [
  {
    name_fa: "پارویی معکوس", name_en: "Bodyweight Inverted Row",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو", "کور"], movement_pattern: "horizontal_pull",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "8-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps", substitution_list: ["پارویی دمبل", "پارویی کابل"],
    desc: "بدن را صاف نگه دار، سینه را به میله یا لبه نزدیک کن، کتف‌ها را جمع کن.", gif: "↔️"
  },
  {
    name_fa: "پارویی دمبل", name_en: "Dumbbell Row",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو", "کمر"], movement_pattern: "horizontal_pull",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["کمر پایین"],
    joint_stress_flags: ["lower_back_stress"], default_rep_range: "8-12", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پارویی معکوس", "پارویی کابل"],
    desc: "تنه ثابت، دمبل را به سمت لگن بکش، کتف را در بالا جمع کن.", gif: "🏋️"
  },
  {
    name_fa: "پارویی کابل", name_en: "Cable Row",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو"], movement_pattern: "horizontal_pull",
    equipment: "کابل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پارویی دمبل", "پارویی معکوس"],
    desc: "قفسه سینه بالا، آرنج‌ها را عقب ببر، اجازه نده شانه‌ها جلو بیفتند.", gif: "🧵"
  },
  {
    name_fa: "پارویی هالتر", name_en: "Barbell Row",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو", "کمر"], movement_pattern: "horizontal_pull",
    equipment: "هالتر", difficulty: "پیشرفته", complexity: "compound",
    suitable_goals: ["strength", "hypertrophy"], contraindications: ["کمر پایین", "شانه"],
    joint_stress_flags: ["lower_back_stress", "shoulder_stress"], default_rep_range: "5-8", default_rest_range: "120-180 ثانیه",
    progression_type: "load", substitution_list: ["پارویی کابل", "پارویی دمبل"],
    desc: "لگن را ثابت نگه دار، میله را به پایین شکم بکش و از تاب‌دادن بدن خودداری کن.", gif: "🏋️‍♂️"
  },
  {
    name_fa: "لانج معکوس بدون وزنه", name_en: "Bodyweight Reverse Lunge",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "lunge",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "12-15", default_rest_range: "45-60 ثانیه",
    progression_type: "reps", substitution_list: ["لانج معکوس دمبل", "لانج"],
    desc: "یک قدم به عقب بردار، زانوی جلو را پایدار نگه دار و با کنترل به حالت شروع برگرد.", gif: "↩️"
  },
  {
    name_fa: "لانج معکوس دمبل", name_en: "Dumbbell Reverse Lunge",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "lunge",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "recomposition"], contraindications: ["زانو"],
    joint_stress_flags: ["knee_stress"], default_rep_range: "10-15", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["لانج معکوس بدون وزنه", "لانج"],
    desc: "دمبل‌ها کنار بدن، قدم را به عقب ببر و فشار را از پاشنه پای جلو منتقل کن.", gif: "🦵"
  },
  {
    name_fa: "پل باسن", name_en: "Glute Bridge",
    primary_muscles: ["سرینی"], secondary_muscles: ["پشت ران", "کور"], movement_pattern: "hinge",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "15-20", default_rest_range: "45-60 ثانیه",
    progression_type: "reps", substitution_list: ["هیپ تراست", "رومانیایی"],
    desc: "کف پاها روی زمین، لگن را بالا ببر و در بالاترین نقطه سرینی را منقبض کن.", gif: "🌉"
  },
  {
    name_fa: "رومانیایی دمبل", name_en: "Dumbbell Romanian Deadlift",
    primary_muscles: ["پشت ران"], secondary_muscles: ["سرینی", "کمر"], movement_pattern: "hinge",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "recomposition"], contraindications: ["کمر پایین"],
    joint_stress_flags: ["lower_back_stress"], default_rep_range: "8-12", default_rest_range: "90-120 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["رومانیایی", "پل باسن"],
    desc: "دمبل‌ها را نزدیک پا نگه دار، باسن را عقب بده و با کمر صاف بالا برگرد.", gif: "🎒"
  },
  {
    name_fa: "هیپ تراست", name_en: "Hip Thrust",
    primary_muscles: ["سرینی"], secondary_muscles: ["پشت ران", "کور"], movement_pattern: "hinge",
    equipment: "هالتر", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: [],
    joint_stress_flags: [], default_rep_range: "8-15", default_rest_range: "90-120 ثانیه",
    progression_type: "load", substitution_list: ["پل باسن", "رومانیایی دمبل"],
    desc: "پشت بالا روی نیمکت، چانه جمع، لگن را تا هم‌راستا شدن با تنه بالا ببر.", gif: "🚀"
  },
];

async function main() {
  const existing = new Set(
    (
      await prisma.exercise.findMany({
        where: {
          nameEn: {
            in: PHASE_0A_EXERCISES.map((exercise) => exercise.name_en),
          },
        },
        select: { nameEn: true },
      })
    ).map((exercise) => exercise.nameEn)
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const ex of PHASE_0A_EXERCISES) {
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
