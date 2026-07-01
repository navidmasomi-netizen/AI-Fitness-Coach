import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { completeMyProfile, getMyProfile, patchMyProfile } from "../controllers/profile.js";

const router = express.Router();

router.get("/", requireAuth, getMyProfile);
router.patch("/", requireAuth, patchMyProfile);
router.post("/complete", requireAuth, completeMyProfile);

export default router;
