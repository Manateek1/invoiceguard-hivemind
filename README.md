# InvoiceGuard

InvoiceGuard is a Hive Mind hackathon MVP for business finance teams. Team members can review invoices in one workspace, compare vendor history, catch duplicates and policy exceptions, and prepare a payment draft for a human approver. It never submits a payment.

## Run the demo

Requirements: Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

The app starts with synthetic invoices that show a duplicate, a budget overrun, a vendor price increase, and clean invoices. Use **Upload invoice** to try your own PDF, image, TXT, JSON, or CSV. CSV supports one invoice per row with `vendor`, `invoice_number`, and `amount` columns; `invoice_date`, `due_date`, and `po_number` are optional. Confirm or correct the extracted fields before they enter the review queue.

PDF text extraction and image OCR run in the browser. The original file is not uploaded or persisted; parsed fields stay in the current page session. Refreshing the page resets the local demo. Demo invoice data is synthetic and must not be presented as actual savings.

## Product flow

1. Read invoice fields and line items.
2. Compare them with the current business workspace's invoice history, purchase order, and budget.
3. Flag exceptions with the evidence behind each finding.
4. Add current vendor-price research when the Keenable service is configured.
5. Prepare a payment draft and leave the final decision with a human.

The multi-member product is scoped to a company workspace. Its shared memory should contain approved vendor, policy, and price history for that workspace; it should not mix data between companies. The current local demo has no authentication or remote database yet.

## Sponsor roles

- **Superlinked SIE:** small-model extraction/OCR and retrieval for invoice and line-item matching.
- **Cognee:** graph memory that ingests approved invoice/vendor facts and recalls them for later reviews.
- **Keenable:** live web evidence for vendor-price research and savings suggestions.
- **BAND:** agent coordination in the InvoiceGuard workflow, plus a separate room for the two developers' coding agents.

The local demo currently uses deterministic rules and synthetic history. Sponsor providers are not live until their runtime adapters and credentials are configured. Keep developer-room credentials separate from the app's agent credentials. Never put secrets in the repo or send them in Messages.

## Team workflow

- `main` is the shared base. Create a named feature branch; never push directly to `main` or force-push.
- Dillon owns audit logic, provider adapters, database/API, and the InvoiceGuard BAND runtime.
- Teammate owns the presentational dashboard under `src/App.tsx`, `src/index.css`, and `src/components/`.
- The teammate must wait for Dillon's **base ready** message, then branch from the latest `origin/main` as `teammate/dashboard-ui`.
- Open a pull request to `main`. If the teammate lacks write access, fork the public repo and open a PR from that fork.
- The complete copy-ready collaborator kickoff is in [`TEAMMATE_PROMPT.md`](./TEAMMATE_PROMPT.md). It keeps the developer coordination room separate from the app's runtime room.

## Safety and review

All findings are estimates backed by the visible evidence. A flagged invoice can still be drafted for manual review, but a draft never authorizes or initiates payment. Do not put real invoice files, customer data, or credentials in commits or demo screenshots.
