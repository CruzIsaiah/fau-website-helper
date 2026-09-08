// Provider contract: GeoJSON LineString, meters, seconds, and maneuvers.
export class OpenRouteServiceProvider {
  constructor({ apiKey = process.env.ORS_API_KEY, fetchImpl = fetch } = {}) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }
  async getWalkingRoute(origin, destination) {
    if (!this.apiKey) throw new Error('ROUTING_NOT_CONFIGURED');
    const response = await this.fetch('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson', {
      method: 'POST',
      headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]], instructions: true, language: 'en', units: 'm' }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('ROUTING_UNAVAILABLE');
    const data = await response.json();
    const feature = data.features?.[0];
    const geometry = feature?.geometry;
    const summary = feature?.properties?.summary;
    const validPoint = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
    if (geometry?.type !== 'LineString' || geometry.coordinates?.length < 2 || !geometry.coordinates?.every(validPoint) || !Number.isFinite(summary?.distance) || !Number.isFinite(summary?.duration) || summary.distance < 0 || summary.duration < 0) throw new Error('INVALID_ROUTE');
    const steps = (feature.properties.segments || []).flatMap(s => s.steps || []).map(s => ({ instruction: typeof s.instruction === 'string' ? s.instruction : '', type: s.type, distance: s.distance, wayPoints: s.way_points }));
    return { geometry, distance: summary.distance, duration: summary.duration, steps, provider: 'OpenRouteService', attribution: '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors' };
  }
}
export function getWalkingRoute(origin, destination, provider = new OpenRouteServiceProvider()) {
  return provider.getWalkingRoute(origin, destination);
}
