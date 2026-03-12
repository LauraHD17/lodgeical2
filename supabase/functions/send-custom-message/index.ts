// send-custom-message Edge Function
// Sends a one-off composed email from the Messaging center.
// Supports sending to any guest (from guests or inquiries tables),
// optionally linked to a reservation for audit trail purposes.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAdminAction } from '../_shared/audit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const inputSchema = z.object({
  to_email: z.string().email(),
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1),
  reservation_id: z.string().uuid().optional(),
  guest_id: z.string().uuid().optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId, user } = authResult

  // Stricter rate limit for compose (prevent accidental spam)
  const rateLimitError = await rateLimit(req, 10, 60_000, propertyId)
  if (rateLimitError) return rateLimitError

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), { status: 400, headers: CORS_HEADERS })
  }
  const input = parsed.data

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // If a reservation_id is provided, verify it belongs to this property
  if (input.reservation_id) {
    const { data: res, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('id', input.reservation_id)
      .eq('property_id', propertyId)
      .single()
    if (error || !res) {
      return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
    }
  }

  // Fetch property name for the From address
  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single()
  const propertyName = (property as { name?: string } | null)?.name ?? 'Lodge-ical'
  const fromAddress = `${propertyName} via Lodge-ical <noreply@lodge-ical.com>`

  // Wrap the innkeeper-composed body in the standard email shell
  // so it matches the look of automated emails (property footer, max-width, fonts)
  const wrappedHtml = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1A1A1A">
      ${input.body_html}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#888;font-size:13px">
        ${propertyName} — sent via Lodge-ical
      </p>
    </div>`

  // Send via Resend
  const apiKey = Deno.env.get('RESEND_API_KEY')
  let emailOk = false
  let resendEmailId: string | undefined

  if (apiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: input.to_email,
        subject: input.subject,
        html: wrappedHtml,
      }),
    })
    emailOk = res.ok
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      resendEmailId = data.id
    } else {
      const err = await res.text()
      console.error('[send-custom-message] Resend error:', err)
    }
  } else {
    console.warn('[send-custom-message] RESEND_API_KEY not set — skipping send')
  }

  // Log to email_logs for the message center
  await supabase.from('email_logs').insert({
    property_id: propertyId,
    reservation_id: input.reservation_id ?? null,
    guest_email: input.to_email,
    template_type: 'custom',
    subject: input.subject,
    status: emailOk ? 'sent' : 'failed',
    ...(resendEmailId ? { resend_email_id: resendEmailId } : {}),
  }).catch(e => console.error('[send-custom-message] log error:', e))

  // Audit log (fire-and-forget)
  logAdminAction(supabase, propertyId, user.id, 'send', 'custom_email', input.reservation_id ?? input.to_email)
    .catch(e => console.error('[send-custom-message] audit error:', e))

  if (!emailOk) {
    return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS })
})
