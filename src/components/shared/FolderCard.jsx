import { cn } from '@/lib/utils'

// Color map — only approved design tokens
const colorMap = {
  primary: '#1A1A1A',
  info: '#1D4ED8',
  success: '#15803D',
  warning: '#B45309',
  danger: '#BE123C',
}

export function FolderCard({ color = 'primary', tabLabel, children, className }) {
  const bgColor = colorMap[color] ?? colorMap.primary

  return (
    <div className={cn('inline-block w-full', className)}>
      {/* Top tab — flush left, rounded top corners only */}
      <div
        className="inline-block px-4 py-2 text-[13px] font-body font-semibold text-white
                   rounded-tl-[8px] rounded-tr-[8px]"
        style={{ backgroundColor: bgColor }}
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
