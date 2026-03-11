import { useState } from 'react'
import { WarningCircle, Eye, EyeSlash } from '@phosphor-icons/react'
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
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

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
      <div className="relative">
        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'w-full h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised',
            'placeholder:text-text-muted',
            'focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
            isPassword && 'pr-10',
            error && 'border-danger bg-danger-bg/30',
            className
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword
              ? <EyeSlash size={18} weight="bold" />
              : <Eye size={18} weight="bold" />
            }
          </button>
        )}
      </div>
      {error && (
        <span id={`${id}-error`} className="mt-1 flex items-center gap-1 text-danger text-[13px]" role="alert">
          <WarningCircle size={14} weight="fill" className="shrink-0" />
          {error}
        </span>
      )}
    </div>
  )
}
