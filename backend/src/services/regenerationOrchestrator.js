const PROGRAM_AGE_TRIGGER_DAYS = 56;

function arraysEqualAsSets(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function getUrgencyRank(urgency) {
  if (urgency === "high") return 3;
  if (urgency === "moderate") return 2;
  if (urgency === "low") return 1;
  return 0;
}

function pickHigherUrgency(currentUrgency, nextUrgency) {
  return getUrgencyRank(nextUrgency) > getUrgencyRank(currentUrgency)
    ? nextUrgency
    : currentUrgency;
}

export function isStagnationSession(session) {
  const totalRecommendations = session.progressionRecommendations.length;
  if (totalRecommendations === 0) {
    return {
      sessionId: session.sessionId,
      totalRecommendations,
      stagnantRecommendations: 0,
      isStagnationSession: false,
      detail:
        "Session has zero progression recommendations, so it cannot be marked as stagnation.",
    };
  }

  const stagnantRecommendations = session.progressionRecommendations.filter(
    (recommendation) =>
      recommendation.recommendationType === "maintain" ||
      recommendation.recommendationType === "deload"
  ).length;

  return {
    sessionId: session.sessionId,
    totalRecommendations,
    stagnantRecommendations,
    isStagnationSession: stagnantRecommendations / totalRecommendations > 0.5,
    detail:
      `${stagnantRecommendations} of ${totalRecommendations} recommendations were maintain/deload.`,
  };
}

export function evaluateSustainedProgressionStagnation(recentCompletedSessions) {
  const sessionCount = recentCompletedSessions.length;
  const sessionEvaluations = recentCompletedSessions
    .slice(0, 3)
    .map((session) => isStagnationSession(session));

  if (sessionCount < 3) {
    return {
      evaluable: false,
      triggered: false,
      sessionEvaluations,
      detail:
        `Only ${sessionCount} completed session(s) were available; 3 are required for sustained stagnation.`,
    };
  }

  return {
    evaluable: true,
    triggered: sessionEvaluations.every((session) => session.isStagnationSession),
    sessionEvaluations,
    detail:
      sessionEvaluations.every((session) => session.isStagnationSession)
        ? "All 3 most recent completed sessions met the stagnation threshold."
        : "At least one of the 3 most recent completed sessions did not meet the stagnation threshold.",
  };
}

export function evaluateGoalDrift({ currentProgram, userProfile }) {
  const programGoal = currentProgram?.goal ?? null;
  const userGoal = userProfile?.goal ?? null;
  const drifted = programGoal !== null && userGoal !== null && programGoal !== userGoal;

  return {
    evaluable: programGoal !== null && userGoal !== null,
    drifted,
    detail: drifted
      ? `Program goal is "${programGoal}" while current user goal is "${userGoal}".`
      : `Program goal and current user goal both resolve to "${programGoal}".`,
  };
}

export function evaluateTrainingDaysPerWeekDrift({
  programProfileSnapshot,
  userProfile,
}) {
  const snapshotTrainingDays = programProfileSnapshot?.trainingDaysPerWeek;
  const currentTrainingDays = userProfile?.trainingDaysPerWeek;

  if (
    snapshotTrainingDays === undefined ||
    snapshotTrainingDays === null ||
    currentTrainingDays === undefined ||
    currentTrainingDays === null
  ) {
    return {
      evaluable: false,
      drifted: false,
      detail: "trainingDaysPerWeek drift is not evaluable because snapshot data is unavailable.",
    };
  }

  return {
    evaluable: true,
    drifted: snapshotTrainingDays !== currentTrainingDays,
    detail:
      snapshotTrainingDays !== currentTrainingDays
        ? `Program snapshot trainingDaysPerWeek=${snapshotTrainingDays} while current user trainingDaysPerWeek=${currentTrainingDays}.`
        : `Program snapshot and current user trainingDaysPerWeek both equal ${currentTrainingDays}.`,
  };
}

export function evaluateEquipmentAccessDrift({
  programProfileSnapshot,
  userProfile,
}) {
  const snapshotEquipmentAccess = programProfileSnapshot?.equipmentAccess;
  const currentEquipmentAccess = userProfile?.equipmentAccess;

  if (!Array.isArray(snapshotEquipmentAccess) || !Array.isArray(currentEquipmentAccess)) {
    return {
      evaluable: false,
      drifted: false,
      detail: "equipmentAccess drift is not evaluable because snapshot data is unavailable.",
    };
  }

  return {
    evaluable: true,
    drifted: !arraysEqualAsSets(snapshotEquipmentAccess, currentEquipmentAccess),
    detail: "equipmentAccess drift comparison is available for future activation.",
  };
}

export function evaluateInjuryFlagsDrift({
  programProfileSnapshot,
  userProfile,
}) {
  const snapshotInjuryFlags = programProfileSnapshot?.injuryFlags;
  const currentInjuryFlags = userProfile?.injuryFlags;

  if (!Array.isArray(snapshotInjuryFlags) || !Array.isArray(currentInjuryFlags)) {
    return {
      evaluable: false,
      drifted: false,
      detail: "injuryFlags drift is not evaluable because snapshot data is unavailable.",
    };
  }

  return {
    evaluable: true,
    drifted: !arraysEqualAsSets(snapshotInjuryFlags, currentInjuryFlags),
    detail: "injuryFlags drift comparison is available for future activation.",
  };
}

export function evaluateProgramAge(userProgram, now = new Date()) {
  if (!userProgram?.activatedAt) {
    return {
      evaluable: false,
      triggered: false,
      ageDays: null,
      detail: "Program age is not evaluable because there is no active user program.",
    };
  }

  const ageDays = Math.floor(
    (now.getTime() - new Date(userProgram.activatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    evaluable: true,
    triggered: ageDays >= PROGRAM_AGE_TRIGGER_DAYS,
    ageDays,
    detail:
      ageDays >= PROGRAM_AGE_TRIGGER_DAYS
        ? `Program has been active for ${ageDays} days.`
        : `Program has been active for ${ageDays} days, below the 56-day threshold.`,
  };
}

export function buildRegenerationTrace({
  recentCompletedSessions,
  sustainedProgression,
  goalDrift,
  trainingDaysDrift,
  equipmentAccessDrift,
  injuryFlagsDrift,
  recoveryModifier,
  programAge,
}) {
  const because = [`recent_completed_sessions_count:${recentCompletedSessions.length}`];

  for (const sessionEvaluation of sustainedProgression.sessionEvaluations) {
    because.push(
      `session_${sessionEvaluation.sessionId}_stagnation:${sessionEvaluation.stagnantRecommendations}/${sessionEvaluation.totalRecommendations}:${sessionEvaluation.isStagnationSession}`
    );
  }

  because.push(
    `sustained_progression_stagnation:${sustainedProgression.triggered}`
  );
  because.push(`goal_drift:${goalDrift.drifted}`);
  because.push(
    trainingDaysDrift.evaluable
      ? `training_days_per_week_drift:${trainingDaysDrift.drifted}`
      : "training_days_per_week_drift:not_evaluable:insufficient_snapshot_data"
  );
  because.push(
    equipmentAccessDrift.evaluable
      ? `equipment_access_drift:${equipmentAccessDrift.drifted}`
      : "equipment_access_drift:not_evaluable:insufficient_snapshot_data"
  );
  because.push(
    injuryFlagsDrift.evaluable
      ? `injury_flags_drift:${injuryFlagsDrift.drifted}`
      : "injury_flags_drift:not_evaluable:insufficient_snapshot_data"
  );
  because.push(`recovery_modifier:${recoveryModifier}`);
  because.push(
    programAge.ageDays === null
      ? "program_age_days:not_evaluable:no_active_user_program"
      : `program_age_days:${programAge.ageDays}`
  );

  return { because };
}

export function evaluateRegenerationEligibility({
  recentCompletedSessions,
  recoveryModifier,
  currentProgram,
  userProgram,
  userProfile,
  programProfileSnapshot,
}) {
  const triggeringFactors = [];
  const reasons = [];
  let urgency = "none";

  const sustainedProgression = evaluateSustainedProgressionStagnation(
    recentCompletedSessions
  );
  const goalDrift = evaluateGoalDrift({ currentProgram, userProfile });
  const trainingDaysDrift = evaluateTrainingDaysPerWeekDrift({
    programProfileSnapshot,
    userProfile,
  });
  const equipmentAccessDrift = evaluateEquipmentAccessDrift({
    programProfileSnapshot,
    userProfile,
  });
  const injuryFlagsDrift = evaluateInjuryFlagsDrift({
    programProfileSnapshot,
    userProfile,
  });
  const latestRecoveryModifier = recoveryModifier?.recoveryModifier ?? "neutral";
  const programAge = evaluateProgramAge(userProgram);

  if (goalDrift.drifted) {
    triggeringFactors.push({
      factor: "profile_drift_goal",
      detail: goalDrift.detail,
    });
    reasons.push("Your current goal differs from the goal your current program was built around.");
    urgency = pickHigherUrgency(urgency, "moderate");
  }

  if (trainingDaysDrift.evaluable && trainingDaysDrift.drifted) {
    triggeringFactors.push({
      factor: "profile_drift_training_days_per_week",
      detail: trainingDaysDrift.detail,
    });
    reasons.push("Your current training frequency differs from the training frequency your current program was built around.");
    urgency = pickHigherUrgency(urgency, "moderate");
  }

  if (sustainedProgression.triggered) {
    triggeringFactors.push({
      factor: "sustained_progression_stagnation",
      detail: sustainedProgression.detail,
    });
    reasons.push("The last 3 completed sessions all showed a majority of maintain/deload outcomes.");
    urgency = pickHigherUrgency(urgency, "moderate");
  }

  if (latestRecoveryModifier === "caution") {
    triggeringFactors.push({
      factor: "recovery_caution",
      detail:
        "Latest recovery evaluation returned caution. This is treated as a single low-weight behavioral signal because no recovery history is persisted.",
    });
    reasons.push("Your latest behavioral recovery signal was caution.");
    urgency = pickHigherUrgency(urgency, "low");
  }

  if (programAge.triggered) {
    triggeringFactors.push({
      factor: "program_age",
      detail: programAge.detail,
    });
    reasons.push("Your current program has been active for at least 8 weeks.");
    urgency = pickHigherUrgency(urgency, "low");
  }

  return {
    regenerationRecommended: triggeringFactors.length > 0,
    urgency,
    reasons,
    triggeringFactors,
    trace: buildRegenerationTrace({
      recentCompletedSessions,
      sustainedProgression,
      goalDrift,
      trainingDaysDrift,
      equipmentAccessDrift,
      injuryFlagsDrift,
      recoveryModifier: latestRecoveryModifier,
      programAge,
    }),
  };
}
