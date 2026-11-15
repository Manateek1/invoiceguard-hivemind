import { linkBusinessRecords, vendorHistory } from '../data/demo-invoices'
import type { AuditFinding, HistoricalInvoice, InvoiceAudit, InvoiceLineItem, InvoiceRecord } from '../domain/types'

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function sameItems(left: InvoiceRecord['lineItems'], right: InvoiceRecord['lineItems']) {
  const signature = (items: InvoiceLineItem[]) => items
    .map((item) => [normalize(item.description), item.quantity, normalize(item.unit), money(item.billedUnitPrice)].join(':'))
    .sort()
  const leftItems = signature(left)
  const rightItems = signature(right)
  return leftItems.length > 0 && leftItems.length === rightItems.length && leftItems.every((item, index) => item === rightItems[index])
}

function datesWithinTwoWeeks(left: string, right: string) {
  if (!left || !right) return false
  const leftTime = Date.parse(left + 'T00:00:00Z')
  const rightTime = Date.parse(right + 'T00:00:00Z')
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && Math.abs(leftTime - rightTime) <= 14 * 24 * 60 * 60 * 1000
}

function findDuplicate(invoice: InvoiceRecord, history: HistoricalInvoice[]) {
  const sameVendor = history.filter((previous) => normalize(previous.vendor) === normalize(invoice.vendor))
  const invoiceNumber = normalize(invoice.invoiceNumber)
  const exactReference = invoiceNumber && invoiceNumber !== normalize('Needs review')
    ? sameVendor.find((previous) => normalize(previous.invoiceNumber) === invoiceNumber)
    : undefined
  if (exactReference) return { previous: exactReference, match: 'invoice number' }

  const sameDetails = sameVendor.find((previous) => Math.abs(previous.amount - invoice.amount) < 0.01 && sameItems(previous.lineItems, invoice.lineItems) && datesWithinTwoWeeks(previous.invoiceDate, invoice.invoiceDate))
  return sameDetails ? { previous: sameDetails, match: 'vendor, total, and line items' } : undefined
}

function findPriceReference(invoice: InvoiceRecord, item: InvoiceLineItem, history: HistoricalInvoice[]) {
  const invoiceDate = invoice.invoiceDate
  const candidates = history
    .filter((previous) => !('source' in previous))
    .filter((previous) => normalize(previous.vendor) === normalize(invoice.vendor))
    .filter((previous) => !invoiceDate || !previous.invoiceDate || previous.invoiceDate < invoiceDate)
    .flatMap((previous) => previous.lineItems
      .filter((pastItem) => normalize(pastItem.description) === normalize(item.description))
      .filter((pastItem) => !pastItem.unit || !item.unit || normalize(pastItem.unit) === normalize(item.unit))
      .map((pastItem) => ({ price: pastItem.billedUnitPrice, invoiceNumber: previous.invoiceNumber, invoiceDate: previous.invoiceDate })))
    .filter((reference) => reference.price > 0)
    .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate))
  return candidates[0]
}

export function auditInvoice(record: InvoiceRecord, history: HistoricalInvoice[] = vendorHistory): InvoiceAudit {
  const invoice = linkBusinessRecords(record)
  const findings: AuditFinding[] = []
  const duplicate = findDuplicate(invoice, history)

  if (duplicate) {
    const evidence = duplicate.match === 'invoice number'
      ? 'Same vendor and invoice number ' + duplicate.previous.invoiceNumber + '.'
      : 'Same vendor, total, and line items as invoice ' + duplicate.previous.invoiceNumber + '.'
    findings.push({
      id: 'duplicate-' + invoice.id,
      kind: 'duplicate',
      severity: 'high',
      title: 'Possible duplicate invoice',
      detail: evidence + ' Earlier record dated ' + (duplicate.previous.invoiceDate || 'unknown date') + ' for ' + formatMoney(duplicate.previous.amount) + '.',
      amount: invoice.amount,
    })
  }

  const lineItems = invoice.lineItems.map((item) => {
    const reference = findPriceReference(invoice, item, history)
    return { ...item, expectedUnitPrice: item.expectedUnitPrice ?? reference?.price }
  })
  const priceDelta = lineItems.reduce((sum, item) => {
    const expected = item.expectedUnitPrice
    if (expected === undefined || expected <= 0 || item.billedUnitPrice <= expected) return sum
    const increase = (item.billedUnitPrice - expected) * item.quantity
    const percent = (item.billedUnitPrice - expected) / expected
    if (percent < 0.1) return sum
    const reference = findPriceReference(invoice, item, history)
    const referenceText = reference
      ? ' Prior invoice ' + reference.invoiceNumber + ' dated ' + reference.invoiceDate + ' billed ' + formatMoney(reference.price) + ' per ' + item.unit + '.' + (Math.abs(reference.price - expected) >= 0.01 ? ' Configured expected price is ' + formatMoney(expected) + ' per ' + item.unit + '.' : '')
      : ' Configured expected price is ' + formatMoney(expected) + ' per ' + item.unit + '.'
    findings.push({
      id: 'price-' + invoice.id + '-' + item.id,
      kind: 'overcharge',
      severity: percent >= 0.2 ? 'high' : 'medium',
      title: item.description + ' is ' + Math.round(percent * 100) + '% above recent price',
      detail: 'Billed ' + formatMoney(item.billedUnitPrice) + ' per ' + item.unit + '.' + referenceText + ' At quantity ' + item.quantity + ', the difference is ' + formatMoney(increase) + '.',
      amount: money(increase),
    })
    return sum + increase
  }, 0)

  if (invoice.purchaseOrderStatus === 'not-found') {
    findings.push({
      id: 'po-missing-' + invoice.id,
      kind: 'purchase-order',
      severity: 'high',
      title: 'Purchase order not found',
      detail: 'No purchase order ' + invoice.purchaseOrder + ' exists in this workspace. Confirm the order before approval.',
    })
  } else if (invoice.purchaseOrderStatus === 'vendor-mismatch') {
    findings.push({
      id: 'po-vendor-' + invoice.id,
      kind: 'purchase-order',
      severity: 'high',
      title: 'Purchase order vendor does not match',
      detail: 'Purchase order ' + invoice.purchaseOrder + ' is assigned to ' + invoice.purchaseOrderVendor + ', but this invoice names ' + invoice.vendor + '.',
    })
  } else if (invoice.purchaseOrder && invoice.purchaseOrderTotal !== undefined && invoice.amount > invoice.purchaseOrderTotal + 0.01) {
    findings.push({
      id: 'po-' + invoice.id,
      kind: 'purchase-order',
      severity: 'high',
      title: 'Invoice exceeds purchase order',
      detail: 'Invoice total ' + formatMoney(invoice.amount) + ' exceeds ' + invoice.purchaseOrder + ' approved for ' + formatMoney(invoice.purchaseOrderTotal) + ' by ' + formatMoney(invoice.amount - invoice.purchaseOrderTotal) + '.',
      amount: money(invoice.amount - invoice.purchaseOrderTotal),
    })
  }

  if (invoice.budgetLimit !== undefined && invoice.amount > invoice.budgetLimit + 0.01) {
    findings.push({
      id: 'budget-' + invoice.id,
      kind: 'budget',
      severity: 'medium',
      title: 'Over the approved budget',
      detail: 'Invoice total ' + formatMoney(invoice.amount) + ' exceeds the ' + (invoice.budgetName ?? 'assigned') + ' budget limit of ' + formatMoney(invoice.budgetLimit) + ' by ' + formatMoney(invoice.amount - invoice.budgetLimit) + '.',
      amount: money(invoice.amount - invoice.budgetLimit),
    })
  }

  const status = duplicate ? 'duplicate' : findings.length > 0 ? 'review' : 'ready'
  const potentialSavings = money(priceDelta)
  const vendorHasHistory = history.some((item) => normalize(item.vendor) === normalize(invoice.vendor))

  return {
    ...invoice,
    lineItems,
    status,
    expectedAmount: money(invoice.amount - potentialSavings),
    potentialSavings,
    findings,
    duplicateOf: duplicate?.previous.invoiceNumber,
    agentSteps: [
      { name: 'Invoice reader', description: 'Extracted invoice fields and ' + (lineItems.length ? lineItems.length + ' line item' + (lineItems.length === 1 ? '' : 's') : 'no line items were detected') + '.', status: 'complete', source: invoice.source === 'demo' ? 'Demo fixture' : 'Local file parser' },
      { name: 'Policy checker', description: 'Checked duplicates, purchase order, budget, and unit prices.', status: 'complete', source: 'Deterministic rules' },
      { name: 'Vendor memory', description: 'Compared this invoice with earlier vendor bills.', status: vendorHasHistory ? 'complete' : 'skipped', source: vendorHasHistory ? 'Synthetic vendor history' : 'No history found' },
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
