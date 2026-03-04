// src/lib/auth/AuthContext.jsx
// Exports AuthProvider (component) and re-exports useAuth for convenience.
// The AuthContext object itself lives in authContext.js (context-only file).
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth } from './useAuth'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  // Fast-path initial state: read localStorage synchronously.
  // If the supabase session key is absent we know immediately the user is
  // unauthenticated — isLoading can start as false so RouteGuard redirects
  // to /login without waiting for the async auth machinery.
  //
  // Background: supabase-js v2 acquires a Navigator Lock to emit INITIAL_SESSION.
  // React Strict Mode double-mounts components in dev, causing two concurrent
  // lock acquisitions. The losing acquirer waits up to 5 s for lock recovery,
  // pushing total resolution past the 10 s Playwright E2E timeout.
  // The synchronous localStorage check completely bypasses this for the
  // overwhelmingly common case of an unauthenticated visitor.
  const [state, setState] = useState(() => {
    const hasStoredSession = typeof window !== 'undefined' &&
      !!window.localStorage.getItem('supabase.auth.token')
    return { user: null, isLoading: hasStoredSession, error: null }
  })

  useEffect(() => {
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ user: session?.user ?? null, isLoading: false, error: null })
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const logout = () => supabase.auth.signOut()

  const value = {
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    isAuthenticated: !!state.user,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
