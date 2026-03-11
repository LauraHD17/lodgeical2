import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Modal({ open, onClose, title, children, footer, className }) {
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
                  'fixed inset-x-0 top-[5vh] z-[9999]',
                  'mx-auto',
                  'bg-surface-raised rounded-[12px]',
                  'max-w-[560px] w-[calc(100%-2rem)]',
                  'max-h-[90vh] flex flex-col',
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
                    <h2 className="font-heading text-[24px] text-text-primary tracking-[-0.02em] px-4 sm:px-8 pt-4 sm:pt-8 pb-4 sm:pb-6 shrink-0">
                      {title}
                    </h2>
                  </Dialog.Title>
                )}
                <div className={cn('flex-1 overflow-y-auto px-4 sm:px-8 min-h-0', footer ? 'pb-4' : 'pb-4 sm:pb-8')}>
                  {children}
                </div>
                {footer && (
                  <div className="shrink-0 px-4 sm:px-8 pb-4 sm:pb-8 pt-4 border-t border-border">
                    {footer}
                  </div>
                )}
              </Motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
