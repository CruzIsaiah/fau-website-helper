import { groupMicroDirections } from './grouping.js';
import { LANDMARK_RADIUS_METERS, nearestOnSection, routeLandmarkCandidates, routeMetrics, separation, stepRange } from './landmarks.js';
const plain = text => (typeof text === 'string' ? text : '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const shortName = location => location.name.replace(/\s*\([A-Z]{1,4}-\d+[A-Z]?\)/g, '').trim();
const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);
const withoutPeriod = text => text.replace(/[.]$/, '');
const heading = /^(?:Head|Proceed|Walk) (?:north|south|east|west|northeast|northwest|southeast|southwest)(?: on (?:-|unnamed (?:road|path|pedestrian path)))?\.?$/i;
const turn = /^(?:Turn|Keep|Bear) (?:slightly |sharp |slight )?(?:left|right)(?:\b.*)?$/i;
const straight = /^(?:Continue straight|Continue|Go straight)\.?$/i;

function relation(metrics, range, location) {
  const point = metrics.project([location.lng, location.lat]);
  const section = metrics.points.slice(range.start, range.end + 1);
  const near = nearestOnSection(metrics, location, range.start, range.end);
  if (near.distance > LANDMARK_RADIUS_METERS) return null;
  const length = metrics.cumulative[range.end] - metrics.cumulative[range.start];
  const distances = section.map(p => separation(point, p));
  // "Toward" requires actual progress and no material movement away, with the
  // landmark near the far end. Proximity somewhere on a looping leg is not enough.
  const toward = length >= 15 && near.along >= 15 && length - near.along <= 30
    && distances[0] - distances.at(-1) >= 12
    && distances.every((d, i) => i === 0 || d <= distances[i - 1] + 1);
  // "Past" requires approach AND departure on this same leg, not merely a pin
  // close to a corner, the origin, the destination, or a parallel later segment.
  const past = near.distance <= 20 && near.along >= 20 && length - near.along >= 20
    && distances[0] > near.distance + 15 && distances.at(-1) > near.distance + 15;
  return { ...near, toward, past, atTurn: distances[0] <= 20 };
}

/** Shared map/chat formatter. Evidence is returned for regression audits only.
 * Original route, steps and locations are never mutated. Unknown instructions
 * and missing/invalid waypoint ranges retain the original ORS text.
 */
export function formatCampusDirections(route, origin, destination, locations = []) {
  const metrics = routeMetrics(route.geometry?.coordinates);
  const candidates = routeLandmarkCandidates(metrics, locations, origin, destination);
  const used = new Set(); const evidence = []; const landmarks = [];
  const entries = (route.steps || []).map((step, index) => {
    const original = plain(step.instruction);
    const range = stepRange(step, metrics);
    let text = original;
    if (!range || !original) return { stepIndex: index, text, step, range };
    if (/^Arrive\b/i.test(original) && range.end === metrics.points.length - 1) {
      const pin = metrics.project([destination.lng, destination.lat]);
      const end = metrics.points[range.end];
      const offset = separation(end, pin);
      if (offset <= LANDMARK_RADIUS_METERS) {
        // Do not transfer ORS's snapped endpoint side to a building pin unless
        // the final non-zero approach segment independently agrees with it.
        let previous = range.end - 1;
        while (previous >= 0 && separation(end, metrics.points[previous]) < 1) previous--;
        let side = '';
        if (previous >= 0) {
          const start = metrics.points[previous];
          const lateral = ((end[0] - start[0]) * (pin[1] - end[1]) - (end[1] - start[1]) * (pin[0] - end[0])) / separation(end, start);
          if (lateral > 5 && /on the left/i.test(original)) side = ', on your left';
          if (lateral < -5 && /on the right/i.test(original)) side = ', on your right';
        }
        text = `Arrive near ${shortName(destination)}${side}.`;
        evidence.push({ stepIndex: index, locationId: destination.id, relationship: side ? `arrival_${side.includes('left') ? 'left' : 'right'}` : 'arrival', distanceMeters: offset, wayPoints: [range.start, range.end] });
      }
      return { stepIndex: index, text, step, range, original };
    }
    const genericHeading = heading.test(original);
    const genericStraight = straight.test(original);
    const turnInstruction = turn.test(original);
    if (used.size < 3 && (genericHeading || genericStraight || turnInstruction)) {
      // Destination can be a useful "toward" cue, but never a "past" landmark.
      const options = [...candidates.filter(c => c.importance >= 2), { location: destination }, ...candidates.filter(c => c.importance < 2)].filter(c => !used.has(c.location.id));
      for (const { location } of options) {
        const context = relation(metrics, range, location);
        if (!context) continue;
        const name = shortName(location);
        let relationship;
        if (context.toward) {
          text = genericHeading || genericStraight ? `Walk toward ${name}.` : `${withoutPeriod(original)} and continue toward ${name}.`;
          relationship = 'toward';
        } else if (context.past && location.id !== destination.id && !genericHeading) {
          text = genericStraight ? `Continue past ${name}.` : `${withoutPeriod(original)} and continue past ${name}.`;
          relationship = 'past';
        } else if (turnInstruction && context.atTurn && location.id !== destination.id) {
          text = `${withoutPeriod(original)} near ${name}.`;
          relationship = 'near';
        } else continue;
        used.add(location.id);
        landmarks.push({ id: location.id, name: location.name });
        evidence.push({ stepIndex: index, locationId: location.id, relationship, distanceMeters: context.distance, wayPoints: [range.start, range.end] });
        break;
      }
    }
    return { stepIndex: index, text, step, range, original };
  }).filter(e => e.text);

  const formatted = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i], next = entries[i + 1];
    const adjacent = entry.range && next?.range && entry.range.end === next.range.start && entry.range.end > entry.range.start;
    // Collapse only redundant straight continuations. Repeated turns are retained.
    if (adjacent && straight.test(entry.text) && entry.text === next.text) continue;
    const shortLeg = Number.isFinite(entry.step.distance) && entry.step.distance > 0 && entry.step.distance <= 12;
    const nextIsManeuver = next && (turn.test(next.original || '') || /^Arrive\b/i.test(next.original || ''));
    if (adjacent && shortLeg && nextIsManeuver && (heading.test(entry.original || '') || turn.test(entry.original || '') || straight.test(entry.original || ''))) {
      // Preserve both maneuvers and their sequence; short connector lengths stay internal.
      formatted.push({ text: `${withoutPeriod(entry.text)}${turn.test(entry.original || '') ? ', continue a short distance' : ' a short distance'}, then ${lowerFirst(next.text)}`, stepIndices: [entry.stepIndex, next.stepIndex], start: entry.range.start, end: next.range.end });
      i++;
    } else formatted.push({ text: entry.text, stepIndices: [entry.stepIndex], start: entry.range?.start, end: entry.range?.end });
  }
  const { directions, merges } = groupMicroDirections(formatted, route, metrics, evidence);
  if (directions.length && metrics && entries[0]?.range?.start === 0 && heading.test(entries[0].original || '')
    && separation(metrics.points[0], metrics.project([origin.lng, origin.lat])) <= 40) {
    directions[0] = `From ${shortName(origin)}, ${lowerFirst(directions[0])}`;
  }
  return { directions: directions.length ? directions : [`Follow the highlighted walking route from ${origin.name} to ${destination.name}.`], landmarks, evidence, merges };
}
export function formatDirections(route, origin, destination, locations = []) {
  return formatCampusDirections(route, origin, destination, locations).directions;
}
export function nearbyLandmarks(route, locations, origin, destination) {
  const metrics = routeMetrics(route.geometry?.coordinates);
  return routeLandmarkCandidates(metrics, locations, origin, destination).slice(0, 3).sort((a, b) => a.along - b.along).map(c => ({ id: c.location.id, name: c.location.name }));
}
