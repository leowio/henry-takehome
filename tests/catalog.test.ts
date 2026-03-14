import { expect, test } from "vitest";

import { getProductById, getProducts } from "../apps/api/src/catalog";

test("normalizes the seeded catalog", () => {
  const products = getProducts();

  expect(products.length).toBe(10);
  expect(products[0]?.image).toContain("imgur");
});

test("finds products by identifier", () => {
  const product = getProductById(7);

  expect(product?.currency).toBe("JPY");
  expect(product?.priceCents).toBe(580000);
});
