# CLAUDE.md — Lodge-ical

Property management platform for small inns and accommodations (< 15 rooms).
React SPA frontend with Supabase backend (PostgreSQL, Edge Functions, Auth).

> **Scoped docs:** See also [`src/CLAUDE.md`](src/CLAUDE.md), [`supabase/CLAUDE.md`](supabase/CLAUDE.md), and [`tests/CLAUDE.md`](tests/CLAUDE.md) for detailed conventions in each area.

## Quick Reference

```bash
npm run dev          # Start dev server (MSW mock mode by default)
npm run build        # Production build (Vite)
npm run lint         # ESLint — zero-warning policy enforced in CI
npm run test         # Unit tests (Vitest)
npm run test:watch   # Unit tests in watch mode
npm run test:e2e     # E2E smoke tests (Playwright)
npm run routes:check # Verify routes.js is single source of truth
```

**Node version:** 20 (enforced in CI)
**Package manager:** npm (`npm ci` in CI — lockfile must be up to date)

## Environment Variables

See `.env.example` for the full list. Copy to `.env` and fill in values.

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | `.env` | Supabase project URL (safe to expose) |
| `VITE_SUPABASE_ANON_KEY` | `.env` | Supabase anon key (RLS enforces access) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `.env` | Stripe publishable key (client-side only) |
| `VITE_MSW` | `.env.development` | `true` enables mock mode (default in dev) |
| `VITE_SUPABASE_STORAGE_BUCKET` | `.env` | Optional — storage bucket name |
| `STRIPE_SECRET_KEY` | Edge Function secret | `supabase secrets set STRIPE_SECRET_KEY=sk_...` |
| `STRIPE_WEBHOOK_SECRET` | Edge Function secret | `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...` |
| `RESEND_API_KEY` | Edge Function secret | `supabase secrets set RESEND_API_KEY=re_...` |

Edge Function secrets are set via `supabase secrets set` and auto-injected at runtime. They are **not** in `.env`.

## Project Structure

```
src/                    # Frontend — see src/CLAUDE.md
├── pages/
│   ├── admin/          # 14 admin pages (Dashboard, Reservations, Rooms, etc.)
│   └── public/         # 6 public pages (Login, Widget, Guest Portal, etc.)
├── components/
│   ├── ui/             # Radix UI primitives (Dialog, Select, Tabs, etc.)
│   ├── layout/         # AdminLayout, Sidebar
│   ├── auth/           # RouteGuard
│   ├── shared/         # ErrorBoundary, DataTable, StatusChip, etc.
│   ├── reservations/   # Reservation-specific modals and components
│   └── widget/         # Public booking widget step components
├── lib/
│   ├── auth/           # AuthContext, permissions, auth gates
│   ├── property/       # PropertyContext, property hooks
│   ├── ical/           # iCalendar parsing and generation
│   ├── csv/            # CSV import utilities
│   └── supabaseClient.js  # Supabase client init
├── hooks/              # Custom hooks (useReservations, useRooms, useGuests, usePaymentSummary)
├── config/
│   ├── routes.js       # ALL route definitions (single source of truth)
│   └── queryKeys.js    # ALL TanStack Query key factories
├── styles/             # Global CSS
├── types/              # JSDoc type definitions
├── assets/             # Images and static assets
└── mocks/              # MSW mock setup (dev mode)

supabase/               # Backend — see supabase/CLAUDE.md
├── functions/          # 15 Edge Functions (TypeScript/Deno)
│   ├── _shared/        # Shared utilities (auth, email, pricing, stripe, rate-limiting)
│   └── [name]/         # Individual functions
├── migrations/         # 22 SQL database migrations
├── seed.sql            # Seed data (runs on `supabase db reset`)
└── config.toml         # Local Supabase configuration

tests/                  # Testing — see tests/CLAUDE.md
├── unit/               # Vitest test files
├── e2e/                # Playwright smoke tests
├── load/               # K6 load tests (manual)
└── setup.js            # Vitest global setup (testing-library/jest-dom)

scripts/
└── checkRoutes.mjs     # Route validation (npm run routes:check)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19, function components + hooks only |
| Build | Vite 7 |
| Routing | React Router 7 (lazy-loaded pages) |
| Server State | TanStack React Query 5 |
| Forms | React Hook Form + Zod validation |
| Styling | Tailwind CSS 3.4 (locked design token palette) |
| Components | Radix UI (headless primitives) |
| Icons | Phosphor Icons |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Payments | Stripe (server-side via Edge Functions) |
| Type Safety | JSDoc (no TypeScript in frontend) |
| Testing | Vitest (unit), Playwright (E2E), K6 (load), React Testing Library |
| Dev Mocking | MSW (Mock Service Worker) |

## Architecture Rules

### Provider Hierarchy (App.jsx)
```
QueryClientProvider → BrowserRouter → AuthProvider → PropertyProvider
  → ToastProvider → ErrorBoundary → Suspense(PageLoader) → Routes
```

### Contexts and State
- **AuthContext** calls `supabase.auth.getUser()` once at app root. RouteGuard reads from AuthContext — it never calls Supabase directly.
- **PropertyContext** reads from AuthContext only — no direct Supabase calls.
- Server state is managed exclusively via TanStack React Query hooks.
- **Query Client defaults**: `staleTime: 2 minutes`, `retry: 1`.

### Single Sources of Truth
- **Routes**: All defined in `src/config/routes.js`. Navigation items, permissions, and public-route detection derive from this array. Never hardcode route paths elsewhere. Enforced by `npm run routes:check` in CI.
- **Query Keys**: All defined in `src/config/queryKeys.js`. Never define query keys inline in hooks. Uses factory pattern: `queryKeys.reservations.list(filters)`.
- **Permissions**: Role-based (owner, manager, staff), defined in `src/lib/auth/permissions.js`. Each route specifies its required permission. Owner has all 12 permissions; manager has all except `MANAGE_SETTINGS`; staff has 6 (view-only + messaging, documents, maintenance, contacts, guests).

### Data Conventions
- **Dates**: Always ISO strings (`YYYY-MM-DD`) in state and API calls. Never use `Date` objects.
- **Money**: Always integer cents in state and API. Display with IBM Plex Mono font.
- **Payments**: `usePaymentSummary` calls the `get-payment-summary` Edge Function. Never calculate payment math client-side.

### Component Patterns
- Function components + hooks only. No class components.
- Pages are lazy-loaded via `React.lazy()` in App.jsx.
- All pages in `src/pages/admin/` or `src/pages/public/`.
- Path alias: `@/` maps to `src/` (configured in Vite).

### Widget Selection Model
- **Room selection** in the public booking widget is normalized: every selection (single room, room link, or multi-room) produces a `{ type, room_ids, base_rate_cents, max_guests, name }` object.
- `type` is one of `'room'`, `'room_link'`, or `'multi_room'`.
- `room_ids` is always an array — the rest of the widget (GuestStep, ReviewStep, handleBook) never branches on selection type.
- Room links (`room_links` table) are property-configured combinations of linkable rooms with their own rate and capacity.

### Book-on-Behalf (Third-Party Bookings)
- Reservations have optional `booker_email` (who booked/paid) and `cc_emails` (text array, max 5).
- When `booker_email` is null, the guest is the booker (default).
- Email distribution: guest gets all emails; booker gets confirmations/receipts; CC'd addresses get check-in/arrival info only.
- Guest portal lookup matches either guest email or booker email.

### Route Redirects
- `/financials` → `/reports` (legacy redirect)
- `*` → `/login` (fallback for unknown routes)

## Design System (Mandatory)

### Color Tokens — Use ONLY These
| Token | Hex | Usage |
|-------|-----|-------|
| background | #E8E8E8 | Page/app backgrounds |
| surface | #F4F4F4 | Cards, panels, sidebar |
| surface-raised | #FFFFFF | Modals, dropdowns, tooltips |
| border | #D4D4D4 | All borders and dividers |
| text-primary | #1A1A1A | Primary readable text |
| text-secondary | #555555 | Labels, captions, helper text |
| text-muted | #888888 | Placeholders, disabled text |
| success / success-bg | #15803D / #DCFCE7 | Confirmed, paid, active |
| warning / warning-bg | #B45309 / #FEF3C7 | Pending, partial, attention |
| danger / danger-bg | #BE123C / #FFE4E6 | Error, cancelled, overdue |
| info / info-bg | #1D4ED8 / #DBEAFE | Links, focus rings, informational |
| tableAlt | #F8FAFC | Alternating table row backgrounds |

**Never use raw hex values in component code** — always use Tailwind design token classes.

### Typography
- **h1**: Questrial, 32px, weight 400. Never bold (Questrial has no bold weight).
- **h2**: Questrial, 24px, weight 400.
- **h3**: DM Sans, 18px, weight 600.
- **h4**: DM Sans, 13px, weight 600, letter-spacing 0.06em, ALL CAPS.
- **body**: DM Sans, 15px, weight 400, line-height 1.65.
- **caption**: DM Sans, 13px, weight 400, color text-secondary.
- **Numeric data** (prices, dates, IDs, counts): IBM Plex Mono, 14px. Always.

### Component Rules
- Buttons: min 44px height. Primary buttons have no border-radius (sharp corners).
- Inputs: 44px height, 1.5px solid border, 6px border-radius.
- Focus ring: 2px offset, info color.
- Labels always above inputs, external. No floating labels.

## Forbidden Practices

- No hardcoded hex colors in any component file
- No payment math in frontend code
- No class components
- No packages not in the approved stack without explicit approval
- No `VITE_` env vars containing secret keys
- No inline query key definitions
- No hardcoded route paths outside `routes.js`

## Testing

See [`tests/CLAUDE.md`](tests/CLAUDE.md) for detailed patterns.

- **Unit tests** (`npm run test`): Vitest + jsdom + React Testing Library. Location: `tests/unit/`.
- **E2E tests** (`npm run test:e2e`): Playwright smoke tests. Intercepts all Supabase calls — no live backend needed.
- **Load tests** (manual): K6 config at `tests/load/k6.config.js`. Requires live Supabase instance.
- **No git hooks** — all enforcement happens in CI only.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on PRs and pushes to main. Cancels in-progress runs for the same ref.

1. **Job 1** — Lint + Unit Tests + Build (always runs)
   - `npm run lint` (zero warnings)
   - `npm run test` (Vitest)
   - `npm run build` (Vite)
   - Uploads `dist/` artifact (3-day retention)

2. **Job 2** — E2E Tests (needs Job 1)
   - Installs Playwright browsers (chromium)
   - Runs smoke tests with stub env vars (no real Supabase/Stripe secrets)
   - Uploads Playwright report on failure (7-day retention)

## ESLint Configuration

- Flat config (`eslint.config.js`)
- Plugins: react-hooks, react-refresh, jsx-a11y
- `no-unused-vars`: error (vars matching `^[A-Z_]` ignored, args matching `^_` ignored)
- `jsx-a11y/label-has-associated-control`: enforced with depth 2, controlComponents: `['Input', 'Select']`
- Zero-warning policy (`--max-warnings=0`)
- Test files get vitest globals
- Ignores: `dist/`, `node_modules/`, `supabase/`, `public/mockServiceWorker.js`

## Development with MSW (Mock Mode)

Setting `VITE_MSW=true` (default in development) swaps the real Supabase client for an in-memory mock via Vite alias resolution. This allows full frontend development without a running Supabase instance.

- Mock worker file: `public/mockServiceWorker.js`
- Mock Supabase client: `src/mocks/supabaseMock.js`
- Vite aliases `@/lib/supabaseClient` → `src/mocks/supabaseMock.js` when MSW is enabled
- MSW starts in `main.jsx` before React renders: `worker.start({ onUnhandledRequest: 'bypass' })`
- Fixture data in `src/mocks/db.js` uses dates relative to "today" for realistic dashboard state

See [`tests/CLAUDE.md`](tests/CLAUDE.md) for mock handler and fixture details.

## Edge Functions (Supabase)

See [`supabase/CLAUDE.md`](supabase/CLAUDE.md) for boilerplate, auth patterns, security, and business logic.

Located in `supabase/functions/`, written in TypeScript for the Deno runtime:

- `_shared/` — Common utilities (auth, email, pricing, Stripe, rate limiting)
- `create-reservation`, `modify-reservation`, `cancel-reservation` — Reservation lifecycle
- `create-payment-intent`, `stripe-webhook`, `get-payment-summary` — Payment processing
- `ical-export`, `ical-import` — Calendar sync
- `import-csv` — Bulk data import
- `guest-portal-lookup` — Public guest access
- `merge-guests` — Guest deduplication
- `public-bootstrap` — Widget/public page initialization
- `confirm-modification` — Reservation modification confirmation
- `update-reservation` — Reservation updates
