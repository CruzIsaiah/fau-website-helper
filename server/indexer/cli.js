#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { InMemoryVectorStore } from "./vectorStore.js";
import { runIngestion } from "../ingest/loader.js";

const CHUNKS_PATH = path.resolve(process.cwd(), "outputs/ingest/chunks.json");
const OUT_INDEX = path.resolve(process.cwd(), "outputs/index/vector_store.json");

async function buildIndex({ fromIngest = false } = {}) {
  let chunks;
  if (fromIngest) {
    const result = await runIngestion();
    chunks = result.chunks;
  } else {
    const raw = await fs.readFile(CHUNKS_PATH, "utf8");
    chunks = JSON.parse(raw);
  }

  const store = new InMemoryVectorStore();
  await store.addDocuments(chunks.map((c) => ({ id: `${c.document_id}:${c.chunk_index}`, text: c.text, metadata: c })));
  await store.saveToFile(OUT_INDEX);
  console.log(`Index built: ${store.items.length} vectors saved to ${OUT_INDEX}`);
  return { count: store.items.length, path: OUT_INDEX };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("cli.js")) {
  const args = process.argv.slice(2);
  const fromIngest = args.includes("--ingest");
  buildIndex({ fromIngest }).catch((err) => {
    console.error("Indexing error:", err);
    process.exit(1);
  });
}

export default { buildIndex };
