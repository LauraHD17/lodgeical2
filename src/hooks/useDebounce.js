import { useState, useEffect } from 'react'

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of inactivity.
 * @param {*} value - The value to debounce
 * @param {number} delayMs - Debounce delay in milliseconds (default: 300)
 */
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
