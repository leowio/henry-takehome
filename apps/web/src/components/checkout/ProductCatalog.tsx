import { formatMoney, type Product } from "../../../../../shared";

import { Button } from "@/components/selia/button";
import { Card } from "@/components/selia/card";
import { SectionKicker } from "../ui/section-kicker";

type ProductCatalogProps = {
  products: Product[];
  onAddToCart: (product: Product) => void;
};

export function ProductCatalog({ products, onAddToCart }: ProductCatalogProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <SectionKicker>Catalog</SectionKicker>
          <h2 className="font-display text-3xl tracking-tight text-foreground">
            Signature silhouettes
          </h2>
          <p className="max-w-xl text-sm leading-6 text-muted">
            Each product card is isolated from checkout state so the shopping
            path reads cleanly at a glance.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <Card
            key={product.id}
            className="group overflow-hidden border-white/60 bg-white/78"
          >
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-stone-950/8" />
              <img
                src={product.image}
                alt={product.name}
                className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </div>

            <div className="space-y-5 p-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  {formatMoney(product.priceCents, product.currency)}
                </p>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {product.name}
                </h3>
                <p className="text-sm leading-6 text-muted">
                  {product.description}
                </p>
              </div>

              <Button block onClick={() => onAddToCart(product)}>
                Add to cart
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
