import { cn } from '@/lib/utils'

// Maps color tokens to Tailwind background utility classes.
// Values must be static strings so Tailwind JIT can detect them.
const tabClassMap = {
  primary: 'bg-text-primary',
  info:    'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
}

export function FolderCard({ color = 'primary', tabLabel, children, className }) {
  const tabClass = tabClassMap[color] ?? tabClassMap.primary

  return (
    <div className={cn('inline-block w-full', className)}>
      {/* Top tab — flush left, rounded top corners only */}
      <div
        className={cn(
          tabClass,
          'inline-block px-4 py-2 text-[13px] font-body font-semibold text-white',
          'rounded-tl-[8px] rounded-tr-[8px]'
        )}
      >
        {tabLabel}
      </div>

      {/* Card body — square top-left corner to merge with tab */}
      <div className="bg-surface border border-border rounded-tr-[8px] rounded-bl-[8px] rounded-br-[8px] p-6">
        {children}
      </div>
    </div>
  )
}
