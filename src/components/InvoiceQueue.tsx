import { ChevronRight } from 'lucide-react'
import type { InvoiceAudit } from '../domain/types'
import { formatMoney } from '../lib/audit-engine'
import { StatusBadge } from './StatusBadge'

export function InvoiceQueue({ invoices, selectedId, onSelect }: { invoices: InvoiceAudit[]; selectedId: string; onSelect: (id: string) => void }) {
  if (!invoices.length) return <div className="empty-state"><strong>No matching invoices</strong><span>Try changing your search or filters.</span></div>
  return <div className="table-scroll"><table className="invoice-table">
    <thead><tr><th>Vendor</th><th>Invoice #</th><th>Amount</th><th>Status</th><th>Findings</th><th><span className="sr-only">Open</span></th></tr></thead>
    <tbody>{invoices.map((invoice) => <tr key={invoice.id} className={selectedId === invoice.id ? 'selected' : ''} onClick={() => onSelect(invoice.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(invoice.id) }}>
      <td className="vendor-cell"><strong>{invoice.vendor}</strong><small>{invoice.source === 'upload' ? 'Uploaded invoice' : 'Invoice received'}</small></td>
      <td className="invoice-number">{invoice.invoiceNumber}</td><td className="amount-cell">{formatMoney(invoice.amount)}</td><td><StatusBadge status={invoice.status} /></td>
      <td className="finding-cell">{invoice.findings[0]?.title ?? 'No issues found'}{invoice.findings.length > 1 && <small>+{invoice.findings.length - 1} more</small>}</td><td className="row-chevron"><ChevronRight size={16} /></td>
    </tr>)}</tbody>
  </table></div>
}
