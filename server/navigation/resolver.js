import { aliases } from './aliases.js';
import { campusLocations } from './locations.js';
export const normalize = text => text.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '');
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
export function searchLocations(query, locations = campusLocations) {
  const q = normalize(query);
  if (!q) return [];
  const target = normalize(aliases[q] || q);
  return locations.map(location => {
    const name = normalize(location.name);
    const short = normalize(location.name.replace(/\([A-Z]{1,4}-\d+[A-Z]?\)/g, ''));
    const score = location.id === query || name === target || short === target ? 1 : name.includes(target) ? .9 : 1 - distance(target, short) / Math.max(target.length, short.length);
    return { location, score };
  }).filter(x => x.score >= .7).sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name));
}
export function resolveLocation(query) {
  const candidates = searchLocations(query);
  const top = candidates[0];
  if (!top) return { status: 'unknown', query, choices: [] };
  let close = candidates.filter(x => x.score >= top.score - .035);
  // Prefer the official building pin over a wellness amenity with the same name.
  close = close.filter(x => !close.some(other => other !== x && other.location.name === x.location.name && other.location.categories.includes('Campus Buildings') && !x.location.categories.includes('Campus Buildings')));
  // Repeated facility markers in different KML layers remain explicit choices.
  if (close.length > 1) return { status: 'ambiguous', query, choices: close.slice(0, 5).map(x => x.location) };
  return { status: 'resolved', query, location: close[0].location };
}
