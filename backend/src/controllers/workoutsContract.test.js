import assert from "node:assert/strict";

import { isValidSetLogWeightKg } from "./workouts.js";

assert.equal(isValidSetLogWeightKg(null), true, "An omitted optional weight remains valid");
assert.equal(isValidSetLogWeightKg(0), true, "Zero weight remains valid");
assert.equal(isValidSetLogWeightKg(42.5), true, "Finite decimal weight remains valid");
assert.equal(isValidSetLogWeightKg(Number.NaN), false, "NaN weight must be rejected");
assert.equal(isValidSetLogWeightKg(Infinity), false, "Infinite weight must be rejected");
assert.equal(isValidSetLogWeightKg(-Infinity), false, "Negative infinite weight must be rejected");
assert.equal(isValidSetLogWeightKg(-1), false, "Negative weight must be rejected");

console.log("Workout set weight contract: 7 passed");
