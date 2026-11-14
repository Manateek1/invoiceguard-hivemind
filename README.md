# Oalgo AI · InvoiceGuard

Oalgo AI is the demo shell for InvoiceGuard, a small-business accounts-payable review MVP. The landing page is `/`; the product demo is `/demo`. Review invoices against vendor history, purchase orders, and budgets, inspect the evidence graph, and prepare a payment draft for a human approver. The app never submits a payment.

## Run the demo

Requirements: Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open `http://localhost:5173/demo` for the review workspace. The Overview page shows the invoice queue, relationship graph, and visible sample workflow. **Agent activity** shows the local sample replay and backend status. These stages are labeled as simulated; this browser app is not connected to the product BAND agents.

The app starts with synthetic invoices that show a duplicate, a budget overrun, a purchase-order overrun, a vendor price increase, and clean invoices. Use **Upload invoice** to try your own PDF, image, TXT, JSON, or CSV. CSV supports one invoice per row with `vendor`, `invoice_number`, and `amount` columns; `invoice_date`, `due_date`, `po_number`, `item_description`, `quantity`, `unit`, `unit_price`, and `line_total` are optional. JSON can include a `lineItems` array with `description`, `quantity`, `unit`, and `unitPrice` for each item. Confirm or correct the vendor, invoice number, date, amount, and purchase order before adding the invoice; enter the date if extraction missed it.

PDF text extraction and image OCR run in the browser. Recognized line items are compared with earlier vendor prices; unmatched items remain visible without an invented baseline. Known purchase orders link to the demo workspace's approved totals and budgets, while unknown or mismatched orders are flagged for review. The original file is not uploaded or persisted; parsed fields stay in the current page session. Refreshing the page resets the local demo. Demo invoice data is synthetic and must not be presented as actual savings.

## Cognee Cloud memory graph

The `/api/cognee` server route supports Cognee Cloud status, dataset graph reads, sample-memory writes, and an explicit vendor-memory search. Cognee's API key stays on the server. The graph initially shown in the app is generated locally from fake data; the UI switches to a Cloud graph only after a successful Cloud response.

To try the Cloud actions locally, create a root `.env.local` file and set:

```dotenv
COGNEE_BASE_URL=https://api.cognee.ai
COGNEE_API_KEY=your-server-side-key
COGNEE_DATASET_NAME=invoiceguard-demo
ALLOW_EXTERNAL_FINANCE_DATA=true
```

Restart Vite after changing the environment. Cloud reads and writes remain disabled unless the dataset and key are present and `ALLOW_EXTERNAL_FINANCE_DATA=true`. **Use a dataset containing only synthetic demo records.** This demo has no login or workspace authorization, so do not connect a real business dataset or put real invoices in the public preview. Uploaded files are parsed locally in the browser; only the whitelisted vendor, invoice number, and line-item descriptions/units are used to build a Cognee search query after the user clicks **Recall vendor memory**.

## Product flow

1. Read invoice fields and line items.
2. Compare them with the current business workspace's invoice history, purchase order, and budget.
3. Flag exceptions with the evidence behind each finding.
4. Add current vendor-price research when the Keenable service is configured.
5. Prepare a payment draft and leave the final decision with a human.

The multi-member product is scoped to a company workspace. Its shared memory should contain approved vendor, policy, and price history for that workspace; it should not mix data between companies. The current browser demo has no authentication or remote business database. Cognee Cloud is an optional, manually enabled integration and is not preconfigured in this repository.

## Sponsor roles

- **Superlinked SIE:** small-model extraction/OCR and retrieval for invoice and line-item matching.
- **Cognee:** graph memory that ingests approved invoice/vendor facts and recalls them for later reviews.
- **Keenable:** live web evidence for vendor-price research and savings suggestions.
- **BAND:** agent coordination in the InvoiceGuard workflow, plus a separate room for the two developers' coding agents.

The local web demo uses deterministic rules and synthetic history. The separate BAND product runtime has sponsor adapters and setup instructions in [`agents/band/README.md`](./agents/band/README.md); it runs separately from this browser UI. Providers stay off until configured with approved credentials. Keep developer-room credentials separate from the product agent credentials. Never put secrets in the repo or send them in Messages.

## Team workflow

- `main` is the shared base. Create a named feature branch; never push directly to `main` or force-push.
- Dillon owns audit logic, provider adapters, database/API, and the InvoiceGuard BAND runtime.
- Teammate owns the presentational dashboard under `src/App.tsx`, `src/index.css`, and `src/components/`.
- The shared starter is ready. The teammate can branch from the latest `origin/main` as `teammate/dashboard-ui`; Dillon's runtime work is isolated under `agents/band/`.
- Open a pull request to `main`. If the teammate lacks write access, fork the public repo and open a PR from that fork.
- The complete copy-ready collaborator kickoff is in [`TEAMMATE_PROMPT.md`](./TEAMMATE_PROMPT.md). It keeps the developer coordination room separate from the app's runtime room.

## Safety and review

All findings are estimates backed by the visible evidence. A flagged invoice can still be drafted for manual review, but a draft never authorizes or initiates payment. Do not put real invoice files, customer data, or credentials in commits or demo screenshots.
