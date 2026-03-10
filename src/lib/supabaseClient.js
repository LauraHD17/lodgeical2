// src/lib/supabaseClient.js
// Single Supabase client instance. Always import from here — never create another.
// Uses the anon key (safe to expose). RLS enforces all data access rules.
//
// In sandbox mode the active client is swapped to the in-memory mock via
// activateSandbox() — every existing `import { supabase }` keeps working
// because the export is a Proxy that delegates to whichever client is active.

import { createClient } from '@supabase/supabase-js'
import { isSandboxMode } from '@/lib/sandbox/useSandbox'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// In sandbox mode env vars may be absent (mock client doesn't need them)
if (!isSandboxMode() && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  )
}

const realClient = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

let _active = realClient

/** @param {object} mockClient — the mock supabase client from mocks/supabaseMock.js */
export function activateSandbox(mockClient) { _active = mockClient }
export function deactivateSandbox() { _active = realClient }

// Proxy delegates all property access to whichever client is active.
// All existing `supabase.auth.*` and `supabase.from(...)` calls work unchanged.
export const supabase = new Proxy({}, {
  get(_, prop) { return _active[prop] },
})
