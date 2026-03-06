# CLAUDE.md — Lodge-ical

Property management platform for small inns and accommodations (< 15 rooms).
React SPA frontend with Supabase backend (PostgreSQL, Edge Functions, Auth).

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

## Project Structure

```
src/
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

supabase/
├── functions/          # 15 Edge Functions (TypeScript/Deno)
│   ├── _shared/        # Shared utilities (auth, email, pricing, stripe, rate-limiting)
│   └── [name]/         # Individual functions
└── migrations/         # 21 SQL database migrations

tests/
├── unit/               # 8 Vitest test files
├── e2e/                # Playwright smoke tests
└── setup.js            # Vitest global setup (testing-library/jest-dom)
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
| Testing | Vitest (unit), Playwright (E2E), React Testing Library |
| Dev Mocking | MSW (Mock Service Worker) |

## Architecture Rules

### Contexts and State
- **AuthContext** calls `supabase.auth.getUser()` once at app root. RouteGuard reads from AuthContext — it never calls Supabase directly.
- **PropertyContext** reads from AuthContext only — no direct Supabase calls.
- Server state is managed exclusively via TanStack React Query hooks.

### Single Sources of Truth
- **Routes**: All defined in `src/config/routes.js`. Navigation items, permissions, and public-route detection derive from this array. Never hardcode route paths elsewhere. Enforced by `npm run routes:check` in CI.
- **Query Keys**: All defined in `src/config/queryKeys.js`. Never define query keys inline in hooks.
- **Permissions**: Role-based (owner, manager, staff), defined in `src/lib/auth/permissions.js`. Each route specifies its required permission.

### Data Conventions
- **Dates**: Always ISO strings (`YYYY-MM-DD`) in state and API calls. Never use `Date` objects.
- **Money**: Always integer cents in state and API. Display with IBM Plex Mono font.
- **Payments**: `usePaymentSummary` calls the `get-payment-summary` Edge Function. Never calculate payment math client-side.

### Component Patterns
- Function components + hooks only. No class components.
- Pages are lazy-loaded via `React.lazy()` in App.jsx.
- All pages in `src/pages/admin/` or `src/pages/public/`.
- Path alias: `@/` maps to `src/` (configured in Vite).

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

### Unit Tests (Vitest)
- Location: `tests/unit/`
- Environment: jsdom with CSS support
- Global setup loads `@testing-library/jest-dom`
- Vitest globals enabled (`describe`, `it`, `expect` available without import)
- Run: `npm run test`

### E2E Tests (Playwright)
- Location: `tests/e2e/`
- Smoke tests verify routing, public pages, and auth redirects
- Runs against auto-started dev server
- CI uses stub Supabase/Stripe env vars (no real backend needed)
- Run: `npm run test:e2e`

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on PRs and pushes to main:

1. **Job 1** — Lint + Unit Tests + Build (always runs)
   - `npm run lint` (zero warnings)
   - `npm run test` (Vitest)
   - `npm run build` (Vite)
   - Uploads `dist/` artifact

2. **Job 2** — E2E Tests (needs Job 1)
   - Installs Playwright browsers (chromium)
   - Runs smoke tests with stub env vars
   - Uploads Playwright report on failure

## ESLint Configuration

- Flat config (`eslint.config.js`)
- Plugins: react-hooks, react-refresh, jsx-a11y
- `no-unused-vars`: error (vars matching `^[A-Z_]` ignored, args matching `^_` ignored)
- `jsx-a11y/label-has-associated-control`: enforced with depth 2
- Zero-warning policy (`--max-warnings=0`)
- Test files get vitest globals

## Development with MSW (Mock Mode)

Setting `VITE_MSW=true` (default in development) swaps the real Supabase client for an in-memory mock via Vite alias resolution. This allows full frontend development without a running Supabase instance.

- Mock worker file: `public/mockServiceWorker.js`
- Mock Supabase client: `src/mocks/supabaseMock.js`
- Vite aliases `@/lib/supabaseClient` → `src/mocks/supabaseMock.js` when MSW is enabled

## Edge Functions (Supabase)

Located in `supabase/functions/`, written in TypeScript for the Deno runtime:

- `_shared/` — Common utilities (auth verification, email sending, pricing logic, Stripe helpers, rate limiting)
- `create-reservation`, `modify-reservation`, `cancel-reservation` — Reservation lifecycle
- `create-payment-intent`, `stripe-webhook`, `get-payment-summary` — Payment processing
- `ical-export`, `ical-import` — Calendar sync
- `import-csv` — Bulk data import
- `guest-portal-lookup` — Public guest access
- `merge-guests` — Guest deduplication
- `public-bootstrap` — Widget/public page initialization
- `confirm-modification` — Reservation modification confirmation
- `update-reservation` — Reservation updates
