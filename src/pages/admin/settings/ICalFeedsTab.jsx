// src/pages/admin/settings/ICalFeedsTab.jsx
// Per-room iCal export feed URLs.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Check, Link, CalendarPlus } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { HelpTip } from '@/components/ui/HelpTip'

function useRoomsWithTokens() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['rooms-ical', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, ical_token, is_active')
        .eq('property_id', propertyId)
        .order('name')
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy URL"
      className="flex items-center gap-1 text-info hover:opacity-80 transition-opacity font-body text-[13px]"
    >
      {copied ? <Check size={14} weight="bold" className="text-success" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function ICalFeedsTab() {
  const { data: rooms = [], isLoading } = useRoomsWithTokens()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const baseUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/ical-export`
    : 'https://<project>.supabase.co/functions/v1/ical-export'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-4">
        <h3 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">iCal Feed URLs</h3>
        <HelpTip text="iCal is a universal calendar format used by Airbnb, VRBO, Google Calendar, Apple Calendar, and most booking platforms. These URLs let other services read your Lodge-ical availability so your calendars stay in sync automatically." />
      </div>
      <p className="font-body text-[14px] text-text-secondary -mt-2">
        Subscribe to these URLs in Google Calendar, Apple Calendar, or any platform that
        supports iCal feeds. Each room has a unique, stable URL — anyone with the URL can
        read the calendar, so treat it like a password.
      </p>

      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-border rounded-[6px]" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex items-start gap-3 bg-info-bg border border-info rounded-[8px] p-4">
          <CalendarPlus size={18} className="text-info mt-0.5 shrink-0" />
          <p className="font-body text-[14px] text-info">
            No rooms found. Add rooms in the Rooms section to generate iCal feeds.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map(room => {
            const feedUrl = `${baseUrl}?token=${room.ical_token}`
            return (
              <div
                key={room.id}
                className="border border-border rounded-[8px] p-4 flex flex-col gap-2 bg-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="font-body font-semibold text-[15px] text-text-primary">
                    {room.name}
                  </span>
                  {!room.is_active && (
                    <span className="font-body text-[12px] text-text-muted bg-border px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 bg-surface-raised border border-border rounded-[6px] px-3 py-2">
                    <Link size={13} className="text-text-muted shrink-0" />
                    <span className="font-mono text-[12px] text-text-secondary truncate">
                      {feedUrl}
                    </span>
                  </div>
                  <CopyButton text={feedUrl} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
