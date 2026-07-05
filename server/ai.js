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
      temperature: 0.3,
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

    const apiError = new Error("The AI assistant could not complete that request. Please try again.");
    apiError.status = error.status || 502;
    apiError.code = "ai_request_failed";
    throw apiError;
  }
}

export async function suggestTasks({ goal, context = "" }) {
  return createJsonResponse({
    fallback: {
      suggestions: [
        {
          title: `Plan ${goal}`,
          description: "Break the goal into milestones and choose the first task to complete today.",
          priority: "medium"
        }
      ]
    },
    system:
      "You are a practical productivity assistant. Return only JSON with a suggestions array of 3 to 5 objects. Each object has title, description, and priority fields. Priority must be low, medium, or high.",
    user: `Goal: ${goal}\nContext: ${context || "No extra context."}`
  });
}

export async function analyzeTasks({ text }) {
  return createJsonResponse({
    fallback: {
      summary: text.slice(0, 140),
      sentiment: "neutral",
      nextStep: "Pick one specific action and schedule time for it."
    },
    system:
      "Analyze the user's task notes. Return only JSON with summary, sentiment, and nextStep fields. Sentiment must be positive, neutral, stressed, or blocked.",
    user: text
  });
}
