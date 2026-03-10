// src/pages/public/Demo.jsx
// Entry point for sandbox mode. Activates the mock Supabase client,
// installs the edge function fetch interceptor, and navigates to the dashboard.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLoader } from '@/components/shared/PageLoader'
import { enterSandbox } from '@/lib/sandbox/useSandbox'
import { activateSandbox } from '@/lib/supabaseClient'
import { installSandboxFetch } from '@/lib/sandbox/sandboxFetch'

export default function Demo() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function activate() {
      const { supabase: mockClient } = await import('@/mocks/supabaseMock.js')
      if (cancelled) return

      activateSandbox(mockClient)
      enterSandbox()
      installSandboxFetch()
      navigate('/', { replace: true })
    }

    activate()
    return () => { cancelled = true }
  }, [navigate])

  return <PageLoader />
}
