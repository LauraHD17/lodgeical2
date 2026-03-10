// src/pages/public/OnboardingPath.jsx
// Path selection screen shown after signup. One question: "What are you bringing with you?"
// Routes the innkeeper to a contextual onboarding flow without implying skill level.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowsClockwise, Notepad, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { useCreateOnboarding } from '@/hooks/useOnboarding'
import { cn } from '@/lib/utils'

const PATHS = [
  {
    id: 'migration',
    icon: ArrowsClockwise,
    title: 'I use another booking system',
    subtitle: 'ResNexus, ThinkReservations, Lodgify, etc.',
    route: 'Migration path — CSV import + printable transfer checklist',
    color: 'info',
  },
  {
    id: 'bridge',
    icon: Notepad,
    title: 'I track things in spreadsheets or email',
    subtitle: 'Excel, Google Sheets, or a paper ledger',
    route: 'Bridge path — manual entry, one week at a time',
    color: 'warning',
  },
  {
    id: 'fresh',
    icon: Sparkle,
    title: "I'm starting fresh",
    subtitle: 'New property, or just want a clean slate',
    route: 'Clean slate — guided first reservation, widget setup',
    color: 'success',
  },
]

const COLOR_MAP = {
  info:    { border: 'border-info',    bg: 'bg-info-bg',    text: 'text-info',    ring: 'ring-info' },
  warning: { border: 'border-warning', bg: 'bg-warning-bg', text: 'text-warning', ring: 'ring-warning' },
  success: { border: 'border-success', bg: 'bg-success-bg', text: 'text-success', ring: 'ring-success' },
}

export default function OnboardingPath() {
  const [choice, setChoice] = useState(null)
  const navigate = useNavigate()
  const createOnboarding = useCreateOnboarding()

  async function handleContinue() {
    if (!choice) return
    await createOnboarding.mutateAsync(choice)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[560px]">
        <div className="bg-surface-raised border border-border rounded-[8px] p-8 md:p-10">
          <h1 className="font-heading text-[26px] text-text-primary mb-1">
            Let&apos;s set up your inn
          </h1>
          <p className="font-body text-[15px] text-text-secondary mb-8 leading-relaxed">
            One question to get you started right.
          </p>

          <div className="font-body text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted mb-3">
            What are you bringing with you?
          </div>

          <div className="flex flex-col gap-2.5">
            {PATHS.map((p) => {
              const selected = choice === p.id
              const c = COLOR_MAP[p.color]
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setChoice(p.id)}
                  className={cn(
                    'flex items-start gap-3.5 p-4 rounded-[8px] border-2 text-left transition-all duration-100 cursor-pointer',
                    selected
                      ? `${c.border} ${c.bg}`
                      : 'border-border bg-surface-raised hover:border-text-muted'
                  )}
                >
                  <Icon size={18} weight="bold" className={cn('shrink-0 mt-0.5', selected ? c.text : 'text-text-secondary')} />
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-[15px] font-semibold text-text-primary">{p.title}</div>
                    <div className="font-body text-[13px] text-text-secondary mt-0.5">{p.subtitle}</div>
                    {selected && (
                      <div className={cn('font-body text-[12px] font-semibold mt-2', c.text)}>
                        → {p.route}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5',
                      selected ? `${c.border} ${c.text}` : 'border-border'
                    )}
                    style={selected ? { backgroundColor: 'currentColor' } : undefined}
                  >
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.5 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {choice && (
            <Button
              variant="primary"
              size="lg"
              className="w-full mt-6"
              onClick={handleContinue}
              loading={createOnboarding.isPending}
            >
              Continue to setup →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
