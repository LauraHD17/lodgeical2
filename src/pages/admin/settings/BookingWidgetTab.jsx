// src/pages/admin/settings/BookingWidgetTab.jsx
// Iframe embed snippet + seasonal closure settings.

import { useState } from 'react'
import { Copy, Check, Code } from '@phosphor-icons/react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from './EmailTemplatesTab'

export function BookingWidgetTab({ property, onSaveClosure }) {
  const [copied, setCopied] = useState(false)
  const slug = property?.slug ?? 'your-property'
  const origin = window.location.origin
  const iframeSnippet = `<iframe\n  src="${origin}/widget?slug=${slug}&embed=true"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border: none; border-radius: 8px;"\n  title="Booking Widget"\n></iframe>`

  function handleCopy() {
    navigator.clipboard.writeText(iframeSnippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <SectionHeader>Embed Booking Widget</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-2">
        Copy this code and paste it into your website's HTML wherever you want the booking form to appear.
        The widget allows guests to check availability and create reservations directly on your site.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
            iframe Snippet
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 font-body text-[13px] text-info hover:opacity-80 transition-opacity"
          >
            {copied ? <Check size={14} weight="bold" className="text-success" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="relative bg-surface-raised border border-border rounded-[6px] p-4 overflow-x-auto">
          <Code size={14} className="text-text-muted absolute top-3 left-3" />
          <pre className="pl-5 font-mono text-[12px] text-text-secondary whitespace-pre-wrap break-all">
            {iframeSnippet}
          </pre>
        </div>
      </div>

      <div className="bg-info-bg border border-info rounded-[8px] p-4">
        <p className="font-body text-[14px] text-info">
          <span className="font-semibold">Property slug:</span> {slug}
          {slug === 'your-property' && (
            <span className="ml-2 text-warning">
              {' '}— Set your property slug in the Property tab to personalize this URL.
            </span>
          )}
        </p>
      </div>

      <div>
        <p className="font-body text-[13px] text-text-muted font-semibold mb-2">Preview</p>
        <a
          href={`/widget?property=${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[14px] text-info hover:underline"
        >
          Open widget preview in new tab →
        </a>
      </div>

      <SectionHeader>Embed Code</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-3">
        Copy this snippet to embed the booking widget on your website.
      </p>
      <div className="bg-surface border border-border rounded-[8px] p-4">
        <p className="font-body text-[12px] text-text-muted uppercase tracking-[0.06em] font-semibold mb-2">Booking Widget (iframe)</p>
        <div className="bg-text-primary rounded-[6px] p-3 overflow-x-auto">
          <code className="font-mono text-[13px] text-surface-raised break-all">
            {`<iframe src="${origin}/widget?slug=${slug}&embed=true" width="100%" height="700" frameBorder="0" style="border:none;border-radius:8px;"></iframe>`}
          </code>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`<iframe src="${origin}/widget?slug=${slug}&embed=true" width="100%" height="700" frameBorder="0" style="border:none;border-radius:8px;"></iframe>`)
          }}
          className="mt-2 font-body text-[13px] text-info hover:underline"
        >
          Copy to clipboard
        </button>
      </div>

      <div className="bg-surface border border-border rounded-[8px] p-4 mt-4">
        <p className="font-body text-[12px] text-text-muted uppercase tracking-[0.06em] font-semibold mb-2">Rooms Page (link)</p>
        <div className="bg-text-primary rounded-[6px] p-3 overflow-x-auto">
          <code className="font-mono text-[13px] text-surface-raised break-all">
            {`${origin}/browse?slug=${slug}`}
          </code>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`${origin}/browse?slug=${slug}`)
          }}
          className="mt-2 font-body text-[13px] text-info hover:underline"
        >
          Copy to clipboard
        </button>
      </div>

      {/* Seasonal Closure */}
      <SeasonalClosure property={property} onSave={onSaveClosure} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seasonal Closure sub-component
// ---------------------------------------------------------------------------

function SeasonalClosure({ property, onSave }) {
  const hasExisting = !!property?.seasonal_closure_start
  const [enabled, setEnabled] = useState(hasExisting)
  const [start, setStart] = useState(property?.seasonal_closure_start ?? '')
  const [end, setEnd] = useState(property?.seasonal_closure_end ?? '')
  const [message, setMessage] = useState(
    property?.seasonal_closure_message ??
    'We haven\'t opened these dates yet. Send an inquiry and we\'ll reach out when availability opens up!'
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave({
        seasonal_closure_start: enabled ? start || null : null,
        seasonal_closure_end: enabled ? end || null : null,
        seasonal_closure_message: enabled ? message : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-t border-border pt-6 mt-2">
      <SectionHeader>Seasonal Closure</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-2 mb-4">
        Block a date range on the booking widget and show an inquiry form instead.
        Guests can express interest for those dates and you&apos;ll see their inquiries on the Inquiries page.
      </p>

      <label className="flex items-center gap-3 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="accent-info w-4 h-4"
        />
        <span className="font-body text-[14px] text-text-primary font-medium">
          Enable seasonal closure
        </span>
      </label>

      {enabled && (
        <div className="flex flex-col gap-4 pl-7">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Closure start"
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
            />
            <Input
              label="Closure end"
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="closure-msg" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
              Message shown to guests
            </label>
            <textarea
              id="closure-msg"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-none"
            />
          </div>
          <Button variant="primary" size="md" onClick={handleSave} disabled={saving} className="self-start">
            {saving ? 'Saving...' : 'Save Closure Settings'}
          </Button>
        </div>
      )}

      {!enabled && hasExisting && (
        <div className="pl-7">
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Clearing...' : 'Clear closure settings'}
          </Button>
        </div>
      )}
    </div>
  )
}
