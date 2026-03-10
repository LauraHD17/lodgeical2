import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Delete',
  variant = 'danger',
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <Motion.div
                className="fixed inset-0 z-[9998] bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <Motion.div
                className="fixed left-1/2 top-1/2 z-[9999] -translate-x-1/2 -translate-y-1/2 bg-surface-raised rounded-[12px] max-w-[400px] w-full mx-4 p-8 focus:outline-none"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <Dialog.Title className="font-heading text-[24px] text-text-primary mb-2 tracking-[-0.02em]">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="font-body text-[15px] text-text-secondary mb-6">
                    {description}
                  </Dialog.Description>
                )}
                <div className="flex items-center justify-end gap-3 mt-6">
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                  <Button
                    variant={variant === 'danger' ? 'destructive' : 'primary'}
                    size="sm"
                    onClick={onConfirm}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </Motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
