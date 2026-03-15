import { expect, test } from "vitest";

import {
  mapPersistedPaymentState,
  mapCheckoutConfirmResponse,
  mapCheckoutCreateResponse,
} from "../apps/api/src/payment";

test("maps immediate checkout creation to a ready state", () => {
  const mapped = mapCheckoutCreateResponse({
    status: "success",
    substatus: "201-immediate",
    data: {
      checkoutId: "checkout_demo",
      paymentMethodOptions: ["embedded"],
    },
  });

  expect(mapped.displayStatus).toBe("ready");
  expect(mapped.orderStatus).toBe("payment_pending");
  expect(mapped.providerCheckoutId).toBe("checkout_demo");
});

test("maps retryable confirmation failures to failed", () => {
  const mapped = mapCheckoutConfirmResponse({
    status: "failure",
    substatus: "503-retry",
    message: "Please retry",
  });

  expect(mapped.displayStatus).toBe("failed");
  expect(mapped.retryEligible).toBe(true);
});

test("maps deferred confirmations to processing", () => {
  const mapped = mapCheckoutConfirmResponse({
    status: "success",
    substatus: "202-deferred",
    message: "processing",
  });

  expect(mapped.displayStatus).toBe("processing");
  expect(mapped.paymentStatus).toBe("processing");
});

test("prefers persisted terminal success over a stale deferred response", () => {
  const mapped = mapPersistedPaymentState({
    orderStatus: "confirmed",
    paymentStatus: "succeeded",
    message: "Payment confirmed.",
  });

  expect(mapped.displayStatus).toBe("confirmed");
  expect(mapped.orderStatus).toBe("confirmed");
  expect(mapped.retryEligible).toBe(false);
});
