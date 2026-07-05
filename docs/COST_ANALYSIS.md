# AI Cost Analysis

Provider: OpenAI  
Default model: `gpt-5.4-mini`  
Pricing source: https://platform.openai.com/docs/pricing  
Date checked: July 5, 2026

OpenAI lists API prices per 1 million tokens. On the pricing page, `gpt-5.4-mini` standard short-context pricing is:

- Input: $0.75 per 1M tokens
- Cached input: $0.075 per 1M tokens
- Output: $4.50 per 1M tokens

## Estimated Usage

This app has two AI calls:

- Task suggestions: about 500 input tokens and 300 output tokens
- Task insights: about 700 input tokens and 200 output tokens

Estimated cost per task suggestion request:

- Input: 500 / 1,000,000 * $0.75 = $0.000375
- Output: 300 / 1,000,000 * $4.50 = $0.00135
- Total: about $0.001725

Estimated cost per insight request:

- Input: 700 / 1,000,000 * $0.75 = $0.000525
- Output: 200 / 1,000,000 * $4.50 = $0.0009
- Total: about $0.001425

## Classroom Demo Estimate

For a 3-5 minute demo using:

- 5 task suggestion requests
- 5 insight requests

Estimated cost:

- Suggestions: 5 * $0.001725 = $0.008625
- Insights: 5 * $0.001425 = $0.007125
- Total: about $0.016

## Monthly Low-Usage Estimate

For 1,000 total AI requests per month split evenly:

- 500 suggestions: about $0.86
- 500 insights: about $0.71
- Total: about $1.57 per month

Actual cost depends on prompt length, task list length, output length, selected model, and current OpenAI pricing.

## Cost Controls

- AI endpoints are rate-limited to 20 requests per 15 minutes per client.
- Prompts are short and request compact JSON.
- The model is configurable with `OPENAI_MODEL`.
- The UI only calls AI when the user presses an AI action button.
