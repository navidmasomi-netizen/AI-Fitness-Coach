import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { DAY_TEMPLATE_MAP, humanizeDayType } from "./dayTemplates.js";
import { buildExplanation } from "./explanationBuilder.js";
import { selectExercise } from "./exerciseSelector.js";
import { resolveSplit } from "./splitResolver.js";
import { resolvePrescription } from "./volumeResolver.js";

function assertProfileCompleted(userId, profile) {
  if (!profile) {
    throw new Error(`User profile not found for user ${userId}.`);
  }

  if (profile.wizardCompleted !== true) {
    throw new Error(`User profile wizard is not completed for user ${userId}.`);
  }
}

function buildConstraintSummary(profile) {
  return `equipmentAccess=${JSON.stringify(profile.equipmentAccess)}, injuryFlags=${JSON.stringify(profile.injuryFlags)}, goal=${profile.goal}, trainingLevel=${profile.trainingLevel}`;
}

function buildPrimaryFailureError({ dayType, movementPattern, profile, reason }) {
  return new Error(
    `Program generation failed for primary slot dayType="${dayType}" movementPattern="${movementPattern}" under constraints ${buildConstraintSummary(profile)}. ${reason}`
  );
}

function buildZeroExerciseDayError({ dayType, profile }) {
  return new Error(
    `Program generation failed because dayType="${dayType}" produced zero exercises after applying accessory omission policy under constraints ${buildConstraintSummary(profile)}.`
  );
}

function buildProgramAlreadyActiveError(userId) {
  return new Error(`Program already active for user ${userId}.`);
}

function isUserProgramUniqueConstraintError(error) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("userId")
  );
}

export function buildProgramPlan({ profile, exercises }) {
  const splitResult = resolveSplit({
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    goal: profile.goal,
    trainingLevel: profile.trainingLevel,
    recoveryQuality: profile.recoveryQuality,
  });

  const diagnostics = [];
  const plannedDays = splitResult.dayTypes.map((dayType, dayIndex) => {
    const template = DAY_TEMPLATE_MAP[dayType];

    if (!template) {
      throw new Error(`No day template found for dayType "${dayType}".`);
    }

    if (dayType === "recovery_or_cardio") {
      return {
        dayIndex,
        dayType,
        name: humanizeDayType(dayType),
        plannedExercises: [],
      };
    }

    const plannedExercises = [];

    for (const slot of template) {
      const selectionResult = selectExercise({
        requiredMovementPattern: slot.movementPattern,
        equipmentAccess: profile.equipmentAccess,
        goal: profile.goal,
        trainingLevel: profile.trainingLevel,
        injuryFlags: profile.injuryFlags,
        exercises,
      });

      if (selectionResult.fallbackLevelUsed === 3 || selectionResult.selectedExercise === null) {
        if (slot.slotType === "accessory") {
          diagnostics.push({
            dayType,
            movementPattern: slot.movementPattern,
            reason: selectionResult.reason,
          });
          continue;
        }

        throw buildPrimaryFailureError({
          dayType,
          movementPattern: slot.movementPattern,
          profile,
          reason: selectionResult.reason,
        });
      }

      const prescription = resolvePrescription({
        goal: profile.goal,
        trainingLevel: profile.trainingLevel,
        recoveryQuality: profile.recoveryQuality,
        sessionDurationMin: profile.sessionDurationMin,
        slotType: slot.slotType,
        exerciseComplexity: selectionResult.selectedExercise.complexity,
      });

      plannedExercises.push({
        order: plannedExercises.length,
        dayType,
        movementPattern: slot.movementPattern,
        slotType: slot.slotType,
        exercise: selectionResult.selectedExercise,
        prescription,
        selectionResult,
      });
    }

    if (plannedExercises.length === 0) {
      throw buildZeroExerciseDayError({ dayType, profile });
    }

    return {
      dayIndex,
      dayType,
      name: humanizeDayType(dayType),
      plannedExercises,
    };
  });

  return {
    splitResult,
    plannedDays,
    diagnostics,
  };
}

export async function persistProgramPlan({
  tx,
  userId,
  splitResult,
  plannedDays,
  description,
  goal,
  equipmentAccess,
  injuryFlags,
  trainingDaysPerWeek,
}) {
  const createdProgram = await tx.program.create({
    data: {
      name: splitResult.splitName,
      description,
      splitFamily: splitResult.splitFamily,
      goal,
      isStatic: false,
    },
  });

  for (const day of plannedDays) {
    const createdDay = await tx.programDay.create({
      data: {
        programId: createdProgram.id,
        dayIndex: day.dayIndex,
        name: day.name,
      },
    });

    for (const plannedExercise of day.plannedExercises) {
      await tx.programDayExercise.create({
        data: {
          programDayId: createdDay.id,
          exerciseId: plannedExercise.exercise.id,
          order: plannedExercise.order,
          sets: plannedExercise.prescription.sets,
          repRangeLow: plannedExercise.prescription.repRangeLow,
          repRangeHigh: plannedExercise.prescription.repRangeHigh,
          restSeconds: plannedExercise.prescription.restSeconds,
          intensity: null,
          progressionType: plannedExercise.exercise.progressionType || null,
        },
      });
    }
  }

  let createdUserProgram;
  try {
    createdUserProgram = await tx.userProgram.create({
      data: {
        userId,
        programId: createdProgram.id,
        currentDayIndex: 0,
      },
    });
  } catch (error) {
    if (isUserProgramUniqueConstraintError(error)) {
      throw buildProgramAlreadyActiveError(userId);
    }
    throw error;
  }

  await tx.userProgramProfileSnapshot.create({
    data: {
      userProgramId: createdUserProgram.id,
      goal,
      equipmentAccess,
      injuryFlags,
      trainingDaysPerWeek,
    },
  });

  return tx.program.findUnique({
    where: { id: createdProgram.id },
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: {
              exercise: true,
            },
          },
        },
      },
      userProgram: true,
    },
  });
}

export async function generateProgramForUser(userId) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  assertProfileCompleted(userId, profile);

  const existingUserProgram = await prisma.userProgram.findUnique({
    where: { userId },
  });

  if (existingUserProgram) {
    throw buildProgramAlreadyActiveError(userId);
  }

  const exercises = await prisma.exercise.findMany({
    orderBy: { id: "asc" },
  });

  const { splitResult, plannedDays, diagnostics } = buildProgramPlan({
    profile,
    exercises,
  });

  const description = buildExplanation({
    splitResult,
    profile,
    diagnostics,
  });

  return prisma.$transaction(async (tx) =>
    persistProgramPlan({
      tx,
      userId,
      splitResult,
      plannedDays,
      description,
      goal: profile.goal,
      equipmentAccess: profile.equipmentAccess,
      injuryFlags: profile.injuryFlags,
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
    })
  );
}
