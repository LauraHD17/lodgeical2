// daily-digest Edge Function
// Sends a daily morning summary email to property owners and managers.
// Triggered by pg_cron or external scheduler.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all properties with digest enabled
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('daily_digest_enabled', true)
      .eq('is_active', true)

    if (propError || !properties?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No properties with digest enabled', sent: 0 }),
        { headers: CORS_HEADERS }
      )
    }

    const today = new Date().toISOString().split('T')[0]
    let totalSent = 0

    for (const property of properties) {
      // Fetch today's arrivals
      const { data: arriving } = await supabase
        .from('reservations')
        .select('id, confirmation_number, check_in, check_out, num_guests, room_ids, guests(first_name, last_name, email)')
        .eq('property_id', property.id)
        .eq('check_in', today)
        .neq('status', 'cancelled')
        .order('confirmation_number')

      // Fetch today's departures
      const { data: departing } = await supabase
        .from('reservations')
        .select('id, confirmation_number, check_in, check_out, num_guests, room_ids, guests(first_name, last_name)')
        .eq('property_id', property.id)
        .eq('check_out', today)
        .neq('status', 'cancelled')
        .order('confirmation_number')

      // Fetch in-house count (checked in before today, checking out after today)
      const { count: inHouseCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', property.id)
        .lte('check_in', today)
        .gt('check_out', today)
        .neq('status', 'cancelled')

      // Fetch rooms for name lookup
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', property.id)

      const roomMap: Record<string, string> = {}
      for (const r of rooms ?? []) {
        roomMap[r.id] = r.name
      }

      function getRoomNames(roomIds: string[]): string {
        return (roomIds ?? []).map(id => roomMap[id] ?? '?').join(', ')
      }

      // Fetch owner/manager emails
      const { data: teamAccess } = await supabase
        .from('user_property_access')
        .select('user_id, role')
        .eq('property_id', property.id)
        .in('role', ['owner', 'manager'])

      if (!teamAccess?.length) continue

      // Get user emails from auth.users via admin API
      const recipientEmails: string[] = []
      for (const access of teamAccess) {
        const { data: { user } } = await supabase.auth.admin.getUserById(access.user_id)
        if (user?.email) recipientEmails.push(user.email)
      }

      if (recipientEmails.length === 0) continue

      const arrivingCount = arriving?.length ?? 0
      const departingCount = departing?.length ?? 0

      // Build HTML email
      const arrivingHtml = (arriving ?? []).map(r => {
        const guest = r.guests
        return `<tr>
          <td style="padding:6px 12px;font-size:14px;">${guest?.first_name ?? ''} ${guest?.last_name ?? ''}</td>
          <td style="padding:6px 12px;font-size:14px;">${getRoomNames(r.room_ids)}</td>
          <td style="padding:6px 12px;font-family:monospace;font-size:13px;">${r.confirmation_number}</td>
          <td style="padding:6px 12px;font-size:14px;">${r.num_guests} guest${r.num_guests !== 1 ? 's' : ''}</td>
        </tr>`
      }).join('')

      const departingHtml = (departing ?? []).map(r => {
        const guest = r.guests
        return `<tr>
          <td style="padding:6px 12px;font-size:14px;">${guest?.first_name ?? ''} ${guest?.last_name ?? ''}</td>
          <td style="padding:6px 12px;font-size:14px;">${getRoomNames(r.room_ids)}</td>
          <td style="padding:6px 12px;font-family:monospace;font-size:13px;">${r.confirmation_number}</td>
        </tr>`
      }).join('')

      const tableStyle = 'width:100%;border-collapse:collapse;'
      const thStyle = 'padding:6px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#555;border-bottom:1px solid #D1D0CB;'

      const html = `
        <div style="font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="font-family:Syne,Helvetica,sans-serif;font-size:24px;margin-bottom:4px;">Good Morning</h2>
          <p style="color:#555;font-size:14px;margin-bottom:24px;">Daily digest for <strong>${property.name}</strong> — ${today}</p>

          <div style="display:flex;gap:16px;margin-bottom:24px;">
            <div style="background:#DCFCE7;border-radius:8px;padding:12px 16px;flex:1;">
              <p style="font-size:24px;font-weight:700;margin:0;color:#15803D;">${arrivingCount}</p>
              <p style="font-size:13px;color:#15803D;margin:0;">Checking in</p>
            </div>
            <div style="background:#DBEAFE;border-radius:8px;padding:12px 16px;flex:1;">
              <p style="font-size:24px;font-weight:700;margin:0;color:#1D4ED8;">${departingCount}</p>
              <p style="font-size:13px;color:#1D4ED8;margin:0;">Checking out</p>
            </div>
            <div style="background:#F2F1ED;border-radius:8px;padding:12px 16px;flex:1;">
              <p style="font-size:24px;font-weight:700;margin:0;color:#1A1A1A;">${inHouseCount ?? 0}</p>
              <p style="font-size:13px;color:#555;margin:0;">In-house</p>
            </div>
          </div>

          ${arrivingCount > 0 ? `
            <h3 style="font-size:16px;color:#15803D;margin-bottom:8px;">Arrivals</h3>
            <table style="${tableStyle}">
              <thead><tr><th style="${thStyle}">Guest</th><th style="${thStyle}">Room</th><th style="${thStyle}">Conf #</th><th style="${thStyle}">Guests</th></tr></thead>
              <tbody>${arrivingHtml}</tbody>
            </table>
          ` : '<p style="color:#888;font-size:14px;">No arrivals today.</p>'}

          ${departingCount > 0 ? `
            <h3 style="font-size:16px;color:#1D4ED8;margin-top:24px;margin-bottom:8px;">Departures</h3>
            <table style="${tableStyle}">
              <thead><tr><th style="${thStyle}">Guest</th><th style="${thStyle}">Room</th><th style="${thStyle}">Conf #</th></tr></thead>
              <tbody>${departingHtml}</tbody>
            </table>
          ` : '<p style="color:#888;font-size:14px;margin-top:24px;">No departures today.</p>'}

          <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #D1D0CB;padding-top:12px;">
            Sent by Lodge-ical. Manage this in Settings → Property → Notifications.
          </p>
        </div>
      `

      const subject = `${property.name} — ${arrivingCount} arriving, ${departingCount} departing today`

      // Send email via Resend
      const apiKey = Deno.env.get('RESEND_API_KEY')
      if (!apiKey) {
        console.warn('[daily-digest] RESEND_API_KEY not set — skipping')
        continue
      }

      const fromAddress = `${property.name} via Lodge-ical <noreply@lodge-ical.com>`

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: recipientEmails,
          subject,
          html,
        }),
      })

      if (emailRes.ok) {
        totalSent += recipientEmails.length
        // Log email
        for (const email of recipientEmails) {
          await supabase.from('email_logs').insert({
            property_id: property.id,
            guest_email: email,
            template_type: 'daily_digest',
            subject,
            status: 'sent',
          }).then(() => {}).catch(() => {})
        }
      } else {
        console.error('[daily-digest] Failed to send for', property.name, await emailRes.text())
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[daily-digest]', err)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
