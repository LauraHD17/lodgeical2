// _shared/emailTemplates.ts
// Template rendering with {{variable}} interpolation.
// Falls back to hardcoded defaults when no custom template is saved for a property.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type TemplateType =
  | 'booking_confirmation'
  | 'cancellation_notice'
  | 'modification_confirmation'
  | 'payment_failed'
  | 'check_in_reminder'
  | 'check_out_reminder'

export interface TemplateVars {
  guest_first_name?: string
  guest_last_name?: string
  guest_email?: string
  confirmation_number?: string
  check_in_date?: string
  check_out_date?: string
  room_names?: string
  num_nights?: string
  total_due?: string
  balance_due?: string
  property_name?: string
  check_in_time?: string
  check_out_time?: string
  cancellation_policy?: string
  refund_amount?: string
  [key: string]: string | undefined
}

/** Escape special HTML characters to prevent injection when inserting user-controlled values. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Replace all {{variable}} tags in a string with HTML-escaped values from vars. */
function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined ? escapeHtml(String(val)) : `{{${key}}}`
  })
}

/** Fetch the property's custom template (if any) then render it.
 *  Returns { subject, html } ready to pass to sendEmail(). */
export async function renderTemplate(
  supabase: SupabaseClient,
  propertyId: string,
  type: TemplateType,
  vars: TemplateVars
): Promise<{ subject: string; html: string }> {
  const { data: tpl } = await supabase
    .from('email_templates')
    .select('subject, body_html')
    .eq('property_id', propertyId)
    .eq('template_type', type)
    .eq('is_active', true)
    .single()

  if (tpl && tpl.subject.trim() && tpl.body_html.trim()) {
    return {
      subject: interpolate(tpl.subject, vars),
      html: interpolate(tpl.body_html, vars),
    }
  }

  // No custom template, or custom template has blank fields — use built-in default
  return defaultTemplate(type, vars)
}

function defaultTemplate(type: TemplateType, v: TemplateVars): { subject: string; html: string } {
  const wrap = (title: string, body: string) => `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1A1A1A">
      <h2 style="margin-top:0">${title}</h2>
      ${body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#888;font-size:13px">
        ${v.property_name ?? 'Lodge-ical'} — sent via Lodge-ical
      </p>
    </div>`

  switch (type) {
    case 'booking_confirmation':
      return {
        subject: `Booking Confirmed — ${v.confirmation_number}`,
        html: wrap('Booking Confirmed', `
          <p>Hi ${v.guest_first_name},</p>
          <p>Your reservation is confirmed!</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#555">Confirmation</td><td><strong>${v.confirmation_number}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Room(s)</td><td>${v.room_names}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-in</td><td>${v.check_in_date} at ${v.check_in_time ?? ''}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-out</td><td>${v.check_out_date} at ${v.check_out_time ?? ''}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Nights</td><td>${v.num_nights}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Total</td><td><strong>${v.total_due}</strong></td></tr>
          </table>
        `),
      }

    case 'cancellation_notice':
      return {
        subject: `Reservation Cancelled — ${v.confirmation_number}`,
        html: wrap('Reservation Cancelled', `
          <p>Hi ${v.guest_first_name},</p>
          <p>Your reservation <strong>${v.confirmation_number}</strong> has been cancelled.</p>
          ${v.refund_amount && v.refund_amount !== '$0.00'
            ? `<p>A refund of <strong>${v.refund_amount}</strong> will appear within 5–10 business days.</p>`
            : ''}
        `),
      }

    case 'payment_failed':
      return {
        subject: `Payment Failed — Action Required (${v.confirmation_number})`,
        html: wrap('Payment Failed', `
          <p>Hi ${v.guest_first_name},</p>
          <p>We were unable to process your payment for reservation <strong>${v.confirmation_number}</strong>.</p>
          <p>Please visit your guest portal to update your payment details.</p>
          <p style="color:#555">Balance due: <strong>${v.balance_due}</strong></p>
        `),
      }

    case 'check_in_reminder':
      return {
        subject: `Your check-in is tomorrow — ${v.property_name}`,
        html: wrap(`See you tomorrow, ${v.guest_first_name}!`, `
          <p>This is a reminder that your stay at <strong>${v.property_name}</strong> begins tomorrow.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#555">Confirmation</td><td><strong>${v.confirmation_number}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Room(s)</td><td>${v.room_names}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-in</td><td>${v.check_in_date} at ${v.check_in_time ?? 'check property for time'}</td></tr>
          </table>
        `),
      }

    case 'check_out_reminder':
      return {
        subject: `Check-out reminder — ${v.property_name}`,
        html: wrap(`Check-out is today`, `
          <p>Hi ${v.guest_first_name},</p>
          <p>This is a reminder that check-out time is <strong>${v.check_out_time ?? 'per property policy'}</strong> today.</p>
          <p>We hope you enjoyed your stay!</p>
        `),
      }

    case 'modification_confirmation':
      return {
        subject: `Reservation Modified — ${v.confirmation_number}`,
        html: wrap('Reservation Modified', `
          <p>Hi ${v.guest_first_name},</p>
          <p>Your reservation has been updated. Here are the new details:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#555">Confirmation</td><td><strong>${v.confirmation_number}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Room(s)</td><td>${v.room_names}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-in</td><td>${v.check_in_date} at ${v.check_in_time ?? ''}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-out</td><td>${v.check_out_date} at ${v.check_out_time ?? ''}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Nights</td><td>${v.num_nights}</td></tr>
            <tr><td style="padding:8px 0;color:#555">New Total</td><td><strong>${v.total_due}</strong></td></tr>
          </table>
          <p>If you have questions, please contact us through your guest portal.</p>
        `),
      }
  }
}
