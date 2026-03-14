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
export const db = drizzle(sqlite, { schema });

export type OrderRecord = typeof schema.orders.$inferSelect;
export type PaymentAttemptRecord = typeof schema.paymentAttempts.$inferSelect;

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

export function createOrder(params: {
  id: string;
  publicOrderId: string;
  email: string;
  status: OrderStatus;
  currency: Currency;
  subtotalCents: number;
  lastMessage: string;
  items: OrderLineItem[];
}): OrderBundle {
  const timestamp = now();

  const insertAll = sqlite.transaction(() => {
    db.insert(schema.orders)
      .values({
        id: params.id,
        publicOrderId: params.publicOrderId,
        email: params.email,
        status: params.status,
        currency: params.currency,
        subtotalCents: params.subtotalCents,
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
        })
        .run();
    }
  });

  insertAll();

  return {
    order: {
      id: params.id,
      publicOrderId: params.publicOrderId,
      email: params.email,
      status: params.status,
      currency: params.currency,
      subtotalCents: params.subtotalCents,
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
