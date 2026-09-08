import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCampusDirections } from '../navigation/directions.js';
import { campusLocations } from '../navigation/locations.js';
import { navigate } from '../navigation/service.js';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/campus-walking-routes.json', import.meta.url)));
const origin = { id: 'origin', name: 'Start (ST-1)', lng: 0, lat: 0 };
const destination = { id: 'destination', name: 'Finish (FI-2)', lng: .01, lat: 0 };
const location = (id, x, y, category = 'Campus Buildings') => ({ id, name: id, lng: x / 111320, lat: y / 111320, categories: [category] });
const route = (steps, points = [[0, 0], [0, 100]]) => ({ geometry: { type: 'LineString', coordinates: points.map(([x, y]) => [x / 111320, y / 111320]) }, steps });
const step = (instruction, wayPoints = [0, 1], distance = 100) => ({ instruction, wayPoints, distance });

// Independent point-to-segment verification: project each KML pin onto the
// specific ORS step's polyline. This does not use the formatter's geometry helper.
function measurePin(pin, points) {
  const cos = Math.cos(pin.lat * Math.PI / 180);
  const local = points.map(([lng, lat]) => [(lng - pin.lng) * 111320 * cos, (lat - pin.lat) * 111320]);
  let min = Math.hypot(...local[0]);
  for (let i = 1; i < local.length; i++) {
    const a = local[i - 1], b = local[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(a[0] + t * dx, a[1] + t * dy));
  }
  return min;
}

describe('live ORS campus route regressions', () => {
  it.each(fixtures.map(f => [f.origin.name, f]))('grounds every landmark for %s', async (_name, fixture) => {
    const { route, origin, destination } = fixture;
    const unchanged = JSON.stringify(fixture);
    const result = formatCampusDirections(route, origin, destination, campusLocations);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.landmarks.length).toBeLessThanOrEqual(3);
    for (const item of result.evidence) {
      const pin = campusLocations.find(l => l.id === item.locationId);
      expect(pin).toBeDefined();
      const [a, b] = item.wayPoints;
      const actual = measurePin(pin, route.geometry.coordinates.slice(a, b + 1));
      expect(actual).toBeLessThanOrEqual(40.1);
      expect(Math.abs(actual - item.distanceMeters)).toBeLessThan(.1);
    }
    // Every left/right maneuver survives, in order, even when grouped.
    const turns = text => [...text.matchAll(/\b(turn|keep|bear)\s+(?:(?:slight|slightly|sharp)\s+)?(left|right)\b/gi)].map(m => m[0].toLowerCase());
    expect(turns(result.directions.join(' '))).toEqual(turns(route.steps.map(s => s.instruction).join(' ')));
    expect(JSON.stringify(fixture)).toBe(unchanged);
    const response = await navigate({ from: origin.id, to: destination.id }, { getWalkingRoute: async () => route });
    expect(response.directions).toEqual(result.directions);
    expect(response.route).toEqual(route);
    expect(response.mapsUrl).toContain('travelmode=walking');
  });
});

describe('conservative campus wording', () => {
  it('replaces a compass heading only with a landmark ahead on that leg', () => {
    const result = formatCampusDirections(route([step('Head north')]), origin, destination, [location('Library', 10, 95)]);
    expect(result.directions).toEqual(['From Start, walk toward Library.']);
    expect(result.evidence[0].relationship).toBe('toward');
  });
  it('does not direct a walker toward a landmark behind them or on a later leg', () => {
    const result = formatCampusDirections(route([step('Head north', [0, 1])], [[0, 0], [0, 100], [100, 100]]), origin, destination, [location('Behind', 0, -20), location('Later', 100, 100)]);
    expect(result.evidence).toEqual([]);
    expect(result.directions[0]).toBe('From Start, head north');
  });
  it('does not replace compass headings on a leg that doubles back', () => {
    const result = formatCampusDirections(route([step('Head north', [0, 3])], [[0, 0], [0, 70], [0, 20], [0, 100]]), origin, destination, [location('Library', 10, 95)]);
    expect(result.evidence).toEqual([]);
  });
  it('requires travel both before and after a pin to say past', () => {
    const result = formatCampusDirections(route([step('Continue straight')]), origin, destination, [location('Library', 10, 50)]);
    expect(result.directions).toEqual(['Continue past Library.']);
    expect(result.evidence[0].relationship).toBe('past');
  });
  it('uses only the original instruction for missing/invalid geometry or step indices', () => {
    for (const input of [{ steps: [step('Proceed north on unnamed road')] }, route([step('Turn left', [0, 99])]), route([step('Turn left', [-1, 1])])]) {
      const result = formatCampusDirections(input, origin, destination, [location('Library', 0, 90)]);
      expect(result.directions).toEqual([input.steps[0].instruction]);
      expect(result.evidence).toEqual([]);
    }
  });
  it('preserves named streets, forks, and every short turn during merging', () => {
    const input = route([step('Head north', [0, 1], 8), step('Turn left onto Named Walk', [1, 2], 9), step('Keep right', [2, 3], 50)], [[0, 0], [0, 8], [-9, 8], [-9, 58]]);
    const result = formatCampusDirections(input, origin, destination);
    expect(result.directions).toEqual(['From Start, head north a short distance, then turn left onto Named Walk', 'Keep right']);
  });
  it('never removes repeated turns and only collapses contiguous straight instructions', () => {
    const input = route([step('Turn right', [0, 1], 20), step('Turn right', [1, 2], 20), step('Continue straight', [2, 3], 20), step('Continue straight', [3, 4], 20)], [[0, 0], [0, 20], [20, 20], [20, 0], [20, -20]]);
    expect(formatCampusDirections(input, origin, destination).directions).toEqual(['Turn right', 'Turn right', 'Continue straight']);
  });
  it('does not merge disconnected legs', () => {
    const input = route([step('Head north', [0, 1], 8), step('Turn left', [2, 3], 20)], [[0, 0], [0, 8], [0, 50], [-20, 50]]);
    expect(formatCampusDirections(input, origin, destination).directions).toHaveLength(2);
  });
  it('does not transfer a snapped endpoint side when the KML pin is on the opposite side', () => {
    const input = route([step('Arrive at your destination, on the right', [1, 1], 0)]);
    const end = location('Destination', -15, 100);
    const result = formatCampusDirections(input, origin, end);
    expect(result.directions).toEqual(['Arrive near Destination.']);
    expect(result.evidence[0].relationship).toBe('arrival');
  });
  it('retains destination side only when the final approach agrees with ORS', () => {
    const input = route([step('Arrive at your destination, on the right', [1, 1], 0)]);
    expect(formatCampusDirections(input, origin, location('Destination', 15, 100)).directions).toEqual(['Arrive near Destination, on your right.']);
  });
  it('excludes far-away and unrecognizable amenity pins and suppresses duplicate buildings', () => {
    const result = formatCampusDirections(route([step('Continue straight')]), origin, destination, [location('Far away', 100, 50), location('Wellness drawer', 0, 50, 'Wellness'), location('Library', 5, 60), location('Library duplicate', 6, 60)]);
    expect(result.landmarks).toHaveLength(1);
    expect(result.directions.join()).not.toMatch(/Far away|Wellness/);
  });
});
