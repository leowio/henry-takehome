import type {
  CheckoutDisplayState,
  OrderStatus,
  PaymentAttemptStatus,
} from "../../../shared";

export type ProviderMappedResult = {
  displayStatus: CheckoutDisplayState;
  orderStatus: OrderStatus;
  paymentStatus: PaymentAttemptStatus;
  message: string;
  retryEligible: boolean;
  providerCheckoutId?: string;
  confirmationId?: string;
  paymentMethodOptions?: string[];
  failureCode?: string;
  failureMessage?: string;
};

function failureMessage(
  substatus: string | undefined,
  message: string,
): string {
  if (substatus === "502-fraud") {
    return "This payment was blocked by fraud screening. Try a different card.";
  }

  if (substatus === "503-retry") {
    return "The payment processor asked for a retry. You can try again safely.";
  }

  if (substatus === "500-error") {
    return "The payment service hit an internal error. Please retry.";
  }

  return message;
}

export function mapCheckoutCreateResponse(response: any): ProviderMappedResult {
  if (
    response?.status === "success" &&
    response?.substatus === "201-immediate"
  ) {
    return {
      displayStatus: "ready",
      orderStatus: "payment_pending",
      paymentStatus: "checkout_ready",
      message: "Secure card entry is ready.",
      retryEligible: false,
      providerCheckoutId: response?.data?.checkoutId,
      paymentMethodOptions: response?.data?.paymentMethodOptions ?? [],
    };
  }

  if (
    response?.status === "success" &&
    response?.substatus === "202-deferred"
  ) {
    return {
      displayStatus: "failed",
      orderStatus: "draft",
      paymentStatus: "failed",
      message:
        "Checkout initialization was delayed. Retry to generate a fresh secure checkout session.",
      retryEligible: true,
      failureCode: response?.substatus,
      failureMessage: response?.message,
    };
  }

  return {
    displayStatus:
      response?.substatus === "502-fraud" ? "fraud_rejected" : "failed",
    orderStatus: "failed",
    paymentStatus:
      response?.substatus === "502-fraud" ? "fraud_rejected" : "failed",
    message: failureMessage(
      response?.substatus,
      response?.message ?? "Checkout failed.",
    ),
    retryEligible: true,
    failureCode: response?.substatus,
    failureMessage: response?.message,
  };
}

export function mapCheckoutConfirmResponse(
  response: any,
): ProviderMappedResult {
  if (
    response?.status === "success" &&
    response?.substatus === "201-immediate"
  ) {
    return {
      displayStatus: "confirmed",
      orderStatus: "confirmed",
      paymentStatus: "succeeded",
      message: "Payment confirmed.",
      retryEligible: false,
      confirmationId: response?.data?.confirmationId,
    };
  }

  if (
    response?.status === "success" &&
    response?.substatus === "202-deferred"
  ) {
    return {
      displayStatus: "processing",
      orderStatus: "processing",
      paymentStatus: "processing",
      message:
        "Payment submitted and is still processing. Keep this tab open or refresh the order page.",
      retryEligible: false,
      failureCode: response?.substatus,
      failureMessage: response?.message,
    };
  }

  return {
    displayStatus:
      response?.substatus === "502-fraud" ? "fraud_rejected" : "failed",
    orderStatus: "failed",
    paymentStatus:
      response?.substatus === "502-fraud" ? "fraud_rejected" : "failed",
    message: failureMessage(
      response?.substatus,
      response?.message ?? "Payment failed.",
    ),
    retryEligible: true,
    failureCode: response?.substatus,
    failureMessage: response?.message,
  };
}

export function mapPersistedPaymentState(params: {
  orderStatus: OrderStatus;
  paymentStatus: PaymentAttemptStatus;
  message: string;
}): ProviderMappedResult {
  if (
    params.orderStatus === "confirmed" ||
    params.paymentStatus === "succeeded"
  ) {
    return {
      displayStatus: "confirmed",
      orderStatus: "confirmed",
      paymentStatus: "succeeded",
      message: params.message,
      retryEligible: false,
    };
  }

  if (params.paymentStatus === "fraud_rejected") {
    return {
      displayStatus: "fraud_rejected",
      orderStatus: "failed",
      paymentStatus: "fraud_rejected",
      message: params.message,
      retryEligible: true,
    };
  }

  if (params.orderStatus === "failed" || params.paymentStatus === "failed") {
    return {
      displayStatus: "failed",
      orderStatus: "failed",
      paymentStatus: params.paymentStatus,
      message: params.message,
      retryEligible: true,
    };
  }

  if (
    params.orderStatus === "processing" ||
    params.paymentStatus === "processing" ||
    params.paymentStatus === "submitted"
  ) {
    return {
      displayStatus: "processing",
      orderStatus: "processing",
      paymentStatus:
        params.paymentStatus === "submitted"
          ? "processing"
          : params.paymentStatus,
      message: params.message,
      retryEligible: false,
    };
  }

  if (params.paymentStatus === "checkout_ready") {
    return {
      displayStatus: "ready",
      orderStatus: "payment_pending",
      paymentStatus: "checkout_ready",
      message: params.message,
      retryEligible: false,
    };
  }

  return {
    displayStatus: "failed",
    orderStatus: "failed",
    paymentStatus: "failed",
    message: params.message,
    retryEligible: true,
  };
}
