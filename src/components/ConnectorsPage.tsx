import { EmailInbox } from './EmailInbox'
import type { ParsedInvoice } from '../lib/invoice-parser'
import { useEffect, useState } from 'react'
import {
  BookOpen, Check, ChevronRight, Cloud, Database, HardDrive, Mail, PlugZap, Search, X,
} from 'lucide-react'

const connectors = [
  { id: 'gmail', name: 'Gmail', group: 'Email intake', icon: Mail, status: 'Setup preview', detail: 'Review invoices from a shared AP inbox. Email access has not been configured.', setup: ['Choose a shared mailbox', 'Limit access to invoice messages', 'Require a person to confirm each imported invoice'] },
  { id: 'drive', name: 'Google Drive', group: 'Document source', icon: HardDrive, status: 'Setup preview', detail: 'Bring invoice and purchase-order files into a review queue. File sync is not implemented.', setup: ['Select an approved folder', 'Read invoice and purchase-order files', 'Keep payment approvals inside your finance workflow'] },
  { id: 'quickbooks', name: 'QuickBooks', group: 'Accounting', icon: Cloud, status: 'Not connected', detail: 'Accounting sync is planned for a later version.', setup: ['Link a business account', 'Map vendors and bills', 'Review sync permissions'] },
  { id: 'xero', name: 'Xero', group: 'Accounting', icon: Cloud, status: 'Not connected', detail: 'Accounting sync is planned for a later version.', setup: ['Link a business account', 'Map vendors and bills', 'Review sync permissions'] },
  { id: 'cognee', name: 'Cognee Cloud', group: 'Business memory', icon: Database, status: 'Needs server setup', detail: 'Cognee Cloud can store workspace invoice facts as graph memory and return related records. API access is disabled until the server is configured.', setup: ['Add a Cognee Cloud API key to the server environment', 'Choose a dataset dedicated to this business', 'Enable external data only after the workspace owner approves it'] },
  { id: 'band', name: 'BAND', group: 'Agent coordination', icon: PlugZap, status: 'Dev room only', detail: 'The development agents coordinate in a separate Band room. Product workflow agents are not connected to this screen.', setup: ['Register the product workflow agents', 'Create a dedicated InvoiceGuard runtime room', 'Keep runtime credentials separate from the developer room'] },
  { id: 'superlinked', name: 'Superlinked SIE', group: 'Invoice matching', icon: Search, status: 'Optional · not connected', detail: 'Could support semantic matching of similar line items. Current reviews use deterministic matching and does not need this service.', setup: ['Define invoice and line-item fields', 'Evaluate matching against approved workspace records', 'Keep exact duplicate checks deterministic'] },
  { id: 'keenable', name: 'Keenable', group: 'Vendor research', icon: BookOpen, status: 'Adapter available · not connected', detail: 'The separate BAND runtime includes an optional web-research adapter. No search request runs from this browser app.', setup: ['Connect an API key in the server environment', 'Limit searches to flagged price changes', 'Show source links before a person acts'] },
]

export function ConnectorsPage({ onImport }: { onImport: (records: ParsedInvoice[]) => void }) {
  const [inboxOpen, setInboxOpen] = useState(false)
  const [bandConnected, setBandConnected] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cogneeStatus, setCogneeStatus] = useState<{ configured?: boolean; allowed?: boolean; reachable?: boolean; missing?: string[]; message?: string } | null>(null)
  useEffect(() => {
    let active = true
    fetch('/api/agents').then(r => r.json()).then(value => { if (active) setBandConnected(Boolean(value.connected)) }).catch(() => {})
    fetch('/api/cognee?action=status')
      .then((response) => response.json())
      .then((status) => { if (active) setCogneeStatus(status) })
      .catch(() => { if (active) setCogneeStatus({ configured: false }) })
    return () => { active = false }
  }, [])
  const activeConnectors = Number(Boolean(cogneeStatus?.configured && cogneeStatus.allowed && cogneeStatus.reachable))
  const connectorCards = connectors.map((connector) => connector.id === 'band' ? { ...connector, status: bandConnected ? 'Connected · Band' : 'Not connected', detail: 'Four runtime agents coordinate memory, policy, research, and human review in a dedicated Band room.' } : connector.id !== 'cognee' ? connector : {
    ...connector,
    status: activeConnectors ? 'Connected · Cognee Cloud' : cogneeStatus?.configured && !cogneeStatus.allowed ? 'External access off' : cogneeStatus?.configured ? 'Configured · unavailable' : 'Needs server setup',
    detail: activeConnectors
      ? 'Cognee Cloud is reachable for this workspace. Open Memory graph to inspect the configured dataset.'
      : cogneeStatus?.configured && !cogneeStatus.allowed
        ? cogneeStatus.message || 'Credentials are present, but external access is disabled for this workspace.'
        : cogneeStatus?.missing?.length
        ? 'Server setup needed: ' + cogneeStatus.missing.join(', ') + '. Invoice relationships remain available locally until configured.'
        : 'Cognee Cloud is not reachable from this environment. Invoice relationships remain available locally until the service is available.',
  })
  const selected = connectorCards.find((connector) => connector.id === selectedId)

  return <section className="connectors-page" aria-label="Connectors">
    <div className="connectors-overview">
      <div className="connectors-overview-copy">
        <h2>Your finance tools, in one review flow.</h2>
        <p>Manage connected services and configure additional sources for your review workflow.</p>
      </div>
      <div className="connector-summary">
        <div><strong>{connectors.length}</strong><span>available connectors</span></div>
        <div><strong>{activeConnectors + Number(bandConnected)}</strong><span>live connections</span></div>
        <div><strong>1</strong><span>human approval gate</span></div>
      </div>
    </div>
    <div className="connector-group-heading"><div><h2>Integrations</h2><p>Choose a service to see its setup plan.</p></div><span><PlugZap size={14} /> Connection settings</span></div>
    <div className="email-entry-banner"><div><span className="section-eyebrow">EMAIL → INVOICE → EVIDENCE</span><h3>Your next invoice is already in your inbox.</h3><p>Explore Gmail intake, inspect the extracted attachment, and import it into your review queue.</p></div><button className="primary-button" onClick={() => setInboxOpen(true)}><Mail size={16} /> Open invoice inbox</button></div>
    <div className="connector-grid">
      {connectorCards.map(({ id, name, group, icon: Icon, status, detail }) => <article className="connector-card" key={id}>
        <div className="connector-card-top">
          <span className={'connector-icon ' + id}><Icon size={20} /></span>
          <span className={'connector-status ' + (status === 'Setup preview' ? 'preview' : status === 'Dev room only' ? 'limited' : status.includes('Connected') ? 'live' : status.includes('available') ? 'adapter' : 'off')}>{status}</span>
        </div>
        <span className="connector-group">{group}</span>
        <h3>{name}</h3>
        <p>{detail}</p>
        <button type="button" className="connector-setup-button" onClick={() => id === 'gmail' ? setInboxOpen(true) : setSelectedId(id)}>{id === 'gmail' ? 'Explore inbox' : 'View setup'} <ChevronRight size={15} /></button>
      </article>)}
    </div>

    {inboxOpen && <EmailInbox onClose={() => setInboxOpen(false)} onImport={onImport} />}
    {selected && <div className="connector-modal-backdrop" role="presentation" onClick={() => setSelectedId(null)}>
      <section className="connector-modal" role="dialog" aria-modal="true" aria-labelledby="connector-modal-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="connector-modal-close" onClick={() => setSelectedId(null)} aria-label="Close setup preview"><X size={18} /></button>
        <span className={'connector-icon ' + selected.id}><selected.icon size={21} /></span>
        <span className="eyebrow">SETUP PREVIEW</span>
        <h2 id="connector-modal-title">Connect {selected.name}</h2>
        <p className="connector-modal-lede">{selected.detail}</p>
        <div className="connector-setup-list"><strong>Planned setup</strong>{selected.setup.map((step) => <div key={step}><Check size={14} /><span>{step}</span></div>)}</div>
        <div className="connector-demo-note">Preview only. This button does not request access, save credentials, or transfer data.</div>
        <button type="button" className="primary-button connector-modal-done" onClick={() => setSelectedId(null)}>Got it</button>
      </section>
    </div>}
  </section>
}
