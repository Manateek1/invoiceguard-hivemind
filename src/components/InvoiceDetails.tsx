import { useState } from 'react'
import { Check, CircleAlert, ClipboardCheck, Copy, FileText, Info, ShieldCheck, Sparkles, TrendingUp, X } from 'lucide-react'
import type { InvoiceAudit } from '../domain/types'
import { formatMoney } from '../lib/audit-engine'
import { StatusBadge } from './StatusBadge'

function formatDate(value: string) {
  if (!value) return 'Needs review'
  const date = new Date(value + 'T00:00:00')
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

export function InvoiceDetails({ invoice, onPrepareDraft, onClose }: { invoice: InvoiceAudit; onPrepareDraft: () => void; onClose?: () => void }) {
  const [showPriceRequest, setShowPriceRequest] = useState(false)
  const [copied, setCopied] = useState(false)
  const variance = invoice.potentialSavings > 0 ? (invoice.potentialSavings / invoice.amount) * 100 : 0
  const priceFindings = invoice.findings.filter((finding) => finding.kind === 'overcharge')
  const priceRequest = `Hi ${invoice.vendor},\n\nWe’re reviewing invoice ${invoice.invoiceNumber}. Our recent invoice history shows ${priceFindings.length} line item${priceFindings.length === 1 ? '' : 's'} priced above the previous vendor prices. The estimated difference is ${formatMoney(invoice.potentialSavings)}. Could you confirm the updated pricing or share a corrected invoice?\n\nThanks,\n[Your team]`
  const handleBack = onClose ?? (() => {
    const target = document.querySelector<HTMLElement>('.queue-section') ?? document.querySelector<HTMLElement>('.page-heading')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(priceRequest)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      setCopied(false)
    }
  }

  return <aside className="detail-panel" aria-label="Selected invoice details">
    <div className="mobile-detail-bar"><button type="button" className="mobile-back-btn" onClick={handleBack} aria-label="Back to queue"><X size={16} /> Back to queue</button></div>
    <div className="detail-header">
      <div className="detail-vendor-icon"><ShieldCheck size={19} /></div>
      <div className="detail-title"><h2>{invoice.vendor}</h2><span>Invoice {invoice.invoiceNumber}</span></div>
      <StatusBadge status={invoice.status} />
    </div>
    <div className="detail-summary">
      <div className="amount-line"><span>Invoice date</span><strong><time dateTime={invoice.invoiceDate || undefined}>{formatDate(invoice.invoiceDate)}</time></strong></div>
      {invoice.dueDate && <div className="amount-line"><span>Due date</span><strong><time dateTime={invoice.dueDate}>{formatDate(invoice.dueDate)}</time></strong></div>}
      <div className="amount-line"><span>Amount billed</span><strong>{formatMoney(invoice.amount)}</strong></div>
      <div className="amount-line"><span>Expected amount</span><strong>{formatMoney(invoice.expectedAmount)}</strong></div>
      {invoice.potentialSavings > 0 && <div className="amount-line savings-line"><span>Potential savings</span><strong>{formatMoney(invoice.potentialSavings)} <small>({variance.toFixed(1)}%)</small></strong></div>}
      {invoice.purchaseOrder && <div className="amount-line"><span>Purchase order</span><strong>{invoice.purchaseOrder} <small className={invoice.purchaseOrderStatus === 'matched' ? 'matched' : 'price-high'}>{invoice.purchaseOrderStatus === 'matched' ? 'Matched' : invoice.purchaseOrderStatus === 'vendor-mismatch' ? 'Vendor mismatch' : 'Not found'}{invoice.purchaseOrderTotal !== undefined ? ' · ' + formatMoney(invoice.purchaseOrderTotal) + ' approved' : ''}</small></strong></div>}
      {invoice.budgetName && <div className="amount-line"><span>Budget</span><strong>{invoice.budgetName}{invoice.budgetLimit !== undefined && <small className={invoice.amount <= invoice.budgetLimit ? 'matched' : 'price-high'}> · {formatMoney(invoice.budgetLimit)} limit{invoice.amount <= invoice.budgetLimit ? '' : ' · over limit'}</small>}</strong></div>}
    </div>
    <section className="detail-section">
      <div className="detail-section-heading"><h3>Line items <span>({invoice.lineItems.length})</span></h3><span className="section-note">Price per unit</span></div>
      {invoice.lineItems.length ? <div className="line-items-table"><div className="line-item-row line-item-head"><span>Quantity · item</span><span>Expected</span><span>Billed</span></div>
        {invoice.lineItems.map((item) => {
          const isHigh = item.expectedUnitPrice !== undefined && item.expectedUnitPrice > 0 && item.billedUnitPrice > item.expectedUnitPrice * 1.1
          return <div className="line-item-row" key={item.id}><span className="line-item-name" title={item.quantity + ' ' + item.unit + ' · ' + item.description}>{item.quantity} {item.unit} · {item.description}</span>
            <span>{item.expectedUnitPrice !== undefined ? formatMoney(item.expectedUnitPrice) : '—'}</span><strong className={isHigh ? 'price-high' : ''}>{formatMoney(item.billedUnitPrice)}{isHigh && <small>↑</small>}</strong>
          </div>
        })}
      </div> : <p className="evidence-footnote"><Info size={13} /> No line items were detected in this invoice.</p>}
    </section>
    <section className="detail-section agent-section">
      <div className="detail-section-heading"><h3>Review handoffs</h3><span className="live-indicator"><span /> Local run</span></div>
      <ol className="agent-timeline">{invoice.agentSteps.map((step) => <li key={step.name} className={step.status}>
        <span className="timeline-marker">{step.status === 'complete' ? <Check size={12} /> : step.status === 'needs-review' ? <CircleAlert size={12} /> : <span />}</span>
        <div><strong>{step.name}</strong><p>{step.description}</p><small>{step.source}</small></div>
        <span className="step-status">{step.status === 'complete' ? 'Done' : step.status === 'skipped' ? step.name === 'External market research' ? 'Optional' : 'Skipped' : 'Review'}</span>
      </li>)}</ol>
    </section>
    <section className="detail-section evidence-section">
      <div className="detail-section-heading"><h3>Evidence</h3><Info size={15} /></div>
      {invoice.findings.length ? <ul className="evidence-list">{invoice.findings.map((finding) => <li key={finding.id}>
        <span className={`evidence-icon ${finding.severity}`}><CircleAlert size={14} /></span><div><strong>{finding.title}</strong><p>{finding.detail}</p></div>
      </li>)}</ul> : <p className="no-findings"><Check size={15} /> No exceptions found in the current checks.</p>}
      <p className="evidence-footnote"><Info size={13} /> Price differences are estimates for human review, not guaranteed savings.</p>
    </section>
    {priceFindings.length > 0 && <section className="price-context-card" aria-label="Historical price context">
      <div className="price-context-heading">
        <span className="price-context-icon"><TrendingUp size={15} /></span>
        <div><h3>Price context</h3><p>Compared with prior vendor pricing</p></div>
      </div>
      <div className="price-context-list">{priceFindings.map((finding) => <article key={finding.id}>
        <div className="price-context-row-heading"><strong>{finding.title}</strong>{finding.amount !== undefined && <span>{formatMoney(finding.amount)} variance</span>}</div>
        <p>{finding.detail}</p>
      </article>)}</div>
      <p className="price-context-source">Based on invoice history and configured price expectations.</p>
    </section>}
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
          <div className="price-request-header">
            <label htmlFor="price-request-draft">Message draft</label>
            <button type="button" className="copy-btn" onClick={handleCopy} aria-label="Copy draft to clipboard">
              {copied ? <><ClipboardCheck size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
          <textarea id="price-request-draft" value={priceRequest} readOnly rows={7} />
          <small>Review and edit before sending. oalgo ai has not contacted the vendor.</small>
        </div>}
      </div>
    </section>}
    <div className="draft-actions"><button className="primary-button draft-button" onClick={onPrepareDraft} disabled={invoice.status === 'draft'}><FileText size={16} />{invoice.status === 'draft' ? 'Draft prepared' : 'Prepare payment draft'}</button>
      <p><ShieldCheck size={13} /> A person must approve and send any payment.</p></div>
    <div className="source-link"><Info size={13} /> The original file stays on this device.</div>
  </aside>
}
