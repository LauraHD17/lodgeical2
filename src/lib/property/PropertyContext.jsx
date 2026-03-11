// src/lib/property/PropertyContext.jsx
// eslint-disable-next-line react-refresh/only-export-components
export { useProperty } from './useProperty'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '../auth/useAuth'
import { PropertyContext } from './propertyContext'
import { getRolePermissions } from '../auth/permissions'

export function PropertyProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState({
    propertyId: null, property: null, settings: null,
    role: null, permissions: [], isLoading: false, error: null,
  })

  const refreshProperty = () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    setRefreshKey(k => k + 1)
  }

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ propertyId: null, property: null, settings: null, role: null, permissions: [], isLoading: false, error: null })
      return
    }

    let mounted = true
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    async function loadProperty() {
      try {
        const { data: access, error: accessError } = await supabase
          .from('user_property_access')
          .select('property_id, role')
          .eq('user_id', user.id)
          .single()

        if (accessError || !access) {
          // No access row. If user has property_name metadata, they are mid-signup.
          // Login.jsx handles provisioning and does a full page reload afterward.
          // Stay in loading state so RouteGuard shows loader, not Access Denied.
          if (mounted) {
            if (user.user_metadata?.property_name) {
              setState(prev => ({ ...prev, isLoading: true, error: null }))
            } else {
              setState(prev => ({ ...prev, isLoading: false, error: 'No property access found.' }))
            }
          }
          return
        }

        const { data: property, error: propError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', access.property_id)
          .single()

        if (propError || !property) {
          if (mounted) setState(prev => ({ ...prev, isLoading: false, error: 'Could not load property.' }))
          return
        }

        const { data: settings } = await supabase
          .from('settings')
          .select('*')
          .eq('property_id', access.property_id)
          .single()

        const permissions = getRolePermissions(access.role)

        if (mounted) {
          setState({
            propertyId: access.property_id, property,
            settings: settings ?? null, role: access.role,
            permissions, isLoading: false, error: null,
          })
        }
      } catch {
        if (mounted) setState(prev => ({ ...prev, isLoading: false, error: 'Failed to load property data.' }))
      }
    }

    loadProperty()
    return () => { mounted = false }
  }, [isAuthenticated, user, refreshKey])

  const value = { ...state, refreshProperty }

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
}
