import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  generateProgram,
  getPrograms,
  getProgramById,
  regenerateProgram,
  getRegenerationRecommendation,
} from "../controllers/programs.js";

const router = express.Router();

router.get("/", getPrograms);
router.post("/generate", requireAuth, generateProgram);
router.post("/regenerate", requireAuth, regenerateProgram);
router.get("/regeneration-recommendation", requireAuth, getRegenerationRecommendation);
router.get("/:id", getProgramById);

export default router;
