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
  | 'invoice'
  | 'daily_digest'
  | 'custom'
  | 'pre_arrival_info'
  | 'post_stay_follow_up'
  | 'booking_thank_you_delay'

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
  arriving_count?: string
  departing_count?: string
  in_house_count?: string
  digest_date?: string
  arrivals_html?: string
  departures_html?: string
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

    case 'invoice':
      return {
        subject: `Invoice — ${v.confirmation_number} — ${v.property_name}`,
        html: wrap('Invoice', `
          <p>Hi ${v.guest_first_name},</p>
          <p>Here is the invoice for your stay at <strong>${v.property_name}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#555">Confirmation</td><td><strong>${v.confirmation_number}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Room(s)</td><td>${v.room_names}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-in</td><td>${v.check_in_date}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-out</td><td>${v.check_out_date}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Nights</td><td>${v.num_nights}</td></tr>
          </table>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:2px solid #1A1A1A">
            <tr><td style="padding:8px 0;color:#555">Total Due</td><td style="text-align:right"><strong>${v.total_due}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Amount Paid</td><td style="text-align:right">${v.net_paid}</td></tr>
            <tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0;color:#555"><strong>Balance Due</strong></td><td style="text-align:right"><strong>${v.balance_due}</strong></td></tr>
          </table>
          <p>Payment Status: <strong>${v.payment_status}</strong></p>
          ${v.invoice_url ? `<p style="margin:24px 0"><a href="${v.invoice_url}" style="background:#1A1A1A;color:#fff;padding:12px 24px;text-decoration:none;font-size:14px">View Invoice Online</a></p>` : ''}
          <p style="color:#555;font-size:13px">If you have questions about this invoice, please contact us.</p>
        `),
      }

    case 'daily_digest':
      return {
        subject: `${v.property_name} — ${v.arriving_count ?? '0'} arriving, ${v.departing_count ?? '0'} departing today`,
        html: wrap('Good Morning', `
          <p style="color:#555;font-size:14px;margin-bottom:24px">Daily digest for <strong>${v.property_name}</strong> — ${v.digest_date}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="background:#DCFCE7;border-radius:8px;padding:12px 16px;text-align:center;width:33%">
                <p style="font-size:24px;font-weight:700;margin:0;color:#15803D">${v.arriving_count ?? '0'}</p>
                <p style="font-size:13px;color:#15803D;margin:0">Checking in</p>
              </td>
              <td style="background:#DBEAFE;border-radius:8px;padding:12px 16px;text-align:center;width:33%">
                <p style="font-size:24px;font-weight:700;margin:0;color:#1D4ED8">${v.departing_count ?? '0'}</p>
                <p style="font-size:13px;color:#1D4ED8;margin:0">Checking out</p>
              </td>
              <td style="background:#F2F1ED;border-radius:8px;padding:12px 16px;text-align:center;width:33%">
                <p style="font-size:24px;font-weight:700;margin:0;color:#1A1A1A">${v.in_house_count ?? '0'}</p>
                <p style="font-size:13px;color:#555;margin:0">In-house</p>
              </td>
            </tr>
          </table>
          ${v.arrivals_html ?? '<p style="color:#888;font-size:14px">No arrivals today.</p>'}
          ${v.departures_html ?? '<p style="color:#888;font-size:14px">No departures today.</p>'}
          <p style="color:#888;font-size:12px;margin-top:32px;border-top:1px solid #D1D0CB;padding-top:12px">
            Sent by Lodge-ical. Manage this in Settings &rarr; Property &rarr; Notifications.
          </p>
        `),
      }

    case 'pre_arrival_info':
      return {
        subject: `Before you arrive — ${v.property_name}`,
        html: wrap(`Getting ready for your visit, ${v.guest_first_name}!`, `
          <p>Your stay at <strong>${v.property_name}</strong> is coming up soon. Here's everything you need to know before you arrive.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#555">Confirmation</td><td><strong>${v.confirmation_number}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-in</td><td>${v.check_in_date} at ${v.check_in_time ?? 'see property details'}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Room(s)</td><td>${v.room_names}</td></tr>
          </table>
          <p style="color:#555">If you have any questions before you arrive, don't hesitate to reach out.</p>
        `),
      }

    case 'post_stay_follow_up':
      return {
        subject: `Thank you for staying at ${v.property_name}`,
        html: wrap(`It was wonderful to have you, ${v.guest_first_name}!`, `
          <p>Thank you for choosing <strong>${v.property_name}</strong>. We hope you had a wonderful stay.</p>
          <p>If you have a moment, we'd love to hear about your experience — your feedback means a lot to us and helps us continue to improve.</p>
          <p style="color:#555;font-size:14px">We look forward to welcoming you back.</p>
        `),
      }

    case 'booking_thank_you_delay':
      return {
        subject: `We're looking forward to your visit — ${v.property_name}`,
        html: wrap(`Thanks again, ${v.guest_first_name}!`, `
          <p>Just a quick note to say we're so glad you'll be joining us at <strong>${v.property_name}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;color:#555">Confirmation</td><td><strong>${v.confirmation_number}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-in</td><td>${v.check_in_date}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Check-out</td><td>${v.check_out_date}</td></tr>
            <tr><td style="padding:8px 0;color:#555">Room(s)</td><td>${v.room_names}</td></tr>
          </table>
          <p style="color:#555">Feel free to reach out if you have any questions before your arrival. We can't wait to welcome you!</p>
        `),
      }
  }
}
