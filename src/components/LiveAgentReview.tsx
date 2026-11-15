import { useEffect, useState } from 'react'
import type { InvoiceAudit } from '../domain/types'
type Run = { id: string; invoiceNumber: string; status: string; report?: string; events: { role: string; at: string; result: unknown }[] }
type Runtime = { connected?: boolean; error?: string; agents?: { role: string; state: string | { status: string } }[]; runs?: Run[] }
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
  async function review() {
    setSending(true); setError('')
    try {
      const response = await fetch('/api/agents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invoice) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not start review')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review failed') }
    finally { setSending(false) }
  }
  const run = runtime.runs?.find(item => item.invoiceNumber === invoice.invoiceNumber)
  return <section className="live-review-panel">
    <div className="orchestration-header"><div><h2>Live agent review</h2><p>{runtime.connected ? 'Connected to the Band runtime · Cognee context is recalled during each review.' : runtime.error || 'Connecting to Band…'}</p></div>
      <button className="primary-button" onClick={review} disabled={!runtime.connected || sending}>{sending ? 'Starting…' : 'Run live review'}</button></div>
    <div className="live-agent-roster">{runtime.agents?.map(agent => <span key={agent.role}>{agent.role} · {typeof agent.state === 'string' ? agent.state : agent.state.status}</span>)}</div>
    {error && <p role="alert">{error}</p>}
    {run && <div aria-live="polite"><p><strong>{run.id}</strong> · {run.status} · {run.events.length}/3 specialist reports</p>
      {run.events.map(event => <details key={event.role}><summary>{event.role} returned evidence · {new Date(event.at).toLocaleTimeString()}</summary><pre>{JSON.stringify(event.result, null, 2)}</pre></details>)}
      {run.report && <details open><summary>Coordinator report · human approval required</summary><pre>{run.report}</pre></details>}
    </div>}
  </section>
}
