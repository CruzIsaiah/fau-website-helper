import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { OpenRouteServiceProvider } from '../navigation/provider.js';
import { navigate } from '../navigation/service.js';
import { diagnosticResponseBody, sanitizeDiagnostic } from '../navigation/diagnostics.js';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/campus-walking-routes.json', import.meta.url)))[1];
const key = 'private-ors-credential-123456';
const context = { requestId: 'request-test', path: '/api/navigation/route' };
let info, errors;
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('ORS_API_KEY', key);
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'deployed-commit');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const events = () => [...info.mock.calls, ...errors.mock.calls].map(([line]) => JSON.parse(line));
const invoke = fetchImpl => navigate({ from: 'gym', to: 'cafeteria' }, new OpenRouteServiceProvider({ apiKey: key, fetchImpl }), context);

describe('production walking-route diagnostics', () => {
  it('reports a missing runtime key without sending a provider request', async () => {
    vi.stubEnv('ORS_API_KEY', '');
    const fetchImpl = vi.fn();
    const response = await navigate({ from: 'gym', to: 'cafeteria' }, new OpenRouteServiceProvider({ fetchImpl }), context);
    expect(response.status).toBe('unavailable');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.request', keyExists: false }));
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.failed', phase: 'configuration', error: expect.objectContaining({ message: 'ROUTING_NOT_CONFIGURED' }) }));
  });
  it.each([401, 403, 429, 503])('reports HTTP %s and a redacted ORS error, retaining the public fallback', async status => {
    const response = await invoke(vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 2001, message: `Provider rejected ${key}` }, request: { authorization: 'another-secret' } }), { status })));
    expect(response.status).toBe('unavailable');
    const logs = events();
    expect(logs).toContainEqual(expect.objectContaining({ event: 'ors.response', status, requestId: context.requestId }));
    const failure = logs.find(e => e.event === 'ors.http.failed');
    expect(failure.body).toContain('2001');
    expect(failure.body).toContain('[REDACTED]');
    expect(JSON.stringify(logs)).not.toContain(key);
    expect(JSON.stringify(logs)).not.toContain('another-secret');
    expect(JSON.stringify(response)).not.toContain('Provider rejected');
    expect(logs.find(e => e.event === 'request.failed')).toMatchObject({ stage: 'routing', path: context.path, commit: 'deployed-commit', environment: 'production' });
  });
  it('records network causes and timeout exception names safely', async () => {
    const error = new TypeError(`fetch failed ${key}`, { cause: { code: 'ENOTFOUND' } });
    await invoke(vi.fn().mockRejectedValue(error));
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.failed', phase: 'fetch', error: { name: 'TypeError', message: 'fetch failed [REDACTED]', causeCode: 'ENOTFOUND' } }));
    errors.mockClear();
    await invoke(vi.fn().mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError')));
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.failed', error: expect.objectContaining({ name: 'TimeoutError' }) }));
  });
  it('distinguishes malformed success responses from HTTP errors', async () => {
    await invoke(vi.fn().mockResolvedValue(new Response('{not json', { status: 200 })));
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.response', status: 200 }));
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.failed', phase: 'response_body', error: expect.objectContaining({ name: 'SyntaxError' }) }));
    errors.mockClear();
    await invoke(vi.fn().mockResolvedValue(Response.json({ features: [] })));
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.failed', phase: 'validation', error: expect.objectContaining({ message: 'INVALID_ROUTE' }) }));
  });
  it('identifies formatter errors separately from provider failures', async () => {
    const malformed = { ...fixture.route, steps: [{ instruction: 'Turn left', wayPoints: {} }] };
    const result = await navigate({ from: 'gym', to: 'cafeteria' }, { getWalkingRoute: async () => malformed }, context);
    expect(result.status).toBe('unavailable');
    expect(events()).toContainEqual(expect.objectContaining({ event: 'request.failed', stage: 'directions', error: expect.objectContaining({ name: 'TypeError' }) }));
  });
  it('normalizes surrounding whitespace and uses the runtime key in the existing POST contract', async () => {
    vi.stubEnv('ORS_API_KEY', ` \n${key}\r\n `);
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ features: [{ geometry: fixture.route.geometry, properties: { summary: { distance: fixture.route.distance, duration: fixture.route.duration }, segments: [{ steps: fixture.route.steps.map(s => ({ instruction: s.instruction, type: s.type, distance: s.distance, way_points: s.wayPoints })) }] } }] }));
    const provider = new OpenRouteServiceProvider({ fetchImpl });
    const response = await navigate({ from: 'gym', to: 'cafeteria' }, provider, context);
    expect(response.status).toBe('ready');
    expect(response.route.geometry).toEqual(fixture.route.geometry);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe(key);
    expect(JSON.parse(options.body).coordinates).toEqual([[fixture.origin.lng, fixture.origin.lat], [fixture.destination.lng, fixture.destination.lat]]);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(events()).toContainEqual(expect.objectContaining({ event: 'ors.request', keyExists: true, keyWhitespaceNormalized: true, timeoutMs: 10000 }));
    expect(JSON.stringify(events())).not.toContain(key);
    expect(new OpenRouteServiceProvider({ apiKey: ' \n ' }).apiKey).toBe('');
  });
  it('bounds and sanitizes plain-text/HTML responses, JSON escapes and arbitrary bearer tokens', () => {
    expect(diagnosticResponseBody(`<h1>Denied</h1> ${key} Bearer another-secret`)).toBe(' Denied  [REDACTED] Bearer [REDACTED]');
    const large = `${'x'.repeat(990)}${key}${'y'.repeat(5000)}`;
    expect(sanitizeDiagnostic(large).length).toBeLessThanOrEqual(1000);
    expect(sanitizeDiagnostic(large)).not.toContain('private-ors');
    expect(sanitizeDiagnostic('Authorization: another-secret')).not.toContain('another-secret');
    expect(sanitizeDiagnostic(JSON.stringify({ value: 'secret\nquoted' }), ['secret\nquoted'])).not.toContain('secret');
  });
});
