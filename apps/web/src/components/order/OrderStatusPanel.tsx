import { Link } from "react-router-dom";

import {
  formatMoney,
  type CreateCheckoutResponse,
  type OrderStatusResponse,
} from "../../../../../shared";
import { Badge } from "@/components/selia/badge";
import { Button } from "@/components/selia/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/selia/card";
import { EmbeddedCardPanel } from "../EmbeddedCardPanel";
import { SectionKicker } from "../ui/section-kicker";

type OrderStatusPanelProps = {
  status: OrderStatusResponse | null;
  error: string;
  busy: boolean;
  pendingCheckout: CreateCheckoutResponse | null;
  onRetryCheckout: () => void;
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
        <Card className="overflow-hidden border-white/60 bg-white/86">
          <CardHeader className="space-y-3 bg-card/80">
            <SectionKicker>Order status</SectionKicker>
            {status ? (
              <>
                <CardTitle className="font-display text-4xl leading-tight tracking-tight">
                  {status.message}
                </CardTitle>
                <CardDescription>
                  Order {status.publicOrderId} is tracked server-side and polled
                  while the payment is still processing.
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
          </CardHeader>

          {status ? (
            <CardBody className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-border bg-accent/70 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Status
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {status.status}
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-accent/70 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    Total
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {formatMoney(status.subtotalCents, status.currency)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {status.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.name}`}
                    className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-white/78 px-4 py-4"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-sm text-muted">
                        {item.quantity} x{" "}
                        {formatMoney(item.unitPriceCents, item.currency)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatMoney(
                        item.quantity * item.unitPriceCents,
                        item.currency,
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {status.retryEligible ? (
                <Button block disabled={busy} onClick={onRetryCheckout}>
                  {busy ? "Preparing retry..." : "Retry payment"}
                </Button>
              ) : null}
            </CardBody>
          ) : null}
        </Card>

        <div className="space-y-5">
          {error ? (
            <Card className="border-danger/15 bg-white/90">
              <div className="p-5 text-sm leading-6 text-danger">{error}</div>
            </Card>
          ) : null}

          {pendingCheckout?.checkoutId ? (
            <EmbeddedCardPanel
              checkoutId={pendingCheckout.checkoutId}
              disabled={busy}
              onToken={onRetryPayment}
              onError={onError}
            />
          ) : (
            <Card className="border-white/60 bg-white/82">
              <div className="space-y-3 p-6">
                <SectionKicker>Recovery path</SectionKicker>
                <h2 className="text-xl font-semibold text-foreground">
                  Retry checkout appears here when needed.
                </h2>
                <p className="text-sm leading-6 text-muted">
                  Failed orders can create another hosted checkout without
                  forcing the shopper back through the catalog.
                </p>
              </div>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}
