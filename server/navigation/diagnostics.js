import { randomUUID } from 'node:crypto';

// Do not pass request headers, question text, coordinates or environment dumps.
// Redact before truncating so a clipped log cannot expose a partial credential.
export function sanitizeDiagnostic(value, secrets = []) {
  let text = String(value ?? '');
  const credentials = [process.env.ORS_API_KEY, ...secrets].filter(s => typeof s === 'string' && s.length);
  for (const raw of credentials) {
    for (const key of new Set([raw, raw.trim(), JSON.stringify(raw).slice(1, -1), encodeURIComponent(raw)])) {
      if (key) text = text.split(key).join('[REDACTED]');
    }
  }
  return text.replace(/(Bearer\s+)[^\s"'<>]+/gi, '$1[REDACTED]')
    .replace(/((?:authorization|api[_-]?key|access[_-]?token)\s*["']?\s*[:=]\s*["']?)[^\s,"'<>}]+/gi, '$1[REDACTED]')
    // eslint-disable-next-line no-control-regex -- Remove controls from untrusted diagnostic text.
    .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1000);
}
export function diagnosticError(error, secrets = []) {
  return {
    name: sanitizeDiagnostic(error?.name || 'Error', secrets),
    message: sanitizeDiagnostic(error?.message || 'Unknown navigation error', secrets),
    ...(error?.cause?.code ? { causeCode: sanitizeDiagnostic(error.cause.code, secrets) } : {})
  };
}
export function navigationContext(path = 'internal') {
  return { requestId: randomUUID(), path };
}
export function logNavigation(event, context, fields = {}, secrets = []) {
  const record = {
    component: 'campus-navigation', event,
    requestId: context.requestId, path: context.path,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    deployment: process.env.VERCEL_URL || 'local',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    node: process.version, ...fields
  };
  // Serialization uses only the explicit fields above and sanitized error data.
  const line = JSON.stringify(record, (_key, value) => typeof value === 'string' ? sanitizeDiagnostic(value, secrets) : value);
  if (event.endsWith('.failed')) console.error(line);
  else console.info(line);
}
export function diagnosticResponseBody(raw, secrets = []) {
  try {
    const data = JSON.parse(raw);
    // Deliberately omit arbitrary echoed headers, request bodies and metadata.
    return sanitizeDiagnostic(JSON.stringify({
      error: typeof data?.error === 'string' ? data.error : data?.error && { code: data.error.code, message: data.error.message },
      message: data?.message, detail: data?.detail, title: data?.title, code: data?.code
    }), secrets);
  } catch {
    return sanitizeDiagnostic(raw.replace(/<[^>]*>/g, ' '), secrets);
  }
}
