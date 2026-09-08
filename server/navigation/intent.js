import { searchLocations } from './resolver.js';
const clean = s => (s || '').replace(/[?.!,]+$/g, '').trim().replace(/^the\s+/i, '');
export function parseNavigationIntent(question) {
  const q = question.trim().replace(/[’]/g, "'");
  let m = q.match(/(?:i'm|i am|im)\s+at\s+(.+?)[,;]?\s+(?:how\s+(?:do|can)\s+i\s+(?:get|walk)|take me|directions)\s+to\s+(.+)/i);
  if (m) return { from: clean(m[1]), to: clean(m[2]) };
  m = q.match(/^(?:(?:how\s+(?:do|can)\s+i\s+(?:get|walk)|take me|(?:walking\s+)?directions|navigate|walk|go)\s+)?from\s+(.+?)\s+to\s+(.+)/i);
  if (m) return { from: clean(m[1]), to: clean(m[2]) };
  m = q.match(/^where is\s+(.+?)\s+from\s+(.+)/i);
  if (m) return { from: clean(m[2]), to: clean(m[1]) };
  m = q.match(/^(.+?)\s+to\s+(.+?)[?.!]*$/i);
  if (m && !/^(?:how|what|when|why|where|can|does|do|is|are|apply|admission|transfer)\b/i.test(m[1]) && (searchLocations(clean(m[1])).length || searchLocations(clean(m[2])).length)) return { from: clean(m[1]), to: clean(m[2]) };
  m = q.match(/^(?:how (?:do|can) i (?:get|walk) to|take me to|directions to|navigate to)\s+(.+)/i);
  return m ? { from: '', to: clean(m[1]) } : null;
}
