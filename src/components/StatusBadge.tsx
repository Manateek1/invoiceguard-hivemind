import { CircleAlert, CircleCheck, CopyCheck } from 'lucide-react'
import type { InvoiceStatus } from '../domain/types'

const labels: Record<InvoiceStatus, string> = { review: 'Review', duplicate: 'Duplicate', ready: 'Ready', draft: 'Draft' }

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const Icon = status === 'ready' || status === 'draft' ? CircleCheck : status === 'duplicate' ? CopyCheck : CircleAlert
  return <span className={`status-badge ${status}`}><Icon size={14} strokeWidth={2.2} />{labels[status]}</span>
}
