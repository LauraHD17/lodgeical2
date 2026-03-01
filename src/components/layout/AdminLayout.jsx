import { useState } from 'react'
import { List, X } from '@phosphor-icons/react'
import { Sidebar } from './Sidebar'

export function AdminLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          {/* Drawer */}
          <div className="relative z-10">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border md:hidden">
          <span className="font-heading text-[20px] text-text-primary">Lodge-ical</span>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-[6px] text-text-secondary hover:bg-border transition-colors"
            aria-label="Open menu"
          >
            {mobileOpen ? <X size={22} /> : <List size={22} />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
