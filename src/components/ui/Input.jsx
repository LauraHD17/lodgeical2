import { WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function Input({
  label,
  error,
  id,
  type = 'text',
  placeholder,
  className,
  ...rest
}) {
  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={id}
          className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised',
          'placeholder:text-text-muted',
          'focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
          error && 'border-danger bg-danger-bg/30',
          className
        )}
        {...rest}
      />
      {error && (
        <span id={`${id}-error`} className="mt-1 flex items-center gap-1 text-danger text-[13px]" role="alert">
          <WarningCircle size={14} weight="fill" className="shrink-0" />
          {error}
        </span>
      )}
    </div>
  )
}
