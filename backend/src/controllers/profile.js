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

function isMissingRequiredValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
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
      if (isMissingRequiredValue(profile[field])) {
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
