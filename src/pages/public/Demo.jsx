// src/pages/public/Demo.jsx
// Entry point for sandbox mode. Activates the mock Supabase client,
// installs the edge function fetch interceptor, and navigates to the dashboard.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLoader } from '@/components/shared/PageLoader'
import { enterSandbox } from '@/lib/sandbox/useSandbox'

export default function Demo() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function activate() {
      // Dynamic imports bypass the Vite alias (@/lib/supabaseClient → supabaseMock)
      // so we get the real module's activateSandbox export.
      const [
        { supabase: mockClient },
        { activateSandbox },
        { installSandboxFetch },
      ] = await Promise.all([
        import('@/mocks/supabaseMock.js'),
        import(/* @vite-ignore */ '../../lib/supabaseClient.js'),
        import('@/lib/sandbox/sandboxFetch'),
      ])
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
