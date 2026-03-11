---
name: senior-architect
description: Lodge-ical system architecture — provider hierarchy, context system, routing, data flow, Edge Function organization, and tech decision rationale. Use when designing system architecture, evaluating trade-offs, planning new features, or understanding how components connect.
user-invocable: true
disable-model-invocation: false
---

# Lodge-ical Architecture

System architecture and design patterns for Lodge-ical. For full technical docs see `CLAUDE.md`, `src/CLAUDE.md`, and `supabase/CLAUDE.md`.

## System Overview

Lodge-ical is a property management platform for small inns and B&Bs (< 15 rooms). Architecture optimized for simplicity over scale.

```
┌─────────────────────────────────────────────────┐
│  React SPA (Vite)                               │
│  ├─ Admin pages (14 lazy-loaded)                │
│  ├─ Public pages (widget, guest portal, etc.)   │
│  └─ TanStack Query (server state cache)         │
└────────────┬─────────────────┬──────────────────┘
             │ PostgREST       │ Edge Functions
             │ (reads)         │ (writes/logic)
┌────────────▼─────────────────▼──────────────────┐
│  Supabase                                        │
│  ├─ PostgreSQL + RLS (data + access control)     │
│  ├─ Auth (JWT, user sessions)                    │
│  ├─ Edge Functions (15, Deno/TypeScript)          │
│  └─ Storage (documents, images)                  │
└──────────────────────────────────────────────────┘
             │                 │
     ┌───────▼───┐     ┌──────▼──────┐
     │  Stripe   │     │   Resend    │
     │ Payments  │     │   Email     │
     └───────────┘     └─────────────┘
```

## Frontend Architecture

### Provider Hierarchy (order matters — defined in App.jsx)

```
QueryClientProvider       ← TanStack Query (staleTime: 2min, retry: 1)
  BrowserRouter           ← React Router 7
    AuthProvider           ← Calls supabase.auth.getUser() once
      PropertyProvider     ← Reads from AuthContext only
        ToastProvider      ← Toast notifications
          ErrorBoundary    ← Catches render errors
            Suspense       ← PageLoader fallback for lazy routes
              Routes       ← All route definitions
```

### Context System

| Context | Purpose | Rule |
|---------|---------|------|
| AuthContext | User session, role | Calls Supabase once at root. RouteGuard reads from it — never calls Supabase directly. |
| PropertyContext | Property data, settings, access | Reads from AuthContext only — no direct Supabase calls. |
| ToastProvider | Notification queue | Available to all components below it. |

### Routing

`src/config/routes.js` is the single source of truth for all 31 routes. From this array:
- `App.jsx` generates `<Route>` elements, matching `pageName` to `pageMap` lazy imports
- `Sidebar.jsx` derives nav items (filtering `!isPublic && !navHidden`)
- `RouteGuard` checks permissions per route

### State Management

- **Server state**: TanStack React Query 5 (all data from Supabase)
- **UI state**: React useState/useReducer (form state, modals, filters)
- **No global client state store** — no Redux, no Zustand

## Backend Architecture

### Edge Functions (15 functions in `supabase/functions/`)

| Domain | Functions |
|--------|-----------|
| Reservation lifecycle | `create-reservation`, `modify-reservation`, `cancel-reservation`, `confirm-modification`, `update-reservation` |
| Payments | `create-payment-intent`, `stripe-webhook`, `get-payment-summary` |
| Calendar | `ical-export`, `ical-import` |
| Public | `public-bootstrap`, `guest-portal-lookup`, `preview-pricing`, `submit-inquiry` |
| Admin | `import-csv`, `merge-guests` |

### Shared Utilities (`_shared/`)

| Module | Responsibility |
|--------|---------------|
| `auth.ts` | JWT validation, propertyId lookup from `user_property_access` |
| `pricing.ts` | Nightly rate engine: base rate → overrides → tax → fee pass-through |
| `paymentSummary.ts` | charges - refunds = net paid, derives paid/partial/unpaid/overpaid |
| `stripe.ts` | Stripe client singleton |
| `email.ts` + `emailTemplates.ts` | Resend integration, HTML templates with variable substitution |
| `rateLimit.ts` | DB-backed sliding window (atomic INSERT...ON CONFLICT) |
| `ical.ts` | iCalendar parsing and generation |

### RLS as Auth Layer

Two-tier access model (migration 009):
1. **Admin**: Authenticated user with row in `user_property_access` for target `property_id`
2. **Public**: Unauthenticated, only for properties where `is_active = true AND is_public = true`

All policies use `EXISTS` subquery — never `USING (auth.uid() = user_id)` directly.

## Data Flow Patterns

### Read Path (admin pages)
```
Component → useQuery(queryKeys.entity.list) → supabase.from('table').select()
  → PostgREST → PostgreSQL (RLS filters by property) → JSON response
```

### Write Path (business logic)
```
Component → useMutation → fetch(Edge Function, Bearer token)
  → requireAuth() → Zod validation → business logic → PostgreSQL
  → invalidateQueries(queryKeys.entity.all)
```

### Widget Payment Flow
```
DateStep → RoomStep → GuestStep → ReviewStep
  → preview-pricing (public, no auth)
  → create-payment-intent (guest header)
  → Stripe Elements confirmPayment
  → stripe-webhook → payment status update
```

## Single Sources of Truth

| Concern | File | Rule |
|---------|------|------|
| Routes | `src/config/routes.js` | All 31 routes. Never hardcode paths elsewhere. Validated by `npm run routes:check`. |
| Query keys | `src/config/queryKeys.js` | Factory pattern. Never define keys inline in hooks. |
| Permissions | `src/lib/auth/permissions.js` | 12 constants, 3 role mappings (owner/manager/staff). |
| Design tokens | `tailwind.config.js` | Locked palette. Never use raw hex in components. |

## Tech Decisions

| Choice | Over | Rationale |
|--------|------|-----------|
| React Router SPA | Next.js | No SSR needed — admin tool, not SEO-critical. Simpler deployment (static files). |
| Supabase | Firebase | PostgreSQL + RLS + Edge Functions in one platform. SQL > NoSQL for relational property data. |
| Vite | webpack | Faster dev server, simpler config, native ESM. |
| JSDoc | TypeScript | Less friction for small team. Supabase Edge Functions use TS; frontend uses JSDoc. |
| TanStack Query | Redux/Zustand | Server state cache with built-in refetching, invalidation. No need for client state store. |
| Radix UI | MUI/Chakra | Headless primitives, no style opinions. Works with Tailwind design tokens. |
| PostgREST reads | Edge Functions for reads | Reads go through PostgREST (auto-generated REST from schema + RLS). Writes go through Edge Functions for business logic. |

## Product Philosophy

- Target: small inns/B&Bs, < 15 rooms. Innkeeper personally knows every guest.
- Software handles business data (reservations, payments, finances, guest records).
- Do NOT add operational tracking (check-in/check-out status) — the innkeeper knows who has arrived.
- Features should reduce admin burden, not add tracking rituals.
- When evaluating a feature: "would a 1-person B&B operator actually use this?"

## Common Commands

```bash
# Frontend
npm run dev            # Dev server with MSW mocks
npm run build          # Production build
npm run lint           # ESLint (zero-warning policy)
npm run test           # Vitest unit tests
npm run test:e2e       # Playwright E2E
npm run routes:check   # Verify routes.js is source of truth

# Backend
supabase start         # Local Supabase stack
supabase db reset      # Re-run migrations + seed
supabase functions serve  # Edge Functions with hot reload
supabase migration new name  # New migration
```
