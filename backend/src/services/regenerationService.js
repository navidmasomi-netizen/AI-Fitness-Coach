import prisma from "../lib/prisma.js";
import { buildExplanation } from "./explanationBuilder.js";
import {
  assertProfileCompleted,
  buildProgramPlan,
  isUserProgramUniqueConstraintError,
  persistProgramPlan,
} from "./programGenerator.js";

function buildNoActiveProgramToRegenerateError(userId) {
  return new Error(`No active program to regenerate for user ${userId}.`);
}

function buildWorkoutSessionInProgressError() {
  return new Error("Cannot regenerate while a workout session is in progress.");
}

function buildRegenerationAlreadyInProgressError(userId) {
  return new Error(`Program regeneration already in progress for user ${userId}.`);
}

async function persistRegeneratedProgram({
  userId,
  activeUserProgramId,
  profile,
  splitResult,
  plannedDays,
  description,
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.userProgram.update({
        where: { id: activeUserProgramId },
        data: { isActive: false },
      });

      return persistProgramPlan({
        tx,
        userId,
        splitResult,
        plannedDays,
        description,
        goal: profile.goal,
        equipmentAccess: profile.equipmentAccess,
        injuryFlags: profile.injuryFlags,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
      });
    });
  } catch (error) {
    if (isUserProgramUniqueConstraintError(error)) {
      throw buildRegenerationAlreadyInProgressError(userId);
    }
    throw error;
  }
}

export async function __persistRegeneratedProgramForTests({
  userId,
  activeUserProgramId,
  profile,
  splitResult,
  plannedDays,
  description,
}) {
  return persistRegeneratedProgram({
    userId,
    activeUserProgramId,
    profile,
    splitResult,
    plannedDays,
    description,
  });
}

export async function regenerateProgramForUser(userId) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  assertProfileCompleted(userId, profile);

  const activeUserProgram = await prisma.userProgram.findFirst({
    where: { userId, isActive: true },
  });

  if (!activeUserProgram) {
    throw buildNoActiveProgramToRegenerateError(userId);
  }

  const activeWorkoutSession = await prisma.workoutSession.findFirst({
    where: {
      userId,
      programId: activeUserProgram.programId,
      status: "active",
    },
  });

  if (activeWorkoutSession) {
    throw buildWorkoutSessionInProgressError();
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

  return persistRegeneratedProgram({
    userId,
    activeUserProgramId: activeUserProgram.id,
    profile,
    splitResult,
    plannedDays,
    description,
  });
}
