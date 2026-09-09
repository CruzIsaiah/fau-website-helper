import { diagnosticError, diagnosticResponseBody, logNavigation, navigationContext } from './diagnostics.js';

const ORS_URL = 'https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson';

// Provider contract: GeoJSON LineString, meters, seconds, and maneuvers.
export class OpenRouteServiceProvider {
  constructor({ apiKey = process.env.ORS_API_KEY, fetchImpl = fetch } = {}) {
    this.apiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    this.keyWhitespaceNormalized = typeof apiKey === 'string' && apiKey !== this.apiKey;
    this.fetch = fetchImpl;
  }
  async getWalkingRoute(origin, destination, context = navigationContext()) {
    const started = Date.now();
    let phase = 'configuration';
    logNavigation('ors.request', context, { url: ORS_URL, method: 'POST', keyExists: Boolean(this.apiKey), keyWhitespaceNormalized: this.keyWhitespaceNormalized, timeoutMs: 10000 }, [this.apiKey]);
    try {
      if (!this.apiKey) throw new Error('ROUTING_NOT_CONFIGURED');
      phase = 'fetch';
      const response = await this.fetch(ORS_URL, {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]], instructions: true, language: 'en', units: 'm' }),
        signal: AbortSignal.timeout(10000)
      });
      logNavigation('ors.response', context, { status: response.status, elapsedMs: Date.now() - started }, [this.apiKey]);
      phase = 'response_body';
      if (!response.ok) {
        const raw = typeof response.text === 'function' ? await response.text() : JSON.stringify(await response.json());
        logNavigation('ors.http.failed', context, { status: response.status, body: diagnosticResponseBody(raw, [this.apiKey]) }, [this.apiKey]);
        throw new Error('ROUTING_UNAVAILABLE');
      }
      const data = await response.json();
      phase = 'validation';
      const feature = data?.features?.[0];
      const geometry = feature?.geometry;
      const summary = feature?.properties?.summary;
      const validPoint = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
      if (geometry?.type !== 'LineString' || geometry.coordinates?.length < 2 || !geometry.coordinates?.every(validPoint) || !Number.isFinite(summary?.distance) || !Number.isFinite(summary?.duration) || summary.distance < 0 || summary.duration < 0) throw new Error('INVALID_ROUTE');
      const steps = (feature.properties.segments || []).flatMap(s => s.steps || []).map(s => ({ instruction: typeof s.instruction === 'string' ? s.instruction : '', type: s.type, distance: s.distance, wayPoints: s.way_points }));
      return { geometry, distance: summary.distance, duration: summary.duration, steps, provider: 'OpenRouteService', attribution: '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors' };
    } catch (error) {
      logNavigation('ors.failed', context, { phase, elapsedMs: Date.now() - started, error: diagnosticError(error, [this.apiKey]) }, [this.apiKey]);
      throw error;
    }
  }
}
export function getWalkingRoute(origin, destination, provider = new OpenRouteServiceProvider(), context) {
  return provider.getWalkingRoute(origin, destination, context);
}
