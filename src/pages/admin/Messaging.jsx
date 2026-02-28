// src/pages/admin/Messaging.jsx
// Messaging placeholder page.

import { useState } from 'react'
import { ChatCircle, PaperPlaneTilt, Info } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'

const PLACEHOLDER_INQUIRIES = [
  { id: 1, name: 'Alice Johnson', subject: 'Availability inquiry', preview: 'Hi, I was wondering if the cabin is available for...', time: '2h ago', unread: true },
  { id: 2, name: 'Bob Martinez', subject: 'Booking question', preview: 'Can I bring my dog? Your policy says...', time: '5h ago', unread: false },
  { id: 3, name: 'Carol Williams', subject: 'Early check-in request', preview: 'We are flying in early and I wanted to ask...', time: 'Yesterday', unread: false },
]

export default function Messaging() {
  const [selected, setSelected] = useState(PLACEHOLDER_INQUIRIES[0])
  const [, setCompose] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Messaging</h1>
        <Button variant="primary" size="md" onClick={() => setCompose(true)}>
          <PaperPlaneTilt size={16} weight="bold" /> Compose New Message
        </Button>
      </div>

      {/* Info callout */}
      <div className="bg-info-bg border border-info rounded-[8px] p-4 flex items-start gap-3">
        <Info size={18} className="text-info shrink-0 mt-0.5" />
        <p className="font-body text-[14px] text-info">
          Full messaging integration coming soon. This preview shows placeholder inquiries.
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-0 border border-border rounded-[8px] overflow-hidden min-h-[480px]">
        {/* Left panel — Inquiry list */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <p className="font-body text-[13px] uppercase tracking-wider font-semibold text-text-secondary">
              Inquiries
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {PLACEHOLDER_INQUIRIES.map((inquiry) => (
              <button
                key={inquiry.id}
                onClick={() => setSelected(inquiry)}
                className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-info-bg ${
                  selected?.id === inquiry.id ? 'bg-info-bg' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-body text-[14px] ${inquiry.unread ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                    {inquiry.name}
                  </span>
                  <span className="font-mono text-[12px] text-text-muted">{inquiry.time}</span>
                </div>
                <p className="font-body text-[13px] text-text-secondary font-medium mb-0.5">
                  {inquiry.subject}
                </p>
                <p className="font-body text-[12px] text-text-muted line-clamp-1">
                  {inquiry.preview}
                </p>
                {inquiry.unread && (
                  <span className="inline-block w-2 h-2 bg-info rounded-full mt-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — Message thread */}
        <div className="flex-1 flex flex-col">
          {selected ? (
            <>
              <div className="p-5 border-b border-border">
                <h2 className="font-heading text-[18px] text-text-primary">{selected.subject}</h2>
                <p className="font-body text-[14px] text-text-secondary">From: {selected.name}</p>
              </div>
              <div className="flex-1 p-5 flex flex-col gap-4">
                <div className="bg-surface border border-border rounded-[8px] p-4 max-w-[80%]">
                  <p className="font-body text-[14px] text-text-primary">{selected.preview}</p>
                  <p className="font-body text-[12px] text-text-muted mt-2">{selected.time}</p>
                </div>
              </div>
              <div className="p-4 border-t border-border">
                <div className="flex gap-3">
                  <textarea
                    rows={2}
                    placeholder="Type a reply..."
                    className="flex-1 border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                  />
                  <Button variant="primary" size="md">
                    <PaperPlaneTilt size={16} weight="bold" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <ChatCircle size={48} className="text-text-muted" weight="light" />
              <p className="font-body text-[15px] text-text-muted">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
