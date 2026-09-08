import { campusLocations } from './locations.js';
import { resolveLocation } from './resolver.js';
import { getWalkingRoute } from './provider.js';
import { formatCampusDirections } from './directions.js';
import { generateCampusSummary } from './summary.js';
export async function navigate({ from = '', to = '' }, provider) {
  const originResult = resolveLocation(from);
  const destinationResult = resolveLocation(to);
  const base = { kind: 'navigation', from, to, originResult, destinationResult };
  if (originResult.status !== 'resolved' || destinationResult.status !== 'resolved') return { ...base, status: 'needs_locations' };
  const origin = originResult.location; const destination = destinationResult.location;
  const maps = new URL('https://www.google.com/maps/dir/');
  maps.search = new URLSearchParams({ api: '1', origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}`, travelmode: 'walking' }).toString();
  const result = { ...base, origin, destination, viewRouteUrl: `/map?${new URLSearchParams({ from: origin.id, to: destination.id })}`, mapsUrl: maps.toString() };
  if (origin.id === destination.id) return { ...result, status: 'same_location', message: 'Your start and destination are the same location.' };
  try {
    const route = await getWalkingRoute(origin, destination, provider);
    const { directions, landmarks, evidence } = formatCampusDirections(route, origin, destination, campusLocations);
    const summary = generateCampusSummary(route, origin, destination, campusLocations, evidence);
    return { ...result, ...summary, status: 'ready', route, directions, landmarks, message: 'Routes connect mapped locations; building entrances and indoor paths may differ.' };
  } catch {
    return { ...result, status: 'unavailable', message: 'Walking directions are unavailable right now. Open in Maps to get a walking route between these locations.' };
  }
}
