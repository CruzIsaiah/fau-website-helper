import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { requireAuth, hashPassword, signToken, verifyPassword } from "./auth.js";
import {
  createSavedResource,
  createUser,
  deleteSavedResource,
  findUserByEmail,
  listSavedResources,
  publicUser,
  updateSavedResource
} from "./db.js";
import { fauResources } from "./resources.js";
import { matchFauResources, summarizeFauContent } from "./ai.js";

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

function assertAllowedFauUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || (!hostname.endsWith("fau.edu") && hostname !== "fau.edu")) {
    const error = new Error("Please enter a public FAU HTTPS page.");
    error.status = 400;
    throw error;
  }
  return parsed.toString();
}

function htmlToReadableText(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: text.slice(0, 6000) };
}

async function fetchFauPageText(url) {
  if (process.env.NODE_ENV === "test") {
    return {
      title: "FAU test page",
      text: "This FAU page includes important deadlines, official forms, contact information, and next steps for students."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(assertAllowedFauUrl(url), {
      signal: controller.signal,
      headers: {
        "User-Agent": "FAU-Website-Helper/1.0"
      }
    });

    if (!response.ok) {
      const error = new Error("I could not open that FAU page. Try another public FAU link or paste the page text.");
      error.status = 400;
      throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      const error = new Error("That link does not look like a readable web page. Try another FAU page or paste the text.");
      error.status = 400;
      throw error;
    }

    const html = await response.text();
    const page = htmlToReadableText(html);
    if (page.text.length < 80) {
      const error = new Error("I could not find enough readable text on that page. Paste the page text instead.");
      error.status = 400;
      throw error;
    }
    return page;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("That FAU page took too long to load. Try again or paste the page text.");
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

  app.get("/api/resources", (_req, res) => {
    res.json({ resources: fauResources });
  });

  app.get("/api/saved", requireAuth, (req, res) => {
    res.json({ saved: listSavedResources(req.user.id) });
  });

  app.post("/api/saved", requireAuth, (req, res, next) => {
    try {
      const saved = createSavedResource(req.user.id, validate(savedResourceSchema, req.body));
      res.status(201).json({ saved });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/saved/:id", requireAuth, (req, res, next) => {
    try {
      const saved = updateSavedResource(req.user.id, req.params.id, validate(savedResourceSchema.partial(), req.body));
      if (!saved) return res.status(404).json({ error: "Saved resource not found." });
      res.json({ saved });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/saved/:id", requireAuth, (req, res) => {
    if (!deleteSavedResource(req.user.id, req.params.id)) {
      return res.status(404).json({ error: "Saved resource not found." });
    }
    res.status(204).end();
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
