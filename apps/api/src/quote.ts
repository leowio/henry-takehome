import {
  toMajorUnits,
  toMinorUnits,
  sumLineItems,
  type CartItemInput,
  type Currency,
  type OrderLineItem,
  type SettlementCurrency,
} from "../../../shared";
import { getProductById } from "./catalog";
import { getUsdRate } from "./fx";

export type CartQuote = {
  currency: SettlementCurrency;
  subtotalCents: number;
  quotedAt: string;
  items: OrderLineItem[];
};

export async function quoteCartItems(
  items: CartItemInput[],
): Promise<CartQuote> {
  const products = items.map((item) => {
    const product = getProductById(item.productId);

    if (!product) {
      throw new Error(`Unknown product ${item.productId}`);
    }

    return { product, quantity: item.quantity };
  });
  const uniqueCurrencies = [...new Set(products.map(({ product }) => product.currency))];
  const rateEntries = await Promise.all(
    uniqueCurrencies.map(async (currency) => [currency, await getUsdRate(currency)]),
  );
  const ratesByCurrency = new Map(
    rateEntries as Array<
      [Currency, Awaited<ReturnType<typeof getUsdRate>>]
    >,
  );
  const quotedItems = await Promise.all(
    products.map(async ({ product, quantity }) => {
      const rate = ratesByCurrency.get(product.currency);

      if (!rate) {
        throw new Error(`Missing FX rate for ${product.currency}`);
      }

      return {
        productId: product.id,
        name: product.name,
        image: product.image,
        quantity,
        unitPriceCents: product.priceCents,
        currency: product.currency,
        settlementUnitPriceCents: toMinorUnits(
          toMajorUnits(product.priceCents, product.currency) * rate.rate,
          "USD",
        ),
        settlementCurrency: "USD",
        exchangeRate: rate.rate,
        exchangeRateFetchedAt: rate.fetchedAt,
      } satisfies OrderLineItem;
    }),
  );

  return {
    currency: "USD",
    subtotalCents: sumLineItems(
      quotedItems.map((item) => ({
        quantity: item.quantity,
        unitPriceCents: item.settlementUnitPriceCents,
      })),
    ),
    quotedAt: quotedItems.reduce(
      (latest, item) =>
        latest > item.exchangeRateFetchedAt ? latest : item.exchangeRateFetchedAt,
      quotedItems[0]?.exchangeRateFetchedAt ?? new Date().toISOString(),
    ),
    items: quotedItems,
  };
}
