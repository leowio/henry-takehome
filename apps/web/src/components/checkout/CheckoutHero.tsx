import { SectionKicker } from "../ui/section-kicker";

const trustPoints = [
  "Local-first cart until checkout starts",
  "Single checkout handoff to the backend",
  "Retry-safe payment recovery on failed attempts",
];

export function CheckoutHero() {
  return (
    <section className="space-y-8 py-2 sm:py-4">
      <div className="space-y-4">
        <SectionKicker>Luxury footwear, cleaner payments</SectionKicker>
        <h1 className="max-w-[14ch] font-display text-5xl leading-[0.94] tracking-tight text-foreground sm:text-6xl">
          Curated pairs with a fast, durable payment path.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted">
          Browse instantly, keep the cart local, and only hand off the final
          payment boundary when the shopper is ready to commit.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {trustPoints.map((point) => (
          <p
            key={point}
            className="border-l-2 border-primary/30 pl-4 text-sm leading-6 text-muted"
          >
            {point}
          </p>
        ))}
      </div>
    </section>
  );
}
