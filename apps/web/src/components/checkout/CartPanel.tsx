import { formatMoney, type Product } from "../../../../../shared";

import type { OrderSession } from "../../lib/checkout";
import { Badge } from "@/components/selia/badge";
import { Button } from "@/components/selia/button";
import { CardDescription, CardTitle } from "@/components/selia/card";
import { Input } from "@/components/selia/input";
import { EmbeddedCardPanel } from "../EmbeddedCardPanel";
import { SectionKicker } from "../ui/section-kicker";

type CartDetailItem = Product & { quantity: number };

type CartPanelProps = {
  items: CartDetailItem[];
  currencies: Product["currency"][];
  nativeCurrency?: Product["currency"];
  nativeTotal?: number;
  estimatedCurrency?: "USD";
  estimatedTotal?: number;
  estimatePending: boolean;
  fxMessage: string;
  email: string;
  pending: boolean;
  checkoutError: string;
  session: OrderSession | null;
  onEmailChange: (email: string) => void;
  onQuantityChange: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  onBeginCheckout: () => void;
  onPaymentToken: (paymentToken: string) => void;
  onDismissPayment: () => void;
  onError: (message: string) => void;
};

function TrashBinIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.5 3.5h5a1 1 0 0 1 .94.66L16 6H8l.56-1.84a1 1 0 0 1 .94-.66Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7 7l.62 10.52A2 2 0 0 0 9.61 19.4h4.78a2 2 0 0 0 1.99-1.88L17 7"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10 10.5v5M14 10.5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CartPanel({
  items,
  currencies,
  nativeCurrency,
  nativeTotal,
  estimatedCurrency,
  estimatedTotal,
  estimatePending,
  fxMessage,
  email,
  pending,
  checkoutError,
  session,
  onEmailChange,
  onQuantityChange,
  onRemoveItem,
  onBeginCheckout,
  onPaymentToken,
  onDismissPayment,
  onError,
}: CartPanelProps) {
  const totalLabel = session
    ? "Checkout total"
    : estimatedCurrency && typeof estimatedTotal === "number"
      ? "Estimated USD total"
      : nativeCurrency && typeof nativeTotal === "number"
        ? "Cart total"
        : "Total";
  const totalValue = session
    ? formatMoney(session.amountCents, session.currency)
    : estimatedCurrency && typeof estimatedTotal === "number"
      ? formatMoney(estimatedTotal, estimatedCurrency)
      : nativeCurrency && typeof nativeTotal === "number"
        ? formatMoney(nativeTotal, nativeCurrency)
        : estimatePending
          ? "Loading..."
          : "Unavailable";

  return (
    <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
      <div>
        <div className="space-y-3 border-b border-border/60 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <SectionKicker>Checkout</SectionKicker>
              <CardTitle>
                {items.length} {items.length === 1 ? "item" : "items"} ready
              </CardTitle>
            </div>
            <Badge pill variant="primary">
              {currencies.length > 1 ? "Mixed currencies" : "Active cart"}
            </Badge>
          </div>
          <CardDescription>
            The bag stays local until checkout starts. Mixed-currency carts are
            converted to USD using live rates on the server.
          </CardDescription>
        </div>

        <div className="space-y-6 py-6">
          <div className="space-y-0">
            {items.map((item) => (
              <div
                key={item.id}
                className="border-b border-border/40 py-4 first:pt-0 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted">
                      {formatMoney(item.priceCents, item.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-24 text-center"
                      disabled={pending}
                      max={10}
                      min={1}
                      type="number"
                      value={item.quantity}
                      onChange={(event) =>
                        onQuantityChange(item.id, Number(event.target.value))
                      }
                    />
                    <Button
                      aria-label={`Remove ${item.name} from cart`}
                      size="icon"
                      variant="plain"
                      disabled={pending}
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <TrashBinIcon />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Email receipt
            </span>
            <Input
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </label>

          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm uppercase tracking-[0.18em] text-muted">
                {totalLabel}
              </span>
              <strong className="text-xl text-foreground">{totalValue}</strong>
            </div>
            {fxMessage ? (
              <p className="mt-3 text-sm leading-6 text-muted">{fxMessage}</p>
            ) : null}
          </div>

          {checkoutError ? (
            <p className="border-l-2 border-primary pl-4 text-sm leading-6 text-primary">
              {checkoutError}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-border/60 pt-6">
          <Button block size="lg" disabled={pending} onClick={onBeginCheckout}>
            {pending ? "Starting checkout..." : "Start secure checkout"}
          </Button>
          <p className="text-xs leading-5 text-muted">
            Card data remains in the hosted form. The app only receives a token.
          </p>
        </div>
      </div>

      {session?.checkout?.checkoutId ? (
        <EmbeddedCardPanel
          checkoutId={session.checkout.checkoutId}
          disabled={pending}
          onDismiss={onDismissPayment}
          onToken={onPaymentToken}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
