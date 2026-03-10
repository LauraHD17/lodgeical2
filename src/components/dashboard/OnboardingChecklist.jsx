// src/components/dashboard/OnboardingChecklist.jsx
// Getting-started checklist shown at the top of the Dashboard. Steps vary by
// the onboarding path chosen during setup. Dismissible.

import { Link } from 'react-router-dom'
import { CheckCircle, Circle, X, ArrowRight } from '@phosphor-icons/react'
import { useOnboarding, useCompleteOnboardingStep, useDismissOnboarding } from '@/hooks/useOnboarding'
import { cn } from '@/lib/utils'

const STEPS_BY_PATH = {
  migration: [
    { id: 'rooms',   label: 'Add your rooms',                link: '/rooms' },
    { id: 'import',  label: 'Import reservations from CSV',  link: '/import' },
    { id: 'verify',  label: 'Verify the transfer checklist', link: '/import' },
    { id: 'rates',   label: 'Set your rates',                link: '/rates' },
    { id: 'ical',    label: 'Connect OTA iCal feeds',        link: '/settings' },
  ],
  bridge: [
    { id: 'rooms',   label: 'Add your rooms',                   link: '/rooms' },
    { id: 'manual',  label: 'Enter this week\'s reservations',  link: '/reservations' },
    { id: 'rates',   label: 'Set your rates',                   link: '/rates' },
    { id: 'settings', label: 'Configure your property settings', link: '/settings' },
  ],
  fresh: [
    { id: 'rooms',   label: 'Add your rooms',            link: '/rooms' },
    { id: 'rates',   label: 'Set your rates',            link: '/rates' },
    { id: 'first',   label: 'Create your first reservation', link: '/reservations' },
    { id: 'widget',  label: 'Set up the booking widget', link: '/settings' },
  ],
}

export function OnboardingChecklist() {
  const { data: onboarding, isLoading } = useOnboarding()
  const completeStep = useCompleteOnboardingStep()
  const dismiss = useDismissOnboarding()

  if (isLoading || !onboarding) return null
  if (onboarding.completed_steps?.includes('dismissed')) return null

  const steps = STEPS_BY_PATH[onboarding.onboarding_path] ?? STEPS_BY_PATH.fresh
  const completed = onboarding.completed_steps ?? []
  const completedCount = steps.filter(s => completed.includes(s.id)).length

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-body text-[16px] font-semibold text-text-primary">
            Getting started
          </h3>
          <p className="font-body text-[13px] text-text-secondary mt-0.5">
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        <button
          onClick={() => dismiss.mutate(onboarding.id)}
          className="p-1 text-text-muted hover:text-text-secondary transition-colors shrink-0"
          aria-label="Dismiss onboarding checklist"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-success rounded-full transition-all duration-300"
          style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1">
        {steps.map((step) => {
          const done = completed.includes(step.id)
          return (
            <li key={step.id} className="flex items-center gap-3 group">
              <button
                onClick={() => completeStep.mutate({
                  onboardingId: onboarding.id,
                  step: step.id,
                  currentSteps: completed,
                })}
                className="shrink-0 p-0.5"
                aria-label={done ? `Uncheck ${step.label}` : `Check ${step.label}`}
              >
                {done
                  ? <CheckCircle size={20} weight="fill" className="text-success" />
                  : <Circle size={20} className="text-border group-hover:text-text-muted transition-colors" />
                }
              </button>
              <Link
                to={step.link}
                className={cn(
                  'flex-1 font-body text-[14px] transition-colors',
                  done ? 'text-text-muted line-through' : 'text-text-primary hover:text-info'
                )}
              >
                {step.label}
              </Link>
              {!done && (
                <Link to={step.link} className="text-text-muted hover:text-info transition-colors">
                  <ArrowRight size={14} />
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
