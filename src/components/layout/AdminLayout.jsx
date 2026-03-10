import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, X, Flask } from '@phosphor-icons/react'
import { Sidebar } from './Sidebar'
import { isSandboxMode, leaveSandbox } from '@/lib/sandbox/useSandbox'

export function AdminLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const sandbox = isSandboxMode()

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
          <span className="font-heading text-[20px] text-text-primary tracking-[-0.02em] font-bold">Lodge-ical</span>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-[6px] text-text-secondary hover:bg-border transition-colors"
            aria-label="Open menu"
          >
            {mobileOpen ? <X size={22} /> : <List size={22} />}
          </button>
        </header>

        {/* Sandbox banner */}
        {sandbox && (
          <div className="bg-warning-bg border-b-2 border-warning px-5 py-2.5 flex items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-2.5 min-w-0">
              <Flask size={16} weight="fill" className="text-warning shrink-0" />
              <span className="font-body text-[14px] font-semibold text-warning">
                Exploring Lodge-ical
              </span>
              <span className="font-body text-[13px] text-text-secondary hidden sm:inline">
                — a sample inn. Click anything. Nothing is saved.
              </span>
            </div>
            <button
              onClick={async () => { await leaveSandbox(); navigate('/login', { replace: true }) }}
              className="shrink-0 font-body text-[13px] font-semibold px-4 py-1.5 bg-warning text-white rounded-none hover:opacity-90 transition-opacity"
            >
              Set up my own inn →
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
