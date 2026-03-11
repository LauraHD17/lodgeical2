// src/components/layout/Sidebar.jsx
// Navigation sidebar with Phosphor Light-weight icons.
// Active state: text-primary + 2px left accent border + surface-raised bg.

import { NavLink } from 'react-router-dom'
import {
  SquaresFour,
  CalendarBlank,
  CalendarDots,
  Door,
  Users,
  Tag,
  CurrencyDollar,
  TrendUp,
  Wrench,
  AddressBook,
  ChatText,
  Files,
  ChartBar,
  Gear,
  UploadSimple,
  Tray,
  Question,
  SignOut,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth/useAuth'
import { useProperty } from '@/lib/property/useProperty'
import { NAV_ITEMS } from '@/config/routes'
import { hasPermission } from '@/lib/auth/permissions'
import { isSandboxMode, leaveSandbox } from '@/lib/sandbox/useSandbox'

const ICON_MAP = {
  Dashboard:        SquaresFour,
  Reservations:     CalendarBlank,
  Calendar:         CalendarDots,
  Rooms:            Door,
  Guests:           Users,
  Rates:            Tag,
  Payments:         CurrencyDollar,
  'Reports & Financials': TrendUp,
  Maintenance:      Wrench,
  Inquiries:        Tray,
  'Admin Contacts': AddressBook,
  Contacts:         AddressBook,
  Messaging:        ChatText,
  Documents:        Files,
  Reports:          ChartBar,
  Settings:         Gear,
  Import:           UploadSimple,
  'Help & FAQ':     Question,
}

/** Sidebar nav groups — presentation-only clustering */
const NAV_GROUPS = [
  { label: null, paths: ['/'] },
  { label: 'Bookings', paths: ['/reservations', '/calendar', '/rooms', '/rates', '/inquiries'] },
  { label: 'People', paths: ['/guests', '/contacts'] },
  { label: 'Finance', paths: ['/payments', '/reports'] },
  { label: 'Operations', paths: ['/messaging', '/documents', '/maintenance'] },
  { label: 'System', paths: ['/settings', '/help'] },
]

export function Sidebar({ onClose }) {
  const { logout } = useAuth()
  const { role, property } = useProperty()

  const visibleItems = NAV_ITEMS.filter(
    item => !item.permission || hasPermission(role, item.permission)
  )

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-surface border-r border-border">
      {/* Property name */}
      <div className="px-6 py-5 border-b border-border">
        <h2 className="font-heading text-[20px] text-text-primary leading-tight truncate tracking-[-0.02em] font-bold">
          {property?.name ?? 'Lodge-ical'}
        </h2>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <div className="flex flex-col gap-4">
          {NAV_GROUPS.map(group => {
            const groupItems = visibleItems.filter(item => group.paths.includes(item.path))
            if (groupItems.length === 0) return null
            return (
              <div key={group.label ?? '_root'}>
                {group.label && (
                  <p className="px-3 mb-1.5 font-body text-[11px] uppercase tracking-[0.08em] font-semibold text-text-muted">
                    {group.label}
                  </p>
                )}
                <ul className="flex flex-col gap-1">
                  {groupItems.map(item => {
                    const Icon = ICON_MAP[item.label] ?? SquaresFour
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          end={item.path === '/'}
                          onClick={onClose}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-[6px] font-body text-[14px] transition-colors duration-100 relative',
                              isActive
                                ? 'text-text-primary bg-surface-raised border border-border border-l-2 border-l-text-primary'
                                : 'text-text-secondary hover:bg-border hover:text-text-primary'
                            )
                          }
                        >
                          <Icon size={12} weight="fill" className="shrink-0" />
                          {item.label}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Quick Links — preview guest-facing pages */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="px-3 mb-1.5 font-body text-[11px] uppercase tracking-[0.08em] font-semibold text-text-muted">
            Quick Links
          </p>
          <ul className="flex flex-col gap-1">
            <li>
              <a
                href={`/widget?slug=${encodeURIComponent(property?.slug ?? 'sunrise-lodge')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[6px] font-body text-[14px] text-text-secondary hover:bg-border hover:text-text-primary transition-colors duration-100"
              >
                <span>Booking Widget</span>
                <ArrowSquareOut size={14} className="shrink-0 text-text-muted" />
              </a>
            </li>
            <li>
              <a
                href="/guest-portal"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[6px] font-body text-[14px] text-text-secondary hover:bg-border hover:text-text-primary transition-colors duration-100"
              >
                <span>Guest Portal</span>
                <ArrowSquareOut size={14} className="shrink-0 text-text-muted" />
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Sign out / Exit demo */}
      <div className="px-2 py-4 border-t border-border">
        {isSandboxMode() ? (
          <button
            onClick={async () => { await leaveSandbox(); window.location.href = '/login' }}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-[6px] font-body text-[14px] text-warning hover:bg-warning-bg transition-colors duration-100"
          >
            <SignOut size={12} weight="fill" className="shrink-0" />
            Exit demo
          </button>
        ) : (
          <button
            onClick={logout}
            aria-label="Sign out"
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-[6px] font-body text-[14px] text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors duration-100"
          >
            <SignOut size={12} weight="fill" className="shrink-0" />
            Sign out
          </button>
        )}
      </div>
    </aside>
  )
}
