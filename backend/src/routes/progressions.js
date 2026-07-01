import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { getProgressionsBySession } from "../controllers/progressions.js";

const router = express.Router();

router.get("/session/:sessionId", requireAuth, getProgressionsBySession);

export default router;
