Next Steps — FAU Knowledge Router (Phase 3+)

Status: paused after ingestion & indexer scaffolding.

Immediate next actions

1. Wire retrieval to the vector store
   - Implement category-aware retrieval pipeline:
     - Accept user question → run classifier → select preferred categories
     - Metadata-filter candidate chunks by category/subcategory
     - Run vector similarity search (top N)
     - Apply authority + recency weighting and rerank
     - Assemble context and call answer-generation LLM
   - Files to modify: `server/ai.js`, add `server/retrieval.js`.

2. Update API to support source-aware retrieval
   - Add endpoint or augment `/api/ai/find` to optionally use the vector index when available.
   - Ensure fallback to current rule/LLM flow if no index exists.
   - File: `server/app.js`, `server/ai.js`.

3. Frontend: show strong sources and excerpts
   - Update `client/src/App.jsx` Finder results to display 2–5 strongest sources with title, category, authority badge, short excerpt, and link.
   - Add optional domain/category filter in the UI.

4. Tests & evaluation
   - Add tests for URL normalization, classification mapping, metadata presence, retrieval ranking, and citations.
   - Create evaluation dataset `tests/eval_set.json` (25–50 questions).

5. Crawl/index admin utilities
   - Improve `server/ingest/loader.js` with configurable seeds, crawl depth, canonicalization rules, and discovery parent tracking.
   - Add ingestion report enhancements.

6. Production considerations
   - Choose vector storage (set `VECTOR_STORE` env): `none` (in-memory) or `supabase` (requires setup).
   - If using Supabase vectors, implement `server/indexer/supabaseAdapter.js` query methods to match your Supabase extension schema.
   - Update `.env.example` with any new variables.

Quick commands

- Run ingestion (writes `outputs/ingest/chunks.json` and `outputs/ingest/report.json`):

```bash
node server/ingest/cli.js
```

- Build index from existing chunks (creates `outputs/index/vector_store.json`):

```bash
node server/indexer/cli.js
# or to run ingestion then index
node server/indexer/cli.js --ingest
```

- Start dev server (runs both server and client):

```bash
npm run dev
```

- Run tests:

```bash
npm test
```

Key files created so far

- `server/taxonomy.js` — taxonomy + authority weights
- `server/ingest/chunker.js` — sentence-aware chunker
- `server/ingest/loader.js` — ingestion loader
- `server/ingest/cli.js` — ingestion CLI
- `server/indexer/embeddings.js` — OpenAI embeddings adapter
- `server/indexer/vectorStore.js` — simple in-memory vector store
- `server/indexer/supabaseAdapter.js` — Supabase adapter scaffold
- `server/indexer/cli.js` — indexer CLI

Environment vars to set for next steps

- `OPENAI_API_KEY` — required for embeddings and LLMs
- `EMBEDDING_MODEL` — default `text-embedding-3-large` (set in `.env.example`)
- `VECTOR_STORE` — `none` or `supabase`
- (if using Supabase) `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Notes

- The current ingestion and indexer are safe, file-based scaffolds; they do not push secrets or external services.
- Next coding steps will preserve current `/api/ai/find` behavior as a fallback and add an opt-in vector retrieval path.

If you'd like, I can now implement step 1 (wire retrieval to use the vector store) and add tests for the retrieval behavior. Which should I start with first: `wire retrieval` or `frontend source UI`?