# FAU Website Helper

FAU Website Helper is an AI-powered mini-project that helps students find the right FAU page and understand confusing website text.

Student: Isaiah Cruz  
Z-number: Z23589169  
FAU email: icruz2020@fau.edu

## Features

- Account registration and login
- Supabase Auth with protected API routes
- Supabase Postgres saved-link persistence
- Curated directory of common FAU resources
- Saved FAU links and notes with CRUD operations
- AI resource finder for plain-English student questions
- AI page summarizer from a public FAU link, with optional pasted text fallback
- Loading states, validation, friendly errors, and AI rate limiting
- Automated tests for auth, saved-resource CRUD, invalid input, unauthorized access, and AI endpoints

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
JWT_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.4-mini
CLIENT_ORIGIN=http://localhost:5174
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:5174`.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `docs/DATABASE_SCHEMA.sql`.
4. Add these values to `.env` locally and Vercel in production:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Never commit Supabase keys or OpenAI keys.

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

- `JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLIENT_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Live app URL: https://th-five-bice.vercel.app

Demo video: https://drive.google.com/file/d/1VOMY6_-Y3Xr-JkQw8tWas5NbN7kdSmaX/view?usp=drive_link

## Documentation

- Endpoint documentation: `docs/API.md`
- Cost analysis: `docs/COST_ANALYSIS.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Planning notes, wireframe, architecture: `docs/PLANNING.md`
- Supabase schema: `docs/DATABASE_SCHEMA.sql`
- Postman collection: `docs/postman_collection.json`
