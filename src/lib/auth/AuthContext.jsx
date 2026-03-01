// src/lib/auth/AuthContext.jsx
// Exports AuthProvider (component) and re-exports useAuth for convenience.
// The AuthContext object itself lives in authContext.js (context-only file).
// eslint-disable-next-line react-refresh/only-export-components
export { useAuth } from './useAuth'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, isLoading: true, error: null })

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (mounted) setState({ user: user ?? null, isLoading: false, error: error ?? null })
    })

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
