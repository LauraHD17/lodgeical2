# CLAUDE.md — Supabase Backend

Edge Functions, database migrations, and local development for Lodge-ical.

## Local Development

```bash
supabase start          # Start local Supabase (Postgres, Auth, Storage, Edge Runtime)
supabase db reset       # Re-run all migrations + seed.sql
supabase functions serve # Serve edge functions locally with hot reload
supabase secrets set KEY=value  # Set edge function secrets (Stripe, Resend, etc.)
```

### Local Ports

| Service | Port |
|---------|------|
| API (PostgREST) | 54321 |
| Database (Postgres 17) | 54322 |
| Studio (Web UI) | 54323 |
| Inbucket (Email testing) | 54324 |
| Edge Runtime Inspector | 8083 |

Emails sent locally are captured by Inbucket — they are **not** actually delivered. View them at `http://localhost:54324`.

## Database Migrations

22 numbered SQL migrations in `supabase/migrations/`:

```
001_properties.sql          → Core property tables
008_enable_rls.sql          → Enable RLS on all tables
009_rls_policies.sql        → Comprehensive RLS policies
021_room_links_and_modifications.sql → Room links, modification tracking, misc fees
022_booker_and_cc_emails.sql → Booker email + CC emails on reservations
```

### RLS Policy Pattern

Two-tier access model defined in migration 009:

1. **Admin access**: Authenticated users with a row in `user_property_access` for the target `property_id`
2. **Public read**: Unauthenticated access for properties where `is_active = true AND is_public = true`

All policies use `EXISTS` subquery pattern — never `USING (auth.uid() = user_id)` directly.

### Seed Data

`seed.sql` is configured in `config.toml` and runs automatically on `supabase db reset`. Used for local development and testing.

## Edge Function Patterns

### Standard Boilerplate

Every edge function follows this structure:

```typescript
import { serve } from 'https://deno.land/std/http/server.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // 1. Rate limit (if applicable)
    // 2. Auth check
    // 3. Parse + validate input (Zod)
    // 4. Business logic
    // 5. Return JSON response with CORS headers
  } catch (err) {
    console.error('[function-name]', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: CORS_HEADERS
    })
  }
})
```

### Auth Patterns

**Admin endpoints** — use `requireAuth()` from `_shared/auth.ts`:

```typescript
const authResult = await requireAuth(req)
if (authResult.error) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
}
const { propertyId, user } = authResult
```

`requireAuth()` does three things:
1. Extracts Bearer token from Authorization header
2. Validates JWT via `supabase.auth.getUser(token)`
3. Fetches `propertyId` from `user_property_access` table (server-side — never trusts client input)

**Public endpoints** (e.g., `guest-portal-lookup`) — no `requireAuth()`. Identity verified via confirmation number + email match. Uses generic error messages to prevent enumeration.

### Input Validation

All input validated with Zod schemas:

```typescript
const inputSchema = z.object({
  room_ids: z.array(z.string().uuid()).min(1),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  // ...
})

const parsed = inputSchema.safeParse(body)
if (!parsed.success) {
  return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), {
    status: 400, headers: CORS_HEADERS
  })
}
```

### Error Response Conventions

| Status | Use Case |
|--------|----------|
| `400` | Validation failure, invalid JSON, business rule violation |
| `401` | Missing/invalid auth token |
| `403` | Resource doesn't belong to this property |
| `404` | Reservation, guest, or resource not found |
| `409` | Booking conflict (includes `conflictingIds`) |
| `429` | Rate limit exceeded |
| `500` | Database or unrecoverable server error |

All errors return `{ error: "message" }` JSON. Errors are logged with function name prefix: `[create-reservation] insert error: ...`

### Shared Utilities (`_shared/`)

| Module | Purpose |
|--------|---------|
| `auth.ts` | JWT validation, propertyId lookup via `user_property_access` |
| `pricing.ts` | Nightly rate calculation (base rate → rate overrides → tax → Stripe fee pass-through) |
| `paymentSummary.ts` | Payment balance: charges - refunds = net paid, derives status (paid/partial/unpaid/overpaid) |
| `stripe.ts` | Stripe client singleton |
| `email.ts` | Resend API integration, template rendering, booking/cancellation/booker email helpers |
| `emailTemplates.ts` | HTML email templates with variable substitution |
| `rateLimit.ts` | DB-backed sliding window rate limiting (atomic INSERT...ON CONFLICT) |
| `ical.ts` | iCalendar format parsing and generation |

## Security Practices

### Authentication & Authorization
- JWT validated by Supabase library (signature + expiry)
- `propertyId` always fetched server-side from DB — never accepted from client
- All resource access checks verify `property_id` ownership before proceeding

### Rate Limiting
- Admin endpoints: 30 req/min default
- Guest portal: 10 req/min (stricter to prevent enumeration)
- Implemented via DB-backed sliding window with atomic upsert

### Webhook Verification
- `stripe-webhook` verifies Stripe signature as **step one** — no processing without it
- Uses `stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET)`

### Guest Portal Security
- Requires both confirmation number AND email (not one or the other)
- Returns generic error for wrong number OR wrong email — prevents revealing which field is incorrect
- Email matched case-insensitively, confirmation number forced uppercase

### Email Security
- HTML escaping in all email template variable substitution
- Fire-and-forget: email send failures don't block reservation operations

## Business Logic Rules

### Pricing
- **Priority**: rate_overrides > base_rate_cents (per room, per night)
- **Nightly billing**: each night calculated separately
- **Tax**: `taxCents = Math.round(subtotalCents * (taxRate / 100))`
- **Stripe fee pass-through** (optional): `gross = (subtotal + tax + $0.30) / (1 - 0.029)`

### Confirmation Numbers
- 6 characters, cryptographically random (`crypto.getRandomValues()`)
- Alphabet excludes confusable characters: 0, O, I, 1
- Collision handling: DB UNIQUE constraint + retry loop (up to 10 attempts) — no check-then-insert

### Reservation Rules
- New reservations: `confirmed` for widget bookings (guest always confirmed). `pending` only for admin-created ("direct") bookings when `require_payment_at_booking = true`
- Modifications: max 1 per reservation, new total must be >= original total (prevents price-down attacks)
- Conflict detection: overlapping date ranges checked per room (`check_in < new_check_out AND check_out > new_check_in`)
- `booker_email` (optional): who made/paid for the booking — null means guest is booker
- `cc_emails` (text array, max 5): additional recipients for check-in/arrival info

### Payment Lifecycle
1. Guest creates reservation → `total_due_cents` set
2. If payment required → `status = 'pending'` until Stripe webhook confirms
3. Stripe webhook updates payment status (`succeeded`, `failed`)
4. Payment summary: `netPaidCents = charges - refunds`, derives `paid | partial | unpaid | overpaid`
5. Modification with balance due → new PaymentIntent for difference amount
