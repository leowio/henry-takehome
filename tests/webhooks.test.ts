import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "vitest";

import {
  createOrder,
  createPaymentAttempt,
  createWebhookEvent,
  getOrderBundle,
  updateOrderStatus,
  updatePaymentAttempt,
} from "../apps/api/src/db";
import {
  reconcileConfirmWebhook,
  verifyWebhookSignature,
} from "../apps/api/src/webhooks";

function sign(payload: string): string {
  return createHmac("sha256", "whsec_test").update(payload).digest("hex");
}

test("rejects invalid webhook signatures", async () => {
  const payload = JSON.stringify({
    uid: "_evt_invalid_",
    type: "checkout.confirm.failure",
    createdAt: Date.now(),
    data: {
      _reqId: "req_invalid",
      status: "failure",
      substatus: "500-error",
      code: 500,
      message: "Invalid payment token",
    },
  });

  expect(verifyWebhookSignature(payload, "invalid", "whsec_test")).toBe(false);
  expect(verifyWebhookSignature(payload, sign(payload), "whsec_test")).toBe(
    true,
  );
});

test("reconciles deferred confirmations from webhooks", async () => {
  const orderId = randomUUID();
  const providerCustomerId = orderId.replaceAll("-", "");
  const publicOrderId = `VIR-${orderId.slice(0, 8).toUpperCase()}`;
  const requestId = `req_${orderId.slice(0, 8)}`;

  createOrder({
    id: orderId,
    publicOrderId,
    providerCustomerId,
    email: "payments@example.com",
    status: "processing",
    currency: "USD",
    subtotalCents: 1000,
    fxSource: "frankfurter",
    fxUpdatedAt: new Date().toISOString(),
    lastMessage: "Payment submitted to the processor.",
    items: [
      {
        productId: 1,
        name: "Noir Gold Sneaker",
        image: "https://example.com/product.jpg",
        quantity: 1,
        unitPriceCents: 1000,
        currency: "USD",
        settlementUnitPriceCents: 1000,
        settlementCurrency: "USD",
        exchangeRate: 1,
        exchangeRateFetchedAt: new Date().toISOString(),
      },
    ],
  });
  createPaymentAttempt({
    orderId,
    status: "processing",
    idempotencyKey: randomUUID(),
    providerCheckoutId: "chk_test_webhook",
    providerRequestId: requestId,
    providerPayload: JSON.stringify({
      _reqId: requestId,
      status: "success",
      substatus: "202-deferred",
      code: 202,
      message:
        "Authorizing, purchase information will likely be returned via webhook",
    }),
  });

  const event = {
    uid: `_evt_${orderId.slice(0, 8)}_`,
    type: "checkout.confirm.success",
    createdAt: Date.now(),
    data: {
      _reqId: `req_success_${orderId.slice(0, 8)}`,
      status: "success",
      substatus: "201-immediate",
      code: 201,
      message: "Approved",
      data: {
        confirmationId: `conf_${orderId.slice(0, 8)}`,
        amount: 1000,
        currency: "USD",
        customerId: providerCustomerId,
      },
    },
  } as const;
  const payload = JSON.stringify(event);

  expect(
    createWebhookEvent({
      uid: event.uid,
      eventType: event.type,
      signature: sign(payload),
      payload,
      processingStatus: "received",
    }),
  ).toBe(true);

  const reconciled = reconcileConfirmWebhook(event);

  expect(reconciled?.orderId).toBe(orderId);
  expect(reconciled?.paymentStatus).toBe("succeeded");

  updatePaymentAttempt(reconciled!.attemptId, {
    providerRequestId: reconciled!.providerRequestId ?? null,
    providerConfirmationId: reconciled!.providerConfirmationId ?? null,
    status: reconciled!.paymentStatus,
    failureCode: reconciled!.failureCode ?? null,
    failureMessage: reconciled!.failureMessage ?? null,
    providerPayload: reconciled!.providerPayload,
  });
  updateOrderStatus(orderId, reconciled!.orderStatus, reconciled!.message);

  const bundle = getOrderBundle(orderId);
  expect(bundle?.order.status).toBe("confirmed");
  expect(bundle?.latestAttempt?.status).toBe("succeeded");
  expect(bundle?.latestAttempt?.providerConfirmationId).toBe(
    `conf_${orderId.slice(0, 8)}`,
  );
  expect(bundle?.order.publicOrderId).toBe(publicOrderId);

  expect(
    createWebhookEvent({
      uid: event.uid,
      eventType: event.type,
      signature: sign(payload),
      payload,
      processingStatus: "received",
    }),
  ).toBe(false);
});
