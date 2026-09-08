import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupMicroDirections, GROUPING_LIMITS } from '../navigation/grouping.js';
import { routeMetrics } from '../navigation/landmarks.js';
import { formatCampusDirections } from '../navigation/directions.js';
import { campusLocations } from '../navigation/locations.js';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/campus-walking-routes.json', import.meta.url)));
const before = JSON.parse(readFileSync(new URL('./fixtures/campus-directions-before-grouping.json', import.meta.url)));

function example({ instructions = ['Turn left', 'Turn right'], points = [[0, 0], [0, 10], [40, 10]], distances = [10, 40], evidence = [], ranges = [[0, 1], [1, 2]] } = {}) {
  const route = { geometry: { coordinates: points.map(p => p.map(n => n / 111320)) }, steps: instructions.map((instruction, i) => ({ instruction, distance: distances[i], wayPoints: ranges[i] })) };
  const entries = route.steps.map((s, i) => ({ text: s.instruction, stepIndices: [i], start: s.wayPoints[0], end: s.wayPoints[1] }));
  return groupMicroDirections(entries, route, routeMetrics(route.geometry.coordinates), evidence);
}
describe('micro-maneuver grouping boundaries', () => {
  it('groups a short continuous corridor while preserving ordered turns and distances', () => {
    expect(example().directions).toEqual(['Turn left; continue a short distance, then turn right.']);
    expect(example().merges[0].inputSteps).toEqual([1, 2]);
  });
  it('preserves keep-left forks rather than inferring a branch-free walkway', () => {
    expect(example({ instructions: ['Turn left', 'Keep left'] }).directions).toEqual(['Turn left; continue a short distance, then keep left.']);
  });
  it.each(['Turn right onto Breezeway', 'Arrive near Starbucks, on your right.', 'Take the stairs', 'Cross the road'])('keeps %s as a separate instruction', instruction => {
    expect(example({ instructions: ['Turn left', instruction] }).merges).toEqual([]);
  });
  it('does not group across a landmark cue before the last maneuver', () => {
    expect(example({ evidence: [{ stepIndex: 0, locationId: 'library', relationship: 'past' }] }).merges).toEqual([]);
    expect(example({ evidence: [{ stepIndex: 1, locationId: 'library', relationship: 'toward' }] }).merges).toHaveLength(1);
  });
  it('rejects long sequences using both geometry and ORS distance', () => {
    expect(example({ distances: [10, 91] }).merges).toEqual([]);
    expect(example({ points: [[0, 0], [0, 10], [100, 10]] }).merges).toEqual([]);
  });
  it('rejects loops and broad deviations from the movement corridor', () => {
    expect(example({ points: [[0, 0], [0, 40], [1, 0]] }).merges).toEqual([]);
    expect(example({ points: [[0, 0], [0, 40], [40, 40]], distances: [40, 40] }).merges).toEqual([]);
  });
  it('rejects a backward leg even in an otherwise narrow efficient corridor', () => {
    const route = { steps: [{ instruction: 'Turn left', distance: 10 }, { instruction: 'Turn right', distance: 70 }], geometry: { coordinates: [[0, 0], [0, 10], [0, 5], [0, 70]].map(p => p.map(n => n / 111320)) } };
    const entries = [{ text: 'Turn left', stepIndices: [0], start: 0, end: 1 }, { text: 'Turn right', stepIndices: [1], start: 1, end: 3 }];
    expect(groupMicroDirections(entries, route, routeMetrics(route.geometry.coordinates)).merges).toEqual([]);
  });
  it('rejects disconnected waypoint ranges and missing geometry', () => {
    expect(example({ ranges: [[0, 1], [2, 2]] }).merges).toEqual([]);
    expect(groupMicroDirections([{ text: 'Turn left', stepIndices: [0] }, { text: 'Turn right', stepIndices: [1] }], {}, null).directions).toEqual(['Turn left', 'Turn right']);
  });
});

describe('before/after campus route verification', () => {
  it.each(fixtures.map((fixture, i) => [fixture.origin.name, fixture, before[i], [3, 3, 5, 7, 6][i]]))('%s preserves route and landmark validation', (_name, fixture, previous, count) => {
    const originalRoute = JSON.stringify(fixture.route);
    const current = formatCampusDirections(fixture.route, fixture.origin, fixture.destination, campusLocations);
    expect(current.evidence).toEqual(previous.evidence);
    expect(current.landmarks).toEqual(previous.landmarks);
    expect(current.directions).toHaveLength(count);
    expect(JSON.stringify(fixture.route)).toBe(originalRoute);
    for (const merge of current.merges) {
      expect(merge.inputSteps.length).toBeLessThanOrEqual(GROUPING_LIMITS.maxInstructions);
      expect(Math.max(merge.geometryMeters, merge.distanceMeters)).toBeLessThanOrEqual(100);
      expect(merge.efficiency).toBeGreaterThanOrEqual(.75);
      expect(merge.deviationMeters).toBeLessThanOrEqual(20);
    }
    // Arrival text and its validated side remain untouched.
    expect(current.directions.at(-1)).toBe(previous.directions.at(-1).replace(/Turn left for about \d+ meters, then/, 'Turn left, continue a short distance, then').replace(/for about \d+ meters, then/, 'a short distance, then'));
    expect(current.directions.join(' ')).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:meters?|metres?|m)\b/i);
  });
  it('groups only the three verified Engineering-to-Starbucks clusters', () => {
    const f = fixtures[3];
    const result = formatCampusDirections(f.route, f.origin, f.destination, campusLocations);
    expect(before[3].directions).toHaveLength(11);
    expect(result.merges.map(m => m.inputSteps)).toEqual([[2, 3], [5, 6, 7], [8, 9]]);
    expect(result.directions[5]).toBe(before[3].directions[9]);
  });
});
