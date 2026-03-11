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

/** Returns true if the hex color is perceptually light (needs dark text). */
function isLightColor(hex) {
  if (!hex) return false
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  // WCAG relative luminance
  const toLinear = (v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return L > 0.4
}

export function FolderCard({ color = 'primary', tabColor, tabLabel, children, className, bodyClassName }) {
  const tabClass = tabColor ? null : (tabClassMap[color] ?? tabClassMap.primary)
  const tabTextClass = tabColor && isLightColor(tabColor) ? 'text-text-primary' : 'text-white'

  return (
    <div className={cn('inline-block w-full', className)}>
      {/* Top tab — flush left, rounded top corners only */}
      <div
        className={cn(
          tabClass,
          'inline-block px-4 py-1.5 text-[10px] font-body font-bold uppercase tracking-[0.08em]',
          tabTextClass,
          'rounded-tl-[8px] rounded-tr-[8px]'
        )}
        style={tabColor ? { background: tabColor } : undefined}
      >
        {tabLabel}
      </div>

      {/* Card body — square top-left corner to merge with tab */}
      <div className={cn('bg-surface-raised border border-border rounded-tr-[8px] rounded-bl-[8px] rounded-br-[8px]', bodyClassName ?? 'p-6')}>
        {children}
      </div>
    </div>
  )
}
