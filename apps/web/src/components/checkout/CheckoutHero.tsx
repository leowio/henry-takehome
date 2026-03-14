import { formatMoney, type Product } from "../../../../../shared";

import { Badge } from "@/components/selia/badge";
import { Card } from "@/components/selia/card";
import { SectionKicker } from "../ui/section-kicker";

type CheckoutHeroProps = {
  itemCount: number;
  total: number;
  currency?: Product["currency"];
};

const trustPoints = [
  "Local-first cart until checkout starts",
  "Single checkout handoff to the backend",
  "Retry-safe payment recovery on failed attempts",
];

export function CheckoutHero({
  itemCount,
  total,
  currency,
}: CheckoutHeroProps) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_20rem]">
      <Card className="relative overflow-hidden border-white/60 bg-white/78">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(197,122,77,0.36),transparent_58%),radial-gradient(circle_at_top_right,rgba(74,52,33,0.14),transparent_46%)]" />
        <div className="relative space-y-8 p-7 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Badge pill variant="primary">
              Selia storefront
            </Badge>
            <Badge pill variant="secondary">
              Virellio guest checkout
            </Badge>
          </div>

          <div className="space-y-4">
            <SectionKicker>Luxury footwear, cleaner payments</SectionKicker>
            <h1 className="max-w-[12ch] font-display text-5xl leading-[0.94] tracking-tight text-foreground sm:text-6xl">
              Curated pairs with a fast, durable payment path.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted">
              Browse instantly, keep the cart local, and only hand off the final
              payment boundary when the shopper is ready to commit.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {trustPoints.map((point) => (
              <div
                key={point}
                className="rounded-3xl border border-white/70 bg-white/72 px-4 py-4 text-sm leading-6 text-muted shadow-[0_8px_24px_rgba(76,55,36,0.06)]"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col justify-between border-white/60 bg-stone-950 text-stone-50">
        <div className="space-y-6 p-7">
          <SectionKicker className="text-stone-400">Cart pulse</SectionKicker>
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
              Ready now
            </p>
            <p className="font-display text-5xl leading-none">{itemCount}</p>
            <p className="text-sm text-stone-400">
              {itemCount === 1 ? "Item in bag" : "Items in bag"}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 p-7">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
            Live total
          </p>
          <p className="text-2xl font-semibold text-white">
            {currency ? formatMoney(total, currency) : "$0.00"}
          </p>
          <p className="text-sm leading-6 text-stone-400">
            Keep the bag to one currency and checkout stays straightforward.
          </p>
        </div>
      </Card>
    </section>
  );
}
