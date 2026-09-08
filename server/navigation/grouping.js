// Presentation only. A polyline does not establish that there are no junctions,
// so grouped instructions retain EVERY maneuver, in its original order.
export const GROUPING_LIMITS = Object.freeze({ maxMeters: 100, maxInstructions: 3, maxDeviationMeters: 20, minEfficiency: .75, maxBackwardMeters: 3 });
const generic = /^(?:Turn (?:left|right)|Keep (?:left|right)|Continue straight)\.?$/i;
const trimPeriod = text => text.replace(/\.$/, '');
const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);

function assess(group, route, metrics, evidence) {
  if (!metrics || group.some(entry => entry.stepIndices.length !== 1)) return null;
  const steps = group.map(entry => route.steps[entry.stepIndices[0]]);
  // Named path transitions, arrivals, roundabouts, stairs, crossings, and unknown
  // maneuver forms remain standalone. Enriched text on the FINAL leg is retained.
  if (steps.some(step => !generic.test(step.instruction.trim()) || !Number.isFinite(step.distance) || step.distance <= 0)) return null;
  if (group.slice(0, -1).some(entry => evidence.some(e => entry.stepIndices.includes(e.stepIndex)))) return null;
  for (let i = 1; i < group.length; i++) {
    if (group[i - 1].end !== group[i].start || group[i - 1].stepIndices.at(-1) + 1 !== group[i].stepIndices[0]) return null;
  }
  const start = group[0].start, end = group.at(-1).end;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= metrics.points.length || end <= start) return null;
  const length = metrics.cumulative[end] - metrics.cumulative[start];
  const orsDistance = steps.reduce((sum, step) => sum + step.distance, 0);
  if (length <= 0 || Math.max(length, orsDistance) > GROUPING_LIMITS.maxMeters) return null;
  const points = metrics.points.slice(start, end + 1);
  const a = points[0], b = points.at(-1);
  const dx = b[0] - a[0], dy = b[1] - a[1], chord = Math.hypot(dx, dy);
  const efficiency = chord / length;
  if (efficiency < GROUPING_LIMITS.minEfficiency) return null;
  const along = points.map(p => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / chord);
  const deviation = Math.max(...points.map(p => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / chord));
  if (deviation > GROUPING_LIMITS.maxDeviationMeters || along.some((distance, i) => i && distance < along[i - 1] - GROUPING_LIMITS.maxBackwardMeters)) return null;
  return { distanceMeters: orsDistance, geometryMeters: length, deviationMeters: deviation, efficiency };
}

/** Reduce list fragmentation without claiming a single walkway or omitting turns.
 * Each input entry corresponds to one already-formatted display instruction.
 * Merge evidence uses 1-based display/ORS indices for before/after review.
 */
export function groupMicroDirections(entries, route, metrics, evidence = []) {
  const directions = [], merges = [];
  for (let i = 0; i < entries.length; i++) {
    let count = 1, measurements;
    for (let size = 2; size <= GROUPING_LIMITS.maxInstructions && i + size <= entries.length; size++) {
      const result = assess(entries.slice(i, i + size), route, metrics, evidence);
      if (result) { count = size; measurements = result; }
    }
    if (count === 1) { directions.push(entries[i].text); continue; }
    const group = entries.slice(i, i + count);
    let text = trimPeriod(group[0].text);
    for (let j = 1; j < group.length; j++) {
      text += `; continue a short distance, then ${lowerFirst(trimPeriod(group[j].text))}`;
    }
    directions.push(`${text}.`);
    merges.push({ inputSteps: group.map((_entry, j) => i + j + 1), orsSteps: group.flatMap(entry => entry.stepIndices.map(index => index + 1)), outputStep: directions.length, ...measurements,
      reason: 'Contiguous unnamed legs in a short corridor, with no intervening validated landmark instruction; all maneuvers and final landmark wording retained.' });
    i += count - 1;
  }
  return { directions, merges };
}
