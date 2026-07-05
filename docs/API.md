# API Documentation

Base URL: `http://localhost:5010/api`

Authenticated endpoints require:

```http
Authorization: Bearer <token>
```

## Auth

### POST `/auth/register`

Request:

```json
{
  "name": "Isaiah Cruz",
  "email": "isaiah@example.com",
  "password": "password123"
}
```

Response `201`:

```json
{
  "user": {
    "id": "uuid",
    "name": "Isaiah Cruz",
    "email": "isaiah@example.com"
  },
  "token": "jwt"
}
```

### POST `/auth/login`

Request:

```json
{
  "email": "isaiah@example.com",
  "password": "password123"
}
```

## Resources

### GET `/resources`

Returns curated FAU resource links.

## Saved Resources

### GET `/saved`

Returns the signed-in user's saved FAU resources.

### POST `/saved`

Request:

```json
{
  "title": "Registrar",
  "url": "https://www.fau.edu/registrar/",
  "category": "Academics",
  "notes": "Registration and transcript info"
}
```

### PUT `/saved/:id`

Request:

```json
{
  "notes": "Important page for class withdrawal."
}
```

### DELETE `/saved/:id`

Returns `204`.

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
  "answer": "These FAU resources are the best starting points.",
  "matches": [
    {
      "resourceId": "controller",
      "reason": "This page covers tuition billing and payments.",
      "confidence": "high"
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

## Common Errors

- `400` invalid input
- `401` unauthorized
- `404` saved resource not found
- `429` AI rate limit reached
- `503` OpenAI API key missing
