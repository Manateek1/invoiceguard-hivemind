export type InvoiceStatus = 'review' | 'duplicate' | 'ready' | 'draft'

export type FindingKind = 'overcharge' | 'duplicate' | 'budget' | 'purchase-order'

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unit: string
  billedUnitPrice: number
  expectedUnitPrice?: number
}

export interface InvoiceRecord {
  id: string
  vendor: string
  invoiceNumber: string
  amount: number
  currency: 'USD'
  invoiceDate: string
  dueDate?: string
  purchaseOrder?: string
  purchaseOrderTotal?: number
  budgetName?: string
  budgetLimit?: number
  lineItems: InvoiceLineItem[]
  source: 'demo' | 'upload'
}

export interface AuditFinding {
  id: string
  kind: FindingKind
  severity: 'low' | 'medium' | 'high'
  title: string
  detail: string
  amount?: number
}

export interface AgentStep {
  name: string
  description: string
  status: 'complete' | 'skipped' | 'needs-review'
  source: string
}

export interface InvoiceAudit extends InvoiceRecord {
  status: InvoiceStatus
  expectedAmount: number
  potentialSavings: number
  findings: AuditFinding[]
  agentSteps: AgentStep[]
  duplicateOf?: string
}

export interface HistoricalInvoice {
  vendor: string
  invoiceNumber: string
  amount: number
  invoiceDate: string
  lineItems: InvoiceLineItem[]
}
