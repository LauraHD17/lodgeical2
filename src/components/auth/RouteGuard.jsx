// src/components/auth/RouteGuard.jsx
// Reads from useAuth() only — never calls Supabase directly.
// Uses pure authGate state machine to derive the routing decision.

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/useAuth'
import { useProperty } from '@/lib/property/useProperty'
import { getAuthGateDecision, AUTH_GATE } from '@/lib/auth/authGate'
import { PageLoader } from '@/components/shared/PageLoader'

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 text-center">
      <h1 className="font-heading text-[32px] text-text-primary">Access Denied</h1>
      <p className="font-body text-[15px] text-text-secondary mt-3 max-w-sm">
        You don&apos;t have permission to view this page. Contact your property owner if you think this is a mistake.
      </p>
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} [props.permission] - Required permission for this route
 * @param {boolean} [props.isPublic] - If true, no auth check is applied
 * @param {React.ReactNode} props.children
 */
export function RouteGuard({ permission, isPublic = false, children }) {
  const location = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const { permissions, isLoading: propertyLoading } = useProperty()

  const isLoading = authLoading || (!isPublic && !!user && propertyLoading)

  const decision = getAuthGateDecision({
    isLoading,
    user,
    permissions,
    isPublicRoute: isPublic,
    requiredPermission: permission ?? null,
  })

  if (decision === AUTH_GATE.LOADING) return <PageLoader />

  if (decision === AUTH_GATE.LOGIN_REQUIRED) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (decision === AUTH_GATE.ACCESS_DENIED) return <AccessDenied />

  return children
}
