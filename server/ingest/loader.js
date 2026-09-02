import fs from "node:fs/promises";
import path from "node:path";
import { fetchFauPageText, htmlToReadableText } from "../pageReader.js";
import { fauResources } from "../resources.js";
import { chunkText } from "./chunker.js";

const OUT_DIR = path.resolve(process.cwd(), "outputs/ingest");

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function runIngestion({ resources = fauResources, maxChars = 1000, overlap = 200 } = {}) {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const chunks = [];
  const report = {
    pages_discovered: resources.length,
    pages_indexed: 0,
    chunks_created: 0,
    failed_urls: [],
    pages: []
  };

  for (const resource of resources) {
    const entry = { id: resource.id, url: resource.url, title: resource.title, status: "skipped" };
    try {
      const page = await fetchFauPageText(resource.url);
      const pageText = page.text;
      const pageTitle = page.title || resource.title;
      const docChunks = chunkText(pageText, maxChars, overlap);

      docChunks.forEach((chunk, idx) => {
        chunks.push({
          document_id: resource.document_id || resource.id,
          title: pageTitle,
          url: resource.url,
          source_domain: domainOf(resource.url),
          category: resource.category || null,
          subcategory: resource.subcategory || null,
          department: resource.department || null,
          page_type: resource.page_type || null,
          authority_level: resource.authority_level || null,
          retrieval_priority: resource.retrieval_priority || 0,
          last_crawled: new Date().toISOString(),
          chunk_index: idx,
          text: chunk.text
        });
      });

      entry.status = "indexed";
      entry.chunks = docChunks.length;
      report.pages_indexed += 1;
      report.chunks_created += docChunks.length;
      report.pages.push(entry);
    } catch (err) {
      entry.status = "failed";
      entry.error = err.message;
      report.failed_urls.push({ url: resource.url, error: err.message });
      report.pages.push(entry);
    }
  }

  // Write outputs
  const chunksPath = path.join(OUT_DIR, "chunks.json");
  const reportPath = path.join(OUT_DIR, "report.json");
  await fs.writeFile(chunksPath, JSON.stringify(chunks, null, 2), "utf8");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  return { chunks, report, chunksPath, reportPath };
}

if (process.argv[1].endsWith("/loader.js") || process.argv[1].endsWith("\\\") && process.argv[1].endsWith("loader.js")) {
  // Allow `node server/ingest/loader.js` to run ingestion
  runIngestion().then(({ report, chunksPath, reportPath }) => {
    // eslint-disable-next-line no-console
    console.log("Ingestion complete:", report);
    // eslint-disable-next-line no-console
    console.log("Chunks written to:", chunksPath);
    // eslint-disable-next-line no-console
    console.log("Report written to:", reportPath);
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
}

export default { runIngestion };
