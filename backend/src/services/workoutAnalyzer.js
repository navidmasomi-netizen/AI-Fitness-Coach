import prisma from "../lib/prisma.js";

const COMPLETED_SESSION_STATUS = "completed";
const PERFORMANCE_TREND_WINDOW = 3;
const RECENT_SETS_LIMIT = 5;
const MISSED_SESSION_GAP_LIMIT = 5;

/**
 * @typedef {Object} NormalizedHistorySession
 * @property {number} id
 * @property {Date} startedAt
 * @property {Date | null} completedAt
 * @property {string} status
 */

/**
 * @typedef {Object} NormalizedHistorySetLog
 * @property {number} sessionId
 * @property {number} exerciseId
 * @property {string} exerciseName
 * @property {string | null} movementPattern
 * @property {Date} date
 * @property {number | null} weightKg
 * @property {number} reps
 */

/**
 * @typedef {Object} NormalizedHistoryPrescribedExercise
 * @property {number} exerciseId
 * @property {string} exerciseName
 * @property {string | null} movementPattern
 * @property {string} dayType
 * @property {number | null} repRangeHigh
 */

/**
 * @typedef {Object} NormalizedHistory
 * @property {NormalizedHistorySession[]} sessions
 * @property {NormalizedHistorySetLog[]} setLogs
 * @property {NormalizedHistoryPrescribedExercise[]} prescribedExercises
 * @property {number} programDayCount
 * @property {boolean} hasActiveProgram
 * @property {number} activeDaysInWindow
 * @property {number} weeksInWindow
 * @property {Date} windowStart
 * @property {Date} windowEnd
 */

function getExerciseName(exerciseName, exerciseId) {
  return exerciseName || `Exercise ${exerciseId}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function daysBetween(laterDate, earlierDate) {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return (laterDate.getTime() - earlierDate.getTime()) / millisecondsPerDay;
}

function getWindowBounds(windowDays) {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - windowDays);
  return { windowStart, windowEnd };
}

function getWeeksInWindow(windowDays) {
  return Math.ceil(windowDays / 7);
}

function getActiveDaysInWindow({ activatedAt, windowStart, windowEnd, windowDays }) {
  if (!activatedAt) {
    return windowDays;
  }

  const daysSinceActivation = daysBetween(windowEnd, activatedAt);
  const clampedDaysActive = clamp(daysSinceActivation, 0, windowDays);
  const daysActiveInsideWindow = activatedAt > windowStart
    ? clampedDaysActive
    : windowDays;

  return daysActiveInsideWindow < 1 ? 0 : daysActiveInsideWindow;
}

export async function fetchRawHistory({ userId, windowStart, windowEnd }) {
  const activeProgram = await prisma.userProgram.findUnique({
    where: { userId },
    include: {
      program: {
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
        },
      },
    },
  });

  const completedSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: COMPLETED_SESSION_STATUS,
      startedAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    orderBy: [
      { startedAt: "asc" },
      { id: "asc" },
    ],
    include: {
      setLogs: {
        orderBy: [
          { loggedAt: "asc" },
          { setNumber: "asc" },
          { id: "asc" },
        ],
        include: {
          exercise: true,
        },
      },
    },
  });

  return {
    activeProgram,
    sessions: completedSessions,
  };
}

export function normalizeHistory(rawHistory, { windowStart, windowEnd, windowDays }) {
  const hasActiveProgram = !!rawHistory.activeProgram;
  const programDays = rawHistory.activeProgram?.program?.days || [];
  const activeDaysInWindow = hasActiveProgram
    ? getActiveDaysInWindow({
        activatedAt: rawHistory.activeProgram?.activatedAt ?? null,
        windowStart,
        windowEnd,
        windowDays,
      })
    : 0;

  const sessions = rawHistory.sessions.map((session) => ({
    id: session.id,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    status: session.status,
  }));

  const setLogs = rawHistory.sessions.flatMap((session) =>
    session.setLogs.map((setLog) => ({
      sessionId: session.id,
      exerciseId: setLog.exerciseId,
      exerciseName: getExerciseName(setLog.exercise?.nameEn, setLog.exerciseId),
      movementPattern: setLog.exercise?.movementPattern || null,
      date: setLog.loggedAt,
      weightKg: setLog.weightKg,
      reps: setLog.reps,
    }))
  );

  const prescribedExercises = programDays.flatMap((programDay) =>
    programDay.exercises.map((programDayExercise) => ({
      exerciseId: programDayExercise.exerciseId,
      exerciseName: getExerciseName(
        programDayExercise.exercise?.nameEn,
        programDayExercise.exerciseId
      ),
      movementPattern: programDayExercise.exercise?.movementPattern || null,
      dayType: programDay.name,
      repRangeHigh: programDayExercise.repRangeHigh ?? null,
    }))
  );

  return {
    sessions,
    setLogs,
    prescribedExercises,
    programDayCount: programDays.length,
    hasActiveProgram,
    activeDaysInWindow,
    weeksInWindow: getWeeksInWindow(windowDays),
    windowStart,
    windowEnd,
  };
}

function buildSessionSnapshotsForExercise(setLogs) {
  const sessionMap = new Map();

  for (const setLog of setLogs) {
    const existing = sessionMap.get(setLog.sessionId);
    if (!existing) {
      sessionMap.set(setLog.sessionId, {
        sessionId: setLog.sessionId,
        date: setLog.date,
        topWeightKg: setLog.weightKg,
        topRepsAtTopWeight: setLog.reps,
      });
      continue;
    }

    if (
      setLog.weightKg !== null &&
      (existing.topWeightKg === null || setLog.weightKg > existing.topWeightKg)
    ) {
      existing.topWeightKg = setLog.weightKg;
      existing.topRepsAtTopWeight = setLog.reps;
      existing.date = setLog.date > existing.date ? setLog.date : existing.date;
      continue;
    }

    if (setLog.weightKg === existing.topWeightKg && setLog.reps > existing.topRepsAtTopWeight) {
      existing.topRepsAtTopWeight = setLog.reps;
    }

    if (setLog.date > existing.date) {
      existing.date = setLog.date;
    }
  }

  return Array.from(sessionMap.values()).sort((left, right) => {
    return right.date.getTime() - left.date.getTime() || right.sessionId - left.sessionId;
  });
}

/**
 * Performance trend rules:
 * - Compare the most recent N=3 logged sessions for an exercise.
 * - If fewer than 3 sessions exist, return insufficient_data / confidence 0 / insufficient_sessions.
 * - Weight change takes precedence over rep change whenever both signals are present.
 * - increasing / weight_increase:
 *   at least one upward weight change across the compared sessions, no downward weight change,
 *   and every compared session is at or above the prescribed high rep target when one exists.
 * - increasing / rep_increase:
 *   weight stays flat across the compared sessions, reps rise at least once without any rep drop,
 *   and the most recent compared session reaches or exceeds the prescribed high rep target when one exists.
 * - decreasing / weight_drop:
 *   at least one downward weight change across the compared sessions, regardless of rep change.
 * - decreasing / rep_drop:
 *   weight stays flat across the compared sessions, and reps drop at least once without any rep rise.
 * - flat / stable_load:
 *   none of the above rules match.
 * - confidence = min(1, sessionsUsed / N), which is 1 whenever a classified trend is returned.
 */
export function computePerformanceTrend({ sessionSnapshots, prescribedRepRangeHigh }) {
  const comparedSessions = sessionSnapshots
    .slice(0, PERFORMANCE_TREND_WINDOW)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (comparedSessions.length < PERFORMANCE_TREND_WINDOW) {
    return {
      direction: "insufficient_data",
      confidence: 0,
      reason: "insufficient_sessions",
    };
  }

  let hasWeightIncrease = false;
  let hasWeightDrop = false;
  let hasRepIncrease = false;
  let hasRepDrop = false;

  for (let index = 1; index < comparedSessions.length; index += 1) {
    const previous = comparedSessions[index - 1];
    const current = comparedSessions[index];

    const previousWeight = previous.topWeightKg;
    const currentWeight = current.topWeightKg;

    if (previousWeight !== null && currentWeight !== null) {
      if (currentWeight > previousWeight) hasWeightIncrease = true;
      if (currentWeight < previousWeight) hasWeightDrop = true;
    }

    if (currentWeight === previousWeight) {
      if (current.topRepsAtTopWeight > previous.topRepsAtTopWeight) hasRepIncrease = true;
      if (current.topRepsAtTopWeight < previous.topRepsAtTopWeight) hasRepDrop = true;
    }
  }

  const allSessionsMeetRepTarget =
    prescribedRepRangeHigh === null ||
    comparedSessions.every(
      (sessionSnapshot) => sessionSnapshot.topRepsAtTopWeight >= prescribedRepRangeHigh
    );

  const latestSession = comparedSessions[comparedSessions.length - 1];
  const latestMeetsRepTarget =
    prescribedRepRangeHigh === null ||
    latestSession.topRepsAtTopWeight >= prescribedRepRangeHigh;

  if (hasWeightIncrease && !hasWeightDrop && allSessionsMeetRepTarget) {
    return {
      direction: "increasing",
      confidence: clamp(comparedSessions.length / PERFORMANCE_TREND_WINDOW, 0, 1),
      reason: "weight_increase",
    };
  }

  if (hasWeightDrop) {
    return {
      direction: "decreasing",
      confidence: clamp(comparedSessions.length / PERFORMANCE_TREND_WINDOW, 0, 1),
      reason: "weight_drop",
    };
  }

  if (hasRepIncrease && !hasRepDrop && latestMeetsRepTarget) {
    return {
      direction: "increasing",
      confidence: clamp(comparedSessions.length / PERFORMANCE_TREND_WINDOW, 0, 1),
      reason: "rep_increase",
    };
  }

  if (hasRepDrop && !hasRepIncrease) {
    return {
      direction: "decreasing",
      confidence: clamp(comparedSessions.length / PERFORMANCE_TREND_WINDOW, 0, 1),
      reason: "rep_drop",
    };
  }

  return {
    direction: "flat",
    confidence: clamp(comparedSessions.length / PERFORMANCE_TREND_WINDOW, 0, 1),
    reason: "stable_load",
  };
}

export function computeExerciseSummaries(normalizedHistory) {
  const prescribedByExerciseId = new Map();
  const loggedByExerciseId = new Map();

  for (const prescribedExercise of normalizedHistory.prescribedExercises) {
    const existing = prescribedByExerciseId.get(prescribedExercise.exerciseId) || {
      exerciseId: prescribedExercise.exerciseId,
      exerciseName: prescribedExercise.exerciseName,
      movementPattern: prescribedExercise.movementPattern,
      prescribedSlotsPerWeek: 0,
      repRangeHigh: prescribedExercise.repRangeHigh,
    };

    existing.prescribedSlotsPerWeek += 1;

    if (existing.repRangeHigh === null && prescribedExercise.repRangeHigh !== null) {
      existing.repRangeHigh = prescribedExercise.repRangeHigh;
    }

    prescribedByExerciseId.set(prescribedExercise.exerciseId, existing);
  }

  for (const setLog of normalizedHistory.setLogs) {
    const existing = loggedByExerciseId.get(setLog.exerciseId) || {
      exerciseId: setLog.exerciseId,
      exerciseName: setLog.exerciseName,
      movementPattern: setLog.movementPattern,
      setLogs: [],
    };
    existing.setLogs.push(setLog);
    loggedByExerciseId.set(setLog.exerciseId, existing);
  }

  const exerciseIds = Array.from(
    new Set([...prescribedByExerciseId.keys(), ...loggedByExerciseId.keys()])
  ).sort((left, right) => left - right);

  return exerciseIds.map((exerciseId) => {
    const prescribed = prescribedByExerciseId.get(exerciseId) || null;
    const logged = loggedByExerciseId.get(exerciseId) || {
      exerciseId,
      exerciseName: prescribed?.exerciseName || getExerciseName(null, exerciseId),
      movementPattern: prescribed?.movementPattern || null,
      setLogs: [],
    };

    const sessionIds = new Set(logged.setLogs.map((setLog) => setLog.sessionId));
    const timesLogged = sessionIds.size;
    const timesPrescribed = prescribed
      ? prescribed.prescribedSlotsPerWeek * normalizedHistory.weeksInWindow
      : 0;

    const recentSets = logged.setLogs
      .slice()
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, RECENT_SETS_LIMIT)
      .map((setLog) => ({
        date: setLog.date,
        weightKg: setLog.weightKg,
        reps: setLog.reps,
      }));

    const sessionSnapshots = buildSessionSnapshotsForExercise(logged.setLogs);
    const performanceTrend = computePerformanceTrend({
      sessionSnapshots,
      prescribedRepRangeHigh: prescribed?.repRangeHigh ?? null,
    });

    const mostRecentSetLog = logged.setLogs
      .slice()
      .sort((left, right) => right.date.getTime() - left.date.getTime())[0];

    return {
      exerciseId,
      exerciseName: prescribed?.exerciseName || logged.exerciseName,
      movementPattern: prescribed?.movementPattern || logged.movementPattern,
      timesPrescribed,
      timesLogged,
      adherenceRate: timesPrescribed === 0 ? null : timesLogged / timesPrescribed,
      performanceTrend,
      lastLoggedAt: mostRecentSetLog ? mostRecentSetLog.date : null,
      recentSets,
    };
  });
}

export function computePatternSummaries(normalizedHistory) {
  const prescribedCounts = new Map();
  const loggedCounts = new Map();

  for (const prescribedExercise of normalizedHistory.prescribedExercises) {
    if (!prescribedExercise.movementPattern) continue;
    prescribedCounts.set(
      prescribedExercise.movementPattern,
      (prescribedCounts.get(prescribedExercise.movementPattern) || 0) + 1
    );
  }

  for (const setLog of normalizedHistory.setLogs) {
    if (!setLog.movementPattern) continue;
    const patternSessionKey = `${setLog.movementPattern}:${setLog.sessionId}`;
    if (!loggedCounts.has(patternSessionKey)) {
      loggedCounts.set(patternSessionKey, setLog.movementPattern);
    }
  }

  const loggedByPattern = new Map();
  for (const movementPattern of loggedCounts.values()) {
    loggedByPattern.set(movementPattern, (loggedByPattern.get(movementPattern) || 0) + 1);
  }

  const patternKeys = Array.from(
    new Set([...prescribedCounts.keys(), ...loggedByPattern.keys()])
  ).sort();

  return patternKeys.map((movementPattern) => {
    const prescribedPerWeek = prescribedCounts.get(movementPattern) || 0;
    const totalPrescribed = prescribedPerWeek * normalizedHistory.weeksInWindow;
    const totalLogged = loggedByPattern.get(movementPattern) || 0;

    return {
      movementPattern,
      adherenceRate: totalPrescribed === 0 ? null : totalLogged / totalPrescribed,
      consistencyScore:
        totalPrescribed === 0 ? 0 : clamp(totalLogged / totalPrescribed, 0, 1),
    };
  });
}

export function computeSessionConsistency(normalizedHistory) {
  const activeDaysInWindow =
    normalizedHistory.activeDaysInWindow ?? normalizedHistory.weeksInWindow * 7;
  const scheduledSessions = normalizedHistory.hasActiveProgram
    ? activeDaysInWindow < 1
      ? 0
      : normalizedHistory.programDayCount * Math.ceil(activeDaysInWindow / 7)
    : 0;

  const completedSessions = normalizedHistory.sessions.length;
  const completionRate =
    scheduledSessions === 0 ? null : completedSessions / scheduledSessions;

  const missedSessionGaps = [];

  if (normalizedHistory.hasActiveProgram && normalizedHistory.programDayCount > 0) {
    const expectedCadenceDays = 7 / normalizedHistory.programDayCount;
    const orderedSessions = normalizedHistory.sessions
      .slice()
      .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());

    for (let index = 1; index < orderedSessions.length; index += 1) {
      const previous = orderedSessions[index - 1];
      const current = orderedSessions[index];
      const actualGapDays = roundToTwo(daysBetween(current.startedAt, previous.startedAt));
      if (actualGapDays <= expectedCadenceDays) continue;

      const expectedDate = new Date(previous.startedAt);
      expectedDate.setTime(
        expectedDate.getTime() + expectedCadenceDays * 24 * 60 * 60 * 1000
      );

      missedSessionGaps.push({
        expectedDate,
        actualGapDays,
      });
    }
  }

  missedSessionGaps.sort((left, right) => {
    return right.actualGapDays - left.actualGapDays || right.expectedDate - left.expectedDate;
  });

  return {
    scheduledSessions,
    completedSessions,
    completionRate,
    missedSessionGaps: missedSessionGaps.slice(0, MISSED_SESSION_GAP_LIMIT),
  };
}

export async function analyzeWorkoutHistory({ userId, windowDays = 28 }) {
  const { windowStart, windowEnd } = getWindowBounds(windowDays);
  const rawHistory = await fetchRawHistory({ userId, windowStart, windowEnd });
  const normalizedHistory = normalizeHistory(rawHistory, { windowStart, windowEnd, windowDays });
  const exerciseSummaries = computeExerciseSummaries(normalizedHistory);
  const patternSummaries = computePatternSummaries(normalizedHistory);
  const sessionConsistency = computeSessionConsistency(normalizedHistory);

  return {
    userId,
    windowStart,
    windowEnd,
    hasActiveProgram: normalizedHistory.hasActiveProgram,
    exerciseSummaries,
    patternSummaries,
    sessionConsistency,
  };
}
