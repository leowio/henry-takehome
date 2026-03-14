import { formatMoney, type Product } from "../../../../../shared";

import type { OrderSession } from "../../lib/checkout";
import { Badge } from "@/components/selia/badge";
import { Button } from "@/components/selia/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/selia/card";
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
    <div className="space-y-5 lg:sticky lg:top-6">
      <Card className="overflow-hidden border-white/60 bg-white/88">
        <CardHeader className="space-y-3 border-b border-card-border/70 bg-card/80">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <SectionKicker>Checkout</SectionKicker>
              <CardTitle>
                {items.length
                  ? `${items.length} items ready`
                  : "Start your bag"}
              </CardTitle>
            </div>
            <Badge pill variant={items.length ? "primary" : "secondary"}>
              {items.length ? "Active cart" : "Empty cart"}
            </Badge>
          </div>
          <CardDescription>
            The bag stays local until the order and checkout session are
            created.
          </CardDescription>
        </CardHeader>

        <CardBody className="space-y-6">
          <div className="space-y-3">
            {items.length ? (
              items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-border/80 bg-white/80 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        {item.name}
                      </p>
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
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-accent/60 px-4 py-5 text-sm leading-6 text-muted">
                The cart lives locally until checkout starts.
              </div>
            )}
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

          <div className="rounded-3xl border border-stone-900 bg-stone-950 px-5 py-4 text-stone-50">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm uppercase tracking-[0.18em] text-stone-400">
                Total
              </span>
              <strong className="text-xl">
                {currency ? formatMoney(total, currency) : "$0.00"}
              </strong>
            </div>
          </div>

          {checkoutError ? (
            <p className="rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-sm leading-6 text-primary">
              {checkoutError}
            </p>
          ) : null}
        </CardBody>

        <CardFooter className="block space-y-4 bg-card-footer/70">
          <Button block size="lg" disabled={pending} onClick={onBeginCheckout}>
            {pending ? "Starting checkout..." : "Start secure checkout"}
          </Button>
          <p className="text-xs leading-5 text-muted">
            Card data remains in the hosted form. The app only receives a token.
          </p>
        </CardFooter>
      </Card>

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
