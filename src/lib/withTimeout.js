// src/lib/withTimeout.js
// Wraps any Promise in a race with a configurable timeout.
// Default is 9 seconds — matches Edge Function timeout budget.

export class TimeoutError extends Error {
  constructor(message = 'The request took too long. Please try again.') {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Race a promise against a timeout.
 * @param {Promise} promise - The promise to race.
 * @param {number} [ms=9000] - Timeout in milliseconds.
 * @param {string} [message] - Custom timeout error message.
 * @returns {Promise} Resolves with the promise result or rejects with TimeoutError.
 */
export function withTimeout(promise, ms = 9000, message) {
  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      reject(new TimeoutError(message))
    }, ms)
  })

  return Promise.race([promise, timeout])
}
