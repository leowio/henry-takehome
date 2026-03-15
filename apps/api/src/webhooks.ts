import { createHmac } from "node:crypto";

import type {
  CheckoutDisplayState,
  OrderStatus,
  PaymentAttemptStatus,
} from "../../../shared";
import type { PaymentAttemptRecord } from "./db";
import {
  getOrderBundle,
  getOrderByProviderCustomerId,
  getPaymentAttemptByProviderConfirmationId,
  getPaymentAttemptByProviderRequestId,
} from "./db";
import { mapCheckoutConfirmResponse } from "./payment";

export const WEBHOOK_EVENTS = [
  "checkout.confirm",
  "checkout.confirm.success",
  "checkout.confirm.failure",
] as const;

export type PaymentWebhookEvent = {
  uid: string;
  type: (typeof WEBHOOK_EVENTS)[number];
  createdAt: number;
  data: any;
};

export type ReconciledWebhook = {
  orderId: string;
  attemptId: string;
  displayStatus: CheckoutDisplayState;
  orderStatus: OrderStatus;
  paymentStatus: PaymentAttemptStatus;
  message: string;
  retryEligible: boolean;
  providerConfirmationId?: string;
  providerRequestId?: string;
  failureCode?: string;
  failureMessage?: string;
  providerPayload: string;
};

export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return signature === expected;
}

export function resolveWebhookAttempt(event: PaymentWebhookEvent): {
  orderId: string;
  attempt: PaymentAttemptRecord;
} | null {
  const confirmationId = event.data?.data?.confirmationId;
  if (typeof confirmationId === "string" && confirmationId) {
    const attempt = getPaymentAttemptByProviderConfirmationId(confirmationId);
    if (attempt) {
      return { orderId: attempt.orderId, attempt };
    }
  }

  const providerRequestId = event.data?._reqId;
  if (typeof providerRequestId === "string" && providerRequestId) {
    const attempt = getPaymentAttemptByProviderRequestId(providerRequestId);
    if (attempt) {
      return { orderId: attempt.orderId, attempt };
    }
  }

  const providerCustomerId = event.data?.data?.customerId;
  if (typeof providerCustomerId === "string" && providerCustomerId) {
    const bundle = getOrderByProviderCustomerId(providerCustomerId);
    if (bundle?.latestAttempt) {
      return { orderId: bundle.order.id, attempt: bundle.latestAttempt };
    }
  }

  return null;
}

export function reconcileConfirmWebhook(
  event: PaymentWebhookEvent,
): ReconciledWebhook | null {
  const resolved = resolveWebhookAttempt(event);
  if (!resolved) {
    return null;
  }

  const bundle = getOrderBundle(resolved.orderId);
  if (!bundle) {
    return null;
  }

  const mapped = mapCheckoutConfirmResponse(event.data);

  return {
    orderId: bundle.order.id,
    attemptId: resolved.attempt.id,
    displayStatus: mapped.displayStatus,
    orderStatus: mapped.orderStatus,
    paymentStatus: mapped.paymentStatus,
    message: mapped.message,
    retryEligible: mapped.retryEligible,
    providerConfirmationId:
      event.data?.data?.confirmationId ??
      resolved.attempt.providerConfirmationId ??
      undefined,
    providerRequestId:
      event.data?._reqId ?? resolved.attempt.providerRequestId ?? undefined,
    failureCode: mapped.failureCode,
    failureMessage: mapped.failureMessage,
    providerPayload: JSON.stringify(event),
  };
}
