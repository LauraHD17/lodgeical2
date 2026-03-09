// src/pages/admin/settings/BookingWidgetTab.jsx
// Iframe embed snippet for embedding the booking widget on external websites.

import { useState } from 'react'
import { Copy, Check, Code } from '@phosphor-icons/react'
import { SectionHeader } from './EmailTemplatesTab'

export function BookingWidgetTab({ property }) {
  const [copied, setCopied] = useState(false)
  const slug = property?.slug ?? 'your-property'
  const origin = window.location.origin
  const iframeSnippet = `<iframe\n  src="${origin}/widget?property=${slug}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border: none; border-radius: 8px;"\n  title="Booking Widget"\n></iframe>`

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
    </div>
  )
}
