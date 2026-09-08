// All measurements are local planar meters. No visibility, entrances or map topology
// can be inferred from a KML point. These bounds support proximity claims only.
export const LANDMARK_RADIUS_METERS = 40;
const radians = Math.PI / 180;
export function routeMetrics(coordinates) {
  if (!Array.isArray(coordinates) || !coordinates.length || !coordinates.every(p => Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every(Number.isFinite))) return null;
  const [lng, lat] = coordinates[0];
  const project = p => [(p[0] - lng) * 111320 * Math.cos(lat * radians), (p[1] - lat) * 111320];
  const points = coordinates.map(project);
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, cumulative, project };
}
export const separation = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function nearestOnSection(metrics, location, start = 0, end = metrics.points.length - 1) {
  const point = metrics.project([location.lng, location.lat]);
  let best = { distance: separation(point, metrics.points[start]), along: 0 };
  for (let i = start; i < end; i++) {
    const a = metrics.points[i], b = metrics.points[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const distance = separation(point, [a[0] + t * dx, a[1] + t * dy]);
    if (distance < best.distance) best = { distance, along: metrics.cumulative[i] - metrics.cumulative[start] + t * Math.hypot(dx, dy) };
  }
  return best;
}
export function stepRange(step, metrics) {
  const [start, end] = step.wayPoints || [];
  return metrics && Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start && end < metrics.points.length ? { start, end } : null;
}
function importance(location) {
  if (/library|student union|recreation|fitness|dining|food court|engineering|medicine|bookstore/i.test(location.name)) return 3;
  if (location.categories.includes('Campus Buildings')) return 2;
  return location.categories.includes('Dining & Retail') ? 1 : 0;
}
export function routeLandmarkCandidates(metrics, locations, origin, destination) {
  if (!metrics) return [];
  const endpointPins = [origin, destination].filter(l => Number.isFinite(l.lng) && Number.isFinite(l.lat)).map(l => metrics.project([l.lng, l.lat]));
  const candidates = locations.filter(l => l.id !== origin.id && l.id !== destination.id && Number.isFinite(l.lng) && Number.isFinite(l.lat)
    && l.categories?.some(c => /^(Campus Buildings|Dining & Retail|Parking)$/.test(c))
    && !/charging|ev station/i.test(l.name)
    && endpointPins.every(p => separation(p, metrics.project([l.lng, l.lat])) > LANDMARK_RADIUS_METERS))
    .map(location => ({ location, ...nearestOnSection(metrics, location), importance: importance(location) }))
    .filter(candidate => candidate.distance <= LANDMARK_RADIUS_METERS)
    .sort((a, b) => b.importance - a.importance || a.distance - b.distance || a.location.name.localeCompare(b.location.name));
  const unique = [];
  for (const candidate of candidates) {
    if (unique.some(other => other.location.name === candidate.location.name || separation(metrics.project([other.location.lng, other.location.lat]), metrics.project([candidate.location.lng, candidate.location.lat])) < 25)) continue;
    unique.push(candidate);
  }
  return unique;
}
