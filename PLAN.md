# Implementation Plan: Widget Multi-Room, Room Links & Book-on-Behalf

Three interconnected features for the public booking widget.

---

## Feature A: Expose Room Links in Widget

Room links already exist in the DB (`room_links` table, migration 021) and admin UI (`Rooms.jsx`). Public RLS policy exists (`public_read_active_room_links`). They just aren't fetched or displayed in the widget.

### Changes

**1. `supabase/functions/public-bootstrap/index.ts`** — Fetch room links alongside rooms

Add a third query after rooms:
```typescript
const { data: roomLinks } = await supabase
  .from('room_links')
  .select('id, name, linked_room_ids, base_rate_cents, max_guests, description, is_active')
  .eq('property_id', property.id)
  .eq('is_active', true)
```

Return `roomLinks` in the response:
```typescript
JSON.stringify({ property, rooms: rooms ?? [], roomLinks: roomLinks ?? [], settings: rawSettings ?? {} })
```

**2. `src/pages/public/Widget.jsx`** — Pass `roomLinks` to BookingWidget

```jsx
<BookingWidget
  property={widgetData.property}
  rooms={widgetData.rooms}
  roomLinks={widgetData.roomLinks}
  settings={widgetData.settings}
/>
```

**3. `src/components/widget/BookingWidget.jsx`** — Accept `roomLinks` prop, pass to RoomStep

```jsx
export function BookingWidget({ property, rooms, roomLinks = [], settings }) {
```

Pass to RoomStep:
```jsx
<RoomStep
  rooms={rooms}
  roomLinks={roomLinks}
  checkIn={dates.checkIn}
  checkOut={dates.checkOut}
  onNext={handleRoomSelection}
  onBack={() => setStep(0)}
/>
```

**4. `src/components/widget/RoomStep.jsx`** — Display room links as bookable options

Room links appear as a separate section below individual rooms (or interleaved by sort order). Each room link card shows:
- Combined name (e.g., "Suite 1A + 1B")
- Combined max_guests
- Room link's own `base_rate_cents` (not sum of individual rooms)
- Description
- "Select" button

When a room link is selected, `onNext` receives:
```javascript
{
  type: 'room_link',        // distinguishes from individual room
  id: roomLink.id,
  name: roomLink.name,
  room_ids: roomLink.linked_room_ids,
  base_rate_cents: roomLink.base_rate_cents,
  max_guests: roomLink.max_guests,
  description: roomLink.description,
}
```

When an individual room is selected:
```javascript
{
  type: 'room',
  id: room.id,
  name: room.name,
  room_ids: [room.id],      // normalize to array
  base_rate_cents: room.base_rate_cents,
  max_guests: room.max_guests,
  description: room.description,
}
```

This normalization means the rest of the widget (GuestStep, ReviewStep, BookingWidget.handleBook) always works with `selectedRoom.room_ids` (array) and `selectedRoom.max_guests` — no branching needed downstream.

**5. `src/components/widget/BookingWidget.jsx`** — Update `handleBook` to use normalized `room_ids`

```javascript
room_ids: selectedRoom.room_ids,  // was: [selectedRoom.id]
```

**6. `src/components/widget/GuestStep.jsx`** — Already works

`room.max_guests` is already used for validation. Since room links have their own `max_guests`, no change needed.

**7. `src/components/widget/ReviewStep.jsx`** — Already works

Uses `room.base_rate_cents * nights` for display. Room links have their own rate. No change needed.

---

## Feature B: Multi-Room Selection (Individual Rooms)

Allow guests to select 2+ individual rooms in a single booking — separate from room links.

### Changes

**1. `src/components/widget/RoomStep.jsx`** — Add multi-select mode

Replace single "Select" button with a toggle/checkbox per room card. Add a floating summary bar at the bottom showing selected count and combined total:

```
┌──────────────────────────────────────┐
│  2 rooms selected · $380/night       │
│  [Continue →]                        │
└──────────────────────────────────────┘
```

Selection state: `const [selectedIds, setSelectedIds] = useState(new Set())`

When "Continue" is clicked, `onNext` receives:
```javascript
{
  type: 'multi_room',
  name: 'Room A, Room B',              // joined names
  room_ids: ['uuid-a', 'uuid-b'],
  base_rate_cents: sumOfBaseRates,      // sum for display only — server recalculates
  max_guests: combinedMaxGuests,
  rooms: [roomA, roomB],               // individual room objects for ReviewStep breakdown
}
```

**2. `src/components/widget/ReviewStep.jsx`** — Show per-room breakdown for multi-room

When `selectedRoom.type === 'multi_room'`, show each room as a line item:
```
Room A: $150 × 3 nights .............. $450
Room B: $230 × 3 nights .............. $690
Subtotal .............................. $1,140
Tax (8%) .............................. $91
Total ................................. $1,231
```

**3. Backend** — Already supports this

`create-reservation` accepts `room_ids` array, validates combined capacity, checks conflicts per room, and `calculatePricing` sums across all room IDs. No backend changes needed.

---

## Feature C: Book on Behalf Of (CC Emails)

Allow a booker to make a reservation for someone else, with CC recipients for check-in info.

### Database Changes

**1. New migration `022_booker_and_cc_emails.sql`**

```sql
-- Booker email: who made and paid for the booking (null = same as guest)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booker_email TEXT;

-- CC emails: additional recipients for check-in/arrival info (max 5)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cc_emails TEXT[] DEFAULT '{}';
```

No new table. No new RLS policies needed — these columns inherit the existing reservation policies.

### Edge Function Changes

**2. `supabase/functions/create-reservation/index.ts`** — Accept new fields

Add to `inputSchema`:
```typescript
booker_email: z.string().email().optional(),
cc_emails: z.array(z.string().email()).max(5).default([]),
```

Include in INSERT:
```typescript
booker_email: input.booker_email ?? null,
cc_emails: input.cc_emails,
```

**3. `supabase/functions/_shared/email.ts`** — Support CC recipients

Update `sendEmail` to accept optional `cc` parameter:
```typescript
async function sendEmail(to: string, subject: string, html: string, cc?: string[]): Promise<void> {
  // ...
  body: JSON.stringify({
    from: 'Lodge-ical <noreply@lodge-ical.com>',
    to,
    subject,
    html,
    ...(cc?.length ? { cc } : {}),
  }),
}
```

Update `sendBookingConfirmation`:
- Send confirmation to guest email
- If `booker_email` exists and differs from guest email, send a copy to booker
- Do NOT CC the booker on check-in info (they aren't staying)

New helper `sendPreArrivalInfo` (for future email triggers):
- Send to guest email
- CC to `cc_emails` array

**4. `supabase/functions/guest-portal-lookup/index.ts`** — Allow booker lookup

Update the lookup query to match either guest email or booker email:
```typescript
// Current: .eq('guest_email', input.email)  (via join)
// New: match if guest.email = input.email OR reservation.booker_email = input.email
```

This lets the booker (payer) access the portal to view/modify/cancel.

### Widget Changes

**5. `src/components/widget/GuestStep.jsx`** — Add "booking for someone else" toggle

Add a toggle below the guest form:

```
[Toggle] I'm booking on behalf of someone else

When ON, the form restructures:
┌─────────────────────────────────────────────┐
│ GUEST STAYING                                │
│ First Name    Last Name                      │
│ Email         Phone (optional)               │
│ Number of Guests                             │
├─────────────────────────────────────────────┤
│ YOUR INFORMATION (BOOKER)                    │
│ Email (for payment receipts)                 │
├─────────────────────────────────────────────┤
│ CC CHECK-IN DETAILS TO                       │
│ [+ Add email]                                │
│ email1@example.com  [×]                      │
│ email2@example.com  [×]                      │
└─────────────────────────────────────────────┘
```

When OFF (default), behaves exactly as today. The `onNext` data becomes:
```javascript
{
  firstName, lastName, email, phone, numGuests,
  bookerEmail: 'admin@company.com',       // null if booking for self
  ccEmails: ['colleague@company.com'],    // empty array if none
}
```

**6. `src/components/widget/BookingWidget.jsx`** — Pass new fields to create-reservation

```javascript
body: JSON.stringify({
  room_ids: selectedRoom.room_ids,
  check_in: dates.checkIn,
  check_out: dates.checkOut,
  num_guests: guestInfo.numGuests,
  guest_email: guestInfo.email,
  guest_first_name: guestInfo.firstName,
  guest_last_name: guestInfo.lastName,
  guest_phone: guestInfo.phone || null,
  booker_email: guestInfo.bookerEmail || null,
  cc_emails: guestInfo.ccEmails || [],
  origin: 'widget',
})
```

**7. `src/components/widget/ReviewStep.jsx`** — Show booker + CC info

In the "Guest" summary section, show:
```
Guest: Jane Smith (jane@example.com)
Booked by: admin@company.com
CC: colleague1@company.com, colleague2@company.com
```

### Admin View Changes

**8. Reservation detail drawer** — Show booker and CC info

When `booker_email` is set, show "Booked by: email" below guest info. Show CC list if non-empty. Make CC list editable (add/remove emails) via the update-reservation edge function.

---

## Email Distribution Matrix

| Email Type | Guest | Booker | CC'd |
|------------|:-----:|:------:|:----:|
| Booking confirmation | Yes | Yes | No |
| Payment receipt | No | Yes | No |
| Pre-arrival / check-in | Yes | No | Yes |
| Modification notice | Yes | Yes | No |
| Cancellation notice | Yes | Yes | No |

---

## Implementation Order

1. **Migration** — `022_booker_and_cc_emails.sql` (adds columns)
2. **public-bootstrap** — Add room links to response
3. **RoomStep** — Room links display + multi-select UI
4. **BookingWidget** — Normalize selectedRoom to use room_ids array
5. **GuestStep** — "Booking for someone else" toggle with booker/CC fields
6. **ReviewStep** — Multi-room breakdown + booker/CC display
7. **create-reservation** — Accept booker_email, cc_emails
8. **email.ts** — CC support in sendEmail, booker-aware distribution
9. **guest-portal-lookup** — Booker email lookup support
10. **Admin drawer** — Booker/CC display and editing

---

## What's NOT Changing

- `calculatePricing` — already handles room_ids arrays
- Conflict detection — already checks per room in array
- Guest capacity validation — already sums across rooms
- Stripe payment flow — amount is server-calculated, unchanged
- Existing single-room bookings — fully backward compatible (booker_email null, cc_emails empty)
