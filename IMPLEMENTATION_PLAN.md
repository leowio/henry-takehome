# Virellio Payments Assessment Plan

## Summary

Build a greenfield TypeScript app with a `Vite` SPA frontend and a `Bun` API backend, optimized for fast interaction and resilient payment handling. The UX should be a single-page guest checkout with instant cart updates, embedded card entry, durable order/payment state in `SQLite`, and explicit recovery paths for failed or delayed payment processing.

The core design principle is: keep browsing and cart interactions purely local and immediate, then make the backend authoritative only at checkout/payment boundaries. That gives the fastest perceived UX without sacrificing payment correctness.

## Implementation Changes

### 1. Architecture and stack

- Frontend: `Vite + React + TypeScript`.
- Backend: `Bun + TypeScript` HTTP API.
- Database: `SQLite` via a lightweight ORM/query layer (`Drizzle` is the practical choice).
- Payments: `@henrylabs-interview/payments` on the backend for `checkout.create()` and `checkout.confirm()`, plus optional `EmbeddedCheckout` on the frontend for card collection.
- Shared package or shared folder for:
  - product types
  - cart/order DTOs
  - status enums
  - money helpers
  - request/response schemas

### 2. Product and cart model

- Treat `products.json` as the source catalog for this assessment.
- Load products server-side at startup and expose a read-only products endpoint.
- Normalize product shape into:
  - `id`
  - `name`
  - `description`
  - `priceCents`
  - `image`
  - `currency`
  - optional `sizes` / `variants` if present in the JSON
- Keep the cart client-side only during browsing:
  - local React state or a tiny store such as Zustand
  - persist cart to `localStorage`
  - no server round-trip for add/remove/update quantity
- Recompute visible cart totals instantly on the client for responsiveness, but always recalculate authoritative totals on the backend during checkout creation.

### 3. Order and payment domain

Use durable records so delayed or failed payments can be reconciled.

Tables/entities:

- `orders`
  - `id` internal UUID
  - `publicOrderId` human-safe confirmation ID
  - `email`
  - `status`: `draft | payment_pending | processing | confirmed | failed | canceled`
  - `currency`
  - `subtotalCents`
  - `createdAt`
  - `updatedAt`
- `order_items`
  - `orderId`
  - `productId`
  - `nameSnapshot`
  - `unitPriceCents`
  - `quantity`
- `payment_attempts`
  - `id`
  - `orderId`
  - `providerCheckoutId`
  - `status`: `created | submitted | processing | succeeded | failed | fraud_rejected`
  - `failureCode`
  - `failureMessage`
  - `idempotencyKey`
  - `createdAt`
  - `updatedAt`
- `webhook_events`
  - `providerEventId` if available
  - `type`
  - `payload`
  - `processedAt`
  - unique constraint for deduplication

Status handling rules:

- `draft`: order created locally but payment session not yet initialized
- `payment_pending`: checkout created and awaiting card submission/confirmation
- `processing`: payment submitted but provider result not final yet
- `confirmed`: payment succeeded
- `failed`: terminal failure or fraud rejection
- `canceled`: optional cleanup state if user abandons after order creation

### 4. Backend API contract

Define a small, explicit API:

- `GET /api/products`
  - returns the catalog
- `POST /api/orders`
  - input: cart items, customer email
  - validates products/prices against current catalog
  - creates order + order items
  - returns `orderId`, `publicOrderId`, `amountCents`, `currency`
- `POST /api/orders/:orderId/checkout`
  - creates payment checkout with provider
  - stores `providerCheckoutId` and idempotency key
  - returns checkout payload needed by frontend embedded payment UI
- `POST /api/orders/:orderId/confirm`
  - called after embedded checkout tokenization/submission step
  - invokes `checkout.confirm()`
  - maps provider result to:
    - success -> `confirmed`
    - explicit failure/fraud -> `failed`
    - delayed/unknown -> `processing`
  - returns normalized state for UI
- `GET /api/orders/:orderId/status`
  - polling endpoint for post-submit recovery and async completion
  - returns `publicOrderId`, current status, retry eligibility, and display message
- `POST /api/webhooks/payments`
  - receives payment events
  - verifies and deduplicates events if the SDK supports that
  - updates `payment_attempts` and `orders`
  - must be idempotent

Normalized frontend-facing payment result:

- `confirmed`
- `processing`
- `failed`
- `fraud_rejected`

### 5. Checkout UX optimized for speed

Use a single checkout page with three zones:

- product grid
- cart summary
- checkout/payment panel

Interaction choices:

- add-to-cart is instant and local
- open cart summary without route change if possible
- keep checkout fields minimal: email only unless the SDK requires more
- render embedded card UI inline on the checkout page
- disable only the final pay button during submission; keep the rest of the page responsive
- show immediate status transitions:
  - `Submitting payment...`
  - `Payment processing...`
  - `Payment confirmed`
  - `Payment failed` with retry path

Important UX details for speed:

- preload the checkout route/assets from the product screen
- avoid server-backed cart syncing
- create the order only when the user clicks checkout/pay
- cache product catalog aggressively in the frontend
- use optimistic UI for cart updates, never for payment confirmation
- after `processing`, automatically poll `GET /api/orders/:orderId/status` on a short interval with backoff, while also supporting webhook-driven finalization on the backend

### 6. Reliability and failure handling

The payment system is explicitly unreliable, so the implementation should assume partial failure.

Required behaviors:

- idempotency on order creation and payment confirmation boundaries
- dedupe webhook events
- never trust client totals or product prices
- never mark success from the client alone
- persist every payment attempt before calling confirm
- if confirm returns ambiguous/in-progress, move order to `processing` rather than failing fast
- if webhook finalizes later, the confirmation page must resolve correctly on refresh
- allow retry only by creating a new payment attempt for the same open order, not a new order
- surface fraud rejection distinctly from ordinary payment failure

Operational safeguards:

- request timeout wrappers around SDK calls
- structured logs keyed by `orderId` and `providerCheckoutId`
- a narrow error mapper from provider/SDK errors to UI-safe messages
- dead-simple retry policy:
  - no blind auto-resubmit of charges
  - user-initiated retry after terminal failure
  - automatic polling only for `processing`

### 7. Confirmation and recovery flow

- On successful payment, redirect to `/order/:publicOrderId` or equivalent confirmation route.
- That page should fetch order status from the backend and display:
  - order confirmation ID
  - final payment state
  - purchased items
- If the user lands there while payment is still `processing`, keep polling until terminal status or timeout.
- If the browser refreshes mid-payment, the order page remains recoverable because state is in SQLite.

### 8. Security and secrets

- Keep the Henry Labs API key backend-only in environment configuration.
- Do not embed secret keys in frontend bundles.
- Use the frontend embedded SDK only for card capture, never direct payment confirmation with secrets.
- Validate request bodies with runtime schemas (`zod` or equivalent).
- Sanitize error responses so raw provider details are not exposed to users.

### 9. Submission and assessment polish

Include:

- concise README with architecture, setup, env vars, and tradeoffs
- explicit note on how AI was used:
  - helpful for scaffolding, type shaping, and edge-case brainstorming
  - potentially misleading around unverified SDK details, which were validated by direct testing/docs
- demo-focused seed/start command
- sample `.env.example`

## Public Interfaces and Types

Define these shared types up front so the frontend and backend stay aligned:

- `Product`
- `CartItemInput`
- `CreateOrderRequest`
- `CreateOrderResponse`
- `CreateCheckoutResponse`
- `ConfirmPaymentResponse`
- `OrderStatusResponse`
- `OrderStatus`
- `PaymentAttemptStatus`

Status enums to standardize everywhere:

- `OrderStatus = draft | payment_pending | processing | confirmed | failed | canceled`
- `PaymentAttemptStatus = created | submitted | processing | succeeded | failed | fraud_rejected`

## Test Plan

### Backend

- creates orders from valid cart input and recalculates totals from catalog
- rejects invalid product IDs / invalid quantities
- creates a payment attempt and stores provider checkout ID
- maps provider success to `confirmed`
- maps explicit failure to `failed`
- maps fraud result to `failed` or `fraud_rejected` display state as designed
- maps slow/async result to `processing`
- webhook processing is idempotent
- status endpoint returns correct state after refresh/retry scenarios
- retry after failed payment reuses order and creates a new payment attempt

### Frontend

- cart updates instantly with no network dependency
- cart persists through refresh
- checkout button disabled only during submission
- processing state polls and transitions to final confirmation
- failure state shows retry without losing cart/order context
- confirmation page recovers from refresh and displays `publicOrderId`

### End-to-end scenarios

- happy path: add item -> pay -> see confirmation ID
- card/payment failure -> retry succeeds
- fraud rejection -> terminal user-friendly rejection
- provider delay -> UI enters processing -> webhook/polling resolves to confirmed
- refresh browser during processing -> final status still resolves
- duplicate webhook delivery does not duplicate confirmation or corrupt state

## Assumptions and Defaults

- No existing repo/starter is being reused; this plan is for a new implementation.
- `products.json` is static and small enough to load directly from the backend at startup.
- Guest checkout only; no auth/accounts.
- Inventory, shipping, tax, promo codes, and fulfillment stay out of scope.
- SQLite is sufficient for assessment durability and local demo reliability.
- The frontend should use a single-page checkout because you prioritized interaction speed over extra review friction.
- If the SDK’s exact response fields differ from expectation, adapt only the provider adapter layer; keep the app’s normalized internal statuses unchanged.
