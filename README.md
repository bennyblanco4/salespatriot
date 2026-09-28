# PatriotBid — DIBBS solicitation browser

A real-data supplier workspace built with Next.js, React, TypeScript, Cheerio, and plain CSS. No database, account, API key, mock records, or demo mode.

## Run

Node.js 22+ is recommended.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For a production build: `npm run build` then `npm start`.

## Data flow

DIBBS → Next.js `/api/opportunities` → Cheerio → JSON → React table.

The server opens the public DIBBS notice, retains its session cookies, submits the notice form with its actual ASP.NET hidden fields, discovers available issue dates, and parses the actual daily record grid. Pagination submits DIBBS's real ASP.NET postback state. No authentication or verification challenges are bypassed.

The UI loads the latest available issue date, imports all source pages sequentially, and makes each batch searchable immediately. It reports exactly how many records are loaded; filters and counts cover loaded rows until import finishes. Select another issue date to inspect a different day. Stop and resume controls handle slow source responses. DIBBS can add records during an import, so the displayed loaded count can differ from the latest source total; sync again for a refreshed pass. Data pages and sessions are cached in bounded server memory for five minutes. Restarting clears the cache. This MVP expects a persistent Node server; serverless cold starts can reestablish the public session.

## Supplier workflow

- Search item name, formatted/compact NSN, or solicitation.
- Filter FSC, set-aside, deadline, minimum quantity, open status, and technical documents.
- Sort by deadline, item name, or quantity.
- Save RFQ identifiers locally in your browser and browse the watchlist for the selected day.
- Open a detail dialog or the original DIBBS package.
- Export the currently filtered records as CSV.

Quantity comes from DIBBS's purchase-request field. The listing does not provide units, so the UI directs the supplier to the package instead of assuming EA. Set-asides come from source icon descriptions. Unknown fields remain unknown. There are no invented contract values, eligibility decisions, or live-sync claims.

## Verification

```sh
npm test
npm run typecheck
npm run build
npx tsx tests/live-check.ts
```

The parser tests use an actual public DIBBS HTML response captured on September 28, 2026; that file is a test fixture only and is never used by the application. The optional live check confirms first, second, and final page retrieval against the current listing.

## Tradeoffs

DIBBS is a legacy external service: imports may take several minutes for thousands of records. The table remains usable during import, and failures retain already loaded rows. A five-minute cache reduces repeat traffic. A production expansion could persist daily imports in a scheduled database job, while keeping this UI and normalized record schema.

Original design reference: `code.html`. Its blue/white procurement style is implemented in `app/globals.css`; unrelated analytics, fictional account data, security claims, and fake feed metrics were removed. `code.html` is a lightweight launch page for the implemented app.
