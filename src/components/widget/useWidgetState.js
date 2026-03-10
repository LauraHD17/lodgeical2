// src/components/widget/useWidgetState.js
// Persists in-progress booking widget state to sessionStorage.
// Keyed by property ID so multiple widgets don't collide.

import { useState, useCallback } from 'react'

const STORAGE_KEY_PREFIX = 'lodgeical_widget_'
const EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

function getStorageKey(propertyId) {
  return `${STORAGE_KEY_PREFIX}${propertyId}`
}

function loadState(propertyId) {
  try {
    const raw = sessionStorage.getItem(getStorageKey(propertyId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Expire stale state
    if (Date.now() - parsed._savedAt > EXPIRY_MS) {
      sessionStorage.removeItem(getStorageKey(propertyId))
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveState(propertyId, state) {
  try {
    sessionStorage.setItem(
      getStorageKey(propertyId),
      JSON.stringify({ ...state, _savedAt: Date.now() })
    )
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export function clearWidgetState(propertyId) {
  try {
    sessionStorage.removeItem(getStorageKey(propertyId))
  } catch {
    // ignore
  }
}

/**
 * Returns [restoredState, persist] where restoredState is the saved state
 * (or null if none) and persist is a function to call with the current state.
 */
export function useWidgetState(propertyId) {
  const [restored] = useState(() => loadState(propertyId))

  const persist = useCallback((state) => {
    saveState(propertyId, state)
  }, [propertyId])

  return [restored, persist]
}
