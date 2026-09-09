# Production walking-route investigation

## Confirmed observations (2026-09-08)

- Production before this patch: `dpl_ERgSwjuzE9trUMuySc3fsMAK4Ysy`, commit
  `d5207dfa9b1fa97117d94d95d6ffb25871a92af3`, a redeploy of the older navigation
  commit. Its logs still show `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
- A separate ready deployment, `dpl_6Gp4NGjECApB8PmNUV6BKXqsjgpN`, contains
  `b9c37779dcd15a1e0847d4f75e28183d255c3430` (the trust-proxy fix).
  An authenticated request to this deployment also returned HTTP 200 with
  `status: "unavailable"`; its invocation log had no proxy warning.
- Active production resolved gym and cafeteria to the correct KML pins and
  returned the fallback in about 609 ms. This is not an Express 429 rejection or
  a Vercel function-timeout response. Missing KML bundling is not the failing
  boundary for this request.
- Vercel lists `ORS_API_KEY` with the exact expected spelling and Production
  scope. A CLI export from a clean directory exposed no usable secret value;
  that does **not** prove the function's environment value is empty. The local
  `.env` must not be allowed to mask this when checking Production configuration.
- The project is configured for Node 24.x; local commands use Node 22.x.
  The API is a Node Express handler (`api/index.js`), not an Edge function.

The underlying routing/formatting exception cannot be proven from the old logs:
`provider.js` discarded non-2xx response details, and `service.js` silently caught
provider, direction-formatting, and summary exceptions in the same fallback.
The proxy warning is a separate confirmed deployment/configuration issue.

## Request path reviewed

1. Map: `MapPage.jsx` posts JSON `{from,to}` to `/api/navigation/route`.
   Assistant: `App.jsx` posts to `/api/ai/find`; navigation intent dispatches
   through the same service before RAG. `/api/ai/research` also dispatches it.
2. Development: Vite proxies `/api` to Express on port 5010.
   Production: `vercel.json` rewrites `/api/(.*)` to `/api/index`, which exports
   `createApp()`. Actual successful location resolution and API responses verify
   this boundary. The SPA rewrite comes after the API rewrite.
3. Express sets `trust proxy` to 1 before the existing 20-request/15-minute
   limiter. No limiter is disabled or loosened by this patch.
4. `navigate()` resolves names/IDs from the KML, then creates the walking provider.
   The provider reads `process.env.ORS_API_KEY` on construction (per route request),
   not at module import. `dotenv.config()` supports local development; Vercel
   supplies the runtime environment. There is no navigation-only Production branch.
5. The provider sends POST to
   `https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson`,
   using `Authorization: <key>`, JSON content type, and coordinates in
   `[longitude, latitude]` order. No Bearer prefix or browser key is introduced.
   This is the [official replacement endpoint](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912).
6. The existing 10-second abort signal covers fetch/body consumption. Validated
   geometry goes through the unchanged directions and summary formatters.

## Patch

- `diagnostics.js`: correlated structured server logs, credential redaction,
  bounded error text, and an allowlist for JSON provider error bodies. No
  request headers, questions, coordinates, or environment dumps are logged.
- `provider.js`: trim surrounding key whitespace; log key presence, URL, method,
  timeout, response status, sanitized error body, phase, elapsed time, exception
  name/message, and network cause code. Retain the original request, timeout,
  geometry validation, return shape, and thrown failures.
- `service.js`: log the precise fallback stage (`routing`, `directions`, or
  `summary`). The public fallback message and response remain unchanged.
- `app.js`: pass a generated request ID and Express request path through all
  navigation entrypoints. Existing proxy and limiter settings remain intact.
- Tests: missing key, whitespace, HTTP 401/403/429/503, malformed/invalid success
  bodies, timeout/network errors, formatter failures, credential redaction,
  unchanged successful request contract, and forwarded-IP limiter enforcement.

Whitespace normalization is defensive; it is not claimed as the proven
Production root cause. No route/UI rewrite or runtime-duration change is made
without evidence supporting it.

## Production verification after deployment

The working tree patch was deployed to Production as
`dpl_33ammhEGoCpYYd47PuWjR1tAS3hZ`, aliased to
`https://fau-website-helper.vercel.app`. The Vercel build succeeded; `/` and
`/map` returned HTTP 200. This was a local working tree deployment, so its Git
metadata still names baseline commit `b9c3777`; the new diagnostic events confirm
that the patch ran.

The gym → cafeteria production request returned HTTP 200 with the existing
`unavailable` fallback. Correlated logs for request
`aeb3ef5e-8699-4bf2-bcd4-3f202444a6c2` establish the failing boundary:

- `keyExists: true`, `keyWhitespaceNormalized: false` in the Production function.
- The expected ORS POST returned HTTP **403** after 321 ms.
- Sanitized ORS error: **Access to this API has been disallowed**.
- The service failed at `routing`; direction and summary formatting were never
  reached. This invocation had no forwarded-proxy warning.

The existing local `.env` credential was separately tested against the same
endpoint and coordinates: ORS returned HTTP 200, 464.6 m, 334.5 seconds. This
confirms that the local credential works, but does not establish whether the
Production credential differs or why the provider rejected Production access.

The initial secret update was blocked before execution pending explicit user
approval. The user subsequently approved replacing Production's `ORS_API_KEY`
with the verified local key. The update succeeded through private stdin, keeping
the variable sensitive and scoped to Production. Neither credential is included
in source files or this report.

The same application code was redeployed successfully as
`dpl_JBe9bAQYhgYjRJc6uwTipa3zc58F`, now serving
`https://fau-website-helper.vercel.app`. All five route checks returned HTTP 200
and `status: "ready"`, with geometry, detailed directions, and both route links:

| Route | ORS distance (m) | ORS duration (s) | Detailed steps |
| --- | ---: | ---: | ---: |
| College of Medicine → Engineering and Computer Science | 220.6 | 158.8 | 3 |
| Recreation and Fitness Center → Student Services & Food Court | 464.6 | 334.5 | 3 |
| Wimberly Library → Student Union | 363.4 | 261.6 | 5 |
| Engineering East → Starbucks | 722.7 | 520.3 | 7 |
| Student Union → Bookstore | 367.3 | 264.5 | 6 |

Both `/api/ai/find` and `/api/ai/research` also returned ready navigation for
"I'm at the gym, how do I get to the cafeteria?" Correlated production logs
confirm ORS HTTP 200 and `ready` for all seven requests, without proxy warnings.
Replacing the Production credential resolved the routing failure with no further
application-code change. The exact reason ORS rejected the previous credential
(for example invalidity or access permissions) is not revealed by its 403 body.

For subsequent checks, filter Vercel logs for `campus-navigation` and group
entries by `requestId`. Use `deployment` and diagnostic events to verify which
code ran; uncommitted deployments retain their baseline Git commit metadata.

| Evidence | Meaning / next check |
| --- | --- |
| `ors.request`, `keyExists: false`; `ROUTING_NOT_CONFIGURED` | Key absent/blank in that function invocation. Check deployment environment scope. |
| `ors.http.failed`, status 401/403 | Provider rejected access. Sanitized provider body distinguishes the stated credential/permission reason. |
| `ors.http.failed`, status 429 | ORS quota/rate limit, separate from Express's HTTP 429. |
| `ors.http.failed`, status 5xx | Upstream provider failure; inspect sanitized body. |
| `ors.failed`, phase `fetch`, `TypeError`, `causeCode` | DNS, TLS, or transport failure; cause code narrows it. |
| `TimeoutError` / `AbortError` | Provider fetch or body consumption timed out/aborted. |
| HTTP 200 then phase `response_body`, `SyntaxError` | Non-JSON/malformed success body. |
| HTTP 200 then phase `validation`, `INVALID_ROUTE` | No valid walking geometry/summary in the response. |
| `request.failed`, stage `directions` or `summary` | Routing succeeded; formatting produced the fallback. Exception identifies the issue. |
| `ors.request` then no completion and a platform timeout | Check Vercel invocation termination; the process may have ended before logging. |
| `ready` | Walking route and formatting completed. |

No log contains the ORS key. The API exposes no secret or provider error body.
