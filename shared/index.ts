import { z } from "zod";

export const currencySchema = z.enum(["USD", "EUR", "JPY"]);
export type Currency = z.infer<typeof currencySchema>;

export const productSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  image: z.string().url(),
  priceCents: z.number().int().positive(),
  currency: currencySchema,
});
export type Product = z.infer<typeof productSchema>;

export const cartItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(10),
});
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export const createOrderRequestSchema = z.object({
  email: z.email(),
  items: z.array(cartItemInputSchema).min(1),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const orderStatusSchema = z.enum([
  "draft",
  "payment_pending",
  "processing",
  "confirmed",
  "failed",
  "canceled",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentAttemptStatusSchema = z.enum([
  "created",
  "checkout_ready",
  "submitted",
  "processing",
  "succeeded",
  "failed",
  "fraud_rejected",
]);
export type PaymentAttemptStatus = z.infer<typeof paymentAttemptStatusSchema>;

export const checkoutDisplayStateSchema = z.enum([
  "ready",
  "processing",
  "confirmed",
  "failed",
  "fraud_rejected",
]);
export type CheckoutDisplayState = z.infer<typeof checkoutDisplayStateSchema>;

export const createOrderResponseSchema = z.object({
  orderId: z.string().uuid(),
  publicOrderId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: currencySchema,
  status: orderStatusSchema,
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

export const createCheckoutResponseSchema = z.object({
  orderId: z.string().uuid(),
  publicOrderId: z.string().min(1),
  status: checkoutDisplayStateSchema,
  checkoutId: z.string().optional(),
  paymentMethodOptions: z.array(z.string()).default([]),
  retryEligible: z.boolean(),
  message: z.string().min(1),
});
export type CreateCheckoutResponse = z.infer<
  typeof createCheckoutResponseSchema
>;

export const confirmPaymentRequestSchema = z.object({
  paymentToken: z.string().min(1),
});
export type ConfirmPaymentRequest = z.infer<typeof confirmPaymentRequestSchema>;

export const confirmPaymentResponseSchema = z.object({
  orderId: z.string().uuid(),
  publicOrderId: z.string().min(1),
  status: checkoutDisplayStateSchema,
  orderStatus: orderStatusSchema,
  message: z.string().min(1),
  retryEligible: z.boolean(),
});
export type ConfirmPaymentResponse = z.infer<
  typeof confirmPaymentResponseSchema
>;

export const orderLineItemSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1),
  image: z.string().url(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  currency: currencySchema,
});
export type OrderLineItem = z.infer<typeof orderLineItemSchema>;

export const orderStatusResponseSchema = z.object({
  orderId: z.string().uuid(),
  publicOrderId: z.string().min(1),
  email: z.email(),
  status: orderStatusSchema,
  paymentStatus: paymentAttemptStatusSchema.nullable(),
  currency: currencySchema,
  subtotalCents: z.number().int().positive(),
  message: z.string().min(1),
  retryEligible: z.boolean(),
  items: z.array(orderLineItemSchema),
  updatedAt: z.string().min(1),
});
export type OrderStatusResponse = z.infer<typeof orderStatusResponseSchema>;

export function formatMoney(amountCents: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(amountCents / (currency === "JPY" ? 1 : 100));
}

export function sumLineItems(
  items: Array<{ quantity: number; unitPriceCents: number }>,
): number {
  return items.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
}
