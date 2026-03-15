import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, or, desc } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type {
  Currency,
  OrderLineItem,
  OrderStatus,
  PaymentAttemptStatus,
} from "../../../shared";
import * as schema from "./schema";

const databasePath = resolve(process.cwd(), "var", "virellio.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
ensureSchema();
export const db = drizzle(sqlite, { schema });

export type OrderRecord = typeof schema.orders.$inferSelect;
export type PaymentAttemptRecord = typeof schema.paymentAttempts.$inferSelect;
export type WebhookEventRecord = typeof schema.webhookEvents.$inferSelect;

export type OrderBundle = {
  order: OrderRecord;
  items: OrderLineItem[];
  latestAttempt: PaymentAttemptRecord | null;
};

function now(): string {
  return new Date().toISOString();
}

export function createPublicOrderId(): string {
  return `VIR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function hasColumn(table: string, column: string): boolean {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  return columns.some((entry) => entry.name === column);
}

function ensureColumn(table: string, column: string, definition: string): void {
  if (!hasColumn(table, column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function ensureSchema(): void {
  ensureColumn(
    "orders",
    "provider_customer_id",
    "provider_customer_id TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    "orders",
    "fx_source",
    "fx_source TEXT NOT NULL DEFAULT 'frankfurter'",
  );
  ensureColumn(
    "orders",
    "fx_updated_at",
    "fx_updated_at TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    "payment_attempts",
    "provider_request_id",
    "provider_request_id TEXT",
  );
  ensureColumn(
    "order_items",
    "settlement_unit_price_cents",
    "settlement_unit_price_cents INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    "order_items",
    "settlement_currency",
    "settlement_currency TEXT NOT NULL DEFAULT 'USD'",
  );
  ensureColumn(
    "order_items",
    "exchange_rate",
    "exchange_rate REAL NOT NULL DEFAULT 1",
  );
  ensureColumn(
    "order_items",
    "exchange_rate_fetched_at",
    "exchange_rate_fetched_at TEXT NOT NULL DEFAULT ''",
  );
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS webhook_events (
      uid TEXT PRIMARY KEY NOT NULL,
      event_type TEXT NOT NULL,
      signature TEXT,
      payload TEXT NOT NULL,
      processing_status TEXT NOT NULL,
      related_order_id TEXT,
      related_attempt_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    )`,
  );

  sqlite.exec(
    `UPDATE orders
     SET fx_updated_at = CASE
       WHEN fx_updated_at = '' THEN updated_at
       ELSE fx_updated_at
     END`,
  );
  sqlite.exec(
    `UPDATE orders
     SET provider_customer_id = replace(id, '-', '')
     WHERE provider_customer_id = ''`,
  );
  sqlite.exec(
    `UPDATE order_items
     SET settlement_unit_price_cents = unit_price_cents
     WHERE settlement_unit_price_cents = 0`,
  );
  sqlite.exec(
    `UPDATE order_items
     SET exchange_rate_fetched_at = '${now()}'
     WHERE exchange_rate_fetched_at = ''`,
  );
  sqlite.exec(
    `UPDATE order_items
     SET settlement_currency = currency
     WHERE exchange_rate = 1
       AND settlement_unit_price_cents = unit_price_cents`,
  );
}

export function createOrder(params: {
  id: string;
  publicOrderId: string;
  providerCustomerId: string;
  email: string;
  status: OrderStatus;
  currency: Currency;
  subtotalCents: number;
  fxSource: string;
  fxUpdatedAt: string;
  lastMessage: string;
  items: OrderLineItem[];
}): OrderBundle {
  const timestamp = now();

  const insertAll = sqlite.transaction(() => {
    db.insert(schema.orders)
      .values({
        id: params.id,
        publicOrderId: params.publicOrderId,
        providerCustomerId: params.providerCustomerId,
        email: params.email,
        status: params.status,
        currency: params.currency,
        subtotalCents: params.subtotalCents,
        fxSource: params.fxSource,
        fxUpdatedAt: params.fxUpdatedAt,
        lastMessage: params.lastMessage,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    for (const item of params.items) {
      db.insert(schema.orderItems)
        .values({
          id: crypto.randomUUID(),
          orderId: params.id,
          productId: item.productId,
          nameSnapshot: item.name,
          imageSnapshot: item.image,
          unitPriceCents: item.unitPriceCents,
          quantity: item.quantity,
          currency: item.currency,
          settlementUnitPriceCents: item.settlementUnitPriceCents,
          settlementCurrency: item.settlementCurrency,
          exchangeRate: item.exchangeRate,
          exchangeRateFetchedAt: item.exchangeRateFetchedAt,
        })
        .run();
    }
  });

  insertAll();

  return {
    order: {
      id: params.id,
      publicOrderId: params.publicOrderId,
      providerCustomerId: params.providerCustomerId,
      email: params.email,
      status: params.status,
      currency: params.currency,
      subtotalCents: params.subtotalCents,
      fxSource: params.fxSource,
      fxUpdatedAt: params.fxUpdatedAt,
      lastMessage: params.lastMessage,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    items: params.items,
    latestAttempt: null,
  };
}

export function createPaymentAttempt(params: {
  orderId: string;
  status: PaymentAttemptStatus;
  idempotencyKey: string;
  providerCheckoutId?: string;
  providerConfirmationId?: string;
  providerRequestId?: string;
  failureCode?: string;
  failureMessage?: string;
  providerPayload?: string;
}): PaymentAttemptRecord {
  const timestamp = now();
  const record: PaymentAttemptRecord = {
    id: crypto.randomUUID(),
    orderId: params.orderId,
    providerCheckoutId: params.providerCheckoutId ?? null,
    providerConfirmationId: params.providerConfirmationId ?? null,
    providerRequestId: params.providerRequestId ?? null,
    status: params.status,
    failureCode: params.failureCode ?? null,
    failureMessage: params.failureMessage ?? null,
    idempotencyKey: params.idempotencyKey,
    providerPayload: params.providerPayload ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.insert(schema.paymentAttempts).values(record).run();

  return record;
}

export function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  message: string,
): void {
  db.update(schema.orders)
    .set({ status, lastMessage: message, updatedAt: now() })
    .where(eq(schema.orders.id, orderId))
    .run();
}

export function updatePaymentAttempt(
  attemptId: string,
  patch: Partial<{
    providerCheckoutId: string | null;
    providerConfirmationId: string | null;
    providerRequestId: string | null;
    status: PaymentAttemptStatus;
    failureCode: string | null;
    failureMessage: string | null;
    providerPayload: string | null;
  }>,
): void {
  db.update(schema.paymentAttempts)
    .set({ ...patch, updatedAt: now() })
    .where(eq(schema.paymentAttempts.id, attemptId))
    .run();
}

export function getOrderBundle(orderReference: string): OrderBundle | null {
  const orderRow = db
    .select()
    .from(schema.orders)
    .where(
      or(
        eq(schema.orders.id, orderReference),
        eq(schema.orders.publicOrderId, orderReference),
      ),
    )
    .limit(1)
    .get();

  if (!orderRow) {
    return null;
  }

  const items = db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderRow.id))
    .all()
    .map(
      (row): OrderLineItem => ({
        productId: row.productId,
        name: row.nameSnapshot,
        image: row.imageSnapshot,
        quantity: row.quantity,
        unitPriceCents: row.unitPriceCents,
        currency: row.currency as Currency,
        settlementUnitPriceCents:
          row.settlementUnitPriceCents || row.unitPriceCents,
        settlementCurrency: (row.settlementCurrency ||
          row.currency) as Currency,
        exchangeRate: row.exchangeRate || 1,
        exchangeRateFetchedAt:
          row.exchangeRateFetchedAt ||
          orderRow.fxUpdatedAt ||
          orderRow.updatedAt,
      }),
    );

  const latestAttempt =
    db
      .select()
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.orderId, orderRow.id))
      .orderBy(desc(schema.paymentAttempts.createdAt))
      .limit(1)
      .get() ?? null;

  return { order: orderRow, items, latestAttempt };
}

export function getOrderByProviderCustomerId(
  providerCustomerId: string,
): OrderBundle | null {
  const orderRow = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.providerCustomerId, providerCustomerId))
    .limit(1)
    .get();

  return orderRow ? getOrderBundle(orderRow.id) : null;
}

export function getPaymentAttemptByProviderRequestId(
  providerRequestId: string,
): PaymentAttemptRecord | null {
  return (
    db
      .select()
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.providerRequestId, providerRequestId))
      .orderBy(desc(schema.paymentAttempts.createdAt))
      .limit(1)
      .get() ?? null
  );
}

export function getPaymentAttemptByProviderConfirmationId(
  providerConfirmationId: string,
): PaymentAttemptRecord | null {
  return (
    db
      .select()
      .from(schema.paymentAttempts)
      .where(
        eq(
          schema.paymentAttempts.providerConfirmationId,
          providerConfirmationId,
        ),
      )
      .orderBy(desc(schema.paymentAttempts.createdAt))
      .limit(1)
      .get() ?? null
  );
}

export function createWebhookEvent(params: {
  uid: string;
  eventType: string;
  signature?: string | null;
  payload: string;
  processingStatus: "received" | "processed" | "ignored" | "failed";
}): boolean {
  const result = sqlite
    .prepare(
      `INSERT OR IGNORE INTO webhook_events (
        uid,
        event_type,
        signature,
        payload,
        processing_status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.uid,
      params.eventType,
      params.signature ?? null,
      params.payload,
      params.processingStatus,
      now(),
    );

  return result.changes > 0;
}

export function updateWebhookEvent(
  uid: string,
  patch: Partial<{
    processingStatus: "received" | "processed" | "ignored" | "failed";
    relatedOrderId: string | null;
    relatedAttemptId: string | null;
    errorMessage: string | null;
    processedAt: string | null;
  }>,
): void {
  db.update(schema.webhookEvents)
    .set({
      processingStatus: patch.processingStatus,
      relatedOrderId: patch.relatedOrderId,
      relatedAttemptId: patch.relatedAttemptId,
      errorMessage: patch.errorMessage,
      processedAt: patch.processedAt,
    })
    .where(eq(schema.webhookEvents.uid, uid))
    .run();
}
