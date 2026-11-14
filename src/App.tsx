import { useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownUp, ArrowRight, Building2, ChevronRight, Clock3, FileCheck2,
  FileText, Home, Network, PlugZap, Search, ShieldCheck, Upload, Workflow,
} from 'lucide-react'
import { demoInvoices, vendorHistory } from './data/demo-invoices'
import type { InvoiceAudit } from './domain/types'
import { auditInvoice, formatMoney } from './lib/audit-engine'
import { parseInvoiceFile, parsedToRecord, type ParsedInvoice } from './lib/invoice-parser'
import { AgentOrchestration } from './components/AgentOrchestration'
import { ConnectorsPage } from './components/ConnectorsPage'
import { InvoiceDetails } from './components/InvoiceDetails'
import { InvoiceQueue } from './components/InvoiceQueue'
import { InvoiceMemoryGraph, SharedReviewContext } from './components/SharedReviewContext'
import { UploadInvoiceModal } from './components/UploadInvoiceModal'
import './App.css'
import './brand.css'

type Section = 'overview' | 'queue' | 'vendors' | 'activity' | 'agents' | 'memory' | 'connections'
const initialAudits = demoInvoices.map((invoice) => auditInvoice(invoice))

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  return pathname === '/demo' || pathname.startsWith('/demo/')
    ? <InvoiceGuardWorkspace />
    : <OalgoLandingPage />
}

function InvoiceGuardWorkspace() {
  const [audits, setAudits] = useState<InvoiceAudit[]>(initialAudits)
  const [selectedId, setSelectedId] = useState(initialAudits[0].id)
  const [section, setSection] = useState<Section>('overview')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parsedInvoices, setParsedInvoices] = useState<ParsedInvoice[] | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = audits.find((invoice) => invoice.id === selectedId) ?? audits[0]
  const hasDetailPanel = section === 'queue'
  const vendors = [...new Set(audits.map((invoice) => invoice.vendor))].sort()
  const needsReview = audits.filter((invoice) => invoice.status === 'review' || invoice.status === 'duplicate').length
  const ready = audits.filter((invoice) => invoice.status === 'ready' || invoice.status === 'draft').length
  const potentialSavings = audits.reduce((sum, invoice) => sum + invoice.potentialSavings, 0)
  const uploadCount = audits.filter((invoice) => invoice.source === 'upload').length

  const filtered = useMemo(() => audits.filter((invoice) => {
    const matchesQuery = `${invoice.vendor} ${invoice.invoiceNumber} ${invoice.findings.map((finding) => finding.title).join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter
    const matchesVendor = vendorFilter === 'all' || invoice.vendor === vendorFilter
    return matchesQuery && matchesStatus && matchesVendor
  }), [audits, query, statusFilter, vendorFilter])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  async function handleFile(file?: File) {
    if (!file) return
    setIsParsing(true)
    setUploadError('')
    try {
      const parsed = await parseInvoiceFile(file)
      setParsedInvoices(parsed)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not read that invoice file.')
    } finally {
      setIsParsing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function chooseInvoiceFile() {
    setParsedInvoices(null)
    setUploadError('')
    inputRef.current?.click()
  }

  function addParsedInvoices(records: ParsedInvoice[]) {
    let history = [...vendorHistory, ...demoInvoices, ...audits.filter((invoice) => invoice.source === 'upload')]
    const newAudits = records.map((parsed) => {
      const record = parsedToRecord(parsed)
      const audit = auditInvoice(record, history)
      history = [...history, record]
      return audit
    })
    setAudits((current) => [...newAudits, ...current])
    setSelectedId(newAudits[0].id)
    setSection('queue')
    setUploadOpen(false)
    setParsedInvoices(null)
    setUploadError('')
    notify(`Added ${newAudits.length} invoice${newAudits.length === 1 ? '' : 's'} for review`)
  }

  function closeUpload() {
    setUploadOpen(false)
    setParsedInvoices(null)
    setUploadError('')
  }

  function prepareDraft(invoice: InvoiceAudit) {
    setAudits((current) => current.map((item) => item.id === invoice.id ? { ...item, status: 'draft' } : item))
    notify(`Payment draft prepared for ${invoice.invoiceNumber}. No payment was sent.`)
  }

  const navItems = [
    { id: 'overview' as const, label: 'Overview', icon: Home },
    { id: 'queue' as const, label: 'Invoices', icon: FileText },
    { id: 'vendors' as const, label: 'Vendors', icon: Building2 },
    { id: 'agents' as const, label: 'Agent activity', icon: Workflow },
    { id: 'memory' as const, label: 'Memory graph', icon: Network },
    { id: 'connections' as const, label: 'Connections', icon: PlugZap },
    { id: 'activity' as const, label: 'Audit log', icon: Activity },
  ]
  const sectionLabel: Record<Section, string> = {
    overview: 'Overview',
    queue: 'Invoices',
    vendors: 'Vendors',
    activity: 'Audit log',
    agents: 'Agent activity',
    memory: 'Memory graph',
    connections: 'Connections',
  }
  const pageCopy: Record<Section, { title: string; description: string }> = {
    overview: { title: 'Overview', description: 'A clear view of invoices waiting for a person to review.' },
    queue: { title: 'Invoice review', description: 'Check each invoice against vendor history, purchase orders, and budgets.' },
    vendors: { title: 'Vendors', description: 'See the sample invoice history used to compare vendor pricing.' },
    activity: { title: 'Audit log', description: 'A record of checks and findings for each invoice in this session.' },
    agents: { title: 'Agent activity', description: 'See each review role, what it receives, and what it passes forward.' },
    memory: { title: 'Business memory graph', description: 'Inspect the links between invoices and the business records behind a review.' },
    connections: { title: 'Connections', description: 'Preview the services that can supply invoice and business context.' },
  }

  return (
    <div className={'workspace' + (hasDetailPanel ? ' has-detail' : '')}>
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Oalgo AI home">
          <span className="brand-lockup"><img src="/oalgo-ai-logo.png" alt="" /></span>
          <img className="brand-icon" src="/favicon.png" alt="" />
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">NB</span>
          <span><strong>Northstar Business</strong><small>Demo workspace</small></span>
          <ChevronRight size={14} />
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => setSection(id)}>
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              <span>{label}</span>
              {id === 'queue' && needsReview > 0 && <span className="nav-count">{needsReview}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="memory-mark"><span className="memory-dot" />Local review context</div>
          <p>This demo uses synthetic records. Check Connections for provider status.</p>
          <div className="sidebar-footer-note"><span>Human approval required</span><ShieldCheck size={14} /></div>
        </div>
      </aside>

      <main className="main-column" id="top">
        <header className="topbar">
          <div className="breadcrumbs"><span>Northstar Business</span><ChevronRight size={14} /><strong>{sectionLabel[section]}</strong></div>
          <div className="topbar-right">
            <span className="demo-pill"><span />{uploadCount ? `Demo + ${uploadCount} file${uploadCount > 1 ? 's' : ''}` : 'Demo data'}</span>
            <span className="user-avatar" aria-label="Oalgo AI demo workspace">OA</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>{pageCopy[section].title}</h1>
              <p>{pageCopy[section].description}</p>
            </div>
            <button className="primary-button upload-button" onClick={() => setUploadOpen(true)}><Upload size={16} /> Upload invoice</button>
          </div>

          {(section === 'queue' || section === 'overview') && <section className="summary-row" aria-label="Invoice summary">
            <div className="summary-item"><span className="summary-label">Needs review</span><strong>{needsReview} <small>{needsReview === 1 ? 'invoice' : 'invoices'}</small></strong><span className="summary-note">Includes duplicates and policy flags</span></div>
            <div className="summary-item savings"><span className="summary-label">Price variance flagged</span><strong>{formatMoney(potentialSavings)}</strong><span className="summary-note">Estimate from sample vendor history</span></div>
            <div className="summary-item"><span className="summary-label">Drafts &amp; ready</span><strong>{ready} <small>{ready === 1 ? 'invoice' : 'invoices'}</small></strong><span className="summary-note">Payment still needs a person</span></div>
          </section>}

          {section === 'connections' ? <ConnectorsPage />
            : section === 'agents' && selected ? <div className="agent-page-layout"><AgentOrchestration invoice={selected} /><SharedReviewContext invoice={selected} /></div>
              : section === 'memory' && selected ? <div className="memory-page-layout"><InvoiceMemoryGraph invoice={selected} /><SharedReviewContext invoice={selected} /></div>
                : section === 'overview' && selected ? <section className="overview-dashboard" aria-label="Demo overview">
                  <div className="overview-primary-grid">
                    <section className="queue-section overview-queue">
                      <div className="section-heading"><div><h2>Recent invoices <span className="muted-count">{filtered.length}</span></h2><p>Choose an invoice to update the relationship graph and agent review.</p></div></div>
                      <InvoiceQueue invoices={filtered} selectedId={selectedId} onSelect={setSelectedId} />
                    </section>
                    <InvoiceMemoryGraph invoice={selected} />
                  </div>
                  <AgentOrchestration invoice={selected} />
                </section>
              : section === 'vendors' ? <VendorDirectory invoices={audits} onSelect={(id) => { setSelectedId(id); setSection('queue') }} />
            : section === 'activity' ? <ActivityList invoices={audits} onSelect={(id) => { setSelectedId(id); setSection('queue') }} />
              : <section className="queue-section">
                <div className="section-heading">
                  <div><h2>{section === 'overview' ? 'Recent invoices' : 'Invoice queue'} <span className="muted-count">{filtered.length}</span></h2><p>Select a bill to inspect its line items, checks, and source records.</p></div>
                  <div className="filters">
                    <label className="select-wrap"><span className="sr-only">Filter by status</span><ArrowDownUp size={14} />
                      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="all">All statuses</option><option value="review">Needs review</option><option value="duplicate">Duplicate</option><option value="ready">Ready</option><option value="draft">Draft</option>
                      </select>
                    </label>
                    <label className="select-wrap vendor-filter"><span className="sr-only">Filter by vendor</span>
                      <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}><option value="all">All vendors</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select>
                    </label>
                    <label className="search-wrap"><Search size={15} /><input aria-label="Search invoices" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoices..." /></label>
                  </div>
                </div>
                <InvoiceQueue invoices={filtered} selectedId={selectedId} onSelect={setSelectedId} />
              </section>}
        </div>
      </main>

      {selected && hasDetailPanel && <InvoiceDetails invoice={selected} onPrepareDraft={() => prepareDraft(selected)} />}
      <input ref={inputRef} className="hidden-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json,.csv" onChange={(event) => void handleFile(event.target.files?.[0])} aria-label="Choose an invoice file" />
      {uploadOpen && <UploadInvoiceModal key={parsedInvoices ? `${parsedInvoices[0]?.fileName}:${parsedInvoices.length}` : 'empty'} isParsing={isParsing} parsedInvoices={parsedInvoices} error={uploadError} onClose={closeUpload} onChoose={chooseInvoiceFile} onConfirm={addParsedInvoices} />}
      {toast && <div className="toast" role="status"><FileCheck2 size={16} />{toast}</div>}
    </div>
  )
}

function VendorDirectory({ invoices, onSelect }: { invoices: InvoiceAudit[]; onSelect: (id: string) => void }) {
  const vendors = [...new Set(invoices.map((invoice) => invoice.vendor))].sort()
  return <section className="directory-section">
    <div className="section-heading"><div><h2>Vendor history <span className="muted-count">{vendors.length}</span></h2><p>Recent invoice patterns from synthetic demo records and this session.</p></div></div>
    <div className="vendor-list">{vendors.map((vendor) => {
      const records = invoices.filter((invoice) => invoice.vendor === vendor)
      const spend = records.reduce((sum, item) => sum + item.amount, 0)
      const latest = records[0]
      return <button className="vendor-row" key={vendor} onClick={() => onSelect(latest.id)}>
        <span className="vendor-initial">{vendor.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span>
        <span className="vendor-name"><strong>{vendor}</strong><small>{records.length} invoice{records.length === 1 ? '' : 's'} in this review</small></span>
        <span className="vendor-spend"><small>Total submitted</small><strong>{formatMoney(spend)}</strong></span><ChevronRight size={16} />
      </button>
    })}</div>
  </section>
}

function ActivityList({ invoices, onSelect }: { invoices: InvoiceAudit[]; onSelect: (id: string) => void }) {
  const rows = invoices.flatMap((invoice) => invoice.agentSteps.map((step) => ({ invoice, step })))
  return <section className="directory-section">
    <div className="section-heading"><div><h2>Review activity <span className="muted-count">{rows.length}</span></h2><p>What the local invoice-review workflow checked for each invoice.</p></div></div>
    <div className="activity-list">{rows.map(({ invoice, step }, index) => <button className="activity-row" key={`${invoice.id}-${step.name}`} onClick={() => onSelect(invoice.id)}>
      <span className={`activity-icon ${step.status}`}><Clock3 size={16} /></span>
      <span className="activity-copy"><strong>{step.name}</strong><small>{step.description}</small><em>{invoice.vendor} · {invoice.invoiceNumber} · {step.source}</em></span>
      <span className="activity-time">{index < 3 ? 'Just now' : 'Demo run'}</span>
    </button>)}</div>
  </section>
}

function OalgoLandingPage() {
  return <div className="olgo-home">
    <header className="olgo-header">
      <a className="olgo-wordmark" href="/" aria-label="Oalgo AI home"><img src="/oalgo-ai-logo.png" alt="Oalgo AI" /></a>
      <span className="olgo-header-label">FINANCE OPERATIONS, MADE REVIEWABLE</span>
      <a className="olgo-header-link" href="/demo">Open demo <ArrowRight size={15} /></a>
    </header>
    <main>
      <section className="olgo-hero">
        <div className="olgo-hero-copy">
          <h1>Every invoice decision, backed by evidence.</h1>
          <p>InvoiceGuard connects invoice details to vendor history, purchase orders, and budgets. Teams see why a bill needs attention—and keep the payment decision with a person.</p>
          <div className="olgo-hero-actions">
            <a className="olgo-cta" href="/demo">Explore the demo <ArrowRight size={16} /></a>
            <span>Fake records · no automatic payments</span>
          </div>
          <div className="olgo-trust-row"><span><ShieldCheck size={15} /> Human approval stays required</span><span><Network size={15} /> Memory links stay visible</span></div>
        </div>
        <div className="olgo-product-preview">
          <div className="preview-window-top"><div className="preview-dots"><i /><i /><i /></div><span>OALGO AI / DEMO</span><span className="preview-window-status"><i /> Sample workspace</span></div>
          <div className="preview-window-body">
            <div className="preview-app-heading"><div><small>ACCOUNTS PAYABLE</small><strong>Invoice review</strong></div><span className="preview-upload">Upload invoice <ArrowRight size={13} /></span></div>
            <div className="preview-metrics">
              <div><small>Needs review</small><strong>3 <em>invoices</em></strong></div>
              <div><small>Price variance</small><strong>$86.50</strong></div>
              <div><small>Human gate</small><strong>Required</strong></div>
            </div>
            <div className="preview-lower">
              <div className="preview-table"><div className="preview-table-head"><span>VENDOR</span><span>INVOICE</span><span>STATUS</span></div><div><strong>Acme Office Supply</strong><span>AOS-11847</span><em>Review</em></div><div><strong>Campus Catering</strong><span>CC-9031</span><em>Over budget</em></div></div>
              <div className="preview-graph-card"><small>MEMORY GRAPH</small><div className="preview-graph-canvas">
                <span className="preview-edge e-one" /><span className="preview-edge e-two" /><span className="preview-edge e-three" /><span className="preview-edge e-four" />
                <span className="preview-node n-invoice">Invoice</span><span className="preview-node n-vendor">Vendor</span><span className="preview-node n-history">Past bill</span><span className="preview-node n-po">PO</span><span className="preview-node n-budget">Budget</span>
              </div><span className="preview-graph-caption">Invoice → vendor memory → policy check</span></div>
            </div>
            <div className="preview-workflow"><span className="preview-workflow-dot active" /> Invoice reader <ArrowRight size={13} /><span className="preview-workflow-dot active" /> Vendor memory <ArrowRight size={13} /><span className="preview-workflow-dot active" /> Policy review <ArrowRight size={13} /><span className="preview-workflow-dot human" /> Human approval</div>
          </div>
        </div>
      </section>
      <section className="olgo-capabilities">
        <div><span className="capability-number">01</span><h2>Evidence you can trace</h2><p>See the invoice, comparison record, and policy limit connected to each flag.</p></div>
        <div><span className="capability-number">02</span><h2>Backend in view</h2><p>Inspect the workflow roles, memory graph, connectors, and each integration’s real status.</p></div>
        <div><span className="capability-number">03</span><h2>People approve payments</h2><p>InvoiceGuard prepares the review. A human decides whether a payment should proceed.</p></div>
      </section>
    </main>
    <footer className="olgo-footer"><span>OALGO AI</span><span>InvoiceGuard · Synthetic demo workspace</span><a href="/demo">Enter demo <ArrowRight size={14} /></a></footer>
  </div>
}

export default App
