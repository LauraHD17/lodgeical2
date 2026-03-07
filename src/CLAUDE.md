# CLAUDE.md — Frontend (src/)

React SPA conventions, component patterns, and state management for Lodge-ical.

## Provider Hierarchy

Defined in `App.jsx` — order matters:

```
QueryClientProvider       ← TanStack React Query (staleTime: 2min, retry: 1)
  BrowserRouter           ← React Router 7
    AuthProvider           ← Calls supabase.auth.getUser() once
      PropertyProvider     ← Reads from AuthContext only
        ToastProvider      ← Toast notifications
          ErrorBoundary    ← Catches render errors
            Suspense       ← PageLoader fallback for lazy routes
              Routes       ← All route definitions
```

Never reorder or skip providers. Components lower in the tree depend on contexts above them.

## Routing

### Route Definitions (`config/routes.js`)

31 total routes. Each route object specifies:
- `path`, `pageName`, `component` (lazy import)
- `isPublic` (boolean) — public routes skip auth
- `permission` (string) — required permission for admin routes
- `navHidden` (boolean, optional) — excluded from sidebar nav
- `navLabel` (string, optional) — override display name in nav

**Admin routes** (14): Dashboard (`/`), Reservations, Calendar, Rooms, Rates, Guests, Payments, Messaging, Documents (navHidden), Maintenance, Contacts, Reports, Settings, Import (navHidden), Help (navHidden)

**Public routes** (6): `/login`, `/widget`, `/guest-portal`, `/booking-confirmation`, `/invoice/:id`, `/check-in`

**Redirects** (in App.jsx, not in routes.js):
- `/financials` → `/reports`
- `*` → `/login`

**NAV_ITEMS** derived by filtering: `!isPublic && !navHidden`. Uses `navLabel` if present, otherwise `pageName`.

### Route Validation

`npm run routes:check` (runs `scripts/checkRoutes.mjs`) verifies routes.js is the single source of truth — no hardcoded paths elsewhere.

## Permissions System (`lib/auth/permissions.js`)

### 12 Permission Constants

`VIEW_DASHBOARD`, `MANAGE_RESERVATIONS`, `VIEW_RESERVATIONS`, `MANAGE_ROOMS`, `MANAGE_GUESTS`, `MANAGE_PAYMENTS`, `MANAGE_DOCUMENTS`, `MANAGE_SETTINGS`, `VIEW_REPORTS`, `MANAGE_MESSAGING`, `MANAGE_MAINTENANCE`, `MANAGE_CONTACTS`

### Role Mappings

| Role | Has | Missing |
|------|-----|---------|
| **owner** | All 12 | — |
| **manager** | 11 | `MANAGE_SETTINGS` |
| **staff** | 6 | `VIEW_DASHBOARD`, `MANAGE_RESERVATIONS`, `MANAGE_ROOMS`, `MANAGE_PAYMENTS`, `MANAGE_SETTINGS`, `VIEW_REPORTS` |

### Helper Functions

- `getRolePermissions(role)` → returns permission array for a role
- `hasPermission(role, permission)` → boolean check

## Query Key Factories (`config/queryKeys.js`)

All query keys use the factory pattern. Never define keys inline.

```javascript
// Pattern:
queryKeys.entityName.all           // root key (for bulk invalidation)
queryKeys.entityName.list(filters) // filtered list
queryKeys.entityName.detail(id)    // single entity

// Available factories:
queryKeys.reservations  // .all, .list(filters), .detail(id), .calendar(year, month)
queryKeys.rooms         // .all, .list(), .detail(id), .availability(checkIn, checkOut)
queryKeys.guests        // .all, .list(search), .detail(id), .byEmail(email), .reservations(guestId)
queryKeys.settings      // .all, .property(propertyId)
queryKeys.payments      // .all, .list(filters), .detail(id)
queryKeys.paymentSummary // .all, .byReservation(reservationId)
queryKeys.property      // .all, .current()
queryKeys.financials    // .all, .monthly(propertyId, year)
queryKeys.maintenance   // .all, .list(propertyId, filters), .open(propertyId)
queryKeys.contacts      // .all, .list(propertyId, type), .staff(propertyId)
queryKeys.weather       // .current(lat, lon)
```

### Invalidation Pattern

Invalidate by parent key to clear all related queries:
```javascript
queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
```

## Hook Patterns

### Query Hooks
- Use `useQuery` with `queryKey` from the factory
- Enable/disable with `enabled` prop: `enabled: !!propertyId`
- Fetch from Supabase directly or via Edge Function

### Mutation Hooks
- Wrap Edge Function calls in `useMutation`
- Get auth token: `const { data: { session } } = await supabase.auth.getSession()`
- Pass Bearer token in Authorization header
- Invalidate parent query key on success

## Path Alias

`@/` maps to `src/` (configured in `vite.config.js`). Use `@/` for all imports — relative imports are not conventional in this project.

In MSW mode, `@/lib/supabaseClient` is additionally aliased to `src/mocks/supabaseMock.js`.
