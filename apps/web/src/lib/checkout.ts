import { atomWithStorage } from "jotai/utils";

import {
  type CartItemInput,
  type ConfirmPaymentResponse,
  type CreateCheckoutResponse,
  type CreateOrderResponse,
  type OrderQuoteResponse,
  type OrderStatusResponse,
  type Product,
} from "../../../../shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3001";
const CART_KEY = "virellio-cart";

export type CartState = Array<CartItemInput>;
export type OrderSession = CreateOrderResponse & {
  checkout?: CreateCheckoutResponse;
};

export const cartAtom = atomWithStorage<CartState>(CART_KEY, []);

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/api/products`);
  const payload = await response.json();
  return payload.products;
}

export async function createOrder(
  email: string,
  items: CartState,
): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, items }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Failed to create order.");
  }

  return payload;
}

export async function quoteOrder(
  items: CartState,
): Promise<OrderQuoteResponse> {
  const response = await fetch(`${API_BASE}/api/orders/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Failed to quote order.");
  }

  return payload;
}

export async function createCheckout(
  orderId: string,
): Promise<CreateCheckoutResponse> {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/checkout`, {
    method: "POST",
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Failed to create checkout.");
  }

  return payload;
}

export async function confirmPayment(
  orderId: string,
  paymentToken: string,
): Promise<ConfirmPaymentResponse> {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentToken }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Failed to confirm payment.");
  }

  return payload;
}

export async function fetchOrderStatus(
  orderReference: string,
): Promise<OrderStatusResponse> {
  const response = await fetch(
    `${API_BASE}/api/orders/${orderReference}/status`,
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Failed to fetch order status.");
  }

  return payload;
}

export function upsertCartItem(cart: CartState, productId: number): CartState {
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    return cart.map((item) =>
      item.productId === productId
        ? { ...item, quantity: Math.min(item.quantity + 1, 10) }
        : item,
    );
  }

  return [...cart, { productId, quantity: 1 }];
}

export function removeCartItem(cart: CartState, productId: number): CartState {
  return cart.filter((item) => item.productId !== productId);
}
