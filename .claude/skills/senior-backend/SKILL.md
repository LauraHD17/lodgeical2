---
name: senior-backend
description: Lodge-ical backend development — Supabase Edge Functions (Deno/TypeScript), PostgreSQL with RLS, database migrations, shared utilities, and payment/email integration. Use when creating Edge Functions, writing database migrations, optimizing queries, implementing auth, or working with Stripe/email.
user-invocable: true
disable-model-invocation: false
---

# Lodge-ical Backend

Supabase Edge Functions, PostgreSQL, and infrastructure patterns for Lodge-ical. For full backend docs see `supabase/CLAUDE.md`. This skill focuses on actionable checklists and patterns.

## New Edge Function Checklist

1. **Create function directory** — `supabase/functions/{function-name}/index.ts`
2. **Use standard boilerplate** — CORS headers, OPTIONS handler, try/catch wrapper (see below)
3. **Add auth** — `requireAuth(req)` for admin endpoints, or skip for public endpoints
4. **Validate input** — Zod schema with `safeParse`, return 400 on failure
5. **Add rate limiting** — `checkRateLimit()` from `_shared/rateLimit.ts` if needed
6. **Add to mock handlers** — if the frontend calls it, add an MSW handler in `src/mocks/handlers.js`

## Edge Function Boilerplate

```typescript
import { serve } from 'https://deno.land/std/http/server.ts'
import { z } from 'https://deno.land/x/zod/mod.ts'
import { requireAuth } from '../_shared/auth.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-guest-token, x-guest-payment',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // 1. Auth
    const authResult = await requireAuth(req)
    if (authResult.error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: CORS_HEADERS
      })
    }
    const { propertyId, user } = authResult

    // 2. Parse + validate input
    const body = await req.json()
    const schema = z.object({ /* ... */ })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), {
        status: 400, headers: CORS_HEADERS
      })
    }

    // 3. Business logic
    // ...

    // 4. Return response
    return new Response(JSON.stringify({ data: result }), { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[function-name]', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: CORS_HEADERS
    })
  }
})
```

## Auth Patterns

**Admin endpoint** — validates JWT + fetches propertyId server-side:
```typescript
import { requireAuth } from '../_shared/auth.ts'

const authResult = await requireAuth(req)
if (authResult.error) return new Response(...)
const { propertyId, user } = authResult
```

`requireAuth()` does three things:
1. Extracts Bearer token from Authorization header
2. Validates JWT via `supabase.auth.getUser(token)`
3. Fetches `propertyId` from `user_property_access` — never trusts client input

**Public endpoint** (e.g., `guest-portal-lookup`, `submit-inquiry`):
- No `requireAuth()` — identity verified by confirmation number + email match
- Generic error messages to prevent enumeration
- Stricter rate limiting (10 req/min vs 30 for admin)

## Shared Utilities (`supabase/functions/_shared/`)

| Module | Purpose |
|--------|---------|
| `auth.ts` | `requireAuth(req)` — JWT validation, propertyId lookup |
| `pricing.ts` | Nightly rate calculation: base rate → rate overrides → tax → Stripe fee pass-through |
| `paymentSummary.ts` | charges - refunds = net paid, derives status (paid/partial/unpaid/overpaid) |
| `stripe.ts` | Stripe client singleton (`new Stripe(STRIPE_SECRET_KEY)`) |
| `email.ts` | Resend API integration, booking/cancellation/booker email helpers |
| `emailTemplates.ts` | HTML email templates with variable substitution (HTML-escaped) |
| `rateLimit.ts` | DB-backed sliding window rate limiting (atomic `INSERT...ON CONFLICT`) |
| `ical.ts` | iCalendar format parsing and generation |

## Database Migration Workflow

```bash
# Create a new migration
supabase migration new descriptive_name
# → creates supabase/migrations/{timestamp}_descriptive_name.sql

# Apply migrations locally
supabase db reset    # Re-runs ALL migrations + seed.sql

# Check migration status
supabase migration list
```

**Naming convention:** Numbered prefix matches logical order (001, 002...), descriptive snake_case name.

**RLS policy pattern** (two-tier access, defined in migration 009):
```sql
-- Admin access: authenticated user with property access
CREATE POLICY "table_admin_select" ON table_name
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_property_access
    WHERE user_property_access.user_id = auth.uid()
    AND user_property_access.property_id = table_name.property_id
  ));

-- Public read: active + public properties only
CREATE POLICY "table_public_select" ON table_name
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = table_name.property_id
    AND properties.is_active = true
    AND properties.is_public = true
  ));
```

## Input Validation Pattern

All Edge Function input validated with Zod:
```typescript
const schema = z.object({
  room_ids: z.array(z.string().uuid()).min(1),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guest_email: z.string().email(),
  notes: z.string().max(500).optional(),
})

const parsed = schema.safeParse(body)
if (!parsed.success) {
  return new Response(JSON.stringify({
    error: 'Invalid input',
    details: parsed.error.flatten()
  }), { status: 400, headers: CORS_HEADERS })
}
```

## HTTP Status Codes

| Code | Use Case |
|------|----------|
| 200 | Success (GET, POST with data return) |
| 201 | Created |
| 204 | No Content (DELETE) |
| 400 | Validation error, invalid JSON, business rule violation |
| 401 | Missing/invalid auth token |
| 403 | Resource doesn't belong to this property |
| 404 | Resource not found |
| 409 | Booking conflict (includes `conflictingIds`) |
| 429 | Rate limit exceeded |
| 500 | Database or unrecoverable server error |

All errors return `{ error: "message" }` JSON.

## SQL Index Strategies

```sql
-- Single column (equality lookups)
CREATE INDEX idx_reservations_property ON reservations(property_id);

-- Composite (multi-column queries)
CREATE INDEX idx_payments_reservation_status ON payments(reservation_id, status);

-- Partial (filtered queries)
CREATE INDEX idx_reservations_active ON reservations(check_in)
  WHERE status IN ('confirmed', 'pending');

-- Covering (avoid table lookup)
CREATE INDEX idx_rooms_property ON rooms(property_id) INCLUDE (name, base_rate_cents);
```

## Rate Limiting

DB-backed sliding window via `_shared/rateLimit.ts`:
```typescript
import { checkRateLimit } from '../_shared/rateLimit.ts'

const rateLimited = await checkRateLimit(supabase, {
  key: `create-reservation:${propertyId}`,
  windowMs: 60_000,
  maxRequests: 30,
})
if (rateLimited) {
  return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
    status: 429, headers: CORS_HEADERS
  })
}
```

Default rates: 30 req/min for admin endpoints, 10 req/min for guest portal.

## Common Commands

```bash
# Local development
supabase start             # Start local Supabase stack
supabase db reset          # Re-run migrations + seed
supabase functions serve   # Serve Edge Functions with hot reload
supabase secrets set KEY=value  # Set secrets (Stripe, Resend)

# Migrations
supabase migration new name  # Create migration file
supabase migration list      # Check status

# Testing
npm run test               # Vitest unit tests
npm run test:e2e           # Playwright E2E
k6 run tests/load/k6.config.js  # Load tests (requires live Supabase)

# Debugging
supabase functions logs function-name  # View Edge Function logs
```

## Forbidden

- No payment math in frontend — always server-side via `_shared/pricing.ts`
- No client-trusted `propertyId` — always fetched server-side via `requireAuth()`
- No `VITE_` env vars containing secrets
- No `stripe_account_id` or secret keys exposed to client
- No check-then-insert for unique values — use DB constraints + retry loops
- No blocking on email send failures — always fire-and-forget
