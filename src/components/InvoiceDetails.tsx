import { useState } from 'react'
import { ArrowUpRight, Check, CircleAlert, FileText, Info, ShieldCheck, Sparkles } from 'lucide-react'
import type { InvoiceAudit } from '../domain/types'
import { formatMoney } from '../lib/audit-engine'
import { StatusBadge } from './StatusBadge'

export function InvoiceDetails({ invoice, onPrepareDraft }: { invoice: InvoiceAudit; onPrepareDraft: () => void }) {
  const [showPriceRequest, setShowPriceRequest] = useState(false)
  const variance = invoice.potentialSavings > 0 ? (invoice.potentialSavings / invoice.amount) * 100 : 0
  const priceFindings = invoice.findings.filter((finding) => finding.kind === 'overcharge')
  const priceRequest = `Hi ${invoice.vendor},\n\nWe’re reviewing invoice ${invoice.invoiceNumber}. Our recent invoice history shows ${priceFindings.length} line item${priceFindings.length === 1 ? '' : 's'} priced above the previous vendor prices. The estimated difference is ${formatMoney(invoice.potentialSavings)}. Could you confirm the updated pricing or share a corrected invoice?\n\nThanks,\n[Your team]`
  return <aside className="detail-panel" aria-label="Selected invoice details">
    <div className="detail-header">
      <div className="detail-vendor-icon"><ShieldCheck size={19} /></div>
      <div className="detail-title"><h2>{invoice.vendor}</h2><span>Invoice {invoice.invoiceNumber}</span></div>
      <StatusBadge status={invoice.status} />
    </div>
    <div className="detail-summary">
      <div className="amount-line"><span>Amount billed</span><strong>{formatMoney(invoice.amount)}</strong></div>
      <div className="amount-line"><span>Expected amount</span><strong>{formatMoney(invoice.expectedAmount)}</strong></div>
      {invoice.potentialSavings > 0 && <div className="amount-line savings-line"><span>Potential savings</span><strong>{formatMoney(invoice.potentialSavings)} <small>({variance.toFixed(1)}%)</small></strong></div>}
      {invoice.purchaseOrder && <div className="amount-line"><span>Purchase order</span><strong>{invoice.purchaseOrder} <small className="matched">{invoice.purchaseOrderTotal !== undefined && invoice.amount <= invoice.purchaseOrderTotal ? 'Matched' : 'Review'}</small></strong></div>}
      {invoice.budgetName && <div className="amount-line"><span>Budget</span><strong>{invoice.budgetName}{invoice.budgetLimit !== undefined && invoice.amount <= invoice.budgetLimit ? ' · within limit' : ''}</strong></div>}
    </div>
    <section className="detail-section">
      <div className="detail-section-heading"><h3>Line items <span>({invoice.lineItems.length})</span></h3><span className="section-note">Price comparison</span></div>
      <div className="line-items-table"><div className="line-item-row line-item-head"><span>Item</span><span>Expected</span><span>Billed</span></div>
        {invoice.lineItems.map((item) => {
          const isHigh = item.expectedUnitPrice !== undefined && item.billedUnitPrice > item.expectedUnitPrice * 1.1
          return <div className="line-item-row" key={item.id}><span className="line-item-name">{item.description}<small>{item.quantity} {item.unit}{item.quantity > 1 ? 's' : ''}</small></span>
            <span>{item.expectedUnitPrice !== undefined ? formatMoney(item.expectedUnitPrice) : '—'}</span><strong className={isHigh ? 'price-high' : ''}>{formatMoney(item.billedUnitPrice)}{isHigh && <small>↑</small>}</strong>
          </div>
        })}
      </div>
    </section>
    <section className="detail-section agent-section">
      <div className="detail-section-heading"><h3>Review handoffs</h3><span className="live-indicator"><span /> Local run</span></div>
      <ol className="agent-timeline">{invoice.agentSteps.map((step) => <li key={step.name} className={step.status}>
        <span className="timeline-marker">{step.status === 'complete' ? <Check size={12} /> : step.status === 'needs-review' ? <CircleAlert size={12} /> : <span />}</span>
        <div><strong>{step.name}</strong><p>{step.description}</p><small>{step.source}</small></div>
        <span className="step-status">{step.status === 'complete' ? 'Done' : step.status === 'skipped' ? 'Not connected' : 'Review'}</span>
      </li>)}</ol>
    </section>
    <section className="detail-section evidence-section">
      <div className="detail-section-heading"><h3>Evidence</h3><Info size={15} /></div>
      {invoice.findings.length ? <ul className="evidence-list">{invoice.findings.map((finding) => <li key={finding.id}>
        <span className={`evidence-icon ${finding.severity}`}><CircleAlert size={14} /></span><div><strong>{finding.title}</strong><p>{finding.detail}</p></div>
      </li>)}</ul> : <p className="no-findings"><Check size={15} /> No exceptions found in the current checks.</p>}
      <p className="evidence-footnote"><Info size={13} /> Price differences are estimates for human review, not guaranteed savings.</p>
    </section>
    {priceFindings.length > 0 && <section className="savings-suggestion" aria-label="Savings suggestion">
      <div className="suggestion-icon"><Sparkles size={14} /></div>
      <div className="suggestion-content">
        <strong>Ask for a price review</strong>
        <p>Use recent workspace invoice history to ask the vendor to confirm these price changes.</p>
        <span>Estimated difference · {formatMoney(invoice.potentialSavings)}</span>
        <button className="suggestion-button" onClick={() => setShowPriceRequest((visible) => !visible)}>
          {showPriceRequest ? 'Hide message draft' : 'Draft price request'}
        </button>
        {showPriceRequest && <div className="price-request-preview">
          <label htmlFor="price-request-draft">Message draft</label>
          <textarea id="price-request-draft" value={priceRequest} readOnly rows={7} />
          <small>Review and edit before sending. oalgo ai has not contacted the vendor.</small>
        </div>}
      </div>
    </section>}
    <div className="draft-actions"><button className="primary-button draft-button" onClick={onPrepareDraft} disabled={invoice.status === 'draft'}><FileText size={16} />{invoice.status === 'draft' ? 'Draft prepared' : 'Prepare payment draft'}</button>
      <p><ShieldCheck size={13} /> This only prepares a draft. It cannot send a payment.</p></div>
    <a className="source-link" href="#review" onClick={(event) => event.preventDefault()}>Review source file <ArrowUpRight size={13} /></a>
  </aside>
}
