import { describe, expect, it, vi } from 'vitest';
import { createEventLoader, selectUpcomingEvent } from '../events.js';
import { contextualQuestion } from '../conversation.js';
const now = Date.parse('2026-09-08T12:00:00Z');
const event = (start, extra = {}) => ({ event: { title: 'Verified campus event', status: 'live', localist_url: 'https://calendar.fau.edu/event/example', description_text: 'A real description. Date details follow.', event_instances: [{ event_instance: { start } }], ...extra } });
describe('upcoming campus events', () => {
  it('selects a future instance in chronological order and never reuses an old recurring date', () => {
    const data = {events:[event('2026-08-01T12:00:00Z'),event('2026-09-10T12:00:00Z'),event('2026-09-09T12:00:00Z')]};
    expect(selectUpcomingEvent(data, now)).toMatchObject({start:'2026-09-09T12:00:00Z',description:'A real description.'});
  });
  it('rejects unknown dates, cancelled events and untrusted event URLs', () => {
    expect(selectUpcomingEvent({events:[event('invalid'),event('2026-09-09T12:00:00Z',{title:'Cancelled event'}),event('2026-09-09T12:00:00Z',{localist_url:'https://evil.example/event/a'})]},now)).toBeNull();
  });
  it('returns and briefly caches the evergreen fallback on upstream failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));
    const load = createEventLoader(fetchImpl);
    expect(await load()).toEqual({event:null}); expect(await load()).toEqual({event:null}); expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('coalesces concurrent feed requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ok:true,json:async()=>({events:[]})});
    const load=createEventLoader(fetchImpl); await Promise.all([load(),load()]); expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
it('keeps a standalone question unchanged and provides bounded user topic context for a follow-up', () => {
  expect(contextualQuestion({question:'Where can I park?'})).toBe('Where can I park?');
  expect(contextualQuestion({question:'What electives can I take?',history:[{question:'CS degree requirements'}]})).toBe('Previous questions for context: CS degree requirements\nCurrent follow-up question: What electives can I take?');
});
