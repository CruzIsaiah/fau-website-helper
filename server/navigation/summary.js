import { routeMetrics, stepRange } from './landmarks.js';
const nameOf = location => location.name.replace(/\s*\([A-Z]{1,4}-\d+[A-Z]?\)/g, '').trim();
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
const firstAndLast = items => items.length <= 2 ? items : [items[0], items.at(-1)];

// This is a narrative layer over the formatter's existing evidence. It never
// simplifies maneuvers, expands a landmark relationship, or infers a named path.
export function generateCampusSummary(route, origin, destination, locations = [], evidence = []) {
  const metrics = routeMetrics(route.geometry?.coordinates);
  const fallback = { summary: `Follow the highlighted walking route from ${nameOf(origin)} to ${nameOf(destination)}.`, summaryLandmarks: [], summaryPaths: [] };
  if (!metrics) return fallback;
  const steps = route.steps || [];
  const ranges = steps.map(s => stepRange(s, metrics));
  if (ranges.some((r, i) => !r || (i > 0 && r.start < ranges[i - 1].end))) return fallback;
  const pins = new Map([...locations, origin, destination].map(l => [l.id, l]));
  const valid = evidence.filter(e => {
    const range = ranges[e.stepIndex];
    return range && pins.has(e.locationId) && e.wayPoints?.[0] === range.start && e.wayPoints?.[1] === range.end;
  }).sort((a, b) => a.stepIndex - b.stepIndex);
  // A 'near this turn' cue alone does not imply progress toward or past a building.
  const progression = valid.filter(e => ['toward', 'past'].includes(e.relationship) && e.locationId !== origin.id);
  const intermediate = firstAndLast(progression.filter(e => e.locationId !== destination.id));
  const terminal = progression.filter(e => e.locationId === destination.id).at(-1);
  const selected = [...intermediate, ...(terminal ? [terminal] : [])];
  const paths = [];
  steps.forEach((step, stepIndex) => {
    // Only explicit ORS on/onto transitions are named. Arrival labels are not paths.
    const match = step.instruction?.match(/^(?:Turn|Keep|Bear|Continue|Head|Proceed|Walk)\b.*?\b(?:onto|on)\s+(.+?)\.?$/i);
    const name = match?.[1].trim();
    if (!name || /^-+$|^unnamed\b/i.test(name) || /[<>]|\b\d+\s*(?:meters?|metres?)\b/i.test(name)) return;
    if (paths.at(-1)?.name !== name) paths.push({ name, stepIndex });
  });
  const selectedPaths = firstAndLast(paths);
  const indices = [...new Set([...selected.map(e => e.stepIndex), ...selectedPaths.map(p => p.stepIndex)])].sort((a, b) => a - b);
  const clauses = indices.map((index, i) => {
    const cue = selected.find(e => e.stepIndex === index);
    const path = selectedPaths.find(p => p.stepIndex === index);
    const relation = cue ? `${cue.relationship} ${nameOf(pins.get(cue.locationId))}` : '';
    if (path) return i === 0
      ? `follow the route to ${path.name}${cue ? ` and continue ${relation}` : ''}`
      : `follow ${path.name}${cue ? ` ${relation}` : ''}`;
    return `${i === 0 ? 'follow the route' : 'continue'} ${relation}`;
  });
  // At most two progression sentences (two or three clauses each), then arrival.
  const sentences = [];
  if (clauses.length) {
    sentences.push(`From ${nameOf(origin)}, ${clauses.slice(0, 2).join(', then ')}.`);
    if (clauses.length > 2) sentences.push(`${capitalize(clauses.slice(2).join(', then '))}.`);
  } else sentences.push(fallback.summary);
  const arrival = valid.find(e => e.locationId === destination.id && ['arrival', 'arrival_left', 'arrival_right'].includes(e.relationship) && ranges[e.stepIndex].end === metrics.points.length - 1);
  const includeArrival = arrival && (arrival.relationship !== 'arrival' || !terminal);
  if (includeArrival) {
    const side = arrival.relationship === 'arrival_left' ? ', on your left' : arrival.relationship === 'arrival_right' ? ', on your right' : '';
    // Preserve 'near'; never turn a nearby pin into an entrance or 'ahead' claim.
    sentences.push(`Finish near ${nameOf(destination)}${side}.`);
  }
  if (!arrival && !terminal && clauses.length) sentences.push(`Continue along the highlighted route to ${nameOf(destination)}.`);
  return {
    summary: sentences.join(' '),
    summaryLandmarks: [...selected, ...(includeArrival ? [arrival] : [])].sort((a, b) => a.stepIndex - b.stepIndex).map(e => ({ id: e.locationId, name: pins.get(e.locationId).name, relationship: e.relationship, stepIndex: e.stepIndex })),
    summaryPaths: selectedPaths
  };
}
