import OpenAI from "openai";
import { fetchFauPageText } from "./pageReader.js";

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OpenAI API key is not configured.");
    error.status = 503;
    error.code = "missing_api_key";
    throw error;
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function createJsonResponse({ system, user, fallback }) {
  if (process.env.NODE_ENV === "test") return fallback;

  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    return JSON.parse(response.choices[0]?.message?.content || "{}");
  } catch (error) {
    if (error.status === 429) {
      const rateError = new Error("The AI service is busy right now. Please wait a moment and try again.");
      rateError.status = 429;
      rateError.code = "rate_limited";
      throw rateError;
    }

    if (error.status === 503) throw error;

    const apiError = new Error("The FAU helper could not complete that AI request. Please try again.");
    apiError.status = error.status || 502;
    apiError.code = "ai_request_failed";
    throw apiError;
  }
}

const topicHints = [
  {
    terms: ["graduation", "graduate", "commencement", "ceremony", "cap and gown", "diploma"],
    answer:
      "For graduation information, the best official FAU page is the Registrar. If you mean the date of a specific commencement ceremony, check the Academic Calendar as well.",
    boosts: {
      registrar: 0.5,
      "academic-calendar": 0.36,
      advising: 0.12
    },
    reasons: {
      registrar:
        "The Registrar handles graduation, student records, and related forms, so it is the main official source for graduation information.",
      "academic-calendar":
        "If the question is about when graduation ceremonies or related deadlines occur, the Academic Calendar lists important dates and term schedules.",
      advising: "Academic advising can help students confirm graduation requirements and timing if they are close to finishing."
    }
  },
  {
    terms: ["tuition", "pay", "payment", "bill", "billing", "refund", "fees"],
    answer:
      "For tuition payment or billing questions, start with Tuition and Billing. Financial Aid may also help if the question involves aid, scholarships, or FAFSA.",
    boosts: {
      controller: 0.48,
      "financial-aid": 0.26,
      "academic-calendar": 0.1
    },
    reasons: {
      controller: "Tuition and Billing covers student accounts, payments, refunds, fees, and payment plans.",
      "financial-aid": "Financial Aid is useful if payment depends on FAFSA, loans, grants, scholarships, or aid status.",
      "academic-calendar": "Payment and registration deadlines may also appear alongside academic dates."
    }
  },
  {
    terms: ["withdraw", "drop", "add class", "drop class", "registration", "transcript", "records"],
    answer: "For registration, dropping, withdrawal, transcript, or student-record questions, the Registrar is the best starting point.",
    boosts: {
      registrar: 0.5,
      "academic-calendar": 0.28,
      advising: 0.18
    },
    reasons: {
      registrar: "The Registrar is the official office for registration, withdrawal, transcripts, records, and academic forms.",
      "academic-calendar": "The Academic Calendar helps confirm add/drop and withdrawal deadlines.",
      advising: "Advising can help you decide whether a schedule change fits your degree plan."
    }
  }
];

function normalizeConfidence(value) {
  if (typeof value === "number") return Math.max(0, Math.min(1, value));
  if (typeof value !== "string") return 0.5;
  const lowered = value.toLowerCase();
  if (lowered === "high") return 0.85;
  if (lowered === "medium") return 0.62;
  if (lowered === "low") return 0.35;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.5;
}

function buildFallbackMatches(question, resources) {
  const lowered = question.toLowerCase();
  const topic = topicHints.find((hint) => hint.terms.some((term) => lowered.includes(term)));
  const tokens = lowered.split(/[^a-z0-9]+/).filter(Boolean);

  const scored = resources
    .map((resource) => {
      const haystack = [
        resource.title,
        resource.category,
        resource.description,
        ...(resource.keywords || [])
      ]
        .join(" ")
        .toLowerCase();
      const keywordScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 0.08 : 0), 0);
      const topicBoost = topic?.boosts?.[resource.id] || 0;
      return {
        resourceId: resource.id,
        reason: topic?.reasons?.[resource.id] || `${resource.title} is a relevant official FAU resource for this question.`,
        confidence: Number(Math.min(0.98, 0.32 + keywordScore + topicBoost).toFixed(2))
      };
    })
    .filter((match) => match.confidence >= 0.38)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);

  return {
    answer: topic?.answer || "These official FAU pages are the best starting points for your question.",
    matches: scored.length > 0 ? scored : resources.slice(0, 3).map((resource) => ({
      resourceId: resource.id,
      reason: `${resource.title} may help answer this FAU navigation question.`,
      confidence: 0.5
    }))
  };
}

export async function matchFauResources({ question, resources }) {
  const fallback = buildFallbackMatches(question, resources);

  const data = await createJsonResponse({
    fallback,
    system:
      "You help FAU students find the right official FAU page. Return only JSON with answer and matches. answer is a direct 1-2 sentence answer to the student's question. matches is an array of 3 to 5 ranked objects with resourceId, reason, and confidence fields. confidence must be a number from 0 to 1, where 1 is most confident. Use only resource IDs from the provided directory.",
    user: `Student question: ${question}\n\nFAU resource directory:\n${JSON.stringify(resources)}`
  });

  const ranked = {
    answer: data.answer || fallback.answer,
    matches: (data.matches || fallback.matches)
      .map((match) => ({
        ...match,
        confidence: Number(normalizeConfidence(match.confidence).toFixed(2))
      }))
      .sort((a, b) => b.confidence - a.confidence)
  };

  if (process.env.NODE_ENV === "test") return ranked;

  const pageSources = (
    await Promise.allSettled(
      ranked.matches.slice(0, 3).map(async (match) => {
        const resource = resources.find((item) => item.id === match.resourceId);
        if (!resource) return null;
        const page = await fetchFauPageText(resource.url);
        return {
          resourceId: resource.id,
          title: page.title || resource.title,
          url: resource.url,
          text: page.text.slice(0, 2500)
        };
      })
    )
  )
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value);

  if (pageSources.length === 0) return ranked;

  const answerData = await createJsonResponse({
    fallback: { answer: ranked.answer },
    system:
      "Answer FAU student questions using only the provided official FAU page excerpts. Return only JSON with an answer field. If the exact answer is present, give the exact date, deadline, office, requirement, or next step. If excerpts do not contain the exact answer, say what page to open and what detail to look for. Keep the answer to 1-3 sentences.",
    user: `Student question: ${question}\n\nOfficial FAU page excerpts:\n${JSON.stringify(pageSources)}`
  });

  return {
    ...ranked,
    answer: answerData.answer || ranked.answer
  };
}

export async function summarizeFauContent({ title = "FAU page", url = "", text }) {
  return createJsonResponse({
    fallback: {
      summary: text.slice(0, 180),
      keyDetails: ["Review the page for deadlines, forms, contacts, and next steps."],
      nextSteps: ["Open the official FAU page.", "Contact the listed FAU office if details are unclear."],
      sentiment: "neutral"
    },
    system:
      "Summarize FAU website text for a student. Return only JSON with summary, keyDetails, nextSteps, and sentiment. sentiment must be positive, neutral, urgent, or confusing.",
    user: `Page title: ${title}\nURL: ${url || "Not provided"}\nText:\n${text}`
  });
}
