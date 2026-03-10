// src/App.jsx
// Full routing setup. All page components are lazy-loaded.
// Routes are generated dynamically from the ROUTES single source of truth in src/config/routes.js.
// Admin routes wrapped in RouteGuard + AdminLayout.

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/lib/auth/AuthContext'
import { PropertyProvider } from '@/lib/property/PropertyContext'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { RouteGuard } from '@/components/auth/RouteGuard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageLoader } from '@/components/shared/PageLoader'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ROUTES } from '@/config/routes'

// Admin pages (lazy-loaded)
const Dashboard       = lazy(() => import('@/pages/admin/Dashboard'))
const Reservations    = lazy(() => import('@/pages/admin/Reservations'))
const Rooms           = lazy(() => import('@/pages/admin/Rooms'))
const Guests          = lazy(() => import('@/pages/admin/Guests'))
const Rates           = lazy(() => import('@/pages/admin/Rates'))
const Payments        = lazy(() => import('@/pages/admin/Payments'))
const Maintenance     = lazy(() => import('@/pages/admin/Maintenance'))
const Contacts        = lazy(() => import('@/pages/admin/Contacts'))
const Messaging       = lazy(() => import('@/pages/admin/Messaging'))
const Documents       = lazy(() => import('@/pages/admin/Documents'))
const Reports         = lazy(() => import('@/pages/admin/Reports'))
const Settings        = lazy(() => import('@/pages/admin/Settings'))
const Import          = lazy(() => import('@/pages/admin/Import'))
const Calendar        = lazy(() => import('@/pages/admin/Calendar'))
const Inquiries       = lazy(() => import('@/pages/admin/Inquiries'))
const Help            = lazy(() => import('@/pages/admin/Help'))

// Public pages (lazy-loaded)
const Login               = lazy(() => import('@/pages/public/Login'))
const Widget              = lazy(() => import('@/pages/public/Widget'))
const GuestPortal         = lazy(() => import('@/pages/public/GuestPortal'))
const BookingConfirmation = lazy(() => import('@/pages/public/BookingConfirmation'))
const Invoice             = lazy(() => import('@/pages/public/Invoice'))
const GuestCheckIn        = lazy(() => import('@/pages/public/GuestCheckIn'))
const Demo                = lazy(() => import('@/pages/public/Demo'))
const OnboardingPath      = lazy(() => import('@/pages/public/OnboardingPath'))
const ResetPassword       = lazy(() => import('@/pages/public/ResetPassword'))
const RoomsBrowse         = lazy(() => import('@/pages/public/RoomsBrowse'))

// Map pageName strings (from routes.js) to lazy-loaded components
const pageMap = {
  Dashboard,
  Reservations,
  Rooms,
  Guests,
  Rates,
  Payments,
  Maintenance,
  Contacts,
  Messaging,
  Documents,
  Reports,
  Settings,
  Import,
  Calendar,
  Inquiries,
  Help,
  Login,
  Widget,
  GuestPortal,
  BookingConfirmation,
  Invoice,
  GuestCheckIn,
  Demo,
  OnboardingPath,
  ResetPassword,
  RoomsBrowse,
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
})

function AdminPage({ permission, children }) {
  return (
    <RouteGuard permission={permission}>
      <AdminLayout>{children}</AdminLayout>
    </RouteGuard>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <PropertyProvider>
            <ToastProvider>
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {ROUTES.map((route) => {
                    const PageComponent = pageMap[route.pageName]
                    const element = route.isPublic
                      ? <PageComponent />
                      : (
                        <AdminPage permission={route.permission}>
                          <PageComponent />
                        </AdminPage>
                      )
                    return <Route key={route.path} path={route.path} element={element} />
                  })}
                  <Route path="/financials" element={<Navigate to="/reports" replace />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </ToastProvider>
          </PropertyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
