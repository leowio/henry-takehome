# Virellio Payments Assessment

This repository implements a small end-to-end checkout system for a fictional
storefront called Virellio. It combines a React single-page application with a
TypeScript API that creates durable orders, prices mixed-currency carts in USD,
starts secure embedded checkout sessions through the Henry Labs payment SDK, and
reconciles final payment outcomes through synchronous responses and webhooks.

The project is structured as a compact monorepo:

- `apps/api` contains the Hono-based HTTP API, payment orchestration, FX
  conversion logic, and SQLite persistence.
- `apps/web` contains the Vite + React client for browsing products, managing a
  cart, and completing embedded card checkout.
- `shared` contains the Zod schemas and TypeScript types shared by the client
  and server.
- `tests` contains Vitest coverage for quote calculation, payment-response
  mapping, catalog behavior, and webhook reconciliation.

## Project Goals

The implementation is designed around a few concrete requirements:

- present a seeded product catalog with items priced in multiple currencies
- maintain a local shopping cart with quantity controls and email capture
- convert the cart into a single USD settlement amount before payment
- create durable order and payment-attempt records before calling the processor
- support embedded card capture without redirecting away from the storefront
- handle both immediate and deferred payment outcomes safely
- preserve enough state to resume status checks and retry eligible failures

## Architecture

### Frontend

The client entry point is [`apps/web/src/App.tsx`](/home/leowio/code/henry-takehome/apps/web/src/App.tsx).
It exposes two routes:

- `/` renders the checkout experience in
  [`apps/web/src/pages/CheckoutPage.tsx`](/home/leowio/code/henry-takehome/apps/web/src/pages/CheckoutPage.tsx)
- `/order/:publicOrderId` renders the order status and retry flow in
  [`apps/web/src/pages/OrderPage.tsx`](/home/leowio/code/henry-takehome/apps/web/src/pages/OrderPage.tsx)

State on the client is intentionally split by responsibility:

- TanStack Query handles server reads such as catalog loading, quote refreshes,
  and order status polling.
- Jotai atoms manage cart, email, checkout session, and retry UI state.
- `localStorage` persists the cart so a page refresh does not discard selections.

The checkout page lets a shopper:

- browse the seeded product catalog
- add or remove items and adjust quantities
- see a live USD quote for mixed-currency carts
- create an order and embedded checkout session
- submit a payment token and transition to the order-status page

The order page reads the durable order record back from the API, polls while a
payment is still processing, and can start a new checkout attempt when the
server marks the current state as retryable.

### Backend

The API is created in [`apps/api/src/app.ts`](/home/leowio/code/henry-takehome/apps/api/src/app.ts)
and served from [`apps/api/src/server.ts`](/home/leowio/code/henry-takehome/apps/api/src/server.ts).
It uses:

- `hono` for routing and HTTP responses
- `@henrylabs-interview/payments` for checkout creation, confirmation, and
  webhook endpoint registration
- `drizzle-orm` with `better-sqlite3` for persistence
- `zod` for validating every shared request and response shape

The API exposes the following endpoints:

- `GET /api/products` returns the seeded catalog from
  [`apps/api/src/data/products.json`](/home/leowio/code/henry-takehome/apps/api/src/data/products.json)
- `POST /api/orders/quote` validates cart items and returns a live USD quote
- `POST /api/orders` creates a durable draft order and snapshots priced line
  items
- `POST /api/orders/:orderId/checkout` creates or reuses a payment attempt and
  starts embedded checkout with the processor
- `POST /api/orders/:orderId/confirm` submits the client payment token and maps
  the processor response into application state
- `POST /api/webhooks/payments` verifies signatures, deduplicates incoming
  events, and reconciles deferred payment results
- `GET /api/orders/:orderReference/status` returns the latest durable order and
  payment-attempt status using either the internal order id or public order id

## Order And Payment Lifecycle

The full flow through the system is:

1. The frontend loads products from the API and stores cart selections locally.
2. When the cart changes, the client can request a live order quote in USD.
3. Starting checkout creates a durable order in SQLite before any processor call
   is made.
4. The server records a payment attempt, then requests an embedded checkout
   session from the Henry Labs payment processor.
5. The browser collects payment details through the embedded checkout component
   and sends the resulting token back to the API.
6. The API confirms the checkout, updates the order and payment-attempt records,
   and returns either a terminal result or a processing state.
7. If the processor finishes asynchronously, a signed webhook updates the same
   durable records and the frontend observes the new state via polling.

This split between immediate confirmation and webhook reconciliation avoids
trusting a single network response as the source of truth. The database remains
authoritative for retries, status display, and eventual consistency.

## Currency And Pricing Model

The seeded catalog deliberately mixes `USD`, `EUR`, and `JPY`. Checkout is
always settled in `USD`, so the server performs conversion during quote and
order creation using the FX utilities in
[`apps/api/src/fx.ts`](/home/leowio/code/henry-takehome/apps/api/src/fx.ts)
and the quote pipeline in
[`apps/api/src/quote.ts`](/home/leowio/code/henry-takehome/apps/api/src/quote.ts).

Each stored order item captures:

- the original product id and quantity
- a snapshot of the name and image
- the original unit price and source currency
- the converted settlement unit price in USD
- the exchange rate used and when that rate was fetched

That snapshotting means later catalog changes do not rewrite historical orders.

## Persistence Model

SQLite data is stored in `var/virellio.sqlite`. The schema is defined in
[`apps/api/src/schema.ts`](/home/leowio/code/henry-takehome/apps/api/src/schema.ts)
and centers on four tables:

- `orders` stores the durable order record, shopper email, settlement total,
  status, and status message
- `order_items` stores immutable snapshots of each purchased line item
- `payment_attempts` stores each checkout attempt plus provider ids, failure
  codes, and raw payloads
- `webhook_events` stores received processor events for deduplication and audit

This model supports retries without losing history and makes payment state
reconstruction possible even if the user leaves the page midway through checkout.

## Shared Contracts

All public request and response contracts live in
[`shared/index.ts`](/home/leowio/code/henry-takehome/shared/index.ts). The same
Zod schemas are used to:

- validate server input
- type frontend API helpers
- define order, quote, checkout, and status payloads
- keep currency, payment-state, and formatting rules consistent across both apps

This avoids the common drift where the client and server silently disagree about
payload shape or enum values.

## Local Development

### Prerequisites

- Node.js capable of running the current Vite and TypeScript toolchain
- a package manager such as `pnpm`, `npm`, or `bun`
- a valid Henry Labs `API_KEY`

### Environment

Create `.env` from `.env.example` and set at minimum:

```bash
API_KEY="replace-with-your-henry-labs-key"
PORT=3001
VITE_API_BASE_URL="http://127.0.0.1:3001"
```

Optional payment webhook settings supported by the API:

- `PAYMENTS_WEBHOOK_SECRET` to verify incoming webhook signatures
- `PAYMENTS_WEBHOOK_BASE_URL` to override the base URL used when registering the
  payment webhook endpoint
- `DISABLE_PAYMENT_WEBHOOKS=1` to skip automatic webhook registration in local
  development
- `FRONTEND_ORIGIN` to tighten CORS instead of allowing `*`

### Install And Run

```bash
pnpm install
pnpm dev:api
pnpm dev:web
```

If you use another package manager, run the same scripts through that tool.

The API listens on `http://127.0.0.1:3001` by default. The Vite app will connect
to that address unless `VITE_API_BASE_URL` is overridden.

## Quality Checks

The repository includes a small but focused test suite. Useful commands:

```bash
pnpm test
pnpm lint
```

The current tests cover:

- mixed-currency quote calculation and FX failure handling
- mapping processor checkout responses into application states
- webhook reconciliation behavior
- catalog-related behavior

## Notable Implementation Details

- Orders are created before payment sessions so every checkout attempt has a
  durable internal record.
- Payment retries are guarded by current order and attempt state to avoid
  duplicate in-flight confirmations.
- The API can return an already-created checkout session if an order has a valid
  reusable attempt.
- The order status endpoint returns the latest persisted view of the order,
  which keeps the frontend thin and stateless.
- Public order ids are separate from internal UUIDs so order-status URLs do not
  expose the raw primary key.
