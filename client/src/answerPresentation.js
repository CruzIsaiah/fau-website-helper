export function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
const identity = value => { const url = new URL(value); url.hash = ''; return url.href; };
export function prepareAnswer(data) {
  const sources = []; const seen = new Map();
  function add(source) {
    if (!safeUrl(source?.url)) return null;
    const key = identity(source.url);
    if (!seen.has(key)) { sources.push(source); seen.set(key, sources.length); }
    return seen.get(key);
  }
  const mapping = (data.citationSources || data.sources || []).map(add);
  (data.sources || []).forEach(add);
  function rewrite(value) {
    if (typeof value === 'string') return value.replace(/\[(\d+)\]/g, (_marker, number) => mapping[number - 1] ? `[${mapping[number - 1]}]` : '');
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, rewrite(v)]));
    return value;
  }
  return { answer: rewrite(data.groundedAnswer || null), sources, usefulLinks: data.usefulLinks || [] };
}

export function answerPlainText(answer, sources = []) {
  if (!answer) return '';
  const lines = [answer.title, answer.summary];
  (answer.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  (answer.facts || []).forEach(f => lines.push(`${f.label}: ${f.value}`));
  (answer.sections || []).forEach(s => lines.push(s.heading, ...(s.items || []).map(i => `• ${i}`)));
  (answer.tables || []).forEach(t => lines.push(t.heading, (t.headers || []).join(' | '), ...(t.courses?.length ? t.courses.map(c => [c.code, c.title, c.credits]) : t.rows || []).map(r => r.join(' | '))));
  lines.push(...(answer.nextSteps || []));
  sources.forEach((s, i) => lines.push(`[${i + 1}] ${s.title}: ${s.url}`));
  return lines.filter(Boolean).join('\n\n').replace(/\*\*/g, '');
}
