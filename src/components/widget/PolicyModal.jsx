// src/components/widget/PolicyModal.jsx
// Modal displaying full policy text during booking.

import * as Dialog from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'

export function PolicyModal({ open, onOpenChange, title, content }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-[560px] max-h-[80vh] bg-surface-raised border border-border rounded-[12px] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <Dialog.Title className="font-heading text-[20px] text-text-primary">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="font-body text-[14px] text-text-primary leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          </div>
          <div className="border-t border-border p-4 flex justify-end">
            <Dialog.Close asChild>
              <button className="font-body text-[14px] text-info hover:underline">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
