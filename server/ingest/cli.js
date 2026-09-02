#!/usr/bin/env node
import { runIngestion } from "./loader.js";

async function main() {
  try {
    const result = await runIngestion();
    console.log("Done.");
    console.log(`Pages indexed: ${result.report.pages_indexed}, chunks: ${result.report.chunks_created}`);
  } catch (err) {
    console.error("Ingestion error:", err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("cli.js")) {
  main();
}
