// src/pages/public/Widget.jsx
// Public booking widget page. No auth required.
// Fetches property data from public-bootstrap edge function, renders BookingWidget.

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageLoader } from '@/components/shared/PageLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { BookingWidget } from '@/components/widget/BookingWidget'

export default function Widget() {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get('slug')

  const [status, setStatus] = useState('loading') // 'loading' | 'notfound' | 'error' | 'ready'
  const [widgetData, setWidgetData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchBootstrap() {
    if (!slug) {
      setStatus('notfound')
      return
    }

    setStatus('loading')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-bootstrap?slug=${encodeURIComponent(slug)}`
      )

      if (res.status === 404) {
        setStatus('notfound')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrorMessage(body.error || `Server error (${res.status})`)
        setStatus('error')
        return
      }

      const data = await res.json()
      setWidgetData(data)
      setStatus('ready')
    } catch (err) {
      setErrorMessage(err.message || 'Network error. Please try again.')
      setStatus('error')
    }
  }

  useEffect(() => {
    fetchBootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (status === 'loading') {
    return <PageLoader />
  }

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="font-heading text-[28px] text-text-primary mb-2">Property Not Available</h1>
          <p className="font-body text-text-secondary">
            This booking page is not currently available. Please contact the property directly.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <ErrorState
          title="Could not load booking page"
          message={errorMessage}
          onRetry={fetchBootstrap}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <BookingWidget
        property={widgetData.property}
        rooms={widgetData.rooms}
        roomLinks={widgetData.roomLinks}
        settings={widgetData.settings}
      />
    </div>
  )
}
