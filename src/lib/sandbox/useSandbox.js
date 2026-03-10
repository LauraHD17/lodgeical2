// src/lib/sandbox/useSandbox.js
// Sandbox mode state utilities. Uses sessionStorage so sandbox persists
// across navigations but not across browser sessions.

const KEY = 'lodgeical_sandbox'

export function isSandboxMode() {
  try {
    return sessionStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

export function enterSandbox() {
  sessionStorage.setItem(KEY, 'true')
}

export function exitSandbox() {
  sessionStorage.removeItem(KEY)
}

// Shared teardown: deactivates mock client, clears session flag, removes fetch interceptor.
// Callers handle navigation themselves after calling this.
export async function leaveSandbox() {
  const { deactivateSandbox } = await import('@/lib/supabaseClient')
  const { removeSandboxFetch } = await import('@/lib/sandbox/sandboxFetch')
  deactivateSandbox()
  exitSandbox()
  removeSandboxFetch()
}
