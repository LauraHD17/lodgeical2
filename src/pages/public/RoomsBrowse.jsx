// src/pages/public/RoomsBrowse.jsx
// Public rooms gallery page. Fetches property + rooms via public-bootstrap.
// Linked from external websites. Each room has a "Book This Room" CTA.

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, PawPrint, Bed, SpinnerGap } from '@phosphor-icons/react'

export default function RoomsBrowse() {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get('slug')

  const [property, setProperty] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) {
      setError('No property specified.')
      setLoading(false)
      return
    }

    async function fetchData() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-bootstrap`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          }
        )
        if (!res.ok) throw new Error('Property not found')
        const data = await res.json()
        setProperty(data.property)
        setRooms(data.rooms ?? [])
      } catch {
        setError('Could not load property information.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SpinnerGap size={28} className="animate-spin text-info" />
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-[15px] text-text-secondary">{error || 'Property not found.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase tracking-tight">
            {property.name}
          </h1>
          {property.location && (
            <p className="font-body text-[15px] text-text-secondary mt-1">{property.location}</p>
          )}
        </div>
      </header>

      {/* Room Grid */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="font-heading text-[24px] text-text-primary mb-6">Our Rooms</h2>

        {rooms.length === 0 ? (
          <p className="font-body text-[15px] text-text-muted">No rooms available at this time.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => (
              <RoomGalleryCard key={room.id} room={room} slug={slug} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6">
        <div className="max-w-5xl mx-auto px-6">
          <p className="font-body text-[13px] text-text-muted text-center">
            Powered by Lodge-ical
          </p>
        </div>
      </footer>
    </div>
  )
}

function RoomGalleryCard({ room, slug }) {
  const photos = room.room_photos ?? room.photos ?? []
  const heroPhoto = photos.length > 0 ? photos[0] : null
  const heroUrl = typeof heroPhoto === 'string' ? heroPhoto : heroPhoto?.url ?? heroPhoto?.file_url ?? null

  return (
    <div className="border border-border rounded-[8px] overflow-hidden bg-surface-raised flex flex-col">
      {/* Photo */}
      <div className="aspect-[4/3] bg-border relative overflow-hidden">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={room.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Bed size={32} weight="fill" className="text-text-muted" />
          </div>
        )}
        {room.type && (
          <span className="absolute top-3 left-3 bg-surface-raised/90 border border-border px-2 py-0.5 rounded-full font-body text-[12px] text-text-secondary capitalize">
            {room.type}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-body font-semibold text-[18px] text-text-primary tracking-tight">
          {room.name}
        </h3>

        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1 font-body text-[13px] text-text-secondary">
            <Users size={14} weight="fill" /> Up to {room.max_guests ?? 2}
          </span>
          {room.allows_pets && (
            <span className="flex items-center gap-1 font-body text-[13px] text-success">
              <PawPrint size={14} weight="fill" /> Pet-friendly
            </span>
          )}
        </div>

        {room.description && (
          <p className="font-body text-[14px] text-text-secondary mt-3 line-clamp-3">
            {room.description}
          </p>
        )}

        {/* Amenities */}
        {room.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {room.amenities.slice(0, 6).map((a) => (
              <span
                key={a}
                className="bg-surface border border-border px-2 py-0.5 rounded-full font-body text-[11px] text-text-secondary"
              >
                {a}
              </span>
            ))}
            {room.amenities.length > 6 && (
              <span className="font-body text-[11px] text-text-muted">
                +{room.amenities.length - 6} more
              </span>
            )}
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-border mt-4">
          <div>
            <span className="font-mono text-[18px] font-semibold text-text-primary">
              ${((room.base_rate_cents ?? 0) / 100).toFixed(0)}
            </span>
            <span className="font-body text-[13px] text-text-muted ml-1">/ night</span>
          </div>
          <a
            href={`/widget?slug=${slug}&room=${room.id}`}
            className="inline-flex items-center justify-center h-11 px-6 bg-text-primary text-surface-raised font-body text-[14px] font-semibold tracking-[-0.01em] active:scale-[0.98] transition-transform"
          >
            Book This Room
          </a>
        </div>
      </div>
    </div>
  )
}
