import { WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/Button'

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <WarningCircle size={18} weight="fill" className="text-text-muted" />
      <h3 className="font-body font-semibold text-[18px] text-text-primary mt-4">{title}</h3>
      {message && (
        <p className="font-body text-[15px] text-text-secondary mt-2 max-w-sm">{message}</p>
      )}
      {onRetry && (
        <Button variant="primary" size="md" onClick={onRetry} className="mt-6">
          Try again
        </Button>
      )}
    </div>
  )
}
