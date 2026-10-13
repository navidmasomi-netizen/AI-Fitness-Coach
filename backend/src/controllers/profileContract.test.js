import assert from "node:assert/strict";

import { buildPatchData, buildProfileCreateData, validateProfileBounds } from "./profile.js";

function assertEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

async function main() {
  assertEqual(
    buildPatchData({ supplementOther: "Creatine", ignoredField: "ignored" }),
    { supplementOther: "Creatine" },
    "Profile patches should retain supplementOther and ignore unrelated fields"
  );
  assertEqual(
    buildPatchData({ supplementOther: null }),
    { supplementOther: null },
    "Profile patches should preserve the optional null value"
  );
  assertEqual(
    validateProfileBounds({ supplementOther: "Creatine" }),
    null,
    "A string other-supplement value should be accepted"
  );
  assertEqual(
    validateProfileBounds({ supplementOther: null }),
    null,
    "A null other-supplement value should be accepted"
  );
  assertEqual(
    validateProfileBounds({ supplementOther: ["Creatine"] }),
    "supplementOther must be a string or null",
    "Invalid other-supplement values should be rejected"
  );
  assertEqual(
    buildProfileCreateData(42, {}),
    {
      userId: 42,
      goal: "",
      trainingLevel: "",
      trainingDaysPerWeek: 0,
      sessionDurationMin: 0,
      equipmentAccess: [],
      age: 0,
      sex: "",
      heightCm: 0,
      weightKg: 0,
      occupationType: "",
      recoveryQuality: "",
      nutritionHabits: "",
      mealFrequency: 0,
      supplementUse: [],
      supplementOther: null,
      cardioPreference: "",
      injuryFlags: [],
      injuryNotes: null,
      preferredLanguage: "en",
      timezone: "UTC",
      units: "metric",
      lastCompletedStep: 0,
    },
    "New profiles should default supplementOther to null"
  );

  console.log("Profile supplementOther contract: 6 passed");
}

void main();
