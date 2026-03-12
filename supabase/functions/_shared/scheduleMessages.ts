// _shared/scheduleMessages.ts
// Manages the scheduled_messages queue: creating rows when a reservation is made,
// rescheduling when dates change, and cancelling when a reservation is cancelled.
// Does NOT send emails — that's handled by the process-scheduled-messages Edge Function.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Template types that fire immediately on events — never scheduled.
const INSTANT_TYPES = new Set([
  'booking_confirmation',
  'cancellation_notice',
  'modification_confirmation',
  'payment_failed',
  'invoice',
  'daily_digest',
])

interface ScheduleRule {
  template_type: string
  trigger_event: 'after_booking' | 'before_check_in' | 'after_check_out'
  offset_days: number
  send_time: string // HH:MM:SS from Postgres TIME column
}

interface ReservationForScheduling {
  id: string
  property_id: string
  created_at: string   // ISO string
  check_in: string     // YYYY-MM-DD
  check_out: string    // YYYY-MM-DD
}

/**
 * Convert a YYYY-MM-DD date string + HH:MM:SS time string to a UTC Date,
 * taking the property's IANA timezone into account.
 *
 * We use Intl.DateTimeFormat to determine the UTC offset for the target
 * date in the property's timezone, avoiding any external date library.
 */
function toUTC(dateStr: string, timeStr: string, timezone: string): Date {
  // Parse time components (send_time from DB is 'HH:MM:SS')
  const [h, m] = timeStr.split(':').map(Number)

  // Build a Date assuming the send_time is local to the given timezone.
  // Strategy: create a UTC instant for midnight of dateStr, then use
  // Intl to find the UTC offset at that point, then adjust.
  const naive = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)

  // Get the UTC offset (in minutes) for this date in the property's timezone
  // by parsing what Intl renders for the naive UTC instant.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    timeZoneName: 'shortOffset',
  })
  const parts = formatter.formatToParts(naive)
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC+0'
  // offsetPart looks like "GMT-5" or "GMT+5:30"
  const offsetMatch = offsetPart.match(/GMT([+-]\d+)(?::(\d+))?/)
  let offsetMinutes = 0
  if (offsetMatch) {
    const hours = parseInt(offsetMatch[1], 10)
    const mins = offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0
    offsetMinutes = hours * 60 + (hours < 0 ? -mins : mins)
  }

  // Build the correct UTC Date: the local time minus the offset equals UTC
  const localMs = Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
    h,
    m,
    0,
    0,
  )
  return new Date(localMs - offsetMinutes * 60_000)
}

/**
 * Compute the UTC timestamp at which a message should be sent.
 * Returns null if the computed time is already in the past (stale — skip it).
 */
function computeScheduledFor(
  rule: ScheduleRule,
  reservation: ReservationForScheduling,
  timezone: string,
): Date | null {
  let anchorDate: string

  switch (rule.trigger_event) {
    case 'after_booking': {
      // offset_days after the reservation creation date (YYYY-MM-DD portion)
      const d = new Date(reservation.created_at)
      d.setUTCDate(d.getUTCDate() + rule.offset_days)
      anchorDate = d.toISOString().slice(0, 10)
      break
    }
    case 'before_check_in': {
      // offset_days BEFORE check_in
      const d = new Date(reservation.check_in)
      d.setUTCDate(d.getUTCDate() - rule.offset_days)
      anchorDate = d.toISOString().slice(0, 10)
      break
    }
    case 'after_check_out': {
      // offset_days AFTER check_out
      const d = new Date(reservation.check_out)
      d.setUTCDate(d.getUTCDate() + rule.offset_days)
      anchorDate = d.toISOString().slice(0, 10)
      break
    }
  }

  const scheduled = toUTC(anchorDate, rule.send_time, timezone)

  // Skip if the send time is already in the past
  if (scheduled <= new Date()) return null

  return scheduled
}

/**
 * Schedule (or reschedule) automated messages for a reservation.
 *
 * On create (replaceExisting = false): inserts rows for all active rules.
 * On date change (replaceExisting = true): deletes pending rows first, then re-inserts.
 *
 * Fire-and-forget safe: all errors are caught and logged, never thrown to the caller.
 */
export async function scheduleMessagesForReservation(
  supabase: SupabaseClient,
  reservation: ReservationForScheduling,
  options: { replaceExisting?: boolean } = {},
): Promise<void> {
  const { replaceExisting = false } = options

  try {
    // Fetch active rule-enabled templates and property timezone in parallel
    const [{ data: templates, error: tplError }, { data: property }] = await Promise.all([
      supabase
        .from('email_templates')
        .select('template_type, trigger_event, offset_days, send_time')
        .eq('property_id', reservation.property_id)
        .eq('rule_enabled', true)
        .eq('is_active', true)
        .not('trigger_event', 'is', null)
        .not('send_time', 'is', null)
        .not('offset_days', 'is', null),
      supabase
        .from('properties')
        .select('timezone')
        .eq('id', reservation.property_id)
        .single(),
    ])

    if (tplError) {
      console.error('[scheduleMessages] fetch templates error:', tplError.message)
      return
    }

    if (!templates?.length) return

    // Filter out instant-send types (defensive — rule_enabled should never be set on these)
    const rules = (templates as ScheduleRule[]).filter(t => !INSTANT_TYPES.has(t.template_type))

    if (!rules.length) return

    const timezone = (property as { timezone?: string } | null)?.timezone ?? 'America/New_York'

    // If rescheduling, delete existing pending rows for this reservation
    if (replaceExisting) {
      await supabase
        .from('scheduled_messages')
        .delete()
        .eq('reservation_id', reservation.id)
        .eq('status', 'pending')
    }

    // Compute and insert new scheduled_messages rows
    const rows = rules
      .map(rule => {
        const scheduledFor = computeScheduledFor(rule, reservation, timezone)
        if (!scheduledFor) return null
        return {
          property_id: reservation.property_id,
          reservation_id: reservation.id,
          template_type: rule.template_type,
          scheduled_for: scheduledFor.toISOString(),
        }
      })
      .filter(Boolean)

    if (!rows.length) return

    const { error: insertError } = await supabase
      .from('scheduled_messages')
      .insert(rows)

    if (insertError) {
      console.error('[scheduleMessages] insert error:', insertError.message)
    }
  } catch (e) {
    console.error('[scheduleMessages] unexpected error:', e)
  }
}

/**
 * Cancel all pending scheduled messages for a reservation.
 * Called when a reservation is cancelled — sets status='cancelled', cancelled_by='system'.
 */
export async function cancelScheduledMessages(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('scheduled_messages')
      .update({
        status: 'cancelled',
        cancelled_by: 'system',
        cancelled_at: new Date().toISOString(),
      })
      .eq('reservation_id', reservationId)
      .eq('status', 'pending')

    if (error) {
      console.error('[scheduleMessages] cancel error:', error.message)
    }
  } catch (e) {
    console.error('[scheduleMessages] cancel unexpected error:', e)
  }
}
