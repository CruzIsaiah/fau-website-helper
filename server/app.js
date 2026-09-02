import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { fauResources } from "./resources.js";
import { matchFauResources, summarizeFauContent } from "./ai.js";
import { assertAllowedFauUrl, fetchFauPageText } from "./pageReader.js";
import { retrieveTopChunks } from "./retrieval.js";
import { checkSupabaseKeys, isSupabaseConfigured } from "./supabase.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");

const findSchema = z.object({
  question: z.string().min(3).max(600),
  useIndex: z.boolean().optional()
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

  app.get("/api/health", async (_req, res) => {
    const databaseConfigured = isSupabaseConfigured();
    const supabase = process.env.SHOW_SUPABASE_HEALTH === "true" ? await checkSupabaseKeys() : undefined;

    res.json({
      status: "ok",
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      databaseConfigured,
      supabase
    });
  });

  app.get("/api/resources", (_req, res) => {
    res.json({ resources: fauResources });
  });

  app.post("/api/ai/find", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(findSchema, req.body);
      // allow client to opt out of vector index retrieval by passing { useIndex: false }
      const useIndex = data.useIndex === undefined ? true : Boolean(data.useIndex);
      res.json(await matchFauResources({ ...data, resources: fauResources, useIndex }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/retrieve", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(z.object({ question: z.string().min(3), topK: z.number().min(1).max(50).optional() }), req.body);
      const topK = data.topK || 6;
      const results = await retrieveTopChunks(data.question, topK);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/summarize", aiLimiter, async (req, res, next) => {
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
