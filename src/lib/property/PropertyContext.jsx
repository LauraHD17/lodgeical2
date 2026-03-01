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
  const [state, setState] = useState({
    propertyId: null, property: null, settings: null,
    role: null, permissions: [], isLoading: false, error: null,
  })

  useEffect(() => {
    if (!isAuthenticated || !user) {
      // Use a microtask to avoid calling setState synchronously inside the effect body
      const id = setTimeout(() => setState({ propertyId: null, property: null, settings: null, role: null, permissions: [], isLoading: false, error: null }), 0)
      return () => clearTimeout(id)
    }

    let mounted = true
    setTimeout(() => { if (mounted) setState(prev => ({ ...prev, isLoading: true, error: null })) }, 0)

    async function loadProperty() {
      try {
        const { data: access, error: accessError } = await supabase
          .from('user_property_access')
          .select('property_id, role')
          .eq('user_id', user.id)
          .single()

        if (accessError || !access) {
          if (mounted) setState(prev => ({ ...prev, isLoading: false, error: 'No property access found.' }))
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
  }, [isAuthenticated, user])

  return <PropertyContext.Provider value={state}>{children}</PropertyContext.Provider>
}
