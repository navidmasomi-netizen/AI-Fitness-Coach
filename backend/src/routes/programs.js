import express from "express";
import { getPrograms, getProgramById } from "../controllers/programs.js";

const router = express.Router();

router.get("/", getPrograms);
router.get("/:id", getProgramById);

export default router;
