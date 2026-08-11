import express from "express";
import cors from "cors";
import usersRouter from "./routes/users.js";
import workoutsRouter from "./routes/workouts.js";
import exercisesRouter from "./routes/exercises.js";
import programsRouter from "./routes/programs.js";
import userProgramsRouter from "./routes/userPrograms.js";
import progressionsRouter from "./routes/progressions.js";
import profileRouter from "./routes/profile.js";
import { attachRequestContext } from "./middleware/requestContext.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(attachRequestContext);

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "IronFa API is running" });
});

app.use("/api/users", usersRouter);
app.use("/api/sessions", workoutsRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/programs", programsRouter);
app.use("/api/userprograms", userProgramsRouter);
app.use("/api/progressions", progressionsRouter);
app.use("/api/profile", profileRouter);

export default app;
