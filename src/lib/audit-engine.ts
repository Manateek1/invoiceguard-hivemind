import { vendorHistory } from '../data/demo-invoices'
import type { AuditFinding, HistoricalInvoice, InvoiceAudit, InvoiceRecord } from '../domain/types'

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function sameItems(left: InvoiceRecord['lineItems'], right: InvoiceRecord['lineItems']) {
  const leftItems = left.map((item) => normalize(item.description)).sort()
  const rightItems = right.map((item) => normalize(item.description)).sort()
  return leftItems.length > 0 && leftItems.length === rightItems.length && leftItems.every((item, index) => item === rightItems[index])
}

function findDuplicate(invoice: InvoiceRecord, history: HistoricalInvoice[]) {
  return history.find((previous) => {
    if (normalize(previous.vendor) !== normalize(invoice.vendor)) return false
    const invoiceNumberMatch = normalize(previous.invoiceNumber) === normalize(invoice.invoiceNumber)
    const sameAmountAndItems = Math.abs(previous.amount - invoice.amount) < 0.01 && sameItems(previous.lineItems, invoice.lineItems)
    return invoiceNumberMatch || sameAmountAndItems
  })
}

export function auditInvoice(invoice: InvoiceRecord, history: HistoricalInvoice[] = vendorHistory): InvoiceAudit {
  const findings: AuditFinding[] = []
  const duplicate = findDuplicate(invoice, history)

  if (duplicate) {
    findings.push({
      id: `duplicate-${invoice.id}`,
      kind: 'duplicate',
      severity: 'high',
      title: 'Possible duplicate invoice',
      detail: `Matches ${duplicate.invoiceNumber} from ${duplicate.invoiceDate} for the same vendor, amount, and items.`,
      amount: invoice.amount,
    })
  }

  const priceDelta = invoice.lineItems.reduce((sum, item) => {
    if (item.expectedUnitPrice === undefined || item.billedUnitPrice <= item.expectedUnitPrice) return sum
    const increase = (item.billedUnitPrice - item.expectedUnitPrice) * item.quantity
    const percent = (item.billedUnitPrice - item.expectedUnitPrice) / item.expectedUnitPrice
    if (percent < 0.1) return sum
    findings.push({
      id: `price-${invoice.id}-${item.id}`,
      kind: 'overcharge',
      severity: percent >= 0.2 ? 'high' : 'medium',
      title: `${item.description} is ${Math.round(percent * 100)}% above recent price`,
      detail: `Billed at ${formatMoney(item.billedUnitPrice)} per ${item.unit}; recent vendor price is ${formatMoney(item.expectedUnitPrice)}.`,
      amount: money(increase),
    })
    return sum + increase
  }, 0)

  if (invoice.purchaseOrderTotal !== undefined && invoice.amount > invoice.purchaseOrderTotal + 0.01) {
    findings.push({
      id: `po-${invoice.id}`,
      kind: 'purchase-order',
      severity: 'high',
      title: 'Invoice exceeds purchase order',
      detail: `${formatMoney(invoice.amount - invoice.purchaseOrderTotal)} above ${invoice.purchaseOrder}.`,
      amount: money(invoice.amount - invoice.purchaseOrderTotal),
    })
  }

  if (invoice.budgetLimit !== undefined && invoice.amount > invoice.budgetLimit + 0.01) {
    findings.push({
      id: `budget-${invoice.id}`,
      kind: 'budget',
      severity: 'medium',
      title: 'Over the approved budget',
      detail: `Exceeds the ${invoice.budgetName ?? 'assigned'} budget by ${formatMoney(invoice.amount - invoice.budgetLimit)}.`,
      amount: money(invoice.amount - invoice.budgetLimit),
    })
  }

  const status = duplicate ? 'duplicate' : findings.length > 0 ? 'review' : 'ready'
  const potentialSavings = money(priceDelta)

  return {
    ...invoice,
    status,
    expectedAmount: money(invoice.amount - potentialSavings),
    potentialSavings,
    findings,
    duplicateOf: duplicate?.invoiceNumber,
    agentSteps: [
      { name: 'Invoice reader', description: 'Extracted vendor, invoice number, amount, and line items.', status: 'complete', source: invoice.source === 'demo' ? 'Demo fixture' : 'Local file parser' },
      { name: 'Policy checker', description: 'Checked duplicates, purchase order, budget, and unit prices.', status: 'complete', source: 'Deterministic rules' },
      { name: 'Vendor memory', description: 'Compared the invoice with earlier vendor bills.', status: history.some((item) => normalize(item.vendor) === normalize(invoice.vendor)) ? 'complete' : 'skipped', source: history.some((item) => normalize(item.vendor) === normalize(invoice.vendor)) ? 'Synthetic vendor history' : 'No history found' },
      { name: 'Vendor research', description: 'Ready to look up current market evidence for flagged prices.', status: 'skipped', source: 'Keenable not connected' },
    ],
  }
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function auditInvoices(invoices: InvoiceRecord[]) {
  return invoices.map((invoice) => auditInvoice(invoice))
}
