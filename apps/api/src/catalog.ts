import { z } from "zod";

import type { Currency, Product } from "../../../shared";
import productsJson from "./data/products.json";

const rawProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  imgUrl: z.string().url(),
  amount: z.number().int().positive(),
  currency: z.enum(["USD", "EUR", "JPY"]),
});

const catalog = z
  .array(rawProductSchema)
  .parse(productsJson)
  .map(
    (product): Product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      keywords: product.keywords,
      image: product.imgUrl,
      priceCents: product.amount,
      currency: product.currency as Currency,
    }),
  );

const catalogById = new Map(catalog.map((product) => [product.id, product]));

export function getProducts(): Product[] {
  return catalog;
}

export function getProductById(productId: number): Product | undefined {
  return catalogById.get(productId);
}
