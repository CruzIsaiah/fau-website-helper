# FAU Website Helper

FAU Website Helper is an AI-powered mini-project that helps students find the right FAU page and understand confusing website text.

## Features

- Account registration and login
- Curated directory of common FAU resources
- Saved FAU links and notes with CRUD operations
- AI resource finder for plain-English student questions
- AI page summarizer for pasted FAU page text
- Loading states, validation, friendly errors, and AI rate limiting
- Automated tests for auth, saved-resource CRUD, invalid input, unauthorized access, and AI endpoints

## AI Features

### Smart FAU Page Finder

Users ask questions like:

```text
Where do I pay tuition?
```

The AI matches the question to curated FAU resources and explains why each page is useful.

### Page Summarization and Sentiment

Users paste text from an FAU page. The AI returns:

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

Live app URL: `TODO`

Demo video: `TODO`

## Documentation

- Endpoint documentation: `docs/API.md`
- Cost analysis: `docs/COST_ANALYSIS.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Postman collection: `docs/postman_collection.json`
