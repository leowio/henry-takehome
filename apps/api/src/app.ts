import "./bun-polyfill";
import "dotenv/config";

import { PaymentProcessor } from "@henrylabs-interview/payments";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import {
  confirmPaymentRequestSchema,
  createOrderQuoteRequestSchema,
  createOrderRequestSchema,
  type OrderStatus,
  type PaymentAttemptStatus,
} from "../../../shared";
import { getProducts } from "./catalog";
import {
  createOrder,
  createPaymentAttempt,
  createWebhookEvent,
  createPublicOrderId,
  getOrderBundle,
  updateOrderStatus,
  updatePaymentAttempt,
  updateWebhookEvent,
} from "./db";
import {
  mapPersistedPaymentState,
  mapCheckoutConfirmResponse,
  mapCheckoutCreateResponse,
} from "./payment";
import { FxUnavailableError, UnsupportedCurrencyError } from "./fx";
import { quoteCartItems } from "./quote";
import {
  reconcileConfirmWebhook,
  verifyWebhookSignature,
  WEBHOOK_EVENTS,
  type PaymentWebhookEvent,
} from "./webhooks";

const apiKey = process.env.API_KEY?.replaceAll('"', "").trim();

if (!apiKey) {
  throw new Error("API_KEY is required in .env");
}

const processor = new PaymentProcessor({ apiKey });
const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET?.trim();
const webhookBaseUrl =
  process.env.PAYMENTS_WEBHOOK_BASE_URL?.trim() ||
  `http://127.0.0.1:${process.env.PORT || 3001}`;
let webhookRegistrationPromise: Promise<void> | null = null;

function ensureWebhookRegistration() {
  if (process.env.DISABLE_PAYMENT_WEBHOOKS === "1") {
    return;
  }

  if (!webhookRegistrationPromise) {
    webhookRegistrationPromise = processor.webhooks
      .createEndpoint({
        url: `${webhookBaseUrl}/api/webhooks/payments`,
        events: [...WEBHOOK_EVENTS],
        secret: webhookSecret,
      })
      .then(() => undefined)
      .catch((error) => {
        webhookRegistrationPromise = null;
        console.error("Unable to register payment webhooks.", error);
      });
  }
}

function toStatusResponse(orderReference: string) {
  const bundle = getOrderBundle(orderReference);

  if (!bundle) {
    return null;
  }

  const latestAttempt = bundle.latestAttempt;

  return {
    orderId: bundle.order.id,
    publicOrderId: bundle.order.publicOrderId,
    email: bundle.order.email,
    status: bundle.order.status,
    paymentStatus: latestAttempt?.status ?? null,
    currency: bundle.order.currency,
    subtotalCents: bundle.order.subtotalCents,
    fxUpdatedAt: bundle.order.fxUpdatedAt,
    message:
      latestAttempt?.failureMessage ??
      bundle.order.lastMessage ??
      "Order created and awaiting payment.",
    retryEligible:
      bundle.order.status !== "confirmed" &&
      latestAttempt?.status !== "processing" &&
      latestAttempt?.status !== "submitted",
    items: bundle.items,
    updatedAt: bundle.order.updatedAt,
  };
}

function hasTerminalPaymentState(orderReference: string) {
  const bundle = getOrderBundle(orderReference);

  if (!bundle?.latestAttempt) {
    return null;
  }

  const isTerminalOrder =
    bundle.order.status === "confirmed" ||
    bundle.order.status === "failed" ||
    bundle.order.status === "canceled";
  const isTerminalAttempt =
    bundle.latestAttempt.status === "succeeded" ||
    bundle.latestAttempt.status === "failed" ||
    bundle.latestAttempt.status === "fraud_rejected";

  if (!isTerminalOrder && !isTerminalAttempt) {
    return null;
  }

  return {
    bundle,
    mapped: mapPersistedPaymentState({
      orderStatus: bundle.order.status as OrderStatus,
      paymentStatus: bundle.latestAttempt.status as PaymentAttemptStatus,
      message:
        bundle.latestAttempt.failureMessage ??
        bundle.order.lastMessage ??
        "Payment updated.",
    }),
  };
}

export function createApp() {
  const app = new Hono();
  ensureWebhookRegistration();

  app.use(
    "/api/*",
    cors({
      origin: process.env.FRONTEND_ORIGIN || "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get("/api/products", (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ products: getProducts() });
  });

  app.post("/api/orders/quote", async (c) => {
    try {
      const payload = createOrderQuoteRequestSchema.parse(await c.req.json());
      const quote = await quoteCartItems(payload.items);

      return c.json({
        currency: quote.currency,
        totalCents: quote.subtotalCents,
        quotedAt: quote.quotedAt,
        items: quote.items,
      });
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? "The quote request is invalid."
          : error instanceof UnsupportedCurrencyError ||
              error instanceof FxUnavailableError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to quote the order.";
      return c.json({ message }, 400);
    }
  });

  app.post("/api/orders", async (c) => {
    try {
      const payload = createOrderRequestSchema.parse(await c.req.json());
      const quote = await quoteCartItems(payload.items);
      const orderId = crypto.randomUUID();
      const publicOrderId = createPublicOrderId();
      const providerCustomerId = orderId.replaceAll("-", "");

      const bundle = createOrder({
        id: orderId,
        publicOrderId,
        providerCustomerId,
        email: payload.email,
        status: "draft",
        currency: quote.currency,
        subtotalCents: quote.subtotalCents,
        fxSource: "frankfurter",
        fxUpdatedAt: quote.quotedAt,
        lastMessage:
          "Order created. Generate a secure checkout session to continue.",
        items: quote.items,
      });

      return c.json({
        orderId: bundle.order.id,
        publicOrderId: bundle.order.publicOrderId,
        amountCents: bundle.order.subtotalCents,
        currency: bundle.order.currency,
        status: bundle.order.status,
        fxUpdatedAt: bundle.order.fxUpdatedAt,
      });
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? "The order request is invalid."
          : error instanceof UnsupportedCurrencyError ||
              error instanceof FxUnavailableError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unable to create order.";
      return c.json({ message }, 400);
    }
  });

  app.post("/api/orders/:orderId/checkout", async (c) => {
    const orderId = c.req.param("orderId");
    const bundle = getOrderBundle(orderId);

    if (!bundle) {
      return c.json({ message: "Order not found." }, 404);
    }

    if (
      bundle.order.status === "confirmed" ||
      bundle.order.status === "canceled"
    ) {
      return c.json(
        { message: "This order can no longer accept payment." },
        409,
      );
    }

    if (
      bundle.latestAttempt?.status === "submitted" ||
      bundle.latestAttempt?.status === "processing"
    ) {
      return c.json(
        {
          message:
            "This payment is still processing. Wait for the latest result before retrying.",
        },
        409,
      );
    }

    if (
      bundle.latestAttempt?.status === "checkout_ready" &&
      bundle.latestAttempt.providerCheckoutId
    ) {
      return c.json({
        orderId: bundle.order.id,
        publicOrderId: bundle.order.publicOrderId,
        status: "ready",
        checkoutId: bundle.latestAttempt.providerCheckoutId,
        paymentMethodOptions: [],
        retryEligible: false,
        message: "Secure card entry is ready.",
      });
    }

    const attempt = createPaymentAttempt({
      orderId: bundle.order.id,
      status: "created",
      idempotencyKey: crypto.randomUUID(),
    });

    const providerResponse = await processor.checkout.create({
      amount: bundle.order.subtotalCents,
      currency: bundle.order.currency as "USD",
      customerId: bundle.order.id.replaceAll("-", ""),
    });

    const mapped = mapCheckoutCreateResponse(providerResponse);

    updatePaymentAttempt(attempt.id, {
      providerRequestId: providerResponse._reqId ?? null,
      status: mapped.paymentStatus,
      providerCheckoutId: mapped.providerCheckoutId ?? null,
      failureCode: mapped.failureCode ?? null,
      failureMessage: mapped.failureMessage ?? null,
      providerPayload: JSON.stringify(providerResponse),
    });
    updateOrderStatus(bundle.order.id, mapped.orderStatus, mapped.message);

    return c.json({
      orderId: bundle.order.id,
      publicOrderId: bundle.order.publicOrderId,
      status: mapped.displayStatus,
      checkoutId: mapped.providerCheckoutId,
      paymentMethodOptions: mapped.paymentMethodOptions ?? [],
      retryEligible: mapped.retryEligible,
      message: mapped.message,
    });
  });

  app.post("/api/orders/:orderId/confirm", async (c) => {
    const orderId = c.req.param("orderId");
    const bundle = getOrderBundle(orderId);

    if (!bundle) {
      return c.json({ message: "Order not found." }, 404);
    }

    if (!bundle.latestAttempt?.providerCheckoutId) {
      return c.json(
        { message: "No active checkout exists for this order." },
        409,
      );
    }

    try {
      const payload = confirmPaymentRequestSchema.parse(await c.req.json());

      updatePaymentAttempt(bundle.latestAttempt.id, {
        status: "submitted",
      });
      updateOrderStatus(
        bundle.order.id,
        "processing",
        "Payment submitted to the processor.",
      );

      const providerResponse = await processor.checkout.confirm({
        checkoutId: bundle.latestAttempt.providerCheckoutId,
        type: "embedded",
        data: {
          paymentToken: payload.paymentToken,
        },
      });

      const mapped = mapCheckoutConfirmResponse(providerResponse);
      const terminalState = hasTerminalPaymentState(bundle.order.id);

      if (terminalState) {
        return c.json({
          orderId: terminalState.bundle.order.id,
          publicOrderId: terminalState.bundle.order.publicOrderId,
          status: terminalState.mapped.displayStatus,
          orderStatus: terminalState.mapped.orderStatus,
          message: terminalState.mapped.message,
          retryEligible: terminalState.mapped.retryEligible,
        });
      }

      updatePaymentAttempt(bundle.latestAttempt.id, {
        providerRequestId: providerResponse._reqId ?? null,
        status: mapped.paymentStatus,
        providerConfirmationId: mapped.confirmationId ?? null,
        failureCode: mapped.failureCode ?? null,
        failureMessage: mapped.failureMessage ?? null,
        providerPayload: JSON.stringify(providerResponse),
      });
      updateOrderStatus(bundle.order.id, mapped.orderStatus, mapped.message);

      return c.json({
        orderId: bundle.order.id,
        publicOrderId: bundle.order.publicOrderId,
        status: mapped.displayStatus,
        orderStatus: mapped.orderStatus,
        message: mapped.message,
        retryEligible: mapped.retryEligible,
      });
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof z.ZodError
              ? "The payment request is invalid."
              : "Unable to confirm payment.",
        },
        400,
      );
    }
  });

  app.post("/api/webhooks/payments", async (c) => {
    const payload = await c.req.text();
    const signature = c.req.header("x-henry-signature") ?? null;

    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      return c.json({ message: "Invalid webhook signature." }, 401);
    }

    let event: PaymentWebhookEvent;
    try {
      event = JSON.parse(payload) as PaymentWebhookEvent;
    } catch {
      return c.json({ message: "Invalid webhook payload." }, 400);
    }

    const inserted = createWebhookEvent({
      uid: event.uid,
      eventType: event.type,
      signature,
      payload,
      processingStatus: "received",
    });

    if (!inserted) {
      return c.json({ ok: true, duplicate: true });
    }

    try {
      const reconciled = reconcileConfirmWebhook(event);

      if (!reconciled) {
        updateWebhookEvent(event.uid, {
          processingStatus: "ignored",
          errorMessage: "Unable to correlate webhook to an order.",
          processedAt: new Date().toISOString(),
        });
        return c.json({ ok: true, ignored: true });
      }

      updatePaymentAttempt(reconciled.attemptId, {
        providerRequestId: reconciled.providerRequestId ?? null,
        providerConfirmationId: reconciled.providerConfirmationId ?? null,
        status: reconciled.paymentStatus,
        failureCode: reconciled.failureCode ?? null,
        failureMessage: reconciled.failureMessage ?? null,
        providerPayload: reconciled.providerPayload,
      });
      updateOrderStatus(
        reconciled.orderId,
        reconciled.orderStatus,
        reconciled.message,
      );
      updateWebhookEvent(event.uid, {
        processingStatus: "processed",
        relatedOrderId: reconciled.orderId,
        relatedAttemptId: reconciled.attemptId,
        processedAt: new Date().toISOString(),
      });

      return c.json({ ok: true });
    } catch (error) {
      updateWebhookEvent(event.uid, {
        processingStatus: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Webhook processing failed.",
        processedAt: new Date().toISOString(),
      });
      return c.json({ message: "Unable to process webhook." }, 500);
    }
  });

  app.get("/api/orders/:orderReference/status", (c) => {
    const status = toStatusResponse(c.req.param("orderReference"));

    if (!status) {
      return c.json({ message: "Order not found." }, 404);
    }

    return c.json(status);
  });

  return app;
}
