# Lodge-ical

Property management software for small inns and B&Bs (fewer than 15 rooms).

Built for innkeepers who personally know every guest — Lodge-ical handles the business data so you can focus on hospitality.

## What it does

- **Reservations** — calendar view, conflict detection, room assignment, multi-room bookings
- **Guest profiles** — full history, contact info, deduplication
- **Payments** — Stripe integration, payment tracking, financial reports
- **Booking widget** — embeddable public widget with availability check, Stripe payment, and inquiry capture
- **Guest portal** — self-service lookup, modification requests, check-in info
- **Import** — bring in existing reservations from Uplisting, Guesty, or any CSV export
- **iCal sync** — export and import iCalendar feeds for channel sync
- **Maintenance** — ticket tracking with room block support
- **Messaging** — guest communication log
- **Contacts** — vendor and staff directory
- **Reports** — revenue, occupancy, ADR, RevPAR, financial insights

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, React Router 7 |
| Server state | TanStack React Query 5 |
| Styling | Tailwind CSS 3.4 (custom design tokens) |
| Components | Radix UI primitives, Phosphor Icons |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Payments | Stripe |
| Testing | Vitest, Playwright, K6 |
| Dev mocking | MSW (Mock Service Worker) |

## Getting started

### Prerequisites

- Node 20
- A Supabase project (or use MSW mock mode for frontend-only development)

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env` and fill in your Supabase URL and anon key:

```bash
cp .env.example .env
```

### Run (mock mode — no Supabase needed)

```bash
npm run dev
```

Mock mode is on by default in development (`VITE_MSW=true` in `.env.development`). The app runs fully against in-memory fixture data.

### Run (live Supabase)

Set `VITE_MSW=false` in `.env`, then:

```bash
npm run dev
```

## Commands

```bash
npm run dev          # Dev server (mock mode by default)
npm run build        # Production build
npm run lint         # ESLint (zero-warning policy)
npm run test         # Unit tests (Vitest)
npm run test:watch   # Unit tests in watch mode
npm run test:e2e     # E2E smoke tests (Playwright)
npm run routes:check # Verify routes.js is single source of truth
```

## Project structure

```
src/
├── pages/
│   ├── admin/          # Admin pages (Dashboard, Reservations, Rooms, Import, ...)
│   └── public/         # Public pages (Login, Widget, Guest Portal, ...)
├── components/
│   ├── ui/             # Radix UI primitives
│   ├── layout/         # AdminLayout, Sidebar
│   ├── shared/         # ErrorBoundary, DataTable, StatusChip, FolderCard, HelpTip
│   ├── reservations/   # Reservation modals and components
│   └── widget/         # Public booking widget (multi-step flow)
├── lib/
│   ├── auth/           # AuthContext, permissions
│   ├── property/       # PropertyContext
│   ├── csv/            # CSV import utilities (column mapper, auto-suggest)
│   └── supabaseClient.js
├── hooks/              # useReservations, useRooms, useGuests, usePaymentSummary
├── config/
│   ├── routes.js       # All route definitions (single source of truth)
│   └── queryKeys.js    # All TanStack Query key factories
└── mocks/              # MSW mock setup and fixture data

supabase/
├── functions/          # Edge Functions (Deno/TypeScript)
├── migrations/         # SQL migrations
└── config.toml

tests/
├── unit/               # Vitest tests
├── e2e/                # Playwright smoke tests
└── load/               # K6 load tests (manual)
```

## CSV import

Innkeepers can import reservations from any CSV export (Uplisting, Guesty, or custom). The import flow:

1. Upload a CSV file
2. Map your CSV columns to Lodge-ical fields (auto-suggest based on header names)
3. Match unrecognized room names to Lodge-ical rooms
4. Preview the mapped data
5. Import — duplicates are detected by confirmation number and by (check-in, check-out, room) composite key
6. Roll back any batch with one click if you uploaded the wrong file

Template CSV with exact Lodge-ical headers skips the mapping step entirely.

## Docs

See [`CLAUDE.md`](CLAUDE.md) for full development conventions, architecture rules, and design system reference.
