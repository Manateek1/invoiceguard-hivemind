import type { InvoiceAudit } from '../domain/types'
import { LiveAgentReview } from './LiveAgentReview'
export function AgentOrchestration({ invoice }: { invoice: InvoiceAudit }) {
  return <LiveAgentReview invoice={invoice} />
}
