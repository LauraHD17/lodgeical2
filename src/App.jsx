// src/App.jsx
// Full routing setup. All page components are lazy-loaded.
// Admin routes wrapped in RouteGuard + AdminLayout.

import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/lib/auth/AuthContext'
import { PropertyProvider } from '@/lib/property/PropertyContext'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { RouteGuard } from '@/components/auth/RouteGuard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageLoader } from '@/components/shared/PageLoader'

// Admin pages (lazy-loaded)
const Dashboard       = lazy(() => import('@/pages/admin/Dashboard'))
const Reservations    = lazy(() => import('@/pages/admin/Reservations'))
const Rooms           = lazy(() => import('@/pages/admin/Rooms'))
const Guests          = lazy(() => import('@/pages/admin/Guests'))
const Rates           = lazy(() => import('@/pages/admin/Rates'))
const Payments        = lazy(() => import('@/pages/admin/Payments'))
const Messaging       = lazy(() => import('@/pages/admin/Messaging'))
const Documents       = lazy(() => import('@/pages/admin/Documents'))
const Reports         = lazy(() => import('@/pages/admin/Reports'))
const Settings        = lazy(() => import('@/pages/admin/Settings'))
const Import          = lazy(() => import('@/pages/admin/Import'))

// Public pages (lazy-loaded)
const Login               = lazy(() => import('@/pages/public/Login'))
const Widget              = lazy(() => import('@/pages/public/Widget'))
const GuestPortal         = lazy(() => import('@/pages/public/GuestPortal'))
const BookingConfirmation = lazy(() => import('@/pages/public/BookingConfirmation'))
const Invoice             = lazy(() => import('@/pages/public/Invoice'))

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
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Admin routes */}
                  <Route path="/" element={<AdminPage permission="view_dashboard"><Dashboard /></AdminPage>} />
                  <Route path="/reservations" element={<AdminPage permission="view_reservations"><Reservations /></AdminPage>} />
                  <Route path="/rooms" element={<AdminPage permission="manage_rooms"><Rooms /></AdminPage>} />
                  <Route path="/guests" element={<AdminPage permission="manage_guests"><Guests /></AdminPage>} />
                  <Route path="/rates" element={<AdminPage permission="manage_rooms"><Rates /></AdminPage>} />
                  <Route path="/payments" element={<AdminPage permission="manage_payments"><Payments /></AdminPage>} />
                  <Route path="/messaging" element={<AdminPage permission="manage_messaging"><Messaging /></AdminPage>} />
                  <Route path="/documents" element={<AdminPage permission="manage_documents"><Documents /></AdminPage>} />
                  <Route path="/reports" element={<AdminPage permission="view_reports"><Reports /></AdminPage>} />
                  <Route path="/settings" element={<AdminPage permission="manage_settings"><Settings /></AdminPage>} />
                  <Route path="/import" element={<AdminPage permission="manage_reservations"><Import /></AdminPage>} />

                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/widget" element={<Widget />} />
                  <Route path="/guest-portal" element={<GuestPortal />} />
                  <Route path="/booking-confirmation" element={<BookingConfirmation />} />
                  <Route path="/invoice/:id" element={<Invoice />} />
                </Routes>
              </Suspense>
            </ToastProvider>
          </PropertyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
