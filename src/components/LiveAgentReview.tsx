import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle, Network, ShieldCheck } from 'lucide-react'
import type { InvoiceAudit } from '../domain/types'
type Result = { status?: string; dataset?: string; context?: string; historyRecords?: { vendor: string; invoiceNumber: string; amount: number }[]; findings?: { title: string; detail: string }[]; note?: string; results?: { title: string; url: string }[] }
type Run = { id: string; invoiceNumber: string; status: string; report?: string; events: { role: string; at: string; result: Result }[] }
type Runtime = { connected?: boolean; error?: string; agents?: { role: string; state: string | { status: string } }[]; runs?: Run[] }
const labels: Record<string,string> = { coordinator: 'Coordinator', memory: 'Vendor memory', policy: 'Policy review', research: 'Price research' }
export function LiveAgentReview({ invoice }: { invoice: InvoiceAudit }) {
  const [runtime, setRuntime] = useState<Runtime>({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try { const response = await fetch('/api/agents'); const value = await response.json(); if (active) setRuntime(value) }
      catch { if (active) setRuntime({ error: 'Runtime unavailable' }) }
    }
    void refresh()
    const timer = window.setInterval(refresh, 2500)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  const run = runtime.runs?.find(item => item.invoiceNumber === invoice.invoiceNumber)
  const running = sending || run?.status === 'running'
  async function review() {
    setSending(true); setError('')
    try {
      const response = await fetch('/api/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invoice) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not start review')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review failed') }
    finally { setSending(false) }
  }
  const policy = run?.events.find(e => e.role === 'policy')?.result
  return <section className="live-review-panel">
    <div className="orchestration-header"><div><span className="section-eyebrow"><Network size={14} /> AGENT INTELLIGENCE</span><h2>A team behind every review.</h2><p>{runtime.connected ? 'Band specialists collaborate using your Cognee business memory.' : runtime.error || 'Connecting to your agent team…'}</p></div>
      <button className="primary-button" onClick={review} disabled={!runtime.connected || running}>{running ? <><LoaderCircle size={15} className="spin-icon" /> Reviewing invoice…</> : 'Run agent review'}</button></div>
    <div className="live-agent-roster">{runtime.agents?.map(agent => { const event = run?.events.find(e => e.role === agent.role); return <div key={agent.role}><span className={'agent-presence ' + (runtime.connected ? 'online' : '')} /><strong>{labels[agent.role]}</strong><small>{event ? 'Report received' : agent.role === 'coordinator' && run?.status === 'complete' ? 'Review complete' : running ? 'Working' : runtime.connected ? 'Ready' : 'Offline'}</small></div> })}</div>
    {error && <p role="alert">{error}</p>}
    {run && <div aria-live="polite"><div className="run-summary"><span><CheckCircle2 size={15} /> {run.status === 'complete' ? 'Review complete' : 'Review in progress'}</span><small>{run.id} · {run.events.length}/3 specialist reports</small></div>
      <div className="live-evidence-grid">{run.events.map(event => <details key={event.role} open={event.role === 'policy'}><summary>{labels[event.role]}<small>{new Date(event.at).toLocaleTimeString()}</small></summary>
        {event.role === 'memory' ? <div><p>{event.result.status === 'complete' ? `${event.result.historyRecords?.length || 0} related invoices recalled from Cognee Cloud.` : event.result.context}</p>{event.result.historyRecords?.map(record => <div className="memory-record" key={record.invoiceNumber}><strong>{record.invoiceNumber}</strong><span>{record.vendor}</span><b>${record.amount.toFixed(2)}</b></div>)}</div> : event.role === 'policy' ? <div>{event.result.findings?.length ? event.result.findings.map(finding => <div className="live-finding" key={finding.title}><strong>{finding.title}</strong><p>{finding.detail}</p></div>) : <p>No policy exceptions found in the available records.</p>}</div> : <p>{event.result.note || (event.result.status === 'not-needed' ? 'No external price research was needed.' : event.result.status === 'complete' ? 'Research complete.' : 'Research unavailable.')}</p>}
      </details>)}</div>
      {run.status === 'complete' && <div className="human-review-gate"><ShieldCheck size={20} /><div><strong>{policy?.findings?.length ? 'Exceptions ready for your review' : 'Ready for a person to review'}</strong><p>Inspect the evidence, resolve any exceptions, then prepare a payment draft. Final approval stays with you.</p></div></div>}
    </div>}
  </section>
}
