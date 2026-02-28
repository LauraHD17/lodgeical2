import { useState, useCallback } from 'react'
import * as RadixToast from '@radix-ui/react-toast'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ToastContext } from './toastContext'

const variantClasses = {
  success: 'bg-success-bg border border-success text-success',
  error: 'bg-danger-bg border border-danger text-danger',
  info: 'bg-info-bg border border-info text-info',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ message, variant = 'info' }) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, variant }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      <RadixToast.Provider swipeDirection="right" duration={4000}>
        {children}

        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            open={true}
            onOpenChange={(open) => { if (!open) removeToast(toast.id) }}
            duration={4000}
            className={cn(
              'rounded-[8px] p-4 shadow-md flex items-start gap-3',
              'min-w-[280px] max-w-[380px]',
              variantClasses[toast.variant] ?? variantClasses.info
            )}
          >
            <RadixToast.Description className="flex-1 text-[14px] font-body leading-snug">
              {toast.message}
            </RadixToast.Description>
            <RadixToast.Close
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}

        <RadixToast.Viewport className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}
