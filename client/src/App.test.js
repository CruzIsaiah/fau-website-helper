// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { fauResources } from '../../server/resources.js';
vi.mock('./navigation/RouteMap.jsx', () => ({ default: () => createElement('div', { 'data-testid': 'route-map' }, 'Route map') }));
const advising = fauResources.find(r => r.id === 'academic-advising') || fauResources.find(r => /advising/i.test(r.title));
const response = { groundedAnswer: { verified: true, type: 'steps', title: 'Advising information', summary: 'Use your college’s advising page. [1]', steps: ['Find your college. [1]', 'Check its appointment information. [2]'] }, sources: [{ title: 'Academic Advising', url: advising.url }, { title: 'Duplicate', url: advising.url }], usefulLinks: [{ text: 'Advising', href: advising.url }] };
let root, container;
const json = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const click = async text => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === text); expect(button, text).toBeTruthy(); await act(async () => button.click()); };
async function input(selector, value) { await act(async () => { const el = container.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function render() { await act(async () => root.render(createElement(App))); }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', cb => { cb(); return 1; });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (url === '/api/resources') return json({ resources: fauResources });
    if (url === '/api/events') return json({ event: null });
    if (url === '/api/ai/find') return json({ matches: [{ resourceId: advising.id }] });
    return json(response);
  }));
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('campus assistant experience', () => {
  it('shows the evergreen event fallback, exactly four quick links and existing map links', async () => {
    await render();
    expect(container.textContent).toContain('Your campus, connected.');
    expect(container.querySelector('.event-action').getAttribute('href')).toBe('/map');
    expect(container.querySelectorAll('.quick-grid a')).toHaveLength(4);
    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/map"]')).toHaveLength(3);
    expect(container.textContent).toContain('Pin a source from an answer');
  });
  it('submits a suggestion, preserves history on home, passes follow-up context, copies and starts a new chat', async () => {
    await render(); await click('Find my advisor');
    expect(container.querySelector('.event-banner')).toBeNull();
    expect(container.querySelector('.user-question').textContent).toBe('Find my advisor');
    expect(container.querySelectorAll('.answer-steps li')).toHaveLength(2);
    expect(container.querySelectorAll('.answer-sources a')).toHaveLength(1);
    expect([...container.querySelectorAll('.inline-citation')].every(a => a.textContent === '[1]' && a.href === advising.url)).toBe(true);
    await click('Copy answer');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(advising.url));
    await click('Back to home');
    expect(container.querySelector('.event-banner')).toBeTruthy();
    await click('Continue your conversation ');
    await input('#follow-up', "I'm an undergraduate");
    await act(async () => container.querySelector('.question-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.querySelectorAll('.conversation-turn')).toHaveLength(2);
    const calls = fetch.mock.calls.filter(([url]) => url === '/api/ai/research');
    expect(JSON.parse(calls.at(-1)[1].body)).toMatchObject({ question: "I'm an undergraduate", history: [{ question: 'Find my advisor' }] });
    await click('New chat');
    expect(container.querySelector('.welcome')).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem('fau-helper-conversation'))).toEqual([]);
  });
  it('pins, renames and unpins without replacing the persisted user list', async () => {
    localStorage.setItem('fau-helper-pinned', JSON.stringify([{ id: 'existing', displayName: 'My saved page', originalTitle: 'My page', url: 'https://www.fau.edu/registrar/' }]));
    await render(); expect(container.textContent).toContain('My saved page');
    await click('Find my advisor'); await click('Pin source'); await click('Back to home');
    expect(JSON.parse(localStorage.getItem('fau-helper-pinned'))).toHaveLength(2);
    await act(async () => container.querySelector('.home-pin details summary').click()); await click('Rename');
    await input('.pin-rename-form input', 'My advisor');
    await act(async () => container.querySelector('.pin-rename-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(JSON.parse(localStorage.getItem('fau-helper-pinned'))[0].displayName).toBe('My advisor');
    await act(async () => container.querySelector('.home-pin details summary').click()); await click('Unpin');
    expect(JSON.parse(localStorage.getItem('fau-helper-pinned'))).toHaveLength(1);
    expect(container.textContent).toContain('My saved page');
  });
  it('renders the navigation map, exact directions and links through the existing suggestion flow', async () => {
    const route = { kind: 'navigation', status: 'ready', origin: { name: 'Library' }, destination: { name: 'Gym' }, route: { duration: 300, distance: 400 }, summary: 'Follow the highlighted route from Library to Gym.', directions: ['Turn left', 'Arrive near Gym'], viewRouteUrl: '/map?from=library&to=gym', mapsUrl: 'https://www.google.com/maps/dir/?api=1' };
    fetch.mockImplementation(async url => url === '/api/ai/find' ? json(route) : json(url === '/api/resources' ? { resources: fauResources } : { event: null }));
    await render(); await click('Library to the gym');
    expect(container.querySelector('[data-testid="route-map"]')).toBeTruthy();
    expect(container.querySelector('.route-duration').textContent).toContain('5 min walk · 400 m');
    expect([...container.querySelectorAll('.route-directions li')].map(e => e.textContent)).toEqual(route.directions);
    expect(container.querySelector('.route-details').open).toBe(false);
    expect(fetch.mock.calls.some(([url]) => url === '/api/ai/research')).toBe(false);
  });
  it('has a retryable error and preserves pending conversations when returning home', async () => {
    let resolve;
    fetch.mockImplementation(async url => url === '/api/resources' ? json({ resources: fauResources }) : url === '/api/events' ? Promise.reject(new Error('Feed offline')) : new Promise(r => { resolve = r; }));
    await render(); await click('Where can I park?');
    expect(container.querySelector('[role="status"]').textContent).toContain('Reading official');
    await click('Back to home');
    await act(async () => resolve(new Response(JSON.stringify({ error: 'Please try again later.' }), { status: 503, headers: { 'content-type': 'application/json' } })));
    expect(container.querySelector('.welcome')).toBeTruthy();
    expect(container.textContent).toContain('Your campus, connected.');
    await click('Continue your conversation ');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Please try again later.');
    fetch.mockImplementation(async () => json({ matches: [] }));
    await click('Try again');
    expect(container.querySelectorAll('.conversation-turn')).toHaveLength(1);
    expect(container.textContent).toContain('I couldn’t find a sourced answer');
  });
  it('ignores a late response after New chat and keeps the page empty', async () => {
    let resolve;
    fetch.mockImplementation(async url => url === '/api/resources' ? json({ resources: fauResources }) : url === '/api/events' ? json({ event: null }) : new Promise(r => { resolve = r; }));
    await render(); await click('Find my advisor'); await click('New chat');
    await act(async () => resolve(json({ kind: 'navigation', status: 'ready' })));
    expect(container.querySelector('.welcome')).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem('fau-helper-conversation'))).toEqual([]);
  });
});
