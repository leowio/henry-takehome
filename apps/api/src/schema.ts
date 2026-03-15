import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  publicOrderId: text("public_order_id").notNull().unique(),
  providerCustomerId: text("provider_customer_id").notNull().unique(),
  email: text("email").notNull(),
  status: text("status").notNull(),
  currency: text("currency").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  fxSource: text("fx_source").notNull().default("frankfurter"),
  fxUpdatedAt: text("fx_updated_at").notNull(),
  lastMessage: text("last_message").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  productId: integer("product_id").notNull(),
  nameSnapshot: text("name_snapshot").notNull(),
  imageSnapshot: text("image_snapshot").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
  currency: text("currency").notNull(),
  settlementUnitPriceCents: integer("settlement_unit_price_cents")
    .notNull()
    .default(0),
  settlementCurrency: text("settlement_currency").notNull().default("USD"),
  exchangeRate: real("exchange_rate").notNull().default(1),
  exchangeRateFetchedAt: text("exchange_rate_fetched_at").notNull().default(""),
});

export const paymentAttempts = sqliteTable("payment_attempts", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  providerCheckoutId: text("provider_checkout_id"),
  providerConfirmationId: text("provider_confirmation_id"),
  providerRequestId: text("provider_request_id"),
  status: text("status").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  providerPayload: text("provider_payload"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  uid: text("uid").primaryKey(),
  eventType: text("event_type").notNull(),
  signature: text("signature"),
  payload: text("payload").notNull(),
  processingStatus: text("processing_status").notNull(),
  relatedOrderId: text("related_order_id"),
  relatedAttemptId: text("related_attempt_id"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  processedAt: text("processed_at"),
});
