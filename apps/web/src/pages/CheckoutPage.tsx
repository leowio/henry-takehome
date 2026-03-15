import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { formatMoney, type Product } from "../../../../shared";
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
  quoteOrder,
  removeCartItem,
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
      currencies,
      nativeCurrency: currencies.length === 1 ? detailed[0]?.currency : undefined,
      nativeTotal:
        currencies.length === 1
          ? detailed.reduce(
              (sum, item) => sum + item.quantity * item.priceCents,
              0,
            )
          : undefined,
    };
  }, [cart, products]);

  const quoteQuery = useQuery({
    queryKey: ["order-quote", cart],
    queryFn: () => quoteOrder(cart),
    enabled: cart.length > 0,
    retry: false,
  });
  const quoteError = quoteQuery.error
    ? quoteQuery.error instanceof Error
      ? quoteQuery.error.message
      : "Unable to calculate a live USD estimate right now."
    : "";

  function addToCart(product: Product) {
    resetCheckoutState();
    setCart((current) => upsertCartItem(current, product.id));
  }

  function resetCheckoutState() {
    setSession(null);
    setPending(false);
    setCheckoutError("");
  }

  function updateQuantity(productId: number, quantity: number) {
    resetCheckoutState();
    setCart((current) =>
      current.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(1, Math.min(quantity || 1, 10)) }
          : item,
      ),
    );
  }

  function removeItem(productId: number) {
    resetCheckoutState();
    setCart((current) => removeCartItem(current, productId));
  }

  function dismissCheckoutOverlay() {
    setSession(null);
    setPending(false);
    setCheckoutError("");
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
      <CheckoutHero />

      {catalogError ? (
        <p className="border-l-2 border-danger pl-4 text-sm leading-6 text-danger">
          {catalogError}
        </p>
      ) : null}

      <section
        className={
          cartDetails.items.length
            ? "grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_24rem]"
            : ""
        }
      >
        <ProductCatalog products={products} onAddToCart={addToCart} />
        {cartDetails.items.length ? (
          <CartPanel
            checkoutError={checkoutError}
            currencies={cartDetails.currencies}
            email={email}
            estimatedCurrency={quoteQuery.data?.currency}
            estimatedTotal={quoteQuery.data?.totalCents}
            estimatePending={quoteQuery.isFetching}
            fxMessage={
              session
                ? `Checkout total locked in ${formatMoney(session.amountCents, session.currency)}.`
                : quoteQuery.data
                  ? "We'll convert the cart to USD at checkout using live exchange rates."
                  : quoteError
                    ? quoteError
                    : ""
            }
            items={cartDetails.items}
            nativeCurrency={cartDetails.nativeCurrency}
            nativeTotal={cartDetails.nativeTotal}
            onBeginCheckout={beginCheckout}
            onDismissPayment={dismissCheckoutOverlay}
            onEmailChange={setEmail}
            onError={setCheckoutError}
            onPaymentToken={handleToken}
            onQuantityChange={updateQuantity}
            onRemoveItem={removeItem}
            pending={pending}
            session={session}
          />
        ) : null}
      </section>
    </main>
  );
}
