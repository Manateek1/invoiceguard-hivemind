# Teammate kickoff prompt

Copy this to your teammate after Dillon says **base ready**:

```text
We’re building InvoiceGuard for the Hive Mind hackathon: a B2B invoice review app for a club or small business. People in one business workspace add invoices; the app checks for duplicate bills, purchase-order or budget mismatches, and price changes against workspace history. It suggests human-reviewed ways to ask vendors about price increases and can prepare a payment draft. It must never send a payment or contact a vendor automatically.

Repository: https://github.com/Manateek1/invoiceguard-hivemind
Stack: React + TypeScript + Vite. `npm install && npm run dev` starts the local demo. The demo uses synthetic invoices and browser-only file parsing; sponsor services are not connected until credentials are configured.

Sponsor plan, each for a useful job:
- BAND coordinates agents in the running InvoiceGuard workflow. We also use a separate BAND room to coordinate our coding agents.
- Cognee ingests approved business invoice/vendor facts into a workspace-scoped graph and recalls related history.
- Superlinked SIE handles small-model extraction and retrieval where it improves invoice parsing or vendor matching.
- Keenable researches current vendor prices when a historical comparison needs outside evidence.

Your task is the light UI lane: improve the demo dashboard’s clarity, mobile layout, empty/error states, and demo usability. Keep it grounded in the existing invoice data and types. Do not build audit logic, provider calls, database/auth, or payment behavior.

Wait for Dillon’s **base ready** message before editing. Then:
1. Fetch `origin/main` and create your own branch named `teammate/dashboard-ui` from the latest main.
2. Limit changes to `src/App.tsx`, `src/App.css`, `src/index.css`, and files under `src/components/`. Don’t edit `src/domain/`, `src/data/`, `src/lib/`, `api/`, `agents/`, `supabase/`, `package.json`, or the lockfile.
3. Don’t commit to main, force-push, overwrite someone else’s branch, or discard unrelated changes. Commit and push only your branch, then open a PR to main. If you lack write access, use a fork and PR.
4. Keep every visible button useful, the interface keyboard-friendly, and the layout usable on laptop and phone. Use synthetic data only.

Use a dedicated BAND room called “InvoiceGuard Dev” for coding-agent questions and short progress updates. Add both coding agents there, mention the agent you need, and include branch/commit/file context in each request. Keep this separate from an “InvoiceGuard Runtime” room for the product’s finance agents. Never put API keys, `.env` contents, real invoices, customer data, or payment information in either room.

If an existing type or boundary blocks your UI work, post the exact question in the dev room and wait rather than editing the restricted files. Finish with a short summary, branch/PR link, and build result.
```
