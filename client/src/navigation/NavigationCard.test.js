// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import NavigationCard from './NavigationCard.jsx';
let container, root;
const result = {
  status: 'ready', origin: { name: 'Engineering East' }, destination: { name: 'Starbucks' },
  route: { duration: 540, distance: 722.7, attribution: 'OpenRouteService' },
  summary: 'Follow the route toward Ritter Art Gallery. Follow Breezeway toward Starbucks.',
  directions: ['Turn right', 'Keep left', 'Turn left onto Breezeway', 'Arrive near Starbucks, on your right.'],
  viewRouteUrl: '/map?from=engineering&to=starbucks', mapsUrl: 'https://www.google.com/maps/dir/?api=1',
  message: 'Routes connect mapped locations.'
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it('shows the shared summary first and keeps the exact steps collapsed until expanded', async () => {
  await act(async () => root.render(createElement(NavigationCard, { result })));
  const details = container.querySelector('details');
  expect(container.querySelector('.campus-route-summary').textContent).toBe(result.summary);
  expect(details.open).toBe(false);
  expect(details.querySelector('summary').textContent).toBe('Show detailed directions');
  expect([...details.querySelectorAll('li')].map(li => li.textContent)).toEqual(result.directions);
  await act(async () => details.querySelector('summary').click());
  expect(details.open).toBe(true);
  await act(async () => details.querySelector('summary').click());
  expect(details.open).toBe(false);
  expect(container.querySelector('.route-duration').textContent).toContain('9 min walk · 723 m');
  expect(container.querySelector('.route-actions a').getAttribute('href')).toBe(result.viewRouteUrl);
  expect(container.querySelector('.route-actions a[target="_blank"]').href).toBe(result.mapsUrl);
});
it('collapses details again when the route changes', async () => {
  await act(async () => root.render(createElement(NavigationCard, { result })));
  await act(async () => container.querySelector('summary').click());
  await act(async () => root.render(createElement(NavigationCard, { result: { ...result, viewRouteUrl: '/map?from=gym&to=cafeteria' } })));
  expect(container.querySelector('details').open).toBe(false);
});
it('keeps the unavailable-route fallback without a fabricated summary or maneuvers', async () => {
  await act(async () => root.render(createElement(NavigationCard, { result: { ...result, status: 'unavailable', summary: undefined, directions: undefined, route: undefined } })));
  expect(container.querySelector('details')).toBeNull();
  expect(container.querySelector('.campus-route-summary')).toBeNull();
  expect(container.querySelector('.route-actions')).toBeTruthy();
});
