import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatCampusDirections } from '../navigation/directions.js';
import { generateCampusSummary } from '../navigation/summary.js';
import { campusLocations } from '../navigation/locations.js';
import { navigate } from '../navigation/service.js';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/campus-walking-routes.json', import.meta.url)));

describe('shared campus route summaries', () => {
  it.each(fixtures.map(f => [f.origin.name, f]))('preserves exact maneuvers and grounds the summary for %s', async (_name, f) => {
    const formatted = formatCampusDirections(f.route, f.origin, f.destination, campusLocations);
    const before = JSON.stringify({ route: f.route, formatted });
    const result = generateCampusSummary(f.route, f.origin, f.destination, campusLocations, formatted.evidence);
    expect(JSON.stringify({ route: f.route, formatted })).toBe(before);
    expect(result.summary).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:meters?|metres?|m)\b|center of campus|entrance|shortcut|walkway/i);
    expect(result.summary.replace(/\b[A-Z]\.(?=\s)/g, '').split('. ').length).toBeLessThanOrEqual(3);
    expect(result.summaryLandmarks.filter(l => l.id !== f.destination.id)).toHaveLength(Math.min(2, formatted.evidence.filter(e => ['toward', 'past'].includes(e.relationship) && e.locationId !== f.destination.id).length));
    for (const item of result.summaryLandmarks) {
      expect(formatted.evidence).toContainEqual(expect.objectContaining({ locationId: item.id, stepIndex: item.stepIndex, relationship: item.relationship }));
      expect(campusLocations.find(l => l.id === item.id)?.name).toBe(item.name);
    }
    for (const path of result.summaryPaths) expect(f.route.steps[path.stepIndex].instruction).toContain(`onto ${path.name}`);
    const order = result.summaryLandmarks.map(l => l.stepIndex);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const response = await navigate({ from: f.origin.id, to: f.destination.id }, { getWalkingRoute: async () => f.route });
    expect(response.summary).toBe(result.summary);
    expect(response.directions).toEqual(formatted.directions);
    expect(response.route).toEqual(f.route);
  });
  it('binds Breezeway to the validated Starbucks leg after the two earlier landmarks', () => {
    const f = fixtures[3], formatted = formatCampusDirections(f.route, f.origin, f.destination, campusLocations);
    const { summary } = generateCampusSummary(f.route, f.origin, f.destination, campusLocations, formatted.evidence);
    expect(summary).toContain('toward College of Medicine, Charles E. Schmidt, then continue toward Ritter Art Gallery. Follow Breezeway toward Starbucks.');
    expect(summary).toContain('on your right');
  });
  it('does not promote nearby-turn evidence into toward/past claims', () => {
    const f = fixtures[3], formatted = formatCampusDirections(f.route, f.origin, f.destination, campusLocations);
    const evidence = formatted.evidence.filter(e => e.stepIndex === 1).map(e => ({ ...e, relationship: 'near' }));
    const result = generateCampusSummary(f.route, f.origin, f.destination, campusLocations, evidence);
    expect(result.summary).not.toContain('College of Medicine');
    expect(result.summary).not.toMatch(/on your (left|right)/);
    expect(result.summaryLandmarks).toEqual([]);
    expect(result.summary).toContain('Starbucks');
  });
  it('ignores stale waypoint references and unknown pins', () => {
    const f = fixtures[3], formatted = formatCampusDirections(f.route, f.origin, f.destination, campusLocations);
    const evidence = formatted.evidence.map(e => ({ ...e, wayPoints: [0, 999] }));
    evidence.push({ stepIndex: 1, wayPoints: f.route.steps[1].wayPoints, locationId: 'made-up', relationship: 'toward' });
    expect(generateCampusSummary(f.route, f.origin, f.destination, campusLocations, evidence).summaryLandmarks).toEqual([]);
  });
  it('uses endpoints only when geometry or ordered step ranges are missing', () => {
    const f = fixtures[0], formatted = formatCampusDirections(f.route, f.origin, f.destination, campusLocations);
    const reversed = { ...f.route, steps: [...f.route.steps].reverse() };
    for (const route of [{}, reversed]) {
      const result = generateCampusSummary(route, f.origin, f.destination, campusLocations, formatted.evidence);
      expect(result.summary).toMatch(/^Follow the highlighted walking route from/);
      expect(result.summaryPaths).toEqual([]);
      expect(result.summaryLandmarks).toEqual([]);
    }
  });
  it('does not turn unnamed road labels into named paths', () => {
    const f = fixtures[0];
    const route = { ...f.route, steps: f.route.steps.map(step => ({ ...step, instruction: 'Continue on unnamed road' })) };
    expect(generateCampusSummary(route, f.origin, f.destination).summaryPaths).toEqual([]);
  });
});
