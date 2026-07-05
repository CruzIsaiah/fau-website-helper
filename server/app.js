import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { loginUser, registerUser, requireAuth } from "./auth.js";
import {
  createSavedResource,
  deleteSavedResource,
  listSavedResources,
  updateSavedResource
} from "./db.js";
import { fauResources } from "./resources.js";
import { matchFauResources, summarizeFauContent } from "./ai.js";
import { assertAllowedFauUrl, fetchFauPageText } from "./pageReader.js";
import { isSupabaseConfigured } from "./supabase.js";

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

const savedResourceSchema = z.object({
  title: z.string().min(2).max(140),
  url: z.string().url(),
  notes: z.string().max(1200).optional().default(""),
  category: z.string().max(80).optional().default("General")
});

const findSchema = z.object({
  question: z.string().min(3).max(600)
});

const summarizeSchema = z.object({
  title: z.string().max(140).optional().default("FAU page"),
  url: z.string().url(),
  text: z.string().max(6000).optional().default("")
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
    res.json({
      status: "ok",
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      databaseConfigured: isSupabaseConfigured()
    });
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const data = validate(registerSchema, req.body);
      res.status(201).json(await registerUser(data));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const data = validate(authSchema, req.body);
      res.json(await loginUser(data));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/resources", (_req, res) => {
    res.json({ resources: fauResources });
  });

  app.get("/api/saved", requireAuth, async (req, res, next) => {
    try {
      res.json({ saved: await listSavedResources(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/saved", requireAuth, async (req, res, next) => {
    try {
      const saved = await createSavedResource(req.user.id, validate(savedResourceSchema, req.body));
      res.status(201).json({ saved });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/saved/:id", requireAuth, async (req, res, next) => {
    try {
      const saved = await updateSavedResource(req.user.id, req.params.id, validate(savedResourceSchema.partial(), req.body));
      if (!saved) return res.status(404).json({ error: "Saved resource not found." });
      res.json({ saved });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/saved/:id", requireAuth, async (req, res, next) => {
    try {
      if (!(await deleteSavedResource(req.user.id, req.params.id))) {
        return res.status(404).json({ error: "Saved resource not found." });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/find", requireAuth, aiLimiter, async (req, res, next) => {
    try {
      const data = validate(findSchema, req.body);
      res.json(await matchFauResources({ ...data, resources: fauResources }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/summarize", requireAuth, aiLimiter, async (req, res, next) => {
    try {
      const data = validate(summarizeSchema, req.body);
      const safeUrl = assertAllowedFauUrl(data.url);
      const page = data.text.trim().length >= 20 ? { title: data.title, text: data.text.trim() } : await fetchFauPageText(safeUrl);
      res.json(await summarizeFauContent({
        title: data.title || page.title || "FAU page",
        url: safeUrl,
        text: page.text
      }));
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
