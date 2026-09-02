# AI Cost Analysis

Provider: OpenAI  
Default model: `gpt-5.4-mini`  
Pricing source: https://platform.openai.com/docs/pricing  
Date checked: July 5, 2026

OpenAI lists `gpt-5.4-mini` short-context standard pricing as:

- Input: $0.75 per 1M tokens
- Cached input: $0.075 per 1M tokens
- Output: $4.50 per 1M tokens

## Estimated Requests

AI resource finder:

- Input: about 1,200 tokens
- Output: about 250 tokens
- Estimated cost: about $0.0020 per request

AI page summarizer:

- Input: about 1,500 tokens
- Output: about 350 tokens
- Estimated cost: about $0.0027 per request

## Demo Estimate

For a 3-5 minute demo using 5 finder requests and 5 summarizer requests:

- Finder: about $0.010
- Summarizer: about $0.014
- Total: about $0.024

Actual cost depends on selected model, pasted page length, output length, and current OpenAI pricing.

## Cost Controls

- AI routes are limited to 20 requests per 15 minutes per client.
- The resource finder uses a compact curated directory instead of scraping large pages.
- The model is configurable through `OPENAI_MODEL`.
