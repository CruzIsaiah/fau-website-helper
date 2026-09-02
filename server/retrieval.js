import fs from "node:fs/promises";
import path from "node:path";
import { InMemoryVectorStore } from "./indexer/vectorStore.js";

const INDEX_PATH = path.resolve(process.cwd(), "outputs/index/vector_store.json");

export async function retrieveTopChunks(question, topK = 6, preferredCategories = []) {
  if (process.env.NODE_ENV === "test") return [];

  try {
    await fs.access(INDEX_PATH);
  } catch {
    return [];
  }

  const store = new InMemoryVectorStore();
  await store.loadFromFile(INDEX_PATH);

  const rawResults = await store.similaritySearch(question, Math.max(topK, 8));

  // Aggregate by document_id (resource) and pick top score per document
  const byDoc = new Map();
  for (const r of rawResults) {
    const docId = r.metadata.document_id || r.metadata.documentId || r.metadata.url;
    const entry = byDoc.get(docId) || { resourceId: docId, score: 0, metadata: r.metadata };
    // combine by choosing max score
    entry.score = Math.max(entry.score, r.score || 0);
    byDoc.set(docId, entry);
  }

  const results = Array.from(byDoc.values())
    .map((e) => {
      const boost = preferredCategories && preferredCategories.length > 0 && preferredCategories.includes(e.metadata.category) ? 0.15 : 0;
      return { resourceId: e.resourceId, score: (e.score || 0) + boost, metadata: e.metadata };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => ({ resourceId: r.resourceId, score: Number(r.score.toFixed(3)), title: r.metadata.title, url: r.metadata.url, text: (r.metadata.text || "").slice(0, 2500) }));

  return results;
}

export default { retrieveTopChunks };
