# API Documentation

Local base URL: `http://localhost:5010/api`  
Production base URL: `https://th-five-bice.vercel.app/api`

No account or authorization header is required.

## Resources

### GET `/resources`

Returns curated FAU resource links.

Saved resources are stored by the client in browser local storage and do not use an API endpoint.

## AI

### POST `/ai/find`

Request:

```json
{
  "question": "Where do I pay tuition?"
}
```

### POST `/ai/research`

Accepts the same search question, fetches the strongest FAU pages, ranks relevant sections and links, and returns a structured `groundedAnswer`, `sources`, and `usefulLinks` response.

### POST `/ai/summarize-resource`

Accepts an FAU resource `url`, its `title`, and the current search `query`. It uses the shared secure page parser to create a query-aware sourced summary for a selected result.

Response:

```json
{
  "answer": "Tuition payment details are listed on the Tuition and Billing page.",
  "matches": [
    {
      "resourceId": "controller",
      "reason": "This page covers tuition billing and payments.",
      "confidence": 0.91
    }
  ]
}
```

### POST `/ai/summarize`

Request:

```json
{
  "url": "https://www.fau.edu/registrar/"
}
```

The request may include a public FAU HTTPS `url`, at least 20 characters of pasted `text`, or both. Pasted text is used directly when provided and is the fallback when a page cannot be read automatically.

Response:

```json
{
  "summary": "This page explains registration and student records steps.",
  "keyDetails": ["Watch deadlines", "Use official forms"],
  "nextSteps": ["Open the official page", "Contact the listed office"],
  "sentiment": "neutral"
}
```

### POST `/ai/retrieve`

Returns matching indexed FAU source excerpts when a local vector index is available. Otherwise, `results` is an empty array.

### POST `/pages/fetch`

Fetches and parses an allowed FAU HTTPS page into semantic sections, tables, and contextual links. Raw remote HTML is never returned.

## Common Errors

- `400` invalid input
- `429` AI rate limit reached
- `503` OpenAI API key missing
