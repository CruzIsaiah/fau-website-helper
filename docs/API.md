# API Documentation

Base URL: `http://localhost:5001/api`

Authenticated endpoints require:

```http
Authorization: Bearer <token>
```

## Health

### GET `/health`

Response:

```json
{
  "status": "ok",
  "aiConfigured": true
}
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
    "email": "isaiah@example.com",
    "createdAt": "2026-07-05T00:00:00.000Z"
  },
  "token": "jwt"
}
```

Errors:

- `400` invalid input
- `409` account already exists

### POST `/auth/login`

Request:

```json
{
  "email": "isaiah@example.com",
  "password": "password123"
}
```

Response `200`:

```json
{
  "user": {
    "id": "uuid",
    "name": "Isaiah Cruz",
    "email": "isaiah@example.com",
    "createdAt": "2026-07-05T00:00:00.000Z"
  },
  "token": "jwt"
}
```

Errors:

- `400` invalid input
- `401` incorrect credentials

## Tasks

### GET `/tasks`

Response `200`:

```json
{
  "tasks": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Finish AI project",
      "description": "Add docs and tests",
      "priority": "high",
      "status": "todo",
      "dueDate": "2026-07-10",
      "createdAt": "2026-07-05T00:00:00.000Z",
      "updatedAt": "2026-07-05T00:00:00.000Z"
    }
  ]
}
```

### POST `/tasks`

Request:

```json
{
  "title": "Finish AI project",
  "description": "Add OpenAI task suggestions",
  "priority": "high",
  "status": "todo",
  "dueDate": "2026-07-10"
}
```

Response `201`:

```json
{
  "task": {
    "id": "uuid",
    "title": "Finish AI project",
    "description": "Add OpenAI task suggestions",
    "priority": "high",
    "status": "todo",
    "dueDate": "2026-07-10"
  }
}
```

### PUT `/tasks/:id`

Request:

```json
{
  "status": "done"
}
```

Response `200`:

```json
{
  "task": {
    "id": "uuid",
    "title": "Finish AI project",
    "status": "done"
  }
}
```

Errors:

- `400` invalid input
- `404` task not found

### DELETE `/tasks/:id`

Response `204` with no body.

Errors:

- `404` task not found

## AI

### POST `/ai/suggestions`

Request:

```json
{
  "goal": "Prepare for finals while working part-time",
  "context": "Current task list or notes"
}
```

Response `200`:

```json
{
  "suggestions": [
    {
      "title": "Create a finals study calendar",
      "description": "Block review time for each course around work shifts.",
      "priority": "high"
    }
  ]
}
```

Errors:

- `400` invalid input
- `401` unauthorized
- `429` AI rate limit reached
- `503` missing OpenAI API key

### POST `/ai/insights`

Request:

```json
{
  "text": "I have two assignments, a quiz, and a work shift tomorrow."
}
```

Response `200`:

```json
{
  "summary": "The user has several near-term obligations.",
  "sentiment": "stressed",
  "nextStep": "Prioritize the quiz and split the assignments into smaller tasks."
}
```

Errors:

- `400` invalid input
- `401` unauthorized
- `429` AI rate limit reached
- `503` missing OpenAI API key
