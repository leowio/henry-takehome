import { afterEach, expect, test, vi } from "vitest";

import { FxUnavailableError } from "../apps/api/src/fx";
import { quoteCartItems } from "../apps/api/src/quote";

afterEach(() => {
  vi.restoreAllMocks();
});

test("quotes a mixed-currency cart into USD", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      rates: {
        USD: 1.25,
      },
    }),
  } as Response);

  const quote = await quoteCartItems([
    { productId: 1, quantity: 1 },
    { productId: 4, quantity: 2 },
  ]);

  expect(quote.currency).toBe("USD");
  expect(quote.items[0]?.settlementUnitPriceCents).toBe(3250);
  expect(quote.items[1]?.settlementUnitPriceCents).toBe(563);
  expect(quote.subtotalCents).toBe(4376);
});

test("fails clearly when live FX is unavailable", async () => {
  vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

  await expect(
    quoteCartItems([{ productId: 7, quantity: 1 }]),
  ).rejects.toBeInstanceOf(FxUnavailableError);
});
