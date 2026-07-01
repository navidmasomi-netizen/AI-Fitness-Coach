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

const RAW_EXERCISES = [
  {
    name_fa: "اسکوات", name_en: "Back Squat",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "squat",
    equipment: "هالتر", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["زانو", "کمر پایین"],
    joint_stress_flags: ["knee_stress", "lower_back_stress"], default_rep_range: "3-8", default_rest_range: "120-180 ثانیه",
    progression_type: "load", substitution_list: ["پرس پا", "لانج"],
    desc: "پادشاه حرکات پایه — زانوها بیرون، کمر صاف، تا موازی پایین برو.", gif: "🏋️"
  },
  {
    name_fa: "ددلیفت", name_en: "Deadlift",
    primary_muscles: ["پشت"], secondary_muscles: ["پشت ران", "سرینی"], movement_pattern: "hinge",
    equipment: "هالتر", difficulty: "پیشرفته", complexity: "compound",
    suitable_goals: ["strength", "hypertrophy"], contraindications: ["کمر پایین"],
    joint_stress_flags: ["lower_back_stress"], default_rep_range: "3-6", default_rest_range: "150-210 ثانیه",
    progression_type: "load", substitution_list: ["رومانیایی"],
    desc: "کمر صاف، باسن به عقب، هالتر نزدیک ساق پا بکش بالا.", gif: "💪"
  },
  {
    name_fa: "پرس سینه", name_en: "Bench Press",
    primary_muscles: ["سینه"], secondary_muscles: ["سرشانه", "پشت بازو"], movement_pattern: "horizontal_press",
    equipment: "هالتر", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["شانه", "مچ"],
    joint_stress_flags: ["shoulder_stress", "wrist_stress"], default_rep_range: "4-10", default_rest_range: "90-150 ثانیه",
    progression_type: "load", substitution_list: ["پرس سرشانه", "پشت بازو سیمکش"],
    desc: "آرنج ۴۵ درجه، کنترل در پایین، انفجاری بالا بیار.", gif: "🔥"
  },
  {
    name_fa: "پول‌آپ", name_en: "Pull-Up",
    primary_muscles: ["پشت"], secondary_muscles: ["بازو", "کور"], movement_pattern: "vertical_pull",
    equipment: "میله", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["شانه", "آرنج"],
    joint_stress_flags: ["shoulder_stress"], default_rep_range: "4-10", default_rest_range: "90-150 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["جلو بازو"],
    desc: "از آویزان کامل شروع کن، کتف‌ها را جمع کن، چانه بالای میله.", gif: "⬆️"
  },
  {
    name_fa: "پرس سرشانه", name_en: "Overhead Press",
    primary_muscles: ["سرشانه"], secondary_muscles: ["پشت بازو", "کور"], movement_pattern: "vertical_press",
    equipment: "هالتر", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["شانه", "کمر پایین"],
    joint_stress_flags: ["shoulder_stress"], default_rep_range: "4-8", default_rest_range: "90-150 ثانیه",
    progression_type: "load", substitution_list: ["پرس سینه"],
    desc: "هسته محکم، هالتر را مستقیم بالا ببر، سر جلو نره.", gif: "🎯"
  },
  {
    name_fa: "جلو بازو", name_en: "Dumbbell Curl",
    primary_muscles: ["بازو"], secondary_muscles: [], movement_pattern: "elbow_flexion",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["آرنج", "مچ"],
    joint_stress_flags: ["wrist_stress"], default_rep_range: "8-15", default_rest_range: "45-75 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پول‌آپ"],
    desc: "آرنج ثابت، کامل باز کن، در بالا فشار بده.", gif: "💪"
  },
  {
    name_fa: "پشت بازو سیمکش", name_en: "Cable Pushdown",
    primary_muscles: ["بازو"], secondary_muscles: [], movement_pattern: "elbow_extension",
    equipment: "دستگاه", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["آرنج"],
    joint_stress_flags: ["elbow_stress"], default_rep_range: "10-15", default_rest_range: "45-75 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پرس سینه"],
    desc: "آرنج ثابت کنار بدن، کامل باز کن، کنترل برگرد.", gif: "🎯"
  },
  {
    name_fa: "لانج", name_en: "Lunge",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی", "کور"], movement_pattern: "single_leg",
    equipment: "دمبل", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["زانو", "تعادل"],
    joint_stress_flags: ["knee_stress"], default_rep_range: "8-12", default_rest_range: "60-90 ثانیه",
    progression_type: "reps_then_load", substitution_list: ["پرس پا", "اسکوات"],
    desc: "گام بلند بردار، زانو به زمین نزنه، تنه صاف.", gif: "🦵"
  },
  {
    name_fa: "کرانچ", name_en: "Crunch",
    primary_muscles: ["شکم"], secondary_muscles: [], movement_pattern: "trunk_flexion",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["fat_loss", "hypertrophy", "recomposition"], contraindications: ["گردن"],
    joint_stress_flags: ["neck_stress"], default_rep_range: "12-20", default_rest_range: "30-45 ثانیه",
    progression_type: "reps", substitution_list: ["پلانک"],
    desc: "پشت خم نشه، شکم را سفت کن، آهسته پایین بیا.", gif: "⚡"
  },
  {
    name_fa: "پلانک", name_en: "Plank",
    primary_muscles: ["کور"], secondary_muscles: ["شکم", "سرشانه"], movement_pattern: "anti_extension",
    equipment: "بدون ابزار", difficulty: "مبتدی", complexity: "isolation",
    suitable_goals: ["fat_loss", "recomposition", "strength"], contraindications: ["شانه", "کمر پایین"],
    joint_stress_flags: ["shoulder_stress"], default_rep_range: "20-60 ثانیه", default_rest_range: "30-45 ثانیه",
    progression_type: "time", substitution_list: ["کرانچ"],
    desc: "بدن مثل خط‌کش، باسن بالا نره، نفس بکش.", gif: "🧱"
  },
  {
    name_fa: "رومانیایی", name_en: "Romanian Deadlift",
    primary_muscles: ["پشت ران"], secondary_muscles: ["سرینی", "کمر"], movement_pattern: "hinge",
    equipment: "هالتر", difficulty: "متوسط", complexity: "compound",
    suitable_goals: ["hypertrophy", "strength", "recomposition"], contraindications: ["کمر پایین"],
    joint_stress_flags: ["lower_back_stress"], default_rep_range: "6-10", default_rest_range: "90-150 ثانیه",
    progression_type: "load", substitution_list: ["ددلیفت", "لانج"],
    desc: "زانو کمی خم، لگن را به عقب ببر، کمر صاف بمونه.", gif: "🏆"
  },
  {
    name_fa: "پرس پا", name_en: "Leg Press",
    primary_muscles: ["پا"], secondary_muscles: ["سرینی"], movement_pattern: "squat_pattern",
    equipment: "دستگاه", difficulty: "مبتدی", complexity: "compound",
    suitable_goals: ["hypertrophy", "fat_loss", "recomposition"], contraindications: ["زانو", "کمر پایین"],
    joint_stress_flags: ["knee_stress"], default_rep_range: "8-15", default_rest_range: "75-120 ثانیه",
    progression_type: "load", substitution_list: ["اسکوات", "لانج"],
    desc: "پاها عرض شانه، کمر به تکیه‌گاه، کامل باز نکن.", gif: "🦵"
  },
];

const RAW_PROGRAMS = [
  {
    name: "پایه قدرت — ۳ روز",
    training_level: "beginner",
    goal_key: "strength",
    days: [
      { day: "روز A", exercises: ["اسکوات", "پرس سینه", "پول‌آپ"] },
      { day: "روز B", exercises: ["ددلیفت", "پرس سرشانه", "جلو بازو"] },
      { day: "روز C", exercises: ["لانج", "رومانیایی", "پلانک"] },
    ],
  },
  {
    name: "Push Pull Legs — ۶ روز",
    training_level: "intermediate",
    goal_key: "hypertrophy",
    days: [
      { day: "Push", exercises: ["پرس سینه", "پرس سرشانه", "پشت بازو سیمکش"] },
      { day: "Pull", exercises: ["پول‌آپ", "ددلیفت", "جلو بازو"] },
      { day: "Legs", exercises: ["اسکوات", "پرس پا", "لانج", "رومانیایی"] },
    ],
  },
  {
    name: "فول‌بادی — ۴ روز",
    training_level: "advanced",
    goal_key: "fat_loss",
    days: [
      { day: "روز ۱", exercises: ["اسکوات", "پرس سینه", "پول‌آپ", "پلانک"] },
      { day: "روز ۲", exercises: ["ددلیفت", "پرس سرشانه", "جلو بازو", "کرانچ"] },
      { day: "روز ۳", exercises: ["لانج", "پرس پا", "پشت بازو سیمکش"] },
      { day: "روز ۴", exercises: ["رومانیایی", "پول‌آپ", "پرس سینه", "پلانک"] },
    ],
  },
];

function splitFamilyForProgram(goalKey, dayCount) {
  if (dayCount <= 3) return "full_body";
  if (dayCount === 4) return "upper_lower";
  return goalKey === "strength" ? "strength_split" : "ppl";
}

function setsForComplexity(complexity) {
  return complexity === "compound" ? 4 : 3;
}

async function seedExercises() {
  console.log("Clearing existing Exercise records...");
  await prisma.exercise.deleteMany({});

  const created = {};
  const unmapped = [];

  for (const ex of RAW_EXERCISES) {
    const equipment = equipmentMap[ex.equipment];
    const difficulty = difficultyMap[ex.difficulty];
    const movementPattern = movementPatternMap[ex.movement_pattern];

    if (!equipment) unmapped.push(`equipment: "${ex.equipment}" (${ex.name_fa})`);
    if (!difficulty) unmapped.push(`difficulty: "${ex.difficulty}" (${ex.name_fa})`);
    if (!movementPattern) unmapped.push(`movement_pattern: "${ex.movement_pattern}" (${ex.name_fa})`);

    const repRange = parseRange(ex.default_rep_range);
    const restRange = parseRange(ex.default_rest_range);

    const row = await prisma.exercise.create({
      data: {
        nameFa: ex.name_fa,
        nameEn: ex.name_en || null,
        description: ex.desc || null,
        icon: ex.gif || null,
        primaryMuscles: ex.primary_muscles || [],
        secondaryMuscles: ex.secondary_muscles || [],
        movementPattern: movementPattern || null,
        equipment: equipment || null,
        difficulty: difficulty || null,
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
    created[ex.name_fa] = row;
  }

  console.log(`Inserted ${Object.keys(created).length} exercises.`);
  if (unmapped.length > 0) {
    console.log("UNMAPPED EXERCISE VALUES FOUND:");
    unmapped.forEach((u) => console.log(" - " + u));
  } else {
    console.log("No unmapped exercise values.");
  }

  return created;
}

async function seedPrograms(exerciseByName) {
  console.log("Clearing existing Program records...");
  await prisma.programDayExercise.deleteMany({});
  await prisma.programDay.deleteMany({});
  await prisma.program.deleteMany({});

  const missingRefs = [];
  let programCount = 0;
  let dayCount = 0;
  let dayExerciseCount = 0;

  for (const prog of RAW_PROGRAMS) {
    const splitFamily = splitFamilyForProgram(prog.goal_key, prog.days.length);

    const programRow = await prisma.program.create({
      data: {
        name: prog.name,
        splitFamily,
        goal: prog.goal_key,
        isStatic: true,
      },
    });
    programCount += 1;

    for (let dayIndex = 0; dayIndex < prog.days.length; dayIndex++) {
      const day = prog.days[dayIndex];
      const dayRow = await prisma.programDay.create({
        data: {
          programId: programRow.id,
          dayIndex,
          name: day.day,
        },
      });
      dayCount += 1;

      for (let order = 0; order < day.exercises.length; order++) {
        const exerciseName = day.exercises[order];
        const exerciseRow = exerciseByName[exerciseName];
        if (!exerciseRow) {
          missingRefs.push(`"${exerciseName}" referenced in program "${prog.name}" / day "${day.day}" not found in Exercise table`);
          continue;
        }
        await prisma.programDayExercise.create({
          data: {
            programDayId: dayRow.id,
            exerciseId: exerciseRow.id,
            order,
            sets: setsForComplexity(exerciseRow.complexity),
            repRangeLow: exerciseRow.defaultRepRangeLow ?? 0,
            repRangeHigh: exerciseRow.defaultRepRangeHigh ?? 0,
            restSeconds: exerciseRow.defaultRestSecondsLow ?? 60,
            intensity: null,
            progressionType: exerciseRow.progressionType || null,
          },
        });
        dayExerciseCount += 1;
      }
    }
  }

  console.log(`Inserted ${programCount} programs.`);
  console.log(`Inserted ${dayCount} program days.`);
  console.log(`Inserted ${dayExerciseCount} program day exercises.`);
  if (missingRefs.length > 0) {
    console.log("MISSING EXERCISE REFERENCES FOUND:");
    missingRefs.forEach((m) => console.log(" - " + m));
  } else {
    console.log("No missing exercise references.");
  }
}

async function main() {
  const exerciseByName = await seedExercises();
  await seedPrograms(exerciseByName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
