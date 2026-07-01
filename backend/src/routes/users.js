import express from "express";
import { getUsers, createUser, getUserById, loginUser } from "../controllers/users.js";

const router = express.Router();

router.get("/", getUsers);
router.post("/", createUser);
router.post("/login", loginUser);
router.get("/:id", getUserById);

export default router;
