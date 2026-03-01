// src/components/reservations/ConflictBanner.jsx
import { WarningCircle } from '@phosphor-icons/react'

export function ConflictBanner({ conflictingIds = [] }) {
  return (
    <div className="bg-danger-bg border border-danger rounded-[6px] p-4">
      <div className="flex items-start gap-3">
        <WarningCircle size={20} weight="fill" className="text-danger shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-body font-semibold text-[14px] text-danger">
            Date conflict detected
          </p>
          <p className="font-body text-[13px] text-danger mt-1">
            The selected dates overlap with existing reservations.
          </p>
          {conflictingIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {conflictingIds.map((id) => (
                <span
                  key={id}
                  className="font-mono text-[13px] bg-danger text-white rounded px-2 py-0.5"
                >
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
