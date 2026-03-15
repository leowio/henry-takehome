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
  currency?: Product["currency"];
  total: number;
  email: string;
  pending: boolean;
  checkoutError: string;
  session: OrderSession | null;
  onEmailChange: (email: string) => void;
  onQuantityChange: (productId: number, quantity: number) => void;
  onBeginCheckout: () => void;
  onPaymentToken: (paymentToken: string) => void;
  onError: (message: string) => void;
};

export function CartPanel({
  items,
  currency,
  total,
  email,
  pending,
  checkoutError,
  session,
  onEmailChange,
  onQuantityChange,
  onBeginCheckout,
  onPaymentToken,
  onError,
}: CartPanelProps) {
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
              Active cart
            </Badge>
          </div>
          <CardDescription>
            The bag stays local until the order and checkout session are
            created.
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
                  <Input
                    className="w-24 text-center"
                    max={10}
                    min={1}
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      onQuantityChange(item.id, Number(event.target.value))
                    }
                  />
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
                Total
              </span>
              <strong className="text-xl text-foreground">
                {currency ? formatMoney(total, currency) : "$0.00"}
              </strong>
            </div>
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
          onToken={onPaymentToken}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
