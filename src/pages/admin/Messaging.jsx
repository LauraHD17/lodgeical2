// src/pages/admin/Messaging.jsx
// Messages page: email log, email templates, and one-off compose.

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  EnvelopeSimple, X, PaperPlaneTilt, Eye, PencilSimple,
  TextB, TextItalic,
} from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { useDebounce } from '@/hooks/useDebounce'
import { TEMPLATE_LABELS, TEMPLATE_TYPE_COLORS } from '@/lib/messaging/templateLabels'
import { EmailTemplatesTab } from './settings/EmailTemplatesTab'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Tiptap toolbar
// ---------------------------------------------------------------------------

function EditorToolbar({ editor }) {
  if (!editor) return null
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-surface">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
        className={cn(
          'p-1.5 rounded-[4px] transition-colors',
          editor.isActive('bold') ? 'bg-border text-text-primary' : 'text-text-secondary hover:bg-border',
        )}
        title="Bold"
      >
        <TextB size={14} weight="bold" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
        className={cn(
          'p-1.5 rounded-[4px] transition-colors',
          editor.isActive('italic') ? 'bg-border text-text-primary' : 'text-text-secondary hover:bg-border',
        )}
        title="Italic"
      >
        <TextItalic size={14} weight="bold" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compose Drawer
// ---------------------------------------------------------------------------

function ComposeDrawer({ onClose }) {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState(null) // { email, name, guest_id?, inquiry_id? }
  const [showDropdown, setShowDropdown] = useState(false)
  const [subject, setSubject] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [sending, setSending] = useState(false)

  const debouncedSearch = useDebounce(searchTerm, 250)

  // Guest search results (guests table)
  const { data: guestResults = [] } = useQuery({
    queryKey: ['compose-guest-search', propertyId, debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim() || !propertyId) return []
      const { data } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email')
        .eq('property_id', propertyId)
        .or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
        .limit(8)
      return (data ?? []).map(g => ({
        key: `guest-${g.id}`,
        email: g.email,
        name: `${g.first_name} ${g.last_name}`.trim(),
        guest_id: g.id,
      }))
    },
    enabled: !!propertyId && debouncedSearch.trim().length > 0,
  })

  // Inquiry search results
  const { data: inquiryResults = [] } = useQuery({
    queryKey: ['compose-inquiry-search', propertyId, debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch.trim() || !propertyId) return []
      const { data } = await supabase
        .from('inquiries')
        .select('id, guest_name, guest_email')
        .eq('property_id', propertyId)
        .or(`guest_name.ilike.%${debouncedSearch}%,guest_email.ilike.%${debouncedSearch}%`)
        .limit(4)
      return (data ?? []).map(i => ({
        key: `inquiry-${i.id}`,
        email: i.guest_email,
        name: i.guest_name ?? i.guest_email,
        inquiry_id: i.id,
      }))
    },
    enabled: !!propertyId && debouncedSearch.trim().length > 0,
  })

  // Dedupe by email: guests take precedence
  const allResults = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const r of [...guestResults, ...inquiryResults]) {
      if (!seen.has(r.email)) {
        seen.add(r.email)
        out.push(r)
      }
    }
    return out
  }, [guestResults, inquiryResults])

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'outline-none font-body text-[14px] text-text-primary leading-relaxed min-h-[180px] px-4 py-3',
      },
    },
  })

  function selectRecipient(r) {
    setSelectedRecipient(r)
    setSearchTerm(r.name || r.email)
    setShowDropdown(false)
  }

  async function handleSend() {
    if (!selectedRecipient?.email || !subject.trim() || !editor) return
    const bodyHtml = editor.getHTML()
    if (bodyHtml === '<p></p>' || !bodyHtml.trim()) {
      addToast({ message: 'Message body is empty', variant: 'warning' })
      return
    }

    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${supabaseUrl}/functions/v1/send-custom-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to_email: selectedRecipient.email,
          subject: subject.trim(),
          body_html: bodyHtml,
          guest_id: selectedRecipient.guest_id ?? undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send')
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.emailLogs.all })
      addToast({ message: 'Email sent', variant: 'success' })
      onClose()
    } catch (err) {
      addToast({ message: err.message || 'Failed to send email', variant: 'danger' })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 z-[9990] bg-black opacity-30"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full z-[9991] bg-surface-raised flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading text-[22px] text-text-primary">Compose</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* To */}
          <div className="relative">
            <label htmlFor="compose-to" className="block font-body text-[13px] font-medium text-text-secondary mb-1.5">To</label>
            <Input
              id="compose-to"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setSelectedRecipient(null)
                setShowDropdown(true)
              }}
              onFocus={() => debouncedSearch && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Search by name or email..."
              autoComplete="off"
            />
            {showDropdown && allResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-surface-raised border border-border rounded-[6px] shadow-none overflow-hidden">
                {allResults.map(r => (
                  <button
                    key={r.key}
                    type="button"
                    onMouseDown={() => selectRecipient(r)}
                    className="w-full flex flex-col px-4 py-2.5 text-left hover:bg-surface transition-colors border-b border-border last:border-b-0"
                  >
                    <span className="font-body text-[14px] text-text-primary">{r.name}</span>
                    <span className="font-body text-[12px] text-text-muted">{r.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="compose-subject" className="block font-body text-[13px] font-medium text-text-secondary mb-1.5">Subject</label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          {/* Message + Preview toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-body text-[13px] font-medium text-text-secondary">Message</span>
              <button
                type="button"
                onClick={() => setPreviewMode(p => !p)}
                className="flex items-center gap-1.5 font-body text-[12px] text-info hover:text-text-primary transition-colors"
              >
                {previewMode ? <PencilSimple size={13} weight="bold" /> : <Eye size={13} weight="bold" />}
                {previewMode ? 'Edit' : 'Preview'}
              </button>
            </div>

            <div className="border border-border rounded-[6px] overflow-hidden bg-surface-raised">
              {!previewMode ? (
                <>
                  <EditorToolbar editor={editor} />
                  <EditorContent editor={editor} />
                </>
              ) : (
                <div className="px-5 py-4">
                  {/* Preview shell — mimics how guests see the email */}
                  <div className="border border-border rounded-[6px] bg-surface p-4">
                    <p className="font-body text-[11px] uppercase tracking-[0.06em] text-text-muted mb-3">
                      Email preview (as guest sees it)
                    </p>
                    {subject && (
                      <p className="font-body text-[15px] font-semibold text-text-primary mb-3">{subject}</p>
                    )}
                    <div
                      className="font-body text-[14px] text-text-primary leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? '' }}
                    />
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="font-body text-[11px] text-text-muted">Sent via Lodge-ical on behalf of your property.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            loading={sending}
            disabled={!selectedRecipient || !subject.trim()}
            onClick={handleSend}
          >
            <PaperPlaneTilt size={14} weight="bold" /> Send Email
          </Button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Email Log Section — split pane
// ---------------------------------------------------------------------------

function EmailLogSection({ onCompose }) {
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
      <div className="flex flex-col items-center gap-4 py-16">
        <EnvelopeSimple size={28} weight="fill" className="text-text-muted" />
        <p className="font-body text-[15px] text-text-muted">No emails sent yet</p>
        <Button size="sm" onClick={onCompose}>
          <PaperPlaneTilt size={14} weight="bold" /> Compose
        </Button>
      </div>
    )
  }

  const selected = logs.find(l => l.id === selectedId) ?? null

  return (
    <div className="flex flex-col sm:flex-row border border-border rounded-[8px] overflow-hidden" style={{ minHeight: 480 }}>
      {/* Left panel — message list */}
      <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-border overflow-y-auto w-full sm:w-[400px] shrink-0 max-h-[240px] sm:max-h-none">
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
                TEMPLATE_TYPE_COLORS[log.template_type] ?? 'bg-surface text-text-secondary'
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
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
            <div className="flex-1 min-w-0">
              <h3 className="font-body text-[16px] font-semibold text-text-primary mb-1">{selected.subject}</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-body text-[13px] text-text-secondary">
                  To: <span className="font-medium text-text-primary">{selected.guest_email}</span>
                </p>
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-[4px] font-body text-[11px] font-medium',
                  TEMPLATE_TYPE_COLORS[selected.template_type] ?? 'bg-surface text-text-secondary'
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
                  <p className={cn(
                    'font-body text-[14px] font-medium capitalize',
                    selected.status === 'bounced' ? 'text-danger'
                    : selected.status === 'failed' ? 'text-danger'
                    : selected.status === 'delivered' ? 'text-success'
                    : 'text-success'
                  )}>{selected.status}</p>
                </div>
                {selected.reservation_id && (
                  <div>
                    <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Reservation</p>
                    <p className="font-mono text-[14px] text-text-primary">{selected.reservation_id}</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-[8px] bg-surface p-5 mt-2">
                {selected.template_type === 'custom' ? (
                  <p className="font-body text-[13px] text-text-secondary">
                    One-off message sent to {selected.guest_email}.
                  </p>
                ) : (
                  <>
                    <p className="font-body text-[13px] text-text-muted italic">
                      This is an automated {TEMPLATE_LABELS[selected.template_type]?.toLowerCase() ?? 'notification'} email
                      sent to {selected.guest_email}.
                    </p>
                    <p className="font-body text-[13px] text-text-secondary mt-3">
                      To customize this email, go to Email Templates and edit the{' '}
                      {TEMPLATE_LABELS[selected.template_type] ?? selected.template_type} template.
                    </p>
                  </>
                )}
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
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">Messages</h1>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <PaperPlaneTilt size={14} weight="bold" /> Compose
        </Button>
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
          <EmailLogSection onCompose={() => setComposeOpen(true)} />
        </Tabs.Content>

        <Tabs.Content value="templates">
          <EmailTemplatesTab />
        </Tabs.Content>
      </Tabs.Root>

      {composeOpen && <ComposeDrawer onClose={() => setComposeOpen(false)} />}
    </div>
  )
}
