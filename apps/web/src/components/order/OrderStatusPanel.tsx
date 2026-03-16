import { Link } from "react-router-dom";

import {
  formatMoney,
  type CreateCheckoutResponse,
  type OrderStatusResponse,
} from "../../../../../shared";
import { Badge } from "@/components/selia/badge";
import { Button } from "@/components/selia/button";
import { CardDescription, CardTitle } from "@/components/selia/card";
import { EmbeddedCardPanel } from "../EmbeddedCardPanel";
import { SectionKicker } from "../ui/section-kicker";

type OrderStatusPanelProps = {
  status: OrderStatusResponse | null;
  error: string;
  busy: boolean;
  pendingCheckout: CreateCheckoutResponse | null;
  onRetryCheckout: () => void;
  onDismissPayment: () => void;
  onRetryPayment: (paymentToken: string) => void;
  onError: (message: string) => void;
};

function getStatusVariant(status: OrderStatusResponse["status"] | undefined) {
  if (status === "confirmed") {
    return "success";
  }

  if (status === "failed") {
    return "danger";
  }

  return "primary";
}

export function OrderStatusPanel({
  status,
  error,
  busy,
  pendingCheckout,
  onRetryCheckout,
  onDismissPayment,
  onRetryPayment,
  onError,
}: OrderStatusPanelProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/"
          className="text-sm font-medium text-muted transition hover:text-foreground"
        >
          Back to catalog
        </Link>
        {status ? (
          <Badge variant={getStatusVariant(status.status)}>
            {status.status}
          </Badge>
        ) : null}
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_24rem]">
        <div>
          <div className="space-y-3 border-b border-border/60 pb-6">
            <SectionKicker>Order status</SectionKicker>
            {status ? (
              <>
                <CardTitle className="font-display text-4xl leading-tight tracking-tight">
                  {status.message}
                </CardTitle>
                <CardDescription>
                  Order {status.publicOrderId} is being updated with the latest
                  payment status.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="font-display text-4xl leading-tight tracking-tight">
                  Loading order
                </CardTitle>
                <CardDescription>
                  Fetching the latest state from the backend.
                </CardDescription>
              </>
            )}
          </div>

          {status ? (
            <div className="space-y-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border-b border-border/60 pb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Status
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {status.status}
                  </p>
                </div>
                <div className="border-b border-border/60 pb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Settled total
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {formatMoney(status.subtotalCents, status.currency)}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    FX snapshot from{" "}
                    {new Date(status.fxUpdatedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-0">
                {status.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.name}`}
                    className="flex items-center justify-between gap-3 border-b border-border/40 py-4 last:border-b-0"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-sm text-muted">
                        {item.quantity} x{" "}
                        {formatMoney(item.unitPriceCents, item.currency)}
                      </p>
                      {item.currency !== item.settlementCurrency ? (
                        <p className="text-xs uppercase tracking-[0.16em] text-muted">
                          Converted at {item.exchangeRate.toFixed(4)} to{" "}
                          {item.settlementCurrency}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatMoney(
                          item.quantity * item.settlementUnitPriceCents,
                          item.settlementCurrency,
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        Native{" "}
                        {formatMoney(
                          item.quantity * item.unitPriceCents,
                          item.currency,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {status.retryEligible ? (
                <Button block disabled={busy} onClick={onRetryCheckout}>
                  {busy ? "Preparing retry..." : "Retry payment"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          {error ? (
            <p className="border-l-2 border-danger pl-4 text-sm leading-6 text-danger">
              {error}
            </p>
          ) : null}

          {pendingCheckout?.checkoutId ? (
            <EmbeddedCardPanel
              checkoutId={pendingCheckout.checkoutId}
              disabled={busy}
              onDismiss={onDismissPayment}
              onToken={onRetryPayment}
              onError={onError}
            />
          ) : (
            <div className="space-y-3">
              <SectionKicker>Recovery path</SectionKicker>
              <h2 className="text-xl font-semibold text-foreground">
                Retry checkout appears here when needed.
              </h2>
              <p className="text-sm leading-6 text-muted">
                Failed orders can create another hosted checkout without forcing
                the shopper back through the catalog.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
