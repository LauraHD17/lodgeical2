import { cn } from '@/lib/utils'

const sizeClasses = {
  sm: 'text-[13px]',
  md: 'text-[14px]',
  lg: 'text-[28px]',
}

export function Price({ cents, size = 'md', className }) {
  const dollars = (cents ?? 0) / 100
  const formatted = dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })

  return (
    <span className={cn('font-mono', sizeClasses[size] ?? sizeClasses.md, className)}>
      {formatted}
    </span>
  )
}
