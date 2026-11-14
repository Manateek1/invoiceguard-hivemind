import { BookOpen, FileText, History, ShoppingCart, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { vendorHistory } from '../data/demo-invoices'
import type { InvoiceAudit } from '../domain/types'
import { formatMoney } from '../lib/audit-engine'

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

type Source = {
  icon: LucideIcon
  label: string
  title: string
  detail: string
  state?: 'warning' | 'good'
}

function formatDate(value: string) {
  if (!value) return 'date not provided'
  const date = new Date(value + 'T00:00:00')
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function SharedReviewContext({ invoice, compact = false }: { invoice: InvoiceAudit; compact?: boolean }) {
  const history = vendorHistory
    .filter((item) => normalize(item.vendor) === normalize(invoice.vendor))
    .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate))
  const latest = history[0]
  const comparableItems = latest
    ? invoice.lineItems.filter((item) => latest.lineItems.some((oldItem) => normalize(oldItem.description) === normalize(item.description)))
    : []
  const sources: Source[] = [
    {
      icon: FileText,
      label: 'Invoice',
      title: invoice.invoiceNumber || 'Invoice number not detected',
      detail: (invoice.source === 'upload' ? 'Parsed in this browser' : 'Synthetic sample') + ' · ' + invoice.vendor + ' · ' + formatMoney(invoice.amount),
    },
    latest
      ? {
          icon: History,
          label: 'Vendor history',
          title: latest.invoiceNumber + ' · ' + formatDate(latest.invoiceDate),
          detail: formatMoney(latest.amount) + ' total · ' + comparableItems.length + ' comparable line item' + (comparableItems.length === 1 ? '' : 's'),
          state: 'good',
        }
      : {
          icon: History,
          label: 'Vendor history',
          title: 'No prior sample invoice found',
          detail: 'The demo has no local price baseline for this vendor.',
          state: 'warning',
        },
    invoice.purchaseOrder
      ? {
          icon: ShoppingCart,
          label: 'Purchase order',
          title: invoice.purchaseOrder + (invoice.purchaseOrderVendor ? ' · ' + invoice.purchaseOrderVendor : ''),
          detail: invoice.purchaseOrderTotal === undefined
            ? 'No approved total is linked in the sample workspace.'
            : 'Approved ' + formatMoney(invoice.purchaseOrderTotal) + ' · invoice ' + formatMoney(invoice.amount),
          state: invoice.purchaseOrderStatus === 'matched' && invoice.purchaseOrderTotal !== undefined && invoice.amount <= invoice.purchaseOrderTotal ? 'good' : 'warning',
        }
      : {
          icon: ShoppingCart,
          label: 'Purchase order',
          title: 'No purchase order reference',
          detail: 'A person should confirm whether this invoice needs an order.',
          state: 'warning',
        },
    invoice.budgetName
      ? {
          icon: WalletCards,
          label: 'Budget',
          title: invoice.budgetName,
          detail: invoice.budgetLimit === undefined
            ? 'No per-invoice limit is linked.'
            : formatMoney(invoice.budgetLimit) + ' per-invoice limit · invoice ' + formatMoney(invoice.amount),
          state: invoice.budgetLimit !== undefined && invoice.amount <= invoice.budgetLimit ? 'good' : 'warning',
        }
      : {
          icon: WalletCards,
          label: 'Budget',
          title: 'No budget linked',
          detail: 'No budget limit is available in the sample workspace.',
          state: 'warning',
        },
  ]

  return <section className={'ai-context-card' + (compact ? ' compact' : '')} aria-label="AI context">
    <div className="ai-context-heading">
      <span className="ai-context-icon"><BookOpen size={17} /></span>
      <div className="ai-context-title">
        <div><h3>AI context</h3><span className="context-local-pill">Local demo · no live memory</span></div>
        <p>{compact ? 'Records behind this review' : 'Structured records available to the sample workflow'}</p>
      </div>
    </div>
    <div className="context-source-list">
      {sources.map(({ icon: Icon, label, title, detail, state }) => <div className="context-source" key={label}>
        <span className={'context-source-icon' + (state ? ' ' + state : '')}><Icon size={15} /></span>
        <div className="context-source-copy">
          <span className="context-source-label">{label}</span>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
      </div>)}
    </div>
    {!compact && <div className="context-rules">
      <div className="context-rules-icon"><BookOpen size={14} /></div>
      <p><strong>Review rules</strong><span>Exact invoice-number duplicates, similar bills within 14 days, unit-price increases above 10%, purchase-order totals, and per-invoice budget limits.</span></p>
    </div>}
    <p className="context-disclosure">This invoice review uses synthetic history and deterministic checks. Cognee Cloud recall is a separate, manual action.</p>
  </section>
}

type MemoryNode = {
  id: string
  kind: string
  title: string
  detail: string
  x: number
  y: number
}

type MemoryEdge = { from: string; to: string; label: string }

type CloudStatus = {
  configured: boolean
  allowed: boolean
  reachable: boolean
  missing: string[]
  datasetName?: string
  message?: string
}

function buildSampleGraph(invoice: InvoiceAudit) {
  const past = vendorHistory.find((record) => normalize(record.vendor) === normalize(invoice.vendor))
  const items = invoice.lineItems.slice(0, 2)
  const nodes: MemoryNode[] = [
    { id: 'invoice', kind: 'CURRENT INVOICE', title: invoice.invoiceNumber || 'Invoice', detail: 'Total · ' + formatMoney(invoice.amount), x: 450, y: 242 },
    { id: 'vendor', kind: 'VENDOR', title: invoice.vendor, detail: 'Matched from invoice', x: 155, y: 135 },
    { id: 'history', kind: 'PAST INVOICE', title: past?.invoiceNumber ?? 'No prior invoice', detail: past ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(past.invoiceDate + 'T00:00:00')) + ' · ' + formatMoney(past.amount) : 'No matching demo history', x: 155, y: 350 },
    { id: 'purchase-order', kind: 'PURCHASE ORDER', title: invoice.purchaseOrder ?? 'No PO reference', detail: invoice.purchaseOrderTotal === undefined ? 'No linked approved total' : 'Approved · ' + formatMoney(invoice.purchaseOrderTotal), x: 745, y: 135 },
    { id: 'budget', kind: 'BUDGET', title: invoice.budgetName ?? 'No budget linked', detail: invoice.budgetLimit === undefined ? 'No per-invoice limit' : 'Limit · ' + formatMoney(invoice.budgetLimit), x: 745, y: 350 },
  ]
  const edges: MemoryEdge[] = [
    { from: 'invoice', to: 'vendor', label: 'billed by' },
    { from: 'vendor', to: 'history', label: 'prior bills' },
    { from: 'invoice', to: 'history', label: 'compared with' },
    { from: 'invoice', to: 'purchase-order', label: invoice.purchaseOrderStatus === 'matched' ? 'matched to' : 'checked against' },
    { from: 'invoice', to: 'budget', label: 'assigned to' },
  ]
  items.forEach((item, index) => {
    const id = 'line-' + index
    const expected = item.expectedUnitPrice
    nodes.push({
      id,
      kind: 'LINE ITEM',
      title: item.description,
      detail: expected === undefined
        ? item.quantity + ' ' + item.unit + ' · ' + formatMoney(item.billedUnitPrice)
        : formatMoney(item.billedUnitPrice) + ' billed · ' + formatMoney(expected) + ' prior',
      x: index === 0 ? 450 : 450,
      y: index === 0 ? 75 : 425,
    })
    edges.push({ from: 'invoice', to: id, label: '' })
    if (past?.lineItems.some((pastItem) => normalize(pastItem.description) === normalize(item.description))) {
      edges.push({ from: 'history', to: id, label: '' })
    }
  })
  return { nodes, edges }
}

function recordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value) return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function normalizeCloudGraph(value: unknown): { nodes: MemoryNode[]; edges: MemoryEdge[] } {
  const outer = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const graphCandidate = [outer.graph, outer.data, outer.result].find((candidate) => candidate && typeof candidate === 'object')
  const graph = graphCandidate && typeof graphCandidate === 'object' ? graphCandidate as Record<string, unknown> : outer
  const toRecords = (candidate: unknown) => {
    if (Array.isArray(candidate)) return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    if (candidate && typeof candidate === 'object') {
      return Object.entries(candidate).map(([id, item]) => item && typeof item === 'object' ? { id, ...item as Record<string, unknown> } : { id, label: String(item) })
    }
    return []
  }
  const rawNodes = toRecords(graph.nodes ?? graph.vertices)
  const rawEdges = toRecords(graph.edges ?? graph.relationships ?? graph.links)
  const visibleRawNodes = rawNodes.slice(0, 9)
  const centerIndex = Math.max(0, visibleRawNodes.findIndex((node) => /invoice/i.test(recordValue(node, ['type', 'kind', 'node_type', 'label', 'name']))))
  const nodes = visibleRawNodes.map((value, index) => {
    const node = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const propertiesCandidate = node.properties ?? node.attributes ?? node.data
    const properties = propertiesCandidate && typeof propertiesCandidate === 'object' ? propertiesCandidate as Record<string, unknown> : {}
    const id = recordValue(node, ['id', 'node_id', 'nodeId']) || 'node-' + index
    const title = recordValue(node, ['label', 'name', 'title']) || recordValue(properties, ['name', 'label', 'text']) || id
    const kind = recordValue(node, ['type', 'kind', 'node_type']) || 'MEMORY NODE'
    const detail = recordValue(properties, ['description', 'text', 'content', 'summary']) || 'Cognee Cloud dataset entity'
    if (index === centerIndex) return { id, kind: kind.toUpperCase(), title: title.slice(0, 40), detail: detail.slice(0, 68), x: 450, y: 245 }
    const ringIndex = index < centerIndex ? index : index - 1
    const angle = (Math.PI * 2 * ringIndex) / Math.max(visibleRawNodes.length - 1, 1) - Math.PI / 2
    return { id, kind: kind.toUpperCase(), title: title.slice(0, 40), detail: detail.slice(0, 68), x: 450 + Math.cos(angle) * 275, y: 245 + Math.sin(angle) * 175 }
  })
  const visibleIds = new Set(nodes.map((node) => node.id))
  const edges = rawEdges.slice(0, 32).flatMap((value) => {
    const edge = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const from = recordValue(edge, ['source', 'from', 'start', 'source_id', 'sourceId', 'start_node', 'start_node_id'])
    const to = recordValue(edge, ['target', 'to', 'end', 'target_id', 'targetId', 'end_node', 'end_node_id'])
    if (!visibleIds.has(from) || !visibleIds.has(to)) return []
    return [{ from, to, label: recordValue(edge, ['label', 'type', 'relationship']) }]
  })
  return { nodes, edges }
}

export function InvoiceMemoryGraph({ invoice }: { invoice: InvoiceAudit }) {
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null)
  const [cloudUnavailable, setCloudUnavailable] = useState(false)
  const [cloudGraph, setCloudGraph] = useState<unknown>(null)
  const [cloudGraphMessage, setCloudGraphMessage] = useState('')
  const [graphSource, setGraphSource] = useState<'sample' | 'cognee'>('sample')
  const [busy, setBusy] = useState<'load' | 'seed' | 'recall' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState('invoice')
  const sampleGraph = useMemo(() => buildSampleGraph(invoice), [invoice])
  const remoteGraph = useMemo(() => normalizeCloudGraph(cloudGraph), [cloudGraph])
  const graph = graphSource === 'cognee' ? remoteGraph : sampleGraph
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes[0]
  const nodePositions = new Map(graph.nodes.map((node) => [node.id, node]))

  useEffect(() => {
    let active = true
    fetch('/api/cognee?action=status')
      .then(async (response) => {
        if (!response.ok) throw new Error('Cognee status endpoint is unavailable.')
        return response.json() as Promise<CloudStatus>
      })
      .then((status) => { if (active) setCloudStatus(status) })
      .catch(() => { if (active) setCloudUnavailable(true) })
    return () => { active = false }
  }, [])

  async function loadCloudGraph(successPrefix = '') {
    setBusy('load')
    setError('')
    if (!successPrefix) setNotice('')
    try {
      const response = await fetch('/api/cognee?action=graph')
      const payload = await response.json() as { graph?: unknown; datasetName?: string; message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || payload.message || 'Could not load the Cognee Cloud graph.')
      setCloudGraph(payload.graph ?? {})
      setCloudGraphMessage(payload.message || '')
      setGraphSource('cognee')
      setSelectedNodeId('')
      const loadedGraph = normalizeCloudGraph(payload.graph)
      const graphNotice = loadedGraph.nodes.length
        ? 'Live graph loaded from Cognee Cloud · ' + (payload.datasetName || cloudStatus?.datasetName || 'workspace dataset') + ` · ${loadedGraph.nodes.length} nodes shown`
        : payload.message || 'The configured Cognee dataset does not contain graph nodes yet.'
      setNotice([successPrefix, graphNotice].filter(Boolean).join(' '))
    } catch (caught) {
      setError([successPrefix, caught instanceof Error ? caught.message : 'Could not load the Cognee Cloud graph.'].filter(Boolean).join(' '))
    } finally {
      setBusy(null)
    }
  }

  async function saveSampleMemory() {
    setBusy('seed')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/cognee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'seed-sample' }),
      })
      const payload = await response.json() as { message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not add the sample records to Cognee Cloud.')
      await loadCloudGraph(payload.message || 'Synthetic sample records were sent to Cognee Cloud.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the sample records to Cognee Cloud.')
      setBusy(null)
    }
  }

  async function searchVendorMemory() {
    setBusy('recall')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/cognee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'search', invoice: {
          vendor: invoice.vendor,
          invoiceNumber: invoice.invoiceNumber,
          lineItems: invoice.lineItems.map(({ description, unit }) => ({ description, unit })),
        } }),
      })
      const payload = await response.json() as { results?: unknown; message?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not search Cognee Cloud memory.')
      const summary = typeof payload.results === 'string' ? payload.results : JSON.stringify(payload.results ?? [])
      setNotice('Cognee Cloud recall returned: ' + summary.slice(0, 500))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not search Cognee Cloud memory.')
    } finally {
      setBusy(null)
    }
  }

  const cloudEnabled = Boolean(cloudStatus?.configured && cloudStatus.allowed && cloudStatus.reachable)
  const statusText = cloudUnavailable
    ? 'Local API unavailable'
    : !cloudStatus
      ? 'Checking Cloud setup'
      : !cloudStatus.configured
        ? 'Setup required'
        : !cloudStatus.allowed
          ? 'External access is off'
          : cloudStatus.reachable
            ? 'Cloud API reachable'
            : 'Cloud API unavailable'

  return <section className="memory-graph-card" aria-label="Invoice memory graph">
    <header className="memory-graph-header">
      <div className="memory-graph-title">
        <h2>Memory graph</h2>
        <p>Invoices linked to vendors, line items, purchase orders, and budgets.</p>
      </div>
      <div className={'cognee-status ' + (cloudEnabled ? 'connected' : 'local')}>
        <span className="cognee-status-dot" />
        <span><strong>{statusText}</strong><small>{cloudStatus?.datasetName ? 'Dataset · ' + cloudStatus.datasetName : 'Cognee Cloud'}</small></span>
      </div>
    </header>

    <div className="graph-toolbar">
      <div className="graph-source-tabs" role="tablist" aria-label="Graph source">
        <button type="button" role="tab" aria-selected={graphSource === 'sample'} className={graphSource === 'sample' ? 'selected' : ''} onClick={() => { setGraphSource('sample'); setSelectedNodeId('invoice') }}>Sample graph</button>
        <button type="button" role="tab" aria-selected={graphSource === 'cognee'} className={graphSource === 'cognee' ? 'selected' : ''} onClick={() => setGraphSource('cognee')} disabled={!cloudGraph}>Cognee Cloud graph</button>
      </div>
      <div className="graph-actions">
        <button type="button" className="secondary-button" onClick={() => void loadCloudGraph()} disabled={!cloudEnabled || busy !== null}>
          {busy === 'load' ? 'Loading graph…' : 'Load Cloud graph'}
        </button>
        <button type="button" className="primary-button" onClick={() => void saveSampleMemory()} disabled={!cloudEnabled || busy !== null}>
          {busy === 'seed' ? 'Writing sample memory…' : 'Write fake sample memory'}
        </button>
      </div>
    </div>

    {!cloudEnabled && <div className="cloud-setup-note">
      <strong>{cloudUnavailable ? 'Run the local API or open the Vercel preview.' : 'Cognee Cloud is not connected.'}</strong>
      <span>{cloudStatus?.missing?.length ? 'Set ' + cloudStatus.missing.join(', ') + ' on the server to enable Cloud reads and writes.' : cloudStatus?.message || 'The graph below is generated from fake records in this browser. No Cloud graph is shown as live.'}</span>
    </div>}

    <div className="graph-canvas-scroll">
      {graph.nodes.length ? <svg className="memory-graph-svg" viewBox="0 0 900 500" role="img" aria-label={graphSource === 'cognee' ? 'Cognee Cloud knowledge graph' : 'Sample invoice relationship graph'}>
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrow-head" />
          </marker>
        </defs>
        <g className="graph-edges">
          {graph.edges.map((edge, index) => {
            const from = nodePositions.get(edge.from)
            const to = nodePositions.get(edge.to)
            if (!from || !to) return null
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2
            return <g key={edge.from + edge.to + index}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#graph-arrow)" />
              {edge.label && <text x={midX} y={midY - 7}>{edge.label}</text>}
            </g>
          })}
        </g>
        <g className="graph-nodes">
          {graph.nodes.map((node) => <g
            key={node.id}
            className={'memory-node' + (selectedNode?.id === node.id ? ' selected' : '')}
            role="button"
            tabIndex={0}
            aria-label={node.kind + ': ' + node.title + '. ' + node.detail}
            onClick={() => setSelectedNodeId(node.id)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedNodeId(node.id) }}
          >
            <rect x={node.x - 100} y={node.y - 34} width="200" height="68" rx="10" />
            <text className="graph-node-kind" x={node.x - 83} y={node.y - 13}>{node.kind.slice(0, 20)}</text>
            <text className="graph-node-title" x={node.x - 83} y={node.y + 8}>{node.title.slice(0, 22)}</text>
            <text className="graph-node-detail" x={node.x - 83} y={node.y + 25}>{node.detail.slice(0, 22)}</text>
          </g>)}
        </g>
      </svg> : <div className="graph-empty"><strong>{graphSource === 'cognee' ? 'No records in the Cloud graph yet' : 'No graph records yet'}</strong><span>{cloudGraphMessage || 'Write the synthetic sample memory to Cognee Cloud, then load its dataset graph.'}</span></div>}
    </div>

    <div className="graph-footer">
      <div className="graph-counts"><span><i className="graph-legend-dot invoice" />{graph.nodes.length} nodes</span><span><i className="graph-legend-dot relation" />{graph.edges.length} relationships</span><span>{graphSource === 'cognee' ? 'Source · Cognee Cloud' : 'Source · synthetic sample data'}</span></div>
      {selectedNode && <div className="selected-node-detail"><span>{selectedNode.kind}</span><strong>{selectedNode.title}</strong><p>{selectedNode.detail}</p></div>}
    </div>

    <div className="graph-memory-actions">
      <div><strong>Use the selected invoice as a memory query</strong><p>Only vendor, invoice number, and line-item descriptions and units are used to build the query after you click.</p></div>
      <button type="button" className="text-action" onClick={() => void searchVendorMemory()} disabled={!cloudEnabled || busy !== null}>{busy === 'recall' ? 'Searching…' : 'Recall vendor memory'}</button>
    </div>
    {(notice || error) && <div className={error ? 'graph-feedback error' : 'graph-feedback'} role={error ? 'alert' : 'status'}>{error || notice}</div>}
    <p className="graph-disclosure">The sample graph is local and synthetic. Cognee Cloud actions are disabled until a server API key, business dataset, and external-data approval are configured.</p>
  </section>
}
