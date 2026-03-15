import { type Currency, toMajorUnits, toMinorUnits } from "../../../shared";

const FX_BASE_URL =
  process.env.FX_API_BASE_URL || "https://api.frankfurter.app";
const FX_CACHE_TTL_MS = 5 * 60 * 1000;

type FxRateSnapshot = {
  rate: number;
  sourceCurrency: Currency;
  settlementCurrency: "USD";
  fetchedAt: string;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: FxRateSnapshot;
};

const rateCache = new Map<Currency, CacheEntry>();

export class FxUnavailableError extends Error {}

export class UnsupportedCurrencyError extends Error {
  constructor(currency: string) {
    super(
      `We can't process items priced in ${currency} right now. Remove that item or try again later.`,
    );
  }
}

export async function getUsdRate(currency: Currency): Promise<FxRateSnapshot> {
  const fetchedAt = new Date().toISOString();
  if (currency === "USD") {
    return {
      rate: 1,
      sourceCurrency: "USD",
      settlementCurrency: "USD",
      fetchedAt,
    };
  }

  const cached = rateCache.get(currency);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }

  let response: Response;
  try {
    response = await fetch(`${FX_BASE_URL}/latest?from=${currency}&to=USD`);
  } catch {
    throw new FxUnavailableError(
      "Live exchange rates are temporarily unavailable. Try checkout again in a moment.",
    );
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new UnsupportedCurrencyError(currency);
    }

    throw new FxUnavailableError(
      "Live exchange rates are temporarily unavailable. Try checkout again in a moment.",
    );
  }

  const payload = await response.json();
  const rate = payload?.rates?.USD;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new UnsupportedCurrencyError(currency);
  }

  const snapshot: FxRateSnapshot = {
    rate,
    sourceCurrency: currency,
    settlementCurrency: "USD",
    fetchedAt,
  };

  rateCache.set(currency, {
    expiresAt: Date.now() + FX_CACHE_TTL_MS,
    snapshot,
  });

  return snapshot;
}

export async function convertToUsd(
  amountMinor: number,
  currency: Currency,
): Promise<{
  amountCents: number;
  exchangeRate: number;
  exchangeRateFetchedAt: string;
}> {
  const rate = await getUsdRate(currency);
  const amountMajor = toMajorUnits(amountMinor, currency);

  return {
    amountCents: toMinorUnits(amountMajor * rate.rate, "USD"),
    exchangeRate: rate.rate,
    exchangeRateFetchedAt: rate.fetchedAt,
  };
}
