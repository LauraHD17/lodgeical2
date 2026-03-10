// src/pages/admin/Messaging.jsx
// Messages page with tabs: Messages (email log with split-pane) + Email Templates.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { EnvelopeSimple, X } from '@phosphor-icons/react'
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
  custom: 'Custom',
}

const TYPE_COLORS = {
  booking_confirmation: 'bg-success-bg text-success',
  cancellation_notice: 'bg-danger-bg text-danger',
  modification_confirmation: 'bg-warning-bg text-warning',
  payment_failed: 'bg-danger-bg text-danger',
  check_in_reminder: 'bg-info-bg text-info',
  check_out_reminder: 'bg-info-bg text-info',
  custom: 'bg-surface text-text-secondary',
}

// ---------------------------------------------------------------------------
// Email Log Section — split pane
// ---------------------------------------------------------------------------

function EmailLogSection() {
  const { propertyId } = useProperty()
  const [selectedId, setSelectedId] = useState(null)

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
      <div className="flex flex-col items-center gap-3 py-12">
        <EnvelopeSimple size={18} weight="fill" className="text-text-muted" />
        <p className="font-body text-[15px] text-text-muted">No emails sent yet</p>
      </div>
    )
  }

  const selected = logs.find(l => l.id === selectedId) ?? null

  return (
    <div className="flex border border-border rounded-[8px] overflow-hidden" style={{ minHeight: 480 }}>
      {/* Left panel — message list */}
      <div className="flex flex-col border-r border-border overflow-y-auto w-[400px] shrink-0">
        {logs.map((log, i) => {
          const isActive = log.id === selectedId
          return (
            <button
              key={log.id}
              onClick={() => setSelectedId(log.id)}
              className={cn(
                'flex flex-col gap-1 px-4 py-3 text-left border-b border-border last:border-b-0 transition-colors',
                isActive ? 'bg-info-bg/30' : (i % 2 === 1 ? 'bg-tableAlt' : 'bg-surface-raised'),
                !isActive && 'hover:bg-surface',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-body text-[13px] font-medium text-text-primary truncate">{log.guest_email}</p>
                <p className="font-mono text-[11px] text-text-muted whitespace-nowrap shrink-0">
                  {format(parseISO(log.sent_at), 'MMM d')}
                </p>
              </div>
              <p className="font-body text-[13px] text-text-secondary truncate">{log.subject}</p>
              <span className={cn(
                'self-start inline-flex items-center px-1.5 py-0.5 rounded-[3px] font-body text-[10px] font-medium mt-0.5',
                TYPE_COLORS[log.template_type] ?? 'bg-surface text-text-secondary'
              )}>
                {TEMPLATE_LABELS[log.template_type] ?? log.template_type}
              </span>
            </button>
          )
        })}
      </div>

      {/* Right panel — message detail */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-y-auto bg-surface-raised">
          {/* Detail header */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
            <div className="flex-1 min-w-0">
              <h3 className="font-body text-[16px] font-semibold text-text-primary mb-1">{selected.subject}</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-body text-[13px] text-text-secondary">
                  To: <span className="font-medium text-text-primary">{selected.guest_email}</span>
                </p>
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-[4px] font-body text-[11px] font-medium',
                  TYPE_COLORS[selected.template_type] ?? 'bg-surface text-text-secondary'
                )}>
                  {TEMPLATE_LABELS[selected.template_type] ?? selected.template_type}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-text-muted hover:text-text-primary p-1 shrink-0"
              aria-label="Close detail"
            >
              <X size={16} />
            </button>
          </div>

          {/* Detail body */}
          <div className="flex-1 px-6 py-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Sent</p>
                  <p className="font-mono text-[14px] text-text-primary">
                    {format(parseISO(selected.sent_at), 'MMMM d, yyyy')} at {format(parseISO(selected.sent_at), 'h:mm a')}
                  </p>
                </div>
                <div>
                  <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Status</p>
                  <p className="font-body text-[14px] text-success font-medium capitalize">{selected.status}</p>
                </div>
                {selected.reservation_id && (
                  <div>
                    <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Reservation</p>
                    <p className="font-mono text-[14px] text-text-primary">{selected.reservation_id}</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-[8px] bg-surface p-5 mt-2">
                <p className="font-body text-[13px] text-text-muted italic">
                  This is an automated {TEMPLATE_LABELS[selected.template_type]?.toLowerCase() ?? 'notification'} email
                  sent to {selected.guest_email}.
                </p>
                <p className="font-body text-[13px] text-text-secondary mt-3">
                  To customize the content of these emails, go to the Email Templates tab and edit the {TEMPLATE_LABELS[selected.template_type] ?? selected.template_type} template.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-surface-raised">
          <EnvelopeSimple size={28} className="text-text-muted" weight="fill" />
          <p className="font-body text-[14px] text-text-muted">Select a message to view details</p>
        </div>
      )}
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
        <h1 className="font-heading text-[32px] text-text-primary uppercase">Messages</h1>
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
