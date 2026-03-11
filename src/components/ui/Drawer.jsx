// src/components/ui/Drawer.jsx
// Side drawer that slides in from the right. Used for New/Edit forms.
// 480px wide on desktop, full-width on mobile.

import { useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function Drawer({ open, onClose, title, width = 480, children }) {
  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-text-primary/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'flex flex-col bg-surface-raised border-l border-border',
          'h-full overflow-hidden',
        )}
        style={{ width: `min(${width}px, 100vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-heading text-[24px] text-text-primary tracking-[-0.02em]">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
