import fs from "node:fs/promises";
import path from "node:path";
import { embedText, embedMany } from "./embeddings.js";

function cosine(a, b) {
  let dot = 0;
  let la = 0;
  let lb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    la += a[i] * a[i];
    lb += b[i] * b[i];
  }
  if (la === 0 || lb === 0) return 0;
  return dot / (Math.sqrt(la) * Math.sqrt(lb));
}

export class InMemoryVectorStore {
  constructor() {
    this.items = [];
  }

  async addDocuments(docs) {
    // docs: [{ id?, text, metadata }]
    const texts = docs.map((d) => d.text);
    const embeddings = await embedMany(texts);
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const id = doc.id || `${doc.document_id || 'doc'}:${doc.chunk_index ?? i}`;
      this.items.push({ id, embedding: embeddings[i], metadata: doc });
    }
    return this.items.length;
  }

  async similaritySearch(queryText, topK = 5) {
    const qEmb = await embedText(queryText);
    const scored = this.items.map((item) => ({ score: cosine(qEmb, item.embedding), item }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => ({ id: s.item.id, score: s.score, metadata: s.item.metadata }));
  }

  async saveToFile(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(this.items, null, 2), "utf8");
    return filePath;
  }

  async loadFromFile(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    this.items = JSON.parse(raw);
    return this.items.length;
  }
}

export default { InMemoryVectorStore };
