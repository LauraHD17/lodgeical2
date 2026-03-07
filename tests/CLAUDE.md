# CLAUDE.md — Testing

Testing infrastructure for Lodge-ical: unit tests, E2E smoke tests, load tests, and MSW mocking.

## Unit Tests (Vitest)

```bash
npm run test         # Run once
npm run test:watch   # Watch mode
```

- **Location**: `tests/unit/`
- **Environment**: jsdom with CSS support enabled
- **Setup**: `tests/setup.js` imports `@testing-library/jest-dom` globally
- **Globals**: `describe`, `it`, `expect` available without import (Vitest globals enabled)
- **Config**: Defined in `vite.config.js` under `test` key

### Test File Conventions

- Test pure functions and state logic — no network calls
- Import modules directly, no special mocking needed for utility functions
- Cover edge cases and state transitions

### Existing Test Files

| File | Tests |
|------|-------|
| `authGate.test.js` | Auth state machine (public routes, loading, login required, access denied, allow) |
| `paymentSummary.test.js` | Payment calculations mirroring edge function logic (full/partial/overpaid, refunds, cancellation policies) |
| `utils.test.js` | Routes config structure validation, query key factory smoke tests |
| `ical.test.js` | iCalendar parsing and generation |
| `rls.test.js` | RLS policy logic |
| `csvImport.test.js` | CSV parsing (RFC4180) |
| `conflictDetection.test.js` | Booking conflict detection |

## E2E Tests (Playwright)

```bash
npm run test:e2e     # Runs against auto-started dev server
```

- **Location**: `tests/e2e/smoke.spec.js`
- **Browser**: Chromium only
- **Dev server**: Auto-started by Playwright on `:5173` (no manual startup)

### How E2E Tests Work

All Supabase calls are intercepted — **no live backend required**:

```javascript
// Intercepts in beforeEach:
'**/auth/v1/**'      → 401 (no session)
'**/rest/v1/**'      → 200 with []
'**/functions/v1/**' → 200 with {}
```

### What Smoke Tests Verify

- Public routes render without crashing (login, widget, guest portal, booking confirmation)
- Unauthenticated users are redirected to `/login` on protected routes
- Unknown routes handled gracefully (404/redirect)

### Playwright Config

- Parallel execution enabled
- CI: 2 workers, 1 retry, GitHub Actions reporter
- Local: full parallelism, 0 retries
- Screenshots: only on failure
- Traces: on first retry

## Load Tests (K6)

```bash
k6 run tests/load/k6.config.js
```

**Manual only** — not part of CI. Requires a running Supabase instance.

- **Location**: `tests/load/k6.config.js`

### Prerequisites

Set these environment variables:
- `BASE_URL` — Supabase functions URL
- `ADMIN_JWT` — Valid admin JWT token
- `PROPERTY_ID` — Test property ID
- `ROOM_ID` — Test room ID

### Scenarios

| Scenario | Description | VUs |
|----------|-------------|-----|
| `create_reservation` | Ramp up to 10 VUs, each with unique date window (offset by 30 days) | 10 |
| `conflict_stress` | 5 VUs race to book same dates/room — expects 1 success, rest 409 | 5 |
| `guest_portal` | Constant arrival rate (8 req/min), respects rate limit | ~2 |
| `update_reservation` | Mix of notes-only and date changes | varies |

### Thresholds

- P95 latency: 3s (write), 1.5s (read), 2s (update)
- Error rate: < 5%
- HTTP failure rate: < 5%

## MSW Mock System

MSW provides full frontend development without a running Supabase instance. Enabled by default in dev mode (`VITE_MSW=true`).

### Architecture

```
main.jsx              → Conditionally starts MSW worker before React renders
vite.config.js         → Aliases @/lib/supabaseClient → src/mocks/supabaseMock.js
src/mocks/browser.js   → MSW worker setup
src/mocks/handlers.js  → Request handlers (PostgREST, Auth, Edge Functions)
src/mocks/db.js        → In-memory fixture data
src/mocks/supabaseMock.js → Mock Supabase client (replaces real client via alias)
```

### Mock Supabase Client (`supabaseMock.js`)

In-memory `MockQueryBuilder` that mimics the real `supabase-js` API:
- **Selectors**: `.select()`
- **Filters**: `.eq()`, `.neq()`, `.gte()`, `.lte()`, `.lt()`, `.gt()`, `.or()`
- **Modifiers**: `.order()`, `.limit(n)`, `.single()`
- **Mutations**: `.insert()`, `.update()`, `.upsert()`, `.delete()`
- **Thenable**: Can be awaited, returns `{ data, error }`

Mock auth methods:
- `getUser()` → returns MOCK_USER
- `signInWithPassword()` → returns MOCK_USER + MOCK_SESSION
- `signOut()` → clears localStorage keys starting with `sb-`
- `onAuthStateChange()` → fires `SIGNED_IN` callback asynchronously

### Mock Handlers (`handlers.js`)

Uses `msw/http` to intercept:
- **Auth (GoTrue)**: `/auth/v1/user`, `/token`, `/logout`, `/sessions`
- **PostgREST**: `/rest/v1/[table]` with full filter/CRUD support
- **Edge Functions**: Partial mocks for reservation, payment, iCal, guest portal, CSV import

`pgRespond()` helper returns single object (when `.single()` requested via Accept header) or array.

### Fixture Data (`db.js`)

All dates computed relative to "today" (`daysFromNow()`) for realistic dashboard state:
- 6 guests, 3 rooms, 9 reservations (checked-in, arriving, departing, upcoming, past, cancelled)
- 6 contacts (vendors + staff)
- 4 maintenance tickets (open, in-progress, resolved)
- 10 payments spanning 6 months
- All records tagged with `property_id: 'prop-demo-001'`

Worker starts with `onUnhandledRequest: 'bypass'` — unmatched requests pass through to the network.
