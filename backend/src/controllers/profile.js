import prisma from "../lib/prisma.js";

const editableFields = [
  "goal",
  "trainingLevel",
  "trainingDaysPerWeek",
  "sessionDurationMin",
  "equipmentAccess",
  "age",
  "sex",
  "heightCm",
  "weightKg",
  "occupationType",
  "recoveryQuality",
  "nutritionHabits",
  "mealFrequency",
  "supplementUse",
  "cardioPreference",
  "injuryFlags",
  "injuryNotes",
  "preferredLanguage",
  "timezone",
  "units",
  "lastCompletedStep",
];

const requiredFields = [
  "goal",
  "trainingLevel",
  "trainingDaysPerWeek",
  "sessionDurationMin",
  "equipmentAccess",
  "age",
  "sex",
  "heightCm",
  "weightKg",
  "occupationType",
  "recoveryQuality",
  "nutritionHabits",
  "mealFrequency",
  "supplementUse",
  "cardioPreference",
  "injuryFlags",
  "preferredLanguage",
  "timezone",
  "units",
];

function validateProfileBounds(body) {
  if (Object.prototype.hasOwnProperty.call(body, "age")) {
    if (!Number.isInteger(body.age) || body.age < 13 || body.age > 100) {
      return "age must be an integer between 13 and 100";
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "trainingDaysPerWeek")) {
    if (
      !Number.isInteger(body.trainingDaysPerWeek) ||
      body.trainingDaysPerWeek < 1 ||
      body.trainingDaysPerWeek > 7
    ) {
      return "trainingDaysPerWeek must be an integer between 1 and 7";
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "sessionDurationMin")) {
    if (
      !Number.isInteger(body.sessionDurationMin) ||
      body.sessionDurationMin < 10 ||
      body.sessionDurationMin > 240
    ) {
      return "sessionDurationMin must be an integer between 10 and 240";
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "heightCm")) {
    if (typeof body.heightCm !== "number" || body.heightCm < 100 || body.heightCm > 250) {
      return "heightCm must be a number between 100 and 250";
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "weightKg")) {
    if (typeof body.weightKg !== "number" || body.weightKg < 20 || body.weightKg > 400) {
      return "weightKg must be a number between 20 and 400";
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "mealFrequency")) {
    if (!Number.isInteger(body.mealFrequency) || body.mealFrequency < 1 || body.mealFrequency > 10) {
      return "mealFrequency must be an integer between 1 and 10";
    }
  }

  return null;
}

function buildPatchData(body) {
  const data = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }
  return data;
}

function buildProfileCreateData(userId, patchData) {
  return {
    userId,
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
    cardioPreference: "",
    injuryFlags: [],
    injuryNotes: null,
    preferredLanguage: "",
    timezone: "",
    units: "",
    lastCompletedStep: 0,
    ...patchData,
  };
}

function isMissingRequiredValue(field, value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) {
    if (field === "injuryFlags") return false;
    return value.length === 0;
  }
  if (typeof value === "number") return value <= 0;
  return false;
}

export const getMyProfile = async (req, res) => {
  const userId = req.userId;

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    res.json({ success: true, data: profile || null });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

export const patchMyProfile = async (req, res) => {
  const userId = req.userId;
  const validationError = validateProfileBounds(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  const patchData = buildPatchData(req.body);

  try {
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    let profile;

    if (existingProfile) {
      profile = await prisma.userProfile.update({
        where: { userId },
        data: patchData,
      });
    } else {
      profile = await prisma.userProfile.create({
        data: buildProfileCreateData(userId, patchData),
      });
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

export const completeMyProfile = async (req, res) => {
  const userId = req.userId;

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(400).json({ success: false, message: "Profile is incomplete" });
    }

    for (const field of requiredFields) {
      if (isMissingRequiredValue(field, profile[field])) {
        return res.status(400).json({ success: false, message: "Profile is incomplete" });
      }
    }

    const completedProfile = await prisma.userProfile.update({
      where: { userId },
      data: {
        wizardCompleted: true,
        wizardCompletedAt: new Date(),
      },
    });

    res.json({ success: true, data: completedProfile });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to complete profile" });
  }
};
