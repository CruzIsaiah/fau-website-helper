import OpenAI from "openai";

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OpenAI API key is not configured for embeddings.");
    error.status = 503;
    throw error;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function embedText(text, model = process.env.EMBEDDING_MODEL || "text-embedding-3-large") {
  const client = getClient();
  const resp = await client.embeddings.create({ model, input: text });
  // The OpenAI client returns embeddings in resp.data
  const data = resp?.data?.[0];
  if (!data || !data.embedding) throw new Error("Embedding response missing.");
  return data.embedding;
}

export async function embedMany(texts, model = process.env.EMBEDDING_MODEL || "text-embedding-3-large") {
  const client = getClient();
  const resp = await client.embeddings.create({ model, input: texts });
  return (resp?.data || []).map((item) => item.embedding);
}

export default { embedText, embedMany };
