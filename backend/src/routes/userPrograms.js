import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { activateProgram, getMyActiveProgram } from "../controllers/userPrograms.js";

const router = express.Router();

router.post("/activate", requireAuth, activateProgram);
router.get("/me", requireAuth, getMyActiveProgram);

export default router;
