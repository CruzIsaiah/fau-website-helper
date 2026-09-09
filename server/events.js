// Public FAU calendar, fixed upstream; no user-provided URLs or fabricated dates.
const FEED = 'https://calendar.fau.edu/api/2/events?days=30&pp=50';
export function selectUpcomingEvent(data, now = Date.now()) {
  return (data?.events || []).flatMap(({ event }) => {
    if (!event || event.status !== 'live' || /sold out|cancelled|canceled/i.test(event.title) || typeof event.title !== 'string') return [];
    let url;
    try { url = new URL(event.localist_url); } catch { return []; }
    if (url.protocol !== 'https:' || url.hostname !== 'calendar.fau.edu' || !url.pathname.startsWith('/event/') || url.username || url.password) return [];
    return (event.event_instances || []).flatMap(({ event_instance: instance }) => {
      const start = Date.parse(instance?.start);
      if (!Number.isFinite(start) || start <= now) return [];
      const sentence = String(event.description_text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0];
      const description = sentence.length > 155 ? `${sentence.slice(0, 152).replace(/\s+\S*$/, '')}…` : sentence;
      return [{ title: event.title, start: instance.start, url: url.href, location: String(event.location_name || ''), description }];
    });
  }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0] || null;
}

export function createEventLoader(fetchImpl = fetch) {
  let cache; let expires = 0; let pending;
  return async function load() {
    if (Date.now() < expires && (!cache?.event || Date.parse(cache.event.start) > Date.now())) return cache;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetchImpl(FEED, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('EVENT_FEED_UNAVAILABLE');
        cache = { event: selectUpcomingEvent(await response.json()) };
        expires = Date.now() + 5 * 60 * 1000;
      } catch {
        cache = { event: null }; expires = Date.now() + 60000;
      } finally { pending = undefined; }
      return cache;
    })();
    return pending;
  };
}
export const loadUpcomingEvent = createEventLoader();
