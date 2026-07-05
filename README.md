# TaskFlow AI

TaskFlow AI is a full-stack task tracker built for the Week 3 AI API Integration assignment. Users can register, sign in, manage tasks, and use OpenAI-powered tools to turn a goal into suggested tasks or summarize the current workload.

## Features

- Email/password registration and login with JWT-protected routes
- Task CRUD: create, list, update status/details, and delete
- AI task suggestions from a user goal and current task context
- AI task insights with summary, sentiment, and recommended next step
- Loading states, validation, friendly error messages, and AI rate limiting
- Automated tests for auth, CRUD, validation, unauthorized access, and AI endpoint shape
- Production build served by Express for single-service deployment

## Tech Stack

- React + Vite
- Express
- OpenAI Node SDK
- JWT + bcryptjs
- Zod validation
- Vitest + Supertest

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PORT=5001
JWT_SECRET=replace-with-a-long-random-secret
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.4-mini
CLIENT_ORIGIN=http://localhost:5173
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:5173`.

## AI Features

### Smart Task Suggestions

The `/api/ai/suggestions` endpoint sends the user's goal and current task context to OpenAI and returns 3 to 5 structured task suggestions. The UI lets users add any suggestion directly to the task board.

### Summary and Sentiment Insights

The `/api/ai/insights` endpoint analyzes the user's current task list or notes and returns:

- `summary`
- `sentiment`
- `nextStep`

This helps the user understand whether their workload looks positive, neutral, stressed, or blocked.

## Error Handling and Rate Limits

- API validation errors return `400` with a readable message.
- Unauthorized requests return `401`.
- Duplicate accounts return `409`.
- Missing OpenAI credentials return `503`.
- OpenAI rate limits return `429` with a friendly retry message.
- AI endpoints are limited to 20 requests per 15 minutes per client.

## Testing

```bash
npm test
npm run build
```

Current automated coverage:

- Register returns a user and token
- Invalid login is rejected
- Task routes require authentication
- Task create/list/update/delete flow works
- Invalid task input returns an error
- AI suggestion endpoint returns suggestions
- AI insight endpoint returns summary fields

The API can also be tested with Postman, Thunder Client, or the included collection in `docs/postman_collection.json`.

## Documentation

- Endpoint documentation: `docs/API.md`
- Cost analysis: `docs/COST_ANALYSIS.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Postman collection: `docs/postman_collection.json`

## Deployment

### Vercel

The repo includes `api/index.js` and `vercel.json` so Vercel can serve the React frontend and Express API together.

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

Environment variables:

- `JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLIENT_ORIGIN`

### Generic Node Host

Build and start:

```bash
npm run build
npm start
```

Set these production environment variables on the host:

- `JWT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLIENT_ORIGIN`

Live app URL: https://th-five-bice.vercel.app

Demo video: `TODO: add 3-5 minute demo video link`

## Usage Notes

OpenAI usage is token-billed. This project uses short prompts and JSON responses, so typical classroom/demo usage should remain low-cost. See `docs/COST_ANALYSIS.md` for estimates.
