import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Modal({ open, onClose, title, children, className }) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
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
                className={cn(
                  'fixed left-1/2 top-1/2 z-[9999]',
                  '-translate-x-1/2 -translate-y-1/2',
                  'bg-surface-raised rounded-[12px]',
                  'max-w-[560px] w-full p-8',
                  'focus:outline-none',
                  className
                )}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {title && (
                  <Dialog.Title asChild>
                    <h2 className="font-heading text-[24px] text-text-primary mb-6">
                      {title}
                    </h2>
                  </Dialog.Title>
                )}
                {children}
              </Motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
