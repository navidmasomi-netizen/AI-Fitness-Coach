import { deriveHistoricalTrainingSignals } from "./historicalTrainingSignals.js";
import { createTrainingStateSignals } from "./trainingStateSignals.js";

export function aggregateTrainingStateSignals({ historicalTrainingSignals }) {
  return createTrainingStateSignals({
    fatigue: {
      historicalTrainingSignals,
    },
  });
}

export function deriveTrainingStateSignalsFromExposures(exposures) {
  return aggregateTrainingStateSignals({
    historicalTrainingSignals: deriveHistoricalTrainingSignals(exposures),
  });
}
