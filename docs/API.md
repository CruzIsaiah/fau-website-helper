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

Optional `text` may be included if the page cannot be read automatically.

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

## Common Errors

- `400` invalid input
- `429` AI rate limit reached
- `503` OpenAI API key missing
