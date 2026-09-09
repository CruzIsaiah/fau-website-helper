import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { fauResources } from "./resources.js";
import { matchFauResources, researchFauQuestion, summarizeFauContent, summarizeFauResource } from "./ai.js";
import { assertAllowedFauUrl, fetchFauPage } from "./pageReader.js";
import { retrieveTopChunks } from "./retrieval.js";
import { checkSupabaseKeys, isSupabaseConfigured } from "./supabase.js";

import { parseNavigationIntent } from "./navigation/intent.js";
import { navigationContext } from "./navigation/diagnostics.js";
import { navigate } from "./navigation/service.js";
import { searchLocations } from "./navigation/resolver.js";
import { loadUpcomingEvent } from './events.js';
import { contextualQuestion } from './conversation.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");

const findSchema = z.object({
  question: z.string().min(3).max(600),
  history: z.array(z.object({ question: z.string().min(3).max(600) })).max(6).optional(),
  useIndex: z.boolean().optional()
});

const researchSchema = findSchema.extend({ bypassCache: z.boolean().optional() });

const summarizeSchema = z.object({
  title: z.string().max(140).optional(),
  url: z.string().trim().max(2048).optional().default(""),
  text: z.string().trim().max(6000).optional().default("")
}).superRefine((data, context) => {
  if (!data.url && data.text.length < 20) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a public FAU page URL or paste at least 20 characters of page text."
    });
  }
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
  app.set("trust proxy", 1);

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

  app.get("/api/navigation/locations", (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 180) : '';
    res.json({ locations: searchLocations(q).slice(0, 10).map(x => x.location) });
  });
  app.post("/api/navigation/route", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(z.object({ from: z.string().max(180), to: z.string().max(180) }), req.body);
      res.json(await navigate(data, undefined, navigationContext(req.path)));
    } catch (error) { next(error); }
  });

  app.get("/api/resources", (_req, res) => {
    res.json({ resources: fauResources });
  });

  app.get('/api/events', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.json(await loadUpcomingEvent());
  });

  app.post("/api/ai/find", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(findSchema, req.body);
      const intent = parseNavigationIntent(data.question);
      if (intent) return res.json(await navigate(intent, undefined, navigationContext(req.path)));
      // allow client to opt out of vector index retrieval by passing { useIndex: false }
      const useIndex = data.useIndex === undefined ? true : Boolean(data.useIndex);
      res.json(await matchFauResources({ ...data, question: contextualQuestion(data), resources: fauResources, useIndex, skipPageAnswer: true }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/research", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(researchSchema, req.body);
      const intent = parseNavigationIntent(data.question);
      if (intent) return res.json(await navigate(intent, undefined, navigationContext(req.path)));
      res.json(await researchFauQuestion({
        ...data,
        question: contextualQuestion(data),
        resources: fauResources,
        bypassCache: process.env.NODE_ENV === "production" ? false : Boolean(data.bypassCache)
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ai/summarize-resource", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(z.object({
        url: z.string().trim().max(2048),
        title: z.string().trim().max(180).optional(),
        query: z.string().trim().max(600).optional(),
        originalQuery: z.string().trim().max(600).optional(),
        program: z.string().trim().max(120).optional(),
        degree: z.string().trim().max(40).optional(),
        bypassCache: z.boolean().optional()
      }), req.body);
      res.json(await summarizeFauResource({
        ...data,
        url: assertAllowedFauUrl(data.url),
        bypassCache: process.env.NODE_ENV === "production" ? false : Boolean(data.bypassCache)
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/pages/fetch", aiLimiter, async (req, res, next) => {
    try {
      const data = validate(z.object({ url: z.string().trim().max(2048), bypassCache: z.boolean().optional() }), req.body);
      const page = await fetchFauPage(assertAllowedFauUrl(data.url), {
        bypassCache: process.env.NODE_ENV === "production" ? false : Boolean(data.bypassCache)
      });
      res.json({ page });
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
      const safeUrl = data.url ? assertAllowedFauUrl(data.url) : "";
      const page = data.text.length >= 20 ? { title: data.title, text: data.text } : await fetchFauPage(safeUrl);
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
