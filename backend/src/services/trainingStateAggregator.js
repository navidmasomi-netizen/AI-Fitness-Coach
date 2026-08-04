import { deriveHistoricalTrainingSignals } from "./historicalTrainingSignals.js";
import { createTrainingStateSignals } from "./trainingStateSignals.js";

export function aggregateTrainingStateSignals({ historicalTrainingSignals, deloadHistory }) {
  return createTrainingStateSignals({
    fatigue: {
      historicalTrainingSignals,
    },
    ...(deloadHistory !== undefined
      ? {
          adaptation: {
            deloadHistory,
          },
        }
      : {}),
  });
}

export function deriveTrainingStateSignalsFromExposures(exposures, { deloadHistory } = {}) {
  return aggregateTrainingStateSignals({
    historicalTrainingSignals: deriveHistoricalTrainingSignals(exposures),
    deloadHistory,
  });
}
