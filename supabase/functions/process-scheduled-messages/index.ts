// process-scheduled-messages Edge Function
// Processes the scheduled_messages queue: sends any pending messages whose
// scheduled_for time has passed. Called hourly by pg_cron or GitHub Actions.
//
// Authentication: X-Scheduler-Secret header must match the SCHEDULER_SECRET env var.
// This prevents public triggering of the function.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { renderTemplate } from '../_shared/emailTemplates.ts'
import { buildVars } from '../_shared/email.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-scheduler-secret',
}

// Maximum messages to process per invocation (prevents timeout on large backlogs)
const BATCH_LIMIT = 50

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // Verify scheduler secret — rejects public/unauthorized invocations
  const schedulerSecret = Deno.env.get('SCHEDULER_SECRET')
  if (schedulerSecret) {
    const provided = req.headers.get('X-Scheduler-Secret')
    if (provided !== schedulerSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch pending messages that are due
  const { data: messages, error: fetchError } = await supabase
    .from('scheduled_messages')
    .select(`
      id,
      property_id,
      reservation_id,
      template_type,
      scheduled_for,
      reservations (
        id,
        check_in,
        check_out,
        total_due_cents,
        confirmation_number,
        room_ids,
        cc_emails,
        guests (
          id,
          email,
          first_name,
          last_name
        )
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(BATCH_LIMIT)

  if (fetchError) {
    console.error('[process-scheduled-messages] fetch error:', fetchError.message)
    return new Response(JSON.stringify({ error: 'Failed to fetch scheduled messages' }), { status: 500, headers: CORS_HEADERS })
  }

  if (!messages?.length) {
    return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0 }), { headers: CORS_HEADERS })
  }

  // Batch-load property names to avoid N+1 per-message DB queries
  const uniquePropertyIds = [...new Set(messages.map(m => m.property_id))]
  const { data: propertyRows } = await supabase
    .from('properties')
    .select('id, name')
    .in('id', uniquePropertyIds)
  const propertyNameMap = new Map<string, string>(
    (propertyRows ?? []).map((p: { id: string; name: string }) => [p.id, p.name])
  )

  let sent = 0
  let failed = 0

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

  for (const msg of messages) {
    try {
      const reservation = msg.reservations as {
        id: string
        check_in: string
        check_out: string
        total_due_cents: number
        confirmation_number: string
        room_ids: string[]
        cc_emails: string[]
        guests: { id: string; email: string; first_name: string; last_name: string }
      } | null

      if (!reservation?.guests) {
        console.warn('[process-scheduled-messages] no guest for message', msg.id)
        await supabase.from('scheduled_messages').update({ status: 'failed' }).eq('id', msg.id)
        failed++
        continue
      }

      const guest = reservation.guests
      const resForVars = {
        confirmation_number: reservation.confirmation_number,
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        total_due_cents: reservation.total_due_cents,
        property_id: msg.property_id,
        room_ids: reservation.room_ids,
      }

      const vars = await buildVars(supabase, guest, resForVars)

      // Render template (uses custom template if saved, falls back to default)
      const { subject, html } = await renderTemplate(
        supabase,
        msg.property_id,
        msg.template_type as Parameters<typeof renderTemplate>[2],
        vars
      )

      // Use pre-loaded property name for the From address
      const propertyName = propertyNameMap.get(msg.property_id) ?? 'Lodge-ical'
      const fromAddress = `${propertyName} via Lodge-ical <noreply@lodge-ical.com>`

      // Send via Resend
      let emailOk = false
      let resendEmailId: string | undefined
      if (RESEND_API_KEY) {
        const cc = reservation.cc_emails?.length ? reservation.cc_emails : undefined
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: guest.email,
            subject,
            html,
            // Reply-To: innkeeper receives guest replies in their own inbox
            reply_to: undefined, // Set this to property owner email when Phase 2 Gmail sync is added
            ...(cc ? { cc } : {}),
          }),
        })
        emailOk = res.ok
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          resendEmailId = data.id
        } else {
          const err = await res.text()
          console.error('[process-scheduled-messages] Resend error:', err)
        }
      } else {
        console.warn('[process-scheduled-messages] RESEND_API_KEY not set — skipping send for', msg.id)
        emailOk = false
      }

      // Log to email_logs
      await supabase.from('email_logs').insert({
        property_id: msg.property_id,
        reservation_id: reservation.id,
        guest_email: guest.email,
        template_type: msg.template_type,
        subject,
        status: emailOk ? 'sent' : 'failed',
        ...(resendEmailId ? { resend_email_id: resendEmailId } : {}),
      }).catch(e => console.error('[process-scheduled-messages] log error:', e))

      // Update scheduled_message status
      await supabase.from('scheduled_messages').update({
        status: emailOk ? 'sent' : 'failed',
        sent_at: emailOk ? new Date().toISOString() : null,
      }).eq('id', msg.id)

      if (emailOk) sent++
      else failed++

    } catch (e) {
      console.error('[process-scheduled-messages] message error:', msg.id, e)
      await supabase.from('scheduled_messages').update({ status: 'failed' }).eq('id', msg.id)
        .catch(() => {})
      failed++
    }
  }

  return new Response(
    JSON.stringify({ processed: messages.length, sent, failed }),
    { headers: CORS_HEADERS }
  )
})
