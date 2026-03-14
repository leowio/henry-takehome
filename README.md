# Virellio Payments Assessment

This repo contains:

- a `Bun` API in [`apps/api/src/server.ts`](/home/leowio/code/henry-takehome/apps/api/src/server.ts)
- a `Vite + React` SPA in [`apps/web/src/App.tsx`](/home/leowio/code/henry-takehome/apps/web/src/App.tsx)
- shared contracts in [`shared/index.ts`](/home/leowio/code/henry-takehome/shared/index.ts)
- durable order and payment state in SQLite at `var/virellio.sqlite`

## Setup

```bash
bun install
bun run dev:api
bun run dev:web
```

The API expects `.env` with `API_KEY`. The frontend defaults to `http://127.0.0.1:3001`.

## Flow

1. Products are loaded from the seeded catalog in `apps/api/src/data/products.json`.
2. Cart updates stay local in the browser and persist to `localStorage`.
3. Checkout creates a durable order in SQLite and then requests a secure checkout session from the payment SDK.
4. Card capture uses `EmbeddedCheckout` in the browser.
5. Confirmation persists processor outcomes and exposes an order status page with retry support.

## Notes

- The first pass uses polling and stored processor responses. Full webhook-driven reconciliation is not enabled.
- The catalog mixes `USD`, `EUR`, and `JPY`, so the UI and backend restrict each checkout to a single currency.
- AI was useful for scaffolding and edge-case coverage, but the SDK surface was verified against the installed package files in `node_modules`.
