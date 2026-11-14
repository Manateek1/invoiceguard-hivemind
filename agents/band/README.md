# InvoiceGuard BAND runtime

This is the product's runtime agent team. The web demo remains usable without it. Start this process after registering four remote agents with BAND; they coordinate in a dedicated **InvoiceGuard Runtime** room.

## Agent flow

1. **InvoiceGuard** receives a structured invoice request. If it is raw invoice text, it can ask Superlinked SIE to extract fields into JSON and requests human confirmation before analysis.
2. **Invoice Memory** searches the business workspace's Cognee dataset for related vendor and item history, then hands matching invoice records to the other specialists.
3. **Invoice Policy** checks duplicate references, PO and budget limits, and historical unit prices with deterministic rules. Matching Cognee invoices become duplicate-check history and the latest matching item price becomes a comparison reference when the current invoice has none.
4. **Invoice Research** asks Keenable for a small set of current public price references only when price changes need outside evidence.
5. The coordinator combines reports and suggests a human-reviewed next step. It never initiates or submits a payment.

The default path uses no hosted language model: the policy and savings calculations are deterministic. SIE uses the configurable `Qwen/Qwen3-0.6B` model only for unstructured extraction. Cognee uses `CHUNKS` retrieval rather than an LLM answer mode. Keenable requests are capped at three results.

## Connect the four agents

1. In BAND, create remote agents named **InvoiceGuard**, **Invoice Policy**, **Invoice Memory**, and **Invoice Research**. Set their handles to `invoiceguard`, `invoicepolicy`, `invoicememory`, and `invoiceresearch`.
2. Copy `agent_config.yaml.example` to `agent_config.yaml` and replace every placeholder with the matching BAND agent ID and API key. Keep the file local; it is ignored by Git.
3. Copy `.env.example` to `.env`. Set the provider URLs/keys you intend to use. Set `ALLOW_EXTERNAL_FINANCE_DATA=true` only after the business has approved sending invoice fields to the configured services. For a real business, configure a Cognee dataset dedicated to that company's workspace.
4. Add all four agents to a new BAND room named **InvoiceGuard Runtime**.
5. Run `npm install` once, then `npm start` from this directory. Keep this process running.

Mention **InvoiceGuard** with an invoice JSON object. Example:

```text
@invoiceguard {"vendor":"Acme Office Supply","invoiceNumber":"AOS-11847","amount":428.5,"purchaseOrder":"PO-1058","purchaseOrderTotal":450,"budgetName":"Office supplies","budgetLimit":500,"lineItems":[{"description":"Copy paper (case)","quantity":2,"unit":"case","billedUnitPrice":67.5,"expectedUnitPrice":54}]}
```

For an unstructured text invoice, mention the coordinator with the text. If SIE is configured and external finance data is enabled, the coordinator returns an extraction preview; reply `@invoiceguard confirm <id>` to send it through the review agents.

To explicitly add an approved invoice summary to Cognee memory, mention **Invoice Memory** with `remember approved invoice` followed by the JSON. This writes only that summary to the configured Cognee dataset. Normal reviews only read the graph.

## Development agents

Use a separate BAND room named **InvoiceGuard Dev** for Dillon and the teammate's coding agents. Add the two coding agents, mention the one being asked, and include the branch/commit/file boundary. Keep real invoices, API keys, `.env` values, and payment details out of this room. The developer room and product runtime room have different participants and purposes.

## Current boundaries

- The current web client stores uploaded invoice fields in browser memory. It does not call the BAND runtime or persist company workspaces across users yet.
- This runtime accepts review requests in the dedicated BAND room. Connecting the web client directly to this agent team needs an authenticated server bridge and workspace membership checks.
- Configure a separate Cognee dataset per business. This hackathon runtime does not provide SaaS tenant authentication or automatic dataset provisioning.
- Vendor-price search returns public references, not proof that the vendor's quoted price is incorrect. Humans review any savings estimate.
