import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'

// ---------------------------------------------------------------------------
// MSW dev preview — intercepts Supabase API calls with fixture data.
// Enabled when VITE_MSW=true (set in .env.development).
// ---------------------------------------------------------------------------
async function enableMocking() {
  if (import.meta.env.VITE_MSW !== 'true') return

  // Inject a mock session into localStorage so supabase.auth.getUser() finds
  // a stored session and calls GET /auth/v1/user, which MSW then intercepts.
  // The storage key format matches @supabase/supabase-js v2.
  const hostname = new URL(import.meta.env.VITE_SUPABASE_URL).hostname
  const storageKey = `sb-${hostname}-auth-token`

  if (!localStorage.getItem(storageKey)) {
    const { MOCK_SESSION } = await import('./mocks/db.js')
    localStorage.setItem(storageKey, JSON.stringify(MOCK_SESSION))
  }

  const { worker } = await import('./mocks/browser.js')
  return worker.start({
    onUnhandledRequest: 'bypass', // let non-Supabase requests through
  })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
