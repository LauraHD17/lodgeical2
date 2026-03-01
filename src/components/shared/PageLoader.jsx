import { SpinnerGap } from '@phosphor-icons/react'

export function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <SpinnerGap size={40} className="animate-spin text-text-muted" />
    </div>
  )
}
