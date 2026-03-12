// resend-webhook Edge Function
// Receives delivery status events from Resend (via Svix) and updates email_logs.
//
// Events handled:
//   email.bounced    → status = 'bounced'
//   email.complained → status = 'bounced' (spam complaint treated as bounce)
//   email.delivered  → status = 'delivered'
//   (all others ignored)
//
// Auth: Svix webhook signature verification using RESEND_WEBHOOK_SECRET.
// Set the secret in Supabase: supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
// Register this URL in the Resend dashboard: <SUPABASE_URL>/functions/v1/resend-webhook

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
}

// Svix signature verification — Resend uses Svix for webhook delivery.
// Implements the verification spec: https://docs.svix.com/receiving/verifying-payloads/how-manual
async function verifySvixSignature(
  rawBody: string,
  msgId: string,
  msgTimestamp: string,
  msgSignature: string,
  secret: string
): Promise<boolean> {
  try {
    // The signed content is: msgId + "." + msgTimestamp + "." + rawBody
    const toSign = `${msgId}.${msgTimestamp}.${rawBody}`

    // Decode the base64 secret (strip the "whsec_" prefix if present)
    const secretBytes = secret.startsWith('whsec_')
      ? Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0))
      : Uint8Array.from(atob(secret), c => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const encoder = new TextEncoder()
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign))
    const computedB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

    // msgSignature may contain multiple comma-separated "v1,<base64>" values
    return msgSignature.split(' ').some(sig => {
      const [, sigB64] = sig.split(',')
      return sigB64 === computedB64
    })
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured')
    // Return 200 so Resend doesn't keep retrying — log the config issue instead
    return new Response(JSON.stringify({ ok: true, warn: 'secret not configured' }), { headers: CORS_HEADERS })
  }

  const rawBody = await req.text()

  // Verify Svix signature
  const msgId        = req.headers.get('svix-id') ?? ''
  const msgTimestamp = req.headers.get('svix-timestamp') ?? ''
  const msgSignature = req.headers.get('svix-signature') ?? ''

  if (!msgId || !msgTimestamp || !msgSignature) {
    return new Response(JSON.stringify({ error: 'Missing Svix headers' }), { status: 400, headers: CORS_HEADERS })
  }

  // Reject timestamps more than 5 minutes old (replay attack prevention)
  const ts = parseInt(msgTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return new Response(JSON.stringify({ error: 'Timestamp out of range' }), { status: 401, headers: CORS_HEADERS })
  }

  const valid = await verifySvixSignature(rawBody, msgId, msgTimestamp, msgSignature, webhookSecret)
  if (!valid) {
    console.warn('[resend-webhook] Signature verification failed for svix-id:', msgId)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: CORS_HEADERS })
  }

  let event: { type: string; data: { email_id?: string } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }

  const { type, data } = event
  const emailId = data?.email_id

  if (!emailId) {
    // Not all Resend events include email_id — just acknowledge
    return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (type === 'email.bounced' || type === 'email.complained') {
    const { error } = await supabase
      .from('email_logs')
      .update({ status: 'bounced' })
      .eq('resend_email_id', emailId)

    if (error) {
      console.error('[resend-webhook] Failed to mark bounced:', error.message, 'email_id:', emailId)
    } else {
      console.log('[resend-webhook]', type, '→ bounced:', emailId)
    }
  } else if (type === 'email.delivered') {
    const { error } = await supabase
      .from('email_logs')
      .update({ status: 'delivered' })
      .eq('resend_email_id', emailId)

    if (error) {
      console.error('[resend-webhook] Failed to mark delivered:', error.message, 'email_id:', emailId)
    } else {
      console.log('[resend-webhook] delivered:', emailId)
    }
  }
  // email.opened, email.clicked, email.sent — acknowledged but not stored

  return new Response(JSON.stringify({ ok: true }), { headers: CORS_HEADERS })
})
