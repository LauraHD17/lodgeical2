// import-csv Edge Function
// Processes a CSV payload (sent as JSON array of row objects) and bulk-imports
// reservations into Lodge-ical.
//
// The frontend parses the CSV client-side and POSTs the rows as JSON so this
// function only needs to handle data validation and database writes — no
// multipart/form-data parsing needed.
//
// POST /functions/v1/import-csv
// Body: { rows: CsvRow[] }
// Returns: { success: true, imported: number, skipped: number, errors: RowError[] }

import { serve }        from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z }            from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth }  from '../_shared/auth.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// ---------------------------------------------------------------------------
// Row schema — mirrors CSV_TEMPLATE_HEADERS in Import.jsx
// ---------------------------------------------------------------------------
const csvRowSchema = z.object({
  confirmation_number: z.string().min(1),
  check_in:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  check_out:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  num_guests:          z.coerce.number().int().min(1),
  guest_first_name:    z.string().min(1),
  guest_last_name:     z.string().min(1),
  guest_email:         z.string().email(),
  guest_phone:         z.string().optional().default(''),
  room_name:           z.string().min(1),
  total_due_cents:     z.coerce.number().int().min(0),
  status:              z.enum(['confirmed', 'pending', 'cancelled', 'no_show']).default('confirmed'),
  notes:               z.string().optional().default(''),
}).refine(r => new Date(r.check_out) > new Date(r.check_in), {
  message: 'check_out must be after check_in',
})

type CsvRow = z.infer<typeof csvRowSchema>

interface RowError {
  row:     number
  error:   string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // 1. Auth
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    })
  }
  const { propertyId } = authResult

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 2. Parse body
  let body: { rows?: unknown[] }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  const rawRows = body?.rows
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return new Response(JSON.stringify({ error: 'rows array is required and must not be empty' }), {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  if (rawRows.length > 500) {
    return new Response(JSON.stringify({ error: 'Maximum 500 rows per import' }), {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  // 3. Load all rooms for this property (to map room_name → room_id)
  const { data: propertyRooms } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('property_id', propertyId)

  const roomByName = new Map<string, string>(
    (propertyRooms ?? []).map(r => [r.name.toLowerCase().trim(), r.id])
  )

  // 4. Process each row
  let imported = 0
  let skipped  = 0
  const errors: RowError[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2 // 1-indexed, +1 for header

    // Validate schema
    const parsed = csvRowSchema.safeParse(rawRows[i])
    if (!parsed.success) {
      errors.push({
        row:   rowNum,
        error: parsed.error.issues.map(e => e.message).join('; '),
      })
      continue
    }
    const row: CsvRow = parsed.data

    // Check for duplicate confirmation_number
    const { data: dup } = await supabase
      .from('reservations')
      .select('id')
      .eq('property_id', propertyId)
      .eq('confirmation_number', row.confirmation_number)
      .single()

    if (dup) { skipped++; continue }

    // Resolve room
    const roomId = roomByName.get(row.room_name.toLowerCase().trim())
    if (!roomId) {
      errors.push({
        row,
        error: `Room "${row.room_name}" not found in this property`,
      } as unknown as RowError)
      continue
    }

    // Upsert guest
    const { data: guest, error: guestErr } = await supabase
      .from('guests')
      .upsert(
        {
          property_id: propertyId,
          email:       row.guest_email,
          first_name:  row.guest_first_name,
          last_name:   row.guest_last_name,
          phone:       row.guest_phone || null,
        },
        { onConflict: 'property_id,email' },
      )
      .select('id')
      .single()

    if (guestErr || !guest) {
      errors.push({ row: rowNum, error: 'Failed to create or find guest' })
      continue
    }

    // Insert reservation
    const { error: insertErr } = await supabase.from('reservations').insert({
      property_id:         propertyId,
      guest_id:            guest.id,
      room_ids:            [roomId],
      check_in:            row.check_in,
      check_out:           row.check_out,
      num_guests:          row.num_guests,
      status:              row.status,
      origin:              'import',
      total_due_cents:     row.total_due_cents,
      confirmation_number: row.confirmation_number,
      notes:               row.notes || null,
    })

    if (insertErr) {
      errors.push({ row: rowNum, error: insertErr.message })
    } else {
      imported++
    }
  }

  return new Response(
    JSON.stringify({ success: true, imported, skipped, errors }),
    { headers: CORS_HEADERS },
  )
})
