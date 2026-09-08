// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MapPage from './MapPage.jsx';
import LocationField from './LocationField.jsx';
vi.mock('./RouteMap.jsx', () => ({ default: () => createElement('div', { 'data-testid': 'map' }, 'Map') }));
const gym = { id: 'gym-id', name: 'Recreation and Fitness Center (RC-91)', campus: 'Boca Raton', categories: ['Campus Buildings'] };
const food = { id: 'food-id', name: 'Student Services & Food Court (SS-8)', campus: 'Boca Raton', categories: ['Campus Buildings'] };
let root; let container;
function fallback(a = gym, b = food) {
  return { kind: 'navigation', status: 'unavailable', origin: a, destination: b, originResult: { status: 'resolved', location: a }, destinationResult: { status: 'resolved', location: b }, viewRouteUrl: '/map?from=gym-id&to=food-id', mapsUrl: 'https://www.google.com/maps/dir/?api=1', message: 'Walking directions are unavailable right now.' };
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  window.history.replaceState({}, '', '/map?from=gym&to=cafeteria');
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true, json: async () => url.includes('/locations') ? { locations: [gym] } : fallback() })));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe('campus map interactions', () => {
  it('restores route from query parameters and shows official names, fallback and map links', async () => {
    await act(async () => root.render(createElement(MapPage)));
    const call = fetch.mock.calls.find(([url]) => url === '/api/navigation/route');
    expect(JSON.parse(call[1].body)).toEqual({ from: 'gym', to: 'cafeteria' });
    expect(container.querySelector('#location-from').value).toBe(gym.name);
    expect(container.textContent).toContain('Walking directions are unavailable');
    expect(container.querySelector('a[target="_blank"]').href).toContain('google.com/maps/dir');
    expect(container.querySelector('[data-testid="map"]')).toBeTruthy();
  });
  it('swaps the resolved endpoints and updates the bookmarkable URL', async () => {
    await act(async () => root.render(createElement(MapPage)));
    await act(async () => container.querySelector('.swap-route').click());
    const calls = fetch.mock.calls.filter(([url]) => url === '/api/navigation/route');
    expect(JSON.parse(calls.at(-1)[1].body)).toEqual({ from: food.id, to: gym.id });
    expect(new URLSearchParams(window.location.search).get('from')).toBe(food.id);
  });
  it('restores routes on browser history changes', async () => {
    await act(async () => root.render(createElement(MapPage)));
    await act(async () => { window.history.pushState({}, '', '/map?from=library&to=gym'); window.dispatchEvent(new PopStateEvent('popstate')); });
    const calls = fetch.mock.calls.filter(([url]) => url === '/api/navigation/route');
    expect(JSON.parse(calls.at(-1)[1].body)).toEqual({ from: 'library', to: 'gym' });
  });
  it('shows an API error instead of leaving the route loading', async () => {
    fetch.mockRejectedValue(new Error('Network unavailable'));
    await act(async () => root.render(createElement(MapPage)));
    expect(container.querySelector('[role="alert"]').textContent).toBe('Network unavailable');
    expect(container.querySelector('.route-submit').disabled).toBe(false);
  });
  it('selects an alias suggestion using its official name and unambiguous ID', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(createElement(LocationField, { label: 'From', value: 'gym', onChange })));
    await act(async () => { container.querySelector('input').focus(); await new Promise(resolve => setTimeout(resolve, 220)); });
    const suggestion = container.querySelector('.location-suggestions button');
    expect(suggestion.textContent).toContain(gym.name);
    await act(async () => container.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    await act(async () => container.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onChange).toHaveBeenCalledWith(gym.name, gym.id);
  });
});
