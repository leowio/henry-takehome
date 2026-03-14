import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  publicOrderId: text("public_order_id").notNull().unique(),
  email: text("email").notNull(),
  status: text("status").notNull(),
  currency: text("currency").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
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
});

export const paymentAttempts = sqliteTable("payment_attempts", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  providerCheckoutId: text("provider_checkout_id"),
  providerConfirmationId: text("provider_confirmation_id"),
  status: text("status").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  providerPayload: text("provider_payload"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
