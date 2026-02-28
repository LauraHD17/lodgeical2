// src/App.jsx
// Root application component.
// Full routing, providers, and lazy-loaded pages are wired in Phase 4.
// For now: minimal shell to verify design tokens and base config work.

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="font-heading text-text-primary mb-2">Lodge-ical</h1>
        <p className="font-body text-text-secondary text-[15px]">
          Property management platform — build in progress.
        </p>
        <div className="mt-6 p-6 bg-surface border border-border rounded-[var(--radius-card)]">
          <h4 className="font-body text-text-primary uppercase tracking-[0.06em] text-[13px] font-semibold mb-3">
            Design Token Verification
          </h4>
          <p className="font-mono text-[14px] text-text-primary">
            $1,234.56 — IBM Plex Mono (prices, dates, IDs)
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-success-bg text-success text-[12px] font-semibold">confirmed</span>
            <span className="px-3 py-1 rounded-full bg-warning-bg text-warning text-[12px] font-semibold">pending</span>
            <span className="px-3 py-1 rounded-full bg-danger-bg text-danger text-[12px] font-semibold">cancelled</span>
            <span className="px-3 py-1 rounded-full bg-info-bg text-info text-[12px] font-semibold">info</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
