import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { type Product } from "../../../../shared";
import { CartPanel } from "../components/checkout/CartPanel";
import { CheckoutHero } from "../components/checkout/CheckoutHero";
import { ProductCatalog } from "../components/checkout/ProductCatalog";
import {
  cartAtom,
  checkoutErrorAtom,
  confirmPayment,
  createCheckout,
  createOrder,
  emailAtom,
  getProducts,
  pendingAtom,
  persistCart,
  sessionAtom,
  upsertCartItem,
} from "../lib/checkout";

export function CheckoutPage() {
  const navigate = useNavigate();
  const { data: products = [], error: productsError } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    retry: false,
  });
  const [cart, setCart] = useAtom(cartAtom);
  const [email, setEmail] = useAtom(emailAtom);
  const [checkoutError, setCheckoutError] = useAtom(checkoutErrorAtom);
  const [pending, setPending] = useAtom(pendingAtom);
  const [session, setSession] = useAtom(sessionAtom);
  const catalogError = productsError
    ? "Unable to load the catalog right now."
    : "";

  useEffect(() => {
    setEmail("");
    setCheckoutError("");
    setPending(false);
    setSession(null);

    return () => {
      setEmail("");
      setCheckoutError("");
      setPending(false);
      setSession(null);
    };
  }, [setCheckoutError, setEmail, setPending, setSession]);

  useEffect(() => {
    persistCart(cart);
  }, [cart]);

  const cartDetails = useMemo(() => {
    const detailed = cart
      .map((entry) => {
        const product = products.find((item) => item.id === entry.productId);
        return product ? { ...product, quantity: entry.quantity } : null;
      })
      .filter(Boolean) as Array<Product & { quantity: number }>;

    const currencies = [...new Set(detailed.map((item) => item.currency))];

    return {
      items: detailed,
      currency: detailed[0]?.currency,
      total: detailed.reduce(
        (sum, item) => sum + item.quantity * item.priceCents,
        0,
      ),
    };
  }, [cart, products]);

  function addToCart(product: Product) {
    setCheckoutError("");

    if (cartDetails.currency && cartDetails.currency !== product.currency) {
      setCheckoutError("Keep the cart to a single currency per checkout.");
      return;
    }

    setCart((current) => upsertCartItem(current, product.id));
  }

  function updateQuantity(productId: number, quantity: number) {
    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, Math.min(quantity || 1, 10)) }
          : item,
      ),
    );
  }

  async function beginCheckout() {
    if (!email) {
      setCheckoutError("Add an email address before starting checkout.");
      return;
    }

    if (!cart.length) {
      setCheckoutError("Add at least one item to the cart.");
      return;
    }

    setPending(true);
    setCheckoutError("");

    try {
      const order = await createOrder(email, cart);
      const checkout = await createCheckout(order.orderId);
      setSession({ ...order, checkout });
      setCheckoutError(checkout.message);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Unable to start checkout.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleToken(paymentToken: string) {
    if (!session) {
      return;
    }

    setPending(true);
    setCheckoutError("Submitting payment...");

    try {
      const result = await confirmPayment(session.orderId, paymentToken);

      if (result.status === "confirmed" || result.status === "processing") {
        setCart([]);
        persistCart([]);
        navigate(`/order/${result.publicOrderId}`);
        return;
      }

      setCheckoutError(result.message);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Unable to confirm payment.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <CheckoutHero
        currency={cartDetails.currency}
        itemCount={cartDetails.items.length}
        total={cartDetails.total}
      />

      {catalogError ? (
        <div className="rounded-3xl border border-danger/15 bg-white/90 px-5 py-4 text-sm leading-6 text-danger">
          {catalogError}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_24rem]">
        <ProductCatalog products={products} onAddToCart={addToCart} />
        <CartPanel
          checkoutError={checkoutError}
          currency={cartDetails.currency}
          email={email}
          items={cartDetails.items}
          onBeginCheckout={beginCheckout}
          onEmailChange={setEmail}
          onError={setCheckoutError}
          onPaymentToken={handleToken}
          onQuantityChange={updateQuantity}
          pending={pending}
          session={session}
          total={cartDetails.total}
        />
      </section>
    </main>
  );
}
