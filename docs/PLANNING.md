# Planning Notes

## User Flow

```mermaid
flowchart TD
  A["Student opens FAU Website Helper"] --> B["Register or log in"]
  B --> C["Ask a plain-English FAU question"]
  C --> D["AI ranks official FAU resources"]
  D --> E["Backend reads top FAU pages"]
  E --> F["AI answers from page excerpts"]
  F --> G["Student opens or saves useful FAU links"]
  B --> H["Paste a FAU URL into Page Summarizer"]
  H --> I["Backend fetches readable page text"]
  I --> J["AI returns summary, key details, sentiment, and next steps"]
```

## Wireframe

```text
+--------------------------------------------------------------+
| FAU Website Helper                         [Sign out]         |
+-------------------------------+------------------------------+
| What are you trying to find?   | Page summarizer              |
| [question input] [Find]        | [FAU URL input]              |
|                               | [optional pasted text]       |
| AI answer from page content    | [Summarize]                  |
|                               | Summary / details / steps    |
| Ranked official FAU pages      |                              |
| [Open] [Save] cards            |                              |
|                               |                              |
| Saved FAU links CRUD           |                              |
+-------------------------------+------------------------------+
```

## Database Schema

Supabase Auth stores users. The app stores saved FAU links in `public.saved_resources`.

See `docs/DATABASE_SCHEMA.sql` for the table, trigger, and RLS policies.

## API Architecture

- React frontend calls Express routes under `/api`.
- Express handles validation, auth checks, rate limiting, and AI calls.
- Supabase Auth manages registration/login/session verification.
- Supabase Postgres persists saved resources with full CRUD.
- OpenAI powers FAU resource matching, page-based answers, and summarization.
- Vercel serves the frontend and API through `api/index.js`.
