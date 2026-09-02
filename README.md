# FAU Website Helper

FAU Website Helper is an AI-powered mini-project that helps students find the right FAU page and understand confusing website text.

## Features

- No account or login required
- Saved links persist in the user's browser
- Curated directory of common FAU resources
- Saved FAU links and notes with CRUD operations
- AI resource finder for plain-English student questions
- AI page summarizer from a public FAU link, with optional pasted text fallback
- Loading states, validation, friendly errors, and AI rate limiting
- Automated tests for public resources, validation, and AI endpoints

## AI Features

### Smart FAU Page Finder

Users ask questions like:

```text
Where do I pay tuition?
```

The AI matches the question to curated FAU resources, reads the top official pages, and answers from the page text when the answer is available.
For process questions, such as `how to register for classes`, it gives short step-by-step guidance and links students to the right FAU pages, such as MyFAU, Registrar, and the Academic Calendar.
For date questions, such as `when is summer graduation`, it prioritizes the Academic Calendar.

### Page Summarization and Sentiment

Users paste a public FAU page link. The app reads the page text automatically, then the AI returns:

- plain-English summary
- key details
- next steps
- sentiment label such as `neutral`, `urgent`, or `confusing`

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PORT=5010
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.4-mini
CLIENT_ORIGIN=http://localhost:5174
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:5174`.

Supabase is optional and is not required to use the site. Never commit API keys.

## Testing

```bash
npm test
npm run build
```

## Deployment

The project includes `api/index.js` and `vercel.json` for Vercel.

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

Production environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLIENT_ORIGIN`

Live app URL: https://th-five-bice.vercel.app

Demo video: https://drive.google.com/file/d/1VOMY6_-Y3Xr-JkQw8tWas5NbN7kdSmaX/view?usp=drive_link

## Documentation

- Endpoint documentation: `docs/API.md`
- Cost analysis: `docs/COST_ANALYSIS.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Planning notes, wireframe, architecture: `docs/PLANNING.md`
- Supabase schema: `docs/DATABASE_SCHEMA.sql`
- Postman collection: `docs/postman_collection.json`
