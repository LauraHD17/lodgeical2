import { cn } from '@/lib/utils'

const reservationVariants = {
  confirmed: 'bg-success-bg text-success',
  pending: 'bg-warning-bg text-warning',
  cancelled: 'bg-danger-bg text-danger',
  no_show: 'bg-warning-bg text-warning',
}

const paymentVariants = {
  paid: 'bg-success-bg text-success',
  partial: 'bg-warning-bg text-warning',
  unpaid: 'bg-warning-bg text-warning',
  overpaid: 'bg-info-bg text-info',
  failed: 'bg-danger-bg text-danger',
}

export function StatusChip({ status, type = 'reservation' }) {
  const variants = type === 'payment' ? paymentVariants : reservationVariants
  const colorClass = variants[status] ?? 'bg-surface text-text-secondary'

  const label = status ? status.replace(/_/g, ' ') : ''

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-[10px] py-[2px]',
        'text-[12px] font-semibold font-body capitalize',
        colorClass
      )}
    >
      {label}
    </span>
  )
}
