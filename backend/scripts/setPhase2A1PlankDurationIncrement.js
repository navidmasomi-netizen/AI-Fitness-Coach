import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const plankRows = await prisma.programDayExercise.findMany({
    where: {
      exercise: {
        OR: [{ nameEn: "Plank" }, { nameFa: "پلانک" }],
      },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      programDayId: true,
      exerciseId: true,
      order: true,
      sets: true,
      repRangeLow: true,
      repRangeHigh: true,
      restSeconds: true,
      progressionType: true,
      durationIncrementSeconds: true,
      exercise: {
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
        },
      },
    },
  });

  console.log("FOUND_PLANK_PROGRAM_DAY_EXERCISES");
  console.log(JSON.stringify(plankRows, null, 2));

  if (plankRows.length === 0) {
    throw new Error('No ProgramDayExercise rows found for exercise "Plank" / "پلانک".');
  }

  const rowIds = plankRows.map((row) => row.id);

  const updateResult = await prisma.programDayExercise.updateMany({
    where: {
      id: { in: rowIds },
    },
    data: {
      durationIncrementSeconds: 15,
    },
  });

  console.log("UPDATED_ROW_COUNT");
  console.log(updateResult.count);

  const afterRows = await prisma.programDayExercise.findMany({
    where: {
      id: { in: rowIds },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      programDayId: true,
      exerciseId: true,
      order: true,
      sets: true,
      repRangeLow: true,
      repRangeHigh: true,
      restSeconds: true,
      progressionType: true,
      durationIncrementSeconds: true,
      exercise: {
        select: {
          id: true,
          nameFa: true,
          nameEn: true,
        },
      },
    },
  });

  console.log("PLANK_PROGRAM_DAY_EXERCISES_AFTER_UPDATE");
  console.log(JSON.stringify(afterRows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
