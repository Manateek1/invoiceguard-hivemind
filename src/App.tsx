import { useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownUp, Building2, ChevronRight, Clock3, FileCheck2,
  FileText, Home, Search, Upload,
} from 'lucide-react'
import { demoInvoices, vendorHistory } from './data/demo-invoices'
import type { InvoiceAudit } from './domain/types'
import { auditInvoice, formatMoney } from './lib/audit-engine'
import { parseInvoiceFile, parsedToRecord, type ParsedInvoice } from './lib/invoice-parser'
import { InvoiceDetails } from './components/InvoiceDetails'
import { InvoiceQueue } from './components/InvoiceQueue'
import { UploadInvoiceModal } from './components/UploadInvoiceModal'
import './App.css'
import './brand.css'

type Section = 'overview' | 'queue' | 'vendors' | 'activity'
const initialAudits = demoInvoices.map((invoice) => auditInvoice(invoice))

function App() {
  const [audits, setAudits] = useState<InvoiceAudit[]>(initialAudits)
  const [selectedId, setSelectedId] = useState(initialAudits[0].id)
  const [section, setSection] = useState<Section>('queue')
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
    { id: 'queue' as const, label: 'Invoice queue', icon: FileText },
    { id: 'vendors' as const, label: 'Vendors', icon: Building2 },
    { id: 'activity' as const, label: 'Activity', icon: Activity },
  ]

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="oalgo ai" onClick={(event) => event.preventDefault()}>
          <span className="brand-lockup"><img src="/oalgo-ai-logo.png" alt="" /></span>
          <img className="brand-icon" src="/favicon.png" alt="" />
        </a>
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
          <div className="memory-mark"><span className="memory-dot" />Shared vendor memory</div>
          <p>History is scoped to this business workspace. Uploaded files stay in this browser.</p>
          <a href="https://github.com/Manateek1/invoiceguard-hivemind" target="_blank" rel="noreferrer">Hackathon build <ChevronRight size={14} /></a>
        </div>
      </aside>

      <main className="main-column" id="top">
        <header className="topbar">
          <div className="breadcrumbs"><span>Finance</span><ChevronRight size={14} /><strong>{section === 'queue' ? 'Invoice queue' : section[0].toUpperCase() + section.slice(1)}</strong></div>
          <div className="topbar-right">
            <span className="demo-pill"><span />{uploadCount ? `Demo + ${uploadCount} file${uploadCount > 1 ? 's' : ''}` : 'Demo data'}</span>
            <span className="user-avatar" aria-label="oalgo ai demo workspace">oa</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>{section === 'queue' ? 'Invoice review' : section === 'overview' ? 'Overview' : section === 'vendors' ? 'Vendors' : 'Activity'}</h1>
              <p>Review invoices, spot exceptions, and prepare payment drafts for approval.</p>
            </div>
            <button className="primary-button upload-button" onClick={() => setUploadOpen(true)}><Upload size={16} /> Upload invoice</button>
          </div>

          <section className="summary-row" aria-label="Invoice summary">
            <div className="summary-item"><span className="summary-label">Needs review</span><strong>{needsReview} <small>{needsReview === 1 ? 'invoice' : 'invoices'}</small></strong></div>
            <div className="summary-item savings"><span className="summary-label">Potential savings</span><strong>{formatMoney(potentialSavings)}</strong><span className="summary-note">Price differences only</span></div>
            <div className="summary-item"><span className="summary-label">Ready to approve</span><strong>{ready} <small>{ready === 1 ? 'invoice' : 'invoices'}</small></strong></div>
          </section>

          {section === 'vendors' ? <VendorDirectory invoices={audits} onSelect={(id) => { setSelectedId(id); setSection('queue') }} />
            : section === 'activity' ? <ActivityList invoices={audits} onSelect={(id) => { setSelectedId(id); setSection('queue') }} />
              : <section className="queue-section">
                <div className="section-heading">
                  <div><h2>{section === 'overview' ? 'Recently reviewed' : 'Invoice queue'} <span className="muted-count">{filtered.length}</span></h2><p>Select an invoice to review its evidence and agent handoffs.</p></div>
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

      {selected && <InvoiceDetails invoice={selected} onPrepareDraft={() => prepareDraft(selected)} />}
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

export default App
