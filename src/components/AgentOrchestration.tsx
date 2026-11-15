import { LiveAgentReview } from './LiveAgentReview'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleDashed, Database, FileText, History, LoaderCircle, Network, PlugZap, Search, ShieldCheck, UserRoundCheck, Workflow } from 'lucide-react'
import type { InvoiceAudit } from '../domain/types'
import { vendorHistory } from '../data/demo-invoices'
import { formatMoney } from '../lib/audit-engine'

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export function AgentOrchestration({ invoice }: { invoice: InvoiceAudit }) {
  const [activeStep, setActiveStep] = useState(0)
  const [cogneeStatus, setCogneeStatus] = useState<{ configured?: boolean; allowed?: boolean; reachable?: boolean; missing?: string[] } | null>(null)
  const historyCount = vendorHistory.filter((item) => normalize(item.vendor) === normalize(invoice.vendor)).length
  const priceFlags = invoice.findings.filter((finding) => finding.kind === 'overcharge').length
  const localSteps = [
    {
      name: 'Invoice reader',
      label: 'Extract',
      icon: FileText,
      source: 'Browser parser',
      result: invoice.lineItems.length + ' line item' + (invoice.lineItems.length === 1 ? '' : 's') + ' · ' + formatMoney(invoice.amount),
    },
    {
      name: 'Vendor memory',
      label: 'Recall',
      icon: History,
      source: 'Synthetic invoice history',
      result: historyCount ? historyCount + ' prior vendor invoice' + (historyCount === 1 ? '' : 's') + ' available' : 'No prior vendor invoice in this sample',
    },
    {
      name: 'Policy checker',
      label: 'Compare',
      icon: ShieldCheck,
      source: 'Deterministic rules',
      result: invoice.findings.length
        ? invoice.findings.length + ' flag' + (invoice.findings.length === 1 ? '' : 's') + (priceFlags ? ' · ' + formatMoney(invoice.potentialSavings) + ' price variance' : '')
        : 'No policy exceptions found',
    },
  ]
  const running = activeStep >= 0 && activeStep < localSteps.length
  const researchStep = invoice.agentSteps.find((step) => step.name === 'Vendor research')

  useEffect(() => {
    let active = true
    fetch('/api/cognee?action=status')
      .then((response) => response.json())
      .then((status) => { if (active) setCogneeStatus(status) })
      .catch(() => { if (active) setCogneeStatus({ configured: false }) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (activeStep < 0 || activeStep >= localSteps.length) return
    const timer = window.setTimeout(() => setActiveStep((step) => step + 1), 850)
    return () => window.clearTimeout(timer)
  }, [activeStep, localSteps.length])

  function replay() {
    setActiveStep(0)
  }

  return <><LiveAgentReview invoice={invoice} /><section className="orchestration-section" aria-label="Agent orchestration">
    <div className="orchestration-header">
      <div>
        <h2>Agent orchestration</h2>
        <p>Follow the handoffs for {invoice.invoiceNumber || 'this invoice'}.</p>
      </div>
      <div className="orchestration-controls">
        <span className="demo-run-pill"><span />Local demo · simulated</span>
        <button type="button" className="secondary-button" onClick={replay} disabled={running}>
          {running ? <><LoaderCircle size={15} className="spin-icon" /> Running sample</> : <><ArrowRight size={15} /> Replay sample run</>}
        </button>
      </div>
    </div>

    <div className="agent-pipeline">
      {localSteps.map(({ name, label, icon: Icon, source, result }, index) => {
        const isActive = running && index === activeStep
        const isDone = index < activeStep
        return <article className={'agent-card' + (isActive ? ' running' : '') + (isDone ? ' complete' : '')} key={name}>
          <div className="agent-card-top">
            <span className="agent-icon"><Icon size={18} /></span>
            <span className={'agent-state' + (isActive ? ' active' : '')}>
              {isActive ? <><LoaderCircle size={12} className="spin-icon" /> Working</>
                : isDone ? <><Check size={12} /> Complete</>
                  : <><CircleDashed size={12} /> Ready</>}
            </span>
          </div>
          <span className="agent-step-label">{label}</span>
          <h3>{name}</h3>
          <p className="agent-result">{isActive ? 'Checking invoice context…' : result}</p>
          <span className="agent-source">{source}</span>
        </article>
      })}
      <article className="agent-card connector-unavailable">
        <div className="agent-card-top">
          <span className="agent-icon"><Search size={18} /></span>
          <span className="agent-state unavailable"><CircleDashed size={12} /> Not connected</span>
        </div>
        <span className="agent-step-label">OPTIONAL RESEARCH</span>
        <h3>Vendor research</h3>
        <p className="agent-result">{researchStep?.source ?? 'Keenable connector is not configured.'}</p>
        <span className="agent-source">External price evidence · off</span>
      </article>
    </div>

    <div className="handoff-panel">
      <div className="handoff-heading"><h3>What each handoff passes</h3><span>Visible data flow</span></div>
      <div className="handoff-flow">
        <div className="handoff-step"><span>01</span><div><strong>Reader → memory</strong><p>Vendor, invoice number, date, total, and line items.</p></div></div>
        <ArrowRight size={16} className="handoff-arrow" />
        <div className="handoff-step"><span>02</span><div><strong>Memory → policy</strong><p>Prior vendor bills and matching unit prices.</p></div></div>
        <ArrowRight size={16} className="handoff-arrow" />
        <div className="handoff-step"><span>03</span><div><strong>Policy → reviewer</strong><p>Flags linked to invoice, PO, budget, or history.</p></div></div>
      </div>
    </div>

    <section className="backend-map" aria-label="Backend service status">
      <div className="backend-map-heading"><div><h3>Backend &amp; service map</h3><p>What is running locally and what still needs a provider connection.</p></div><span>Environment status</span></div>
      <div className="backend-service-grid">
        <article className="backend-service"><span className="backend-service-icon local"><FileText size={16} /></span><div><strong>Invoice intake</strong><p>Browser PDF/text parser · upload stays local</p></div><span className="service-state local">Local</span></article>
        <article className="backend-service"><span className="backend-service-icon local"><ShieldCheck size={16} /></span><div><strong>Policy engine</strong><p>Duplicate, price, PO, and budget rules</p></div><span className="service-state local">Running</span></article>
        <article className="backend-service"><span className="backend-service-icon"><Workflow size={16} /></span><div><strong>BAND runtime</strong><p>Dev room only · product agents not connected</p></div><span className="service-state muted">Separate</span></article>
        <article className="backend-service"><span className="backend-service-icon"><Database size={16} /></span><div><strong>Cognee Cloud</strong><p>{cogneeStatus?.missing?.length ? 'Missing ' + cogneeStatus.missing.join(', ') : cogneeStatus?.reachable ? 'Workspace dataset reachable' : 'Cloud graph not connected'}</p></div><span className={'service-state' + (cogneeStatus?.reachable && cogneeStatus.allowed ? ' live' : ' muted')}>{cogneeStatus?.reachable && cogneeStatus.allowed ? 'Connected' : 'Setup needed'}</span></article>
        <article className="backend-service"><span className="backend-service-icon"><Network size={16} /></span><div><strong>Superlinked SIE</strong><p>Optional retrieval · deterministic matching is active</p></div><span className="service-state muted">Optional</span></article>
        <article className="backend-service"><span className="backend-service-icon"><Search size={16} /></span><div><strong>Keenable research</strong><p>{researchStep?.source || 'Vendor research adapter is not configured'}</p></div><span className="service-state muted">Not connected</span></article>
        <article className="backend-service"><span className="backend-service-icon local"><UserRoundCheck size={16} /></span><div><strong>Payment approval</strong><p>No payment API is available in this demo</p></div><span className="service-state local">Person required</span></article>
        <article className="backend-service"><span className="backend-service-icon"><PlugZap size={16} /></span><div><strong>Web deployment</strong><p>oalgo ai /demo · Vercel preview build</p></div><span className="service-state muted">Preview</span></article>
      </div>
    </section>

    <div className="human-gate">
      <span className="human-gate-icon"><UserRoundCheck size={17} /></span>
      <div><strong>Human approval stays in control</strong><p>The workflow can prepare a payment draft. A person must review and approve it; this demo cannot send a payment.</p></div>
      <span className="approval-required">Approval required</span>
    </div>
    <p className="orchestration-disclosure">This is a local visualization of the planned workflow. It does not call remote agents, Cognee, BAND, Superlinked, or Keenable.</p>
  </section></>
}
