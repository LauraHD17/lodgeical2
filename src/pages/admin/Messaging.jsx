// src/pages/admin/Messaging.jsx
// Messages page with tabs: Messages (email log) + Email Templates.

import { useQuery } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { EnvelopeSimple, Info } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { EmailTemplatesTab } from './settings/EmailTemplatesTab'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Template type label map
// ---------------------------------------------------------------------------

const TEMPLATE_LABELS = {
  booking_confirmation: 'Booking Confirmation',
  cancellation_notice: 'Cancellation Notice',
  modification_confirmation: 'Modification Confirmation',
  payment_failed: 'Payment Failed',
  check_in_reminder: 'Check-in Reminder',
  check_out_reminder: 'Check-out Reminder',
}

// ---------------------------------------------------------------------------
// Email Log Section
// ---------------------------------------------------------------------------

function EmailLogSection() {
  const { propertyId } = useProperty()

  const { data: logs, isLoading } = useQuery({
    queryKey: queryKeys.emailLogs.list(propertyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('property_id', propertyId)
        .order('sent_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="font-body text-[14px] text-text-muted">Loading messages...</p>
      </div>
    )
  }

  if (!logs?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <EnvelopeSimple size={48} className="text-text-muted" weight="light" />
        <p className="font-body text-[15px] text-text-muted">No emails have been sent yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 border border-border rounded-[8px] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-5 py-3 bg-surface border-b border-border">
        <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Recipient</p>
        <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Subject</p>
        <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Type</p>
        <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary text-right">Sent</p>
      </div>

      {/* Rows */}
      {logs.map((log, i) => (
        <div
          key={log.id}
          className={cn(
            'grid grid-cols-[1fr_1.5fr_auto_auto] gap-4 px-5 py-3 border-b border-border last:border-b-0',
            i % 2 === 1 && 'bg-tableAlt'
          )}
        >
          <p className="font-body text-[14px] text-text-primary truncate">{log.guest_email}</p>
          <p className="font-body text-[14px] text-text-primary truncate">{log.subject}</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-surface font-body text-[12px] text-text-secondary whitespace-nowrap">
            {TEMPLATE_LABELS[log.template_type] ?? log.template_type}
          </span>
          <div className="text-right">
            <p className="font-mono text-[13px] text-text-primary">
              {format(parseISO(log.sent_at), 'MMM d, yyyy')}
            </p>
            <p className="font-mono text-[12px] text-text-muted">
              {format(parseISO(log.sent_at), 'h:mm a')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function Messaging() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Messages</h1>
      </div>

      <Tabs.Root defaultValue="messages">
        <Tabs.List className="flex gap-0 border-b border-border mb-6">
          {['messages', 'templates'].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className={cn(
                'px-5 py-3 font-body text-[14px] font-medium text-text-secondary border-b-2 border-transparent whitespace-nowrap',
                'transition-colors hover:text-text-primary',
                'data-[state=active]:text-text-primary data-[state=active]:border-text-primary'
              )}
            >
              {tab === 'messages' && 'Messages'}
              {tab === 'templates' && 'Email Templates'}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="messages">
          <EmailLogSection />
        </Tabs.Content>

        <Tabs.Content value="templates">
          <EmailTemplatesTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
