import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Format cents as a rounded dollar string, e.g. 12345 → "$123" */
export function dollars(cents) {
  if (!cents) return '$0'
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** Format cents as a full dollar string with decimals, e.g. 12345 → "$123.45" */
export function fmtMoney(cents) {
  if (cents == null) return '$0.00'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Format a byte count as a human-readable file size, e.g. 1536 → "1.5 KB" */
export function formatFileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
