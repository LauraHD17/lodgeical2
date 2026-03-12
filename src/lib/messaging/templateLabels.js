// src/lib/messaging/templateLabels.js
// Shared display constants for email template types.
// Used in Messaging.jsx (email log) and Reservations.jsx (scheduled messages drawer).

export const TEMPLATE_LABELS = {
  booking_confirmation:      'Booking Confirmation',
  cancellation_notice:       'Cancellation Notice',
  modification_confirmation: 'Modification Confirmation',
  payment_failed:            'Payment Failed',
  check_in_reminder:         'Check-in Reminder',
  check_out_reminder:        'Check-out Reminder',
  pre_arrival_info:          'Pre-arrival Info',
  post_stay_follow_up:       'Post-stay Follow-up',
  booking_thank_you_delay:   'Booking Thank You',
  custom:                    'Custom',
}

export const TEMPLATE_TYPE_COLORS = {
  booking_confirmation:      'bg-success-bg text-success',
  cancellation_notice:       'bg-danger-bg text-danger',
  modification_confirmation: 'bg-warning-bg text-warning',
  payment_failed:            'bg-danger-bg text-danger',
  check_in_reminder:         'bg-info-bg text-info',
  check_out_reminder:        'bg-info-bg text-info',
  pre_arrival_info:          'bg-info-bg text-info',
  post_stay_follow_up:       'bg-success-bg text-success',
  booking_thank_you_delay:   'bg-success-bg text-success',
  custom:                    'bg-surface text-text-secondary',
}
