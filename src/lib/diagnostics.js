// src/lib/diagnostics.js
// Structured logger with correlation IDs.
// All log entries include a session-scoped correlation ID, scope, event, and timestamp.
// Never log sensitive data (tokens, card numbers, passwords).

// Generate a UUID v4 once per session
function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const SESSION_CORRELATION_ID = generateCorrelationId()

/**
 * Structured log entry shape:
 * { correlationId, scope, event, timestamp, ...meta }
 */
function createEntry(level, scope, event, meta = {}) {
  return {
    correlationId: SESSION_CORRELATION_ID,
    scope,
    event,
    timestamp: new Date().toISOString(),
    level,
    ...meta,
  }
}

const isDev = import.meta.env.DEV

export const diagnostics = {
  /** Log informational events (always on) */
  info(scope, event, meta) {
    const entry = createEntry('info', scope, event, meta)
    if (isDev) console.log('[LODGE]', entry)
    return entry
  },

  /** Log warnings */
  warn(scope, event, meta) {
    const entry = createEntry('warn', scope, event, meta)
    console.warn('[LODGE]', entry)
    return entry
  },

  /** Log errors — sanitize before logging (no stack traces in production) */
  error(scope, event, meta) {
    const entry = createEntry('error', scope, event, meta)
    if (isDev) {
      console.error('[LODGE]', entry)
    } else {
      // In production, log without full error objects
      const safe = { ...entry }
      if (safe.error instanceof Error) {
        safe.error = safe.error.message
      }
      console.error('[LODGE]', safe)
    }
    return entry
  },

  /** Get the current session correlation ID */
  getCorrelationId() {
    return SESSION_CORRELATION_ID
  },
}
