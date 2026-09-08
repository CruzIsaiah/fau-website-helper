# FAU Website Helper

FAU Website Helper is an AI-powered mini-project that helps students find the right FAU page and understand confusing website text.

## Features

- No account or login required
- Saved links persist in the user's browser
- Curated directory of common FAU resources
- Saved FAU links and notes with CRUD operations
- AI resource finder for plain-English student questions
- AI page summarizer from a public FAU link, with optional pasted text fallback
- Loading states, validation, friendly errors, and AI rate limiting
- Automated tests for public resources, validation, and AI endpoints

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
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.4-mini
CLIENT_ORIGIN=http://localhost:5174
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:5174`.

Supabase is optional and is not required to use the site. Never commit API keys.

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

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CLIENT_ORIGIN`

Live app URL: https://fau-helper.vercel.app

Demo video: https://drive.google.com/file/d/1VOMY6_-Y3Xr-JkQw8tWas5NbN7kdSmaX/view?usp=drive_link

## Documentation

- Endpoint documentation: `docs/API.md`
- Cost analysis: `docs/COST_ANALYSIS.md`
- Demo script: `docs/DEMO_SCRIPT.md`
- Planning notes, wireframe, architecture: `docs/PLANNING.md`
- Supabase schema: `docs/DATABASE_SCHEMA.sql`
- Postman collection: `docs/postman_collection.json`

### Campus navigation

Ask the existing assistant “I'm at the gym how do I get to the cafeteria” or open `/map`.
The map supports From/To suggestions, common aliases, swapping, and shareable query
parameters (`/map?from=gym&to=cafeteria`). Generated links use stable KML location IDs
to preserve explicit choices, including places with duplicate names.

Set `ORS_API_KEY` in the **server** environment to enable OpenRouteService's
`foot-walking` directions API at
`https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson`.
Obtain a key at https://openrouteservice.org/dev/;
restart the server after configuring it. No routing secret is sent to the browser.
The Leaflet map uses OpenStreetMap tiles and needs internet access; routing has a
10-second timeout. Without a key, on quota errors, or if a route cannot be found,
the app shows the official endpoint pins and a Google Maps link prefilled with
exact KML coordinates and walking mode. It does not draw a straight-line route
or fabricate a duration. Live walking routes require a valid key and provider
coverage. KML points are location pins, not verified entrances; routes do not
claim indoor navigation or accessibility. OpenStreetMap tile usage policy:
https://operations.osmfoundation.org/policies/tiles/ .

Implementation:
- `server/navigation/data/campus.kml`: supplied authoritative map. Replace this file
  and restart/redeploy to refresh the dataset; no manual location table to update.
- `locations.js`: XML parser/loader, point coordinates, folder/category metadata,
  duplicate pin merging, deterministic IDs. Lines/polygons are not routed.
- `aliases.js` and `resolver.js`: configured aliases first, exact official names
  and building codes, substring/fuzzy matching, then explicit ambiguity choices.
  Official building pins take priority over same-name wellness amenity pins.
- `intent.js`: explicit origin/destination patterns (including “from … to …”,
  “I'm at … how do I get to …”, and known-location shorthand). `/api/ai/find` and
  `/api/ai/research` dispatch navigation before retrieval. Normal RAG is unchanged.
- `provider.js`: replaceable `getWalkingRoute(origin, destination)` adapter returning
  GeoJSON, meters, seconds and provider maneuvers.
- `directions.js` / `service.js`: conservative instruction cleanup, geometry-based
  proximity landmarks, fallback states and exact-coordinate external links.
- `client/src/navigation/`: response card, map page, autocomplete and Leaflet view.

API: `GET /api/navigation/locations?q=gym` and
`POST /api/navigation/route` with `{ "from": "gym", "to": "cafeteria" }`.
Responses distinguish `ready`, `needs_locations`, `same_location`, `unavailable`.

Run `npm run check`. Navigation tests cover all five requested endpoint pairs,
natural-language examples, ambiguity, unknown locations, same-location handling,
provider contract, malformed/error responses, coordinate links and conservative
formatting. Provider success tests use fixtures, not verified real campus routes.

Campus instruction formatting is shared by the assistant and map through
`formatCampusDirections(route, origin, destination, campusLocations)` in
`server/navigation/directions.js`. Its geometry helpers are in `landmarks.js`.
It uses ORS step waypoint indices, not a straight line between endpoints.
Up to three distinct landmarks are selected from official buildings, dining/retail,
and parking points within 40 meters of the applicable route leg. Major buildings
rank above dining/parking; colocated and duplicate pins, minor amenity layers,
and charging stations are suppressed. Endpoint-adjacent pins are suppressed in
favor of the selected origin/destination.

“Toward” requires measurable progress toward the pin on that leg without material
backtracking. “Past” requires a pin within 20 meters and route travel both before
and after it. “Near” a turn requires the pin within 20 meters of the maneuver.
Arrival sides require both the original ORS side and an independently agreeing
KML pin position relative to the final approach. No entrances, visibility, or
unnamed walkways are inferred. Unsupported instructions retain the original ORS
wording. Short contiguous legs (12 meters or less) can share a sentence with the
next maneuver, retaining both maneuvers and their order; only repeated
straight continuations are collapsed. The original route object is never changed.

`server/__tests__/fixtures/campus-walking-routes.json` contains five actual ORS
responses fetched for regression testing (not a route cache or replacement for
live routing). `server/__tests__/directions.test.js` independently checks every
referenced pin against its route leg, preserves all turn sequences, and tests
ambiguous geometry and missing data. See `docs/CAMPUS_DIRECTIONS_VERIFICATION.md`
for the route-by-route wording and measured landmark distances.

`server/navigation/grouping.js` adds a presentation-only grouping pass after the
existing landmark wording and short-leg combinations. It groups up to three
contiguous generic maneuver instructions within 100 meters (checked against both
ORS distances and route geometry), with a displacement/path ratio of at least
0.75, corridor deviation at most 20 meters, and backward movement at most 3 meters.
Named transitions, arrivals, and intervening validated landmark instructions are
boundaries. Every turn is retained, with natural short-distance connectors between maneuvers;
geometry alone cannot prove that omitted turns would be unambiguous. No landmark
selection, KML proximity checks, arrival-side checks, ORS geometry, route time,
or route distance is changed. Grouping audit metadata is available in the
formatter's `merges` result. The route API continues to use the same response UI.

See `docs/CAMPUS_DIRECTION_GROUPING.md` for current directions, before/after
counts, measured merge justification, and routes intentionally left ungrouped.
`docs/CAMPUS_DIRECTIONS_VERIFICATION.md` records the earlier landmark-formatting
verification before this grouping pass.

Short connector measurements remain internal to the grouping checks. Individual
instructions use “a short distance” instead of numeric meter measurements; the
route summary retains its original total distance and estimated walking time.

Campus route summaries are generated separately by `server/navigation/summary.js`
from the formatter's validated evidence, KML names, ordered step ranges, and
explicit ORS on/onto path names. They use at most two intermediate landmarks,
preserve supported toward/past relationships and arrival sides, and never infer
entrances, shortcuts, a campus center, or unnamed walkways. A path name and
landmark are combined only when supported on the same ORS leg. Missing evidence
falls back to the endpoints and highlighted route.

Both map and assistant responses use `navigate()` and the same `NavigationCard`:
`summary` is primary, and a native “Show detailed directions” disclosure contains
the unchanged `directions` list. No route geometry, time, distance, maneuver,
grouping, or landmark validation changes are made by this layer. The API also
returns `summaryLandmarks` and `summaryPaths` to audit the summary's sources.
See `docs/CAMPUS_ROUTE_SUMMARIES.md` for all five verified summaries and references.
