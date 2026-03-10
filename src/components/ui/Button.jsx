import { SpinnerGap } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const variantClasses = {
  primary: 'bg-text-primary text-white hover:opacity-90',
  secondary: 'bg-transparent border-[1.5px] border-text-primary text-text-primary hover:bg-surface',
  destructive: 'bg-danger text-white hover:opacity-90',
  ghost: 'bg-transparent text-text-primary hover:bg-surface',
}

const sizeClasses = {
  sm: 'h-9 px-3 text-[14px]',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-[52px] px-6 text-[16px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  onClick,
  type = 'button',
  className,
  ...rest
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-none font-body font-medium transition-opacity duration-150 select-none',
        'min-h-[44px]',
        variantClasses[variant] ?? variantClasses.primary,
        sizeClasses[size] ?? sizeClasses.md,
        isDisabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...rest}
    >
      {loading && (
        <SpinnerGap size={16} className="animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
}
