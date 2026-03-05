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
