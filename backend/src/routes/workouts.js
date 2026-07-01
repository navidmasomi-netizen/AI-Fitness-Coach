import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createWorkoutSession,
  addSetLog,
  completeWorkoutSession,
  getUserWorkoutSessions,
  startFromActiveProgram,
  getSessionById,
  getActiveSession,
} from "../controllers/workouts.js";

const router = express.Router();

router.post("/", createWorkoutSession);
router.post("/startFromActiveProgram", requireAuth, startFromActiveProgram);
router.post("/:sessionId/set-logs", requireAuth, addSetLog);
router.patch("/:sessionId/complete", requireAuth, completeWorkoutSession);
router.get("/user/:userId", requireAuth, getUserWorkoutSessions);
router.get("/active", requireAuth, getActiveSession);
router.get("/:sessionId", requireAuth, getSessionById);

export default router;
