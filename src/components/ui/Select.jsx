import * as RadixSelect from '@radix-ui/react-select'
import { CaretDown, Check, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export function Select({
  label,
  error,
  placeholder = 'Select an option',
  options = [],
  value,
  onValueChange,
  className,
  id,
}) {
  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={id}
          className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1"
        >
          {label}
        </label>
      )}
      <RadixSelect.Root value={value} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          id={id}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            'h-11 border-[1.5px] border-border rounded-[6px] px-3 text-[15px] text-text-primary bg-surface-raised w-full',
            'flex items-center justify-between gap-2',
            'focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
            'data-[placeholder]:text-text-muted',
            error && 'border-danger',
            className
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <CaretDown size={16} className="text-text-muted shrink-0" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className="bg-surface-raised border border-border rounded-[6px] z-[9999] overflow-hidden"
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport>
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    'px-3 py-2 text-[15px] text-text-primary cursor-pointer',
                    'flex items-center gap-2',
                    'hover:bg-info-bg hover:text-info',
                    'focus:bg-info-bg focus:text-info focus:outline-none',
                    'data-[highlighted]:bg-info-bg data-[highlighted]:text-info'
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="ml-auto">
                    <Check size={14} weight="bold" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error && (
        <span id={`${id}-error`} className="mt-1 flex items-center gap-1 text-danger text-[13px]" role="alert">
          <WarningCircle size={14} weight="fill" className="shrink-0" />
          {error}
        </span>
      )}
    </div>
  )
}
