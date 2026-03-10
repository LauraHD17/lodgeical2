import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { isSandboxMode } from './lib/sandbox/useSandbox'

async function startApp() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser.js')
    await worker.start({ onUnhandledRequest: 'bypass' })
  } else if (isSandboxMode()) {
    // Re-activate mock client on page refresh in sandbox mode (production builds)
    const { supabase: mockClient } = await import('./mocks/supabaseMock.js')
    const { activateSandbox } = await import('./lib/supabaseClient')
    const { installSandboxFetch } = await import('./lib/sandbox/sandboxFetch')
    activateSandbox(mockClient)
    installSandboxFetch()
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

startApp()
