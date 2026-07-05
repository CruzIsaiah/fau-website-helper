import OpenAI from "openai";

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

export async function matchFauResources({ question, resources }) {
  const fallbackMatches = resources
    .map((resource) => ({
      resourceId: resource.id,
      reason: `This page may help with ${question}.`,
      confidence: "medium"
    }))
    .slice(0, 3);

  return createJsonResponse({
    fallback: { answer: "These FAU resources are the best starting points.", matches: fallbackMatches },
    system:
      "You help FAU students find the right official FAU page. Return only JSON with answer and matches. matches is an array of 3 to 5 objects with resourceId, reason, and confidence fields. Use only resource IDs from the provided directory.",
    user: `Student question: ${question}\n\nFAU resource directory:\n${JSON.stringify(resources)}`
  });
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
