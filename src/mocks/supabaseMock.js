// src/mocks/supabaseMock.js
// In-memory Supabase client used when VITE_MSW=true.
// Aliased in vite.config.js so every `import { supabase } from '@/lib/supabaseClient'`
// gets this instead of the real client — no network, no service worker, any origin.

import {
  MOCK_USER, MOCK_SESSION,
  MOCK_PROPERTY, MOCK_USER_ACCESS, MOCK_SETTINGS,
  MOCK_ROOMS, MOCK_GUESTS, MOCK_RESERVATIONS,
} from './db.js'

// ---------------------------------------------------------------------------
// In-memory table store
// ---------------------------------------------------------------------------
const TABLE_DATA = {
  user_property_access: [MOCK_USER_ACCESS],
  properties:           [MOCK_PROPERTY],
  settings:             [MOCK_SETTINGS],
  rooms:                MOCK_ROOMS,
  reservations:         MOCK_RESERVATIONS,
  guests:               MOCK_GUESTS,
  documents:            [],
  room_external_feeds:  [],
}

// ---------------------------------------------------------------------------
// Chainable query builder (thenable — safe to await)
// ---------------------------------------------------------------------------
class MockQueryBuilder {
  constructor(table) {
    this._data    = [...(TABLE_DATA[table] ?? [])]
    this._method  = 'select'
    this._body    = null
    this._filters = []
    this._limitN  = null
    this._single  = false
  }

  // Projection (ignored — we always return full objects)
  select() { return this }

  // Filters
  eq(col, val)  { this._filters.push(r => String(r[col]) === String(val)); return this }
  neq(col, val) { this._filters.push(r => String(r[col]) !== String(val)); return this }
  gte(col, val) { this._filters.push(r => r[col] >= val); return this }
  lte(col, val) { this._filters.push(r => r[col] <= val); return this }
  lt(col, val)  { this._filters.push(r => r[col] <  val); return this }
  gt(col, val)  { this._filters.push(r => r[col] >  val); return this }
  or()          { return this } // search not needed for fixture data
  order()       { return this }
  limit(n)      { this._limitN = n; return this }
  single()      { this._single = true; return this }

  // Mutations
  insert(body) {
    this._method = 'insert'
    const rows = Array.isArray(body) ? body : [body]
    this._data = rows.map((r, i) => ({
      id: `mock-${Date.now()}-${i}`,
      created_at: new Date().toISOString(),
      ...r,
    }))
    return this
  }
  update(body) { this._method = 'update'; this._body = body; return this }
  upsert(body) { return this.insert(body) }
  delete()     { this._method = 'delete'; return this }

  // Resolve the accumulated operations to { data, error }
  _resolve() {
    if (this._method === 'delete') return { data: null, error: null }

    let rows = this._method === 'insert'
      ? this._data                                              // already set by insert()
      : this._filters.reduce((acc, f) => acc.filter(f), this._data)

    if (this._method === 'update' && this._body) {
      rows = rows.map(r => ({ ...r, ...this._body }))
    }

    if (this._limitN != null) rows = rows.slice(0, this._limitN)

    if (this._single) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }

  then(resolve, reject) { return Promise.resolve(this._resolve()).then(resolve, reject) }
  catch(reject)         { return Promise.resolve(this._resolve()).catch(reject) }
  finally(fn)           { return Promise.resolve(this._resolve()).finally(fn) }
}

// ---------------------------------------------------------------------------
// Mock auth
// ---------------------------------------------------------------------------
const auth = {
  getUser: async () => ({ data: { user: MOCK_USER }, error: null }),

  getSession: async () => ({ data: { session: MOCK_SESSION }, error: null }),

  signInWithPassword: async () => ({
    data: { user: MOCK_USER, session: MOCK_SESSION },
    error: null,
  }),

  signOut: async () => {
    // Clear the injected session so a hard-refresh goes back to login
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k))
    return { error: null }
  },

  onAuthStateChange: (callback) => {
    // Fire SIGNED_IN asynchronously so effects can register first
    setTimeout(() => callback('SIGNED_IN', MOCK_SESSION), 0)
    return { data: { subscription: { unsubscribe: () => {} } } }
  },
}

// ---------------------------------------------------------------------------
// Exported mock client — same shape as the real supabase export
// ---------------------------------------------------------------------------
export const supabase = {
  auth,
  from: (table) => new MockQueryBuilder(table),
}
