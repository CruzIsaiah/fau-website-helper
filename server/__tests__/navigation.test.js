import { describe, expect, it, vi } from 'vitest';
import { parseKml, campusLocations } from '../navigation/locations.js';
import { resolveLocation } from '../navigation/resolver.js';
import { parseNavigationIntent } from '../navigation/intent.js';
import { OpenRouteServiceProvider } from '../navigation/provider.js';
import { navigate } from '../navigation/service.js';
import { formatDirections, nearbyLandmarks } from '../navigation/directions.js';

const pairs = [
  ['Recreation and Fitness Center', 'Student Services & Food Court'],
  ['S. E. Wimberly Library', 'Recreation and Fitness Center'],
  ['Engineering East', 'Starbucks'],
  ['Student Union', 'Bookstore'],
  ['Atlantic Dining Hall', 'S. E. Wimberly Library']
];
describe('campus locations and intent', () => {
  it('loads the supplied KML with precise coordinates', () => {
    expect(campusLocations.length).toBeGreaterThan(300);
    expect(resolveLocation('gym').location).toMatchObject({ lng: -80.10289205274347, lat: 26.37423570592457 });
    expect(resolveLocation('cafeteria').location.name).toBe('Student Services & Food Court (SS-8)');
    expect(resolveLocation('Wimberley Library').status).toBe('resolved');
  });
  it('ignores lines, polygons and invalid points; decodes text and merges identical pins', () => {
    const xml = '<kml><Folder><name>Campus</name><Placemark><name>A &amp; B</name><Point><coordinates>-80,26,0</coordinates></Point></Placemark><Placemark><name>A &amp; B</name><Point><coordinates>-80,26,0</coordinates></Point></Placemark><Placemark><name>Bad</name><Point><coordinates>NaN,91</coordinates></Point></Placemark><Placemark><name>Line</name><LineString><coordinates>-80,26 -81,27</coordinates></LineString></Placemark></Folder></kml>';
    expect(parseKml(xml)).toHaveLength(1);
    expect(parseKml(xml)[0].name).toBe('A & B');
  });
  it.each([
    ["I'm at the gym how do I get to the cafeteria", 'gym', 'cafeteria'],
    ['library to gym', 'library', 'gym'],
    ['How do I walk from Wimberly to the student union?', 'Wimberly', 'student union'],
    ['Take me from engineering to Starbucks', 'engineering', 'Starbucks'],
    ['Where is the bookstore from the library?', 'library', 'bookstore'],
    ["I'm at Engineering East. How do I get to Starbucks?", 'Engineering East', 'Starbucks'],
    ['Take me from the gym to Chick-fil-A.', 'gym', 'Chick-fil-A']
  ])('extracts %s', (q, from, to) => expect(parseNavigationIntent(q)).toEqual({ from, to }));
  it.each(['How do I apply to FAU?', 'Financial Aid', 'How to book a library room', 'library hours', 'Where is the financial aid application?'])('keeps RAG question %s separate', q => expect(parseNavigationIntent(q)).toBeNull());
  it('asks about ambiguous, missing and unknown places', async () => {
    expect(resolveLocation('engineering').status).toBe('ambiguous');
    expect(resolveLocation('nonexistent moon building').status).toBe('unknown');
    expect((await navigate({ from: '', to: 'gym' })).status).toBe('needs_locations');
    const choice = resolveLocation('engineering').choices[0];
    expect(resolveLocation(choice.id).location.id).toBe(choice.id);
  });
});
describe('walking routes', () => {
  it.each(pairs)('resolves %s → %s and uses exact coordinates in fallback links', async (from, to) => {
    const result = await navigate({ from, to }, new OpenRouteServiceProvider({ apiKey: '' }));
    expect(result.status).toBe('unavailable');
    expect(result.route).toBeUndefined();
    const params = new URL(result.mapsUrl).searchParams;
    expect(params.get('origin')).toBe(`${result.origin.lat},${result.origin.lng}`);
    expect(params.get('destination')).toBe(`${result.destination.lat},${result.destination.lng}`);
    expect(params.get('travelmode')).toBe('walking');
    const share = new URL(result.viewRouteUrl, 'http://localhost').searchParams;
    expect(resolveLocation(share.get('from')).location.id).toBe(result.origin.id);
  });
  it('requests pedestrian routing server-side and preserves provider geometry and steps', async () => {
    const feature = { geometry: { type: 'LineString', coordinates: [[-80.104, 26.371], [-80.103, 26.372]] }, properties: { summary: { distance: 230, duration: 180 }, segments: [{ steps: [{ instruction: 'Turn right onto University Drive', type: 1, way_points: [0, 1] }] }] } };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [feature] }) });
    const result = await navigate({ from: 'library', to: 'gym' }, new OpenRouteServiceProvider({ apiKey: 'test-secret', fetchImpl }));
    expect(result.status).toBe('ready');
    expect(result.route.geometry).toEqual(feature.geometry);
    expect(result.directions[0]).toMatch(/^Turn right onto University Drive/);
    expect(result.route.steps[0].instruction).toBe('Turn right onto University Drive');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson');
    expect(options.headers.Authorization).toBe('test-secret');
    expect(JSON.parse(options.body).coordinates[0]).toEqual([result.origin.lng, result.origin.lat]);
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });
  it.each(['http', 'malformed', 'timeout'])('falls back safely on %s failure', async mode => {
    const fetchImpl = mode === 'timeout' ? vi.fn().mockRejectedValue(new Error('timeout')) : vi.fn().mockResolvedValue({ ok: mode !== 'http', json: async () => ({ features: [] }) });
    const result = await navigate({ from: 'gym', to: 'cafeteria' }, new OpenRouteServiceProvider({ apiKey: 'test', fetchImpl }));
    expect(result.status).toBe('unavailable'); expect(result.directions).toBeUndefined();
  });
  it('does not call routing for the same location', async () => {
    const provider = { getWalkingRoute: vi.fn() };
    expect((await navigate({ from: 'gym', to: 'rec center' }, provider)).status).toBe('same_location');
    expect(provider.getWalkingRoute).not.toHaveBeenCalled();
  });
  it('formats without inventing turns, walkways or landmark relationships', () => {
    const origin = resolveLocation('gym').location; const destination = resolveLocation('cafeteria').location;
    expect(formatDirections({ steps: [{ instruction: 'Proceed north on unnamed road' }] }, origin, destination)).toEqual(['Proceed north on unnamed road']);
    const route = { geometry: { coordinates: [[0, 0], [.001, 0]] } };
    const locations = [{ id: 'near', name: 'Near', lng: .0005, lat: .00001, categories: ['Campus Buildings'] }, { id: 'far', name: 'Far', lng: 1, lat: 1, categories: ['Campus Buildings'] }];
    expect(nearbyLandmarks(route, locations, { id: 'a', lat: 0 }, { id: 'b' })).toEqual([{ id: 'near', name: 'Near' }]);
  });
});
