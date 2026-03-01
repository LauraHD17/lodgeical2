import { NavLink } from 'react-router-dom'
import {
  SquaresFour,
  CalendarBlank,
  Door,
  Users,
  CurrencyDollar,
  ChartBar,
  Gear,
  ChatText,
  Files,
  Tag,
  UploadSimple,
  SignOut,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/useAuth'
import { useProperty } from '@/lib/property/useProperty'
import { NAV_ITEMS } from '@/config/routes'
import { hasPermission } from '@/lib/auth/permissions'

const ICON_MAP = {
  Dashboard: SquaresFour,
  Reservations: CalendarBlank,
  Rooms: Door,
  Guests: Users,
  Rates: Tag,
  Payments: CurrencyDollar,
  Messaging: ChatText,
  Documents: Files,
  Reports: ChartBar,
  Settings: Gear,
  Import: UploadSimple,
}

export function Sidebar({ onClose }) {
  const { logout } = useAuth()
  const { role, property } = useProperty()

  // Filter nav items by role permissions
  const visibleItems = NAV_ITEMS.filter(
    item => !item.permission || hasPermission(role, item.permission)
  )

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-surface border-r border-border">
      {/* Property name */}
      <div className="px-6 py-5 border-b border-border">
        <h2 className="font-heading text-[20px] text-text-primary leading-tight truncate">
          {property?.name ?? 'Lodge-ical'}
        </h2>
        <p className="font-body text-[12px] text-text-muted mt-0.5 uppercase tracking-[0.06em]">
          Admin Dashboard
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map(item => {
            const Icon = ICON_MAP[item.label] ?? SquaresFour
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-[6px] font-body text-[15px] transition-colors duration-100',
                      isActive
                        ? 'bg-text-primary text-white'
                        : 'text-text-secondary hover:bg-border hover:text-text-primary'
                    )
                  }
                >
                  <Icon size={18} weight="regular" className="shrink-0" />
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-[6px] font-body text-[15px] text-text-secondary hover:bg-danger-bg hover:text-danger transition-colors duration-100"
        >
          <SignOut size={18} weight="regular" className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
