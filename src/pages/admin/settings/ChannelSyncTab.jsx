// src/pages/admin/settings/ChannelSyncTab.jsx
// Manage external iCal feeds (Airbnb, VRBO, etc.)

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowsClockwise, Link, CalendarPlus } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { HelpTip } from '@/components/ui/HelpTip'
import { useToast } from '@/components/ui/useToast'

function useExternalFeeds() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['external-feeds', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('room_external_feeds')
        .select('id, room_id, label, feed_url, last_synced_at, rooms(name)')
        .eq('property_id', propertyId)
        .order('created_at')
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useRoomsSimple() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['rooms-simple', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', propertyId)
        .order('name')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

export function ChannelSyncTab() {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const { data: feeds = [], isLoading: feedsLoading } = useExternalFeeds()
  const { data: rooms = [] } = useRoomsSimple()

  const [newRoomId, setNewRoomId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [syncing, setSyncing] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

  const feedRoomIds = new Set(feeds.map(f => f.room_id))
  const availableRooms = rooms.filter(r => !feedRoomIds.has(r.id))

  async function handleAddFeed() {
    if (!newRoomId || !newUrl) {
      addToast({ message: 'Room and feed URL are required', variant: 'error' })
      return
    }
    try {
      const { error } = await supabase.from('room_external_feeds').upsert(
        {
          room_id: newRoomId,
          property_id: propertyId,
          label: newLabel || 'External Calendar',
          feed_url: newUrl,
        },
        { onConflict: 'room_id' },
      )
      if (error) throw error
      addToast({ message: 'External feed saved', variant: 'success' })
      setNewRoomId('')
      setNewLabel('')
      setNewUrl('')
      queryClient.invalidateQueries({ queryKey: ['external-feeds', propertyId] })
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save feed', variant: 'error' })
    }
  }

  async function handleSync(feed) {
    setSyncing(feed.room_id)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        addToast({ message: 'Your session has expired. Please log in again.', variant: 'error' })
        setSyncing(null)
        return
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/ical-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ room_id: feed.room_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      addToast({
        message: `Synced: ${json.synced} new block(s), ${json.skipped} skipped`,
        variant: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['external-feeds', propertyId] })
    } catch (err) {
      addToast({ message: err?.message ?? 'Sync failed', variant: 'error' })
    } finally {
      setSyncing(null)
    }
  }

  function handleDelete(feed) {
    setConfirmState({
      title: `Remove external feed for "${feed.rooms?.name}"?`,
      description: 'This feed will stop syncing and its blocked dates will no longer update.',
      onConfirm: async () => {
        const { error } = await supabase
          .from('room_external_feeds')
          .delete()
          .eq('id', feed.id)
        if (error) {
          addToast({ message: 'Failed to remove feed', variant: 'error' })
        } else {
          addToast({ message: 'Feed removed', variant: 'success' })
          queryClient.invalidateQueries({ queryKey: ['external-feeds', propertyId] })
        }
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 pb-2 border-b border-border mb-4">
        <h3 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">External Calendar Sync</h3>
        <HelpTip text="Paste the iCal feed URL from Airbnb, VRBO, or any other platform where you list your rooms. Lodge-ical will regularly check that URL and block off any dates that are already booked elsewhere, keeping your availability accurate." />
      </div>
      <p className="font-body text-[14px] text-text-secondary -mt-4">
        Paste iCal feed URLs from Airbnb, VRBO, Booking.com, or any other platform. Lodge-ical
        will import them as blocked dates so your availability stays accurate.
      </p>

      {availableRooms.length > 0 && (
        <div className="border border-border rounded-[8px] p-5 flex flex-col gap-4 bg-surface">
          <h3 className="font-body font-semibold text-[15px] text-text-primary">
            Add External Feed
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Room"
              options={availableRooms.map(r => ({ value: r.id, label: r.name }))}
              value={newRoomId}
              onValueChange={setNewRoomId}
              placeholder="Select a room"
            />
            <Input
              label="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Airbnb, VRBO"
            />
          </div>
          <Input
            label="iCal Feed URL"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/..."
          />
          <Button variant="primary" size="md" onClick={handleAddFeed} className="self-start">
            <CalendarPlus size={16} /> Save Feed
          </Button>
        </div>
      )}

      {feedsLoading ? (
        <div className="animate-pulse flex flex-col gap-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-border rounded-[6px]" />)}
        </div>
      ) : feeds.length === 0 ? (
        <p className="font-body text-[14px] text-text-muted">
          No external feeds configured yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {feeds.map(feed => (
            <div
              key={feed.id}
              className="border border-border rounded-[8px] p-4 flex flex-col gap-2 bg-surface"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-body font-semibold text-[15px] text-text-primary">
                    {feed.rooms?.name ?? '—'}
                  </span>
                  <span className="ml-2 font-body text-[13px] text-text-muted">
                    {feed.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={syncing === feed.room_id}
                    onClick={() => handleSync(feed)}
                  >
                    <ArrowsClockwise size={14} />
                    {syncing === feed.room_id ? 'Syncing…' : 'Sync Now'}
                  </Button>
                  <button
                    onClick={() => handleDelete(feed)}
                    className="font-body text-[13px] text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 bg-surface-raised border border-border rounded-[6px] px-3 py-2">
                <Link size={13} className="text-text-muted shrink-0" />
                <span className="font-mono text-[12px] text-text-secondary truncate">
                  {feed.feed_url}
                </span>
              </div>
              {feed.last_synced_at && (
                <p className="font-body text-[12px] text-text-muted">
                  Last synced:{' '}
                  {new Date(feed.last_synced_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  )
}
