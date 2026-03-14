import "./bun-polyfill";
import "dotenv/config";

import { PaymentProcessor } from "@henrylabs-interview/payments";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import {
  confirmPaymentRequestSchema,
  createOrderRequestSchema,
  sumLineItems,
  type CartItemInput,
  type OrderLineItem,
} from "../../../shared";
import { getProductById, getProducts } from "./catalog";
import {
  createOrder,
  createPaymentAttempt,
  createPublicOrderId,
  getOrderBundle,
  updateOrderStatus,
  updatePaymentAttempt,
} from "./db";
import {
  mapCheckoutConfirmResponse,
  mapCheckoutCreateResponse,
} from "./payment";

const apiKey = process.env.API_KEY?.replaceAll('"', "").trim();

if (!apiKey) {
  throw new Error("API_KEY is required in .env");
}

const processor = new PaymentProcessor({ apiKey });

function getOrderItems(items: CartItemInput[]): {
  orderItems: OrderLineItem[];
  currency: "USD" | "EUR" | "JPY";
  subtotalCents: number;
} {
  const orderItems = items.map((item) => {
    const product = getProductById(item.productId);

    if (!product) {
      throw new Error(`Unknown product ${item.productId}`);
    }

    return {
      productId: product.id,
      name: product.name,
      image: product.image,
      quantity: item.quantity,
      unitPriceCents: product.priceCents,
      currency: product.currency,
    } satisfies OrderLineItem;
  });

  const currencies = new Set(orderItems.map((item) => item.currency));
  if (currencies.size !== 1) {
    throw new Error(
      "A checkout can only contain products with the same currency.",
    );
  }

  return {
    orderItems,
    currency: orderItems[0]!.currency,
    subtotalCents: sumLineItems(orderItems),
  };
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

export function createApp() {
  const app = new Hono();

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

  app.post("/api/orders", async (c) => {
    try {
      const payload = createOrderRequestSchema.parse(await c.req.json());
      const { orderItems, currency, subtotalCents } = getOrderItems(
        payload.items,
      );
      const orderId = crypto.randomUUID();
      const publicOrderId = createPublicOrderId();

      const bundle = createOrder({
        id: orderId,
        publicOrderId,
        email: payload.email,
        status: "draft",
        currency,
        subtotalCents,
        lastMessage:
          "Order created. Generate a secure checkout session to continue.",
        items: orderItems,
      });

      return c.json({
        orderId: bundle.order.id,
        publicOrderId: bundle.order.publicOrderId,
        amountCents: bundle.order.subtotalCents,
        currency: bundle.order.currency,
        status: bundle.order.status,
      });
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? "The order request is invalid."
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
      currency: bundle.order.currency,
      customerId: bundle.order.id.replaceAll("-", ""),
    });

    const mapped = mapCheckoutCreateResponse(providerResponse);

    updatePaymentAttempt(attempt.id, {
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

      updatePaymentAttempt(bundle.latestAttempt.id, {
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

  app.get("/api/orders/:orderReference/status", (c) => {
    const status = toStatusResponse(c.req.param("orderReference"));

    if (!status) {
      return c.json({ message: "Order not found." }, 404);
    }

    return c.json(status);
  });

  return app;
}
