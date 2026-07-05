import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { requireAuth, hashPassword, signToken, verifyPassword } from "./auth.js";
import {
  createTask,
  createUser,
  deleteTask,
  findUserByEmail,
  listTasks,
  publicUser,
  updateTask
} from "./db.js";
import { analyzeTasks, suggestTasks } from "./ai.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = authSchema.extend({
  name: z.string().min(2).max(80)
});

const taskSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1000).optional().default(""),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  status: z.enum(["todo", "doing", "done"]).optional().default("todo"),
  dueDate: z.string().optional().default("")
});

const suggestionSchema = z.object({
  goal: z.string().min(3).max(400),
  context: z.string().max(1200).optional().default("")
});

const analysisSchema = z.object({
  text: z.string().min(3).max(3000)
});

function validate(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = new Error(result.error.issues[0]?.message || "Invalid request.");
    error.status = 400;
    throw error;
  }
  return result.data;
}

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
  app.use(express.json({ limit: "1mb" }));

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI requests are limited. Please wait a few minutes and try again." }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const data = validate(registerSchema, req.body);
      if (findUserByEmail(data.email)) {
        return res.status(409).json({ error: "An account already exists for that email." });
      }

      const user = createUser({
        name: data.name.trim(),
        email: data.email.toLowerCase(),
        passwordHash: await hashPassword(data.password)
      });
      res.status(201).json({ user: publicUser(user), token: signToken(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const data = validate(authSchema, req.body);
      const user = findUserByEmail(data.email);
      if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
        return res.status(401).json({ error: "Email or password is incorrect." });
      }
      res.json({ user: publicUser(user), token: signToken(user) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/tasks", requireAuth, (req, res) => {
    res.json({ tasks: listTasks(req.user.id) });
  });

  app.post("/api/tasks", requireAuth, (req, res, next) => {
    try {
      const task = createTask(req.user.id, validate(taskSchema, req.body));
      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/tasks/:id", requireAuth, (req, res, next) => {
    try {
      const task = updateTask(req.user.id, req.params.id, validate(taskSchema.partial(), req.body));
      if (!task) return res.status(404).json({ error: "Task not found." });
      res.json({ task });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/tasks/:id", requireAuth, (req, res) => {
    if (!deleteTask(req.user.id, req.params.id)) {
      return res.status(404).json({ error: "Task not found." });
    }
    res.status(204).end();
  });

  app.post("/api/ai/suggestions", requireAuth, aiLimiter, async (req, res, next) => {
    try {
      const data = validate(suggestionSchema, req.body);
      res.json(await suggestTasks(data));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/insights", requireAuth, aiLimiter, async (req, res, next) => {
    try {
      const data = validate(analysisSchema, req.body);
      res.json(await analyzeTasks(data));
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).json({
      error: status === 500 ? "Something went wrong. Please try again." : error.message,
      code: error.code
    });
  });

  return app;
}
