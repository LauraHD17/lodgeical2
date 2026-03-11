// src/components/ui/HelpTip.jsx
// Inline "?" tooltip for plain-English context on jargon labels.
// Opens on hover and click (for keyboard/touch users).
// Usage: <HelpTip text="Explanation here" />

import { useState, useRef, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Question } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function HelpTip({ text, size = 14, className }) {
  const [open, setOpen] = useState(false)
  const hoverTimer = useRef(null)

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  function handleMouseEnter() {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setOpen(true), 120)
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer.current)
    setOpen(false)
  }

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(o => !o)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Help"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className={cn(
            'inline-flex items-center justify-center rounded-full border transition-colors',
            'border-border text-text-muted',
            'hover:border-info hover:text-info',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-info',
            className,
          )}
          style={{ width: size + 2, height: size + 2, flexShrink: 0 }}
        >
          <Question size={size - 2} weight="bold" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={6}
          onMouseEnter={() => { clearTimeout(hoverTimer.current); setOpen(true) }}
          onMouseLeave={handleMouseLeave}
          onOpenAutoFocus={e => e.preventDefault()}
          className="z-50 max-w-[240px] rounded-[6px] bg-text-primary px-3 py-2 text-white"
          style={{ fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', lineHeight: 1.55 }}
        >
          {text}
          <Popover.Arrow className="fill-text-primary" width={10} height={5} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
