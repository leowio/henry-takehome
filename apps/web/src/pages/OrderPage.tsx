import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { OrderStatusPanel } from "../components/order/OrderStatusPanel";
import {
  confirmPayment,
  createCheckout,
  fetchOrderStatus,
  orderBusyAtom,
  orderErrorAtom,
  orderStatusAtom,
  pendingCheckoutAtom,
} from "../lib/checkout";

export function OrderPage() {
  const { publicOrderId = "" } = useParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useAtom(orderStatusAtom);
  const [error, setError] = useAtom(orderErrorAtom);
  const [pendingCheckout, setPendingCheckout] = useAtom(pendingCheckoutAtom);
  const [busy, setBusy] = useAtom(orderBusyAtom);
  const orderStatusQuery = useQuery({
    queryKey: ["order-status", publicOrderId],
    queryFn: () => fetchOrderStatus(publicOrderId),
    enabled: Boolean(publicOrderId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2500 : false,
  });

  useEffect(() => {
    setStatus(null);
    setError("");
    setPendingCheckout(null);
    setBusy(false);

    return () => {
      setStatus(null);
      setError("");
      setPendingCheckout(null);
      setBusy(false);
    };
  }, [publicOrderId, setBusy, setError, setPendingCheckout, setStatus]);

  useEffect(() => {
    if (orderStatusQuery.data) {
      setStatus(orderStatusQuery.data);
      setError("");
    }
  }, [orderStatusQuery.data, setError, setStatus]);

  useEffect(() => {
    if (orderStatusQuery.error) {
      setError(
        orderStatusQuery.error instanceof Error
          ? orderStatusQuery.error.message
          : "Unable to load the order.",
      );
    }
  }, [orderStatusQuery.error, setError]);

  async function retryCheckout() {
    if (!status) {
      return;
    }

    setBusy(true);
    try {
      const checkout = await createCheckout(status.orderId);
      setPendingCheckout(checkout);
      setError(checkout.message);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to start another payment attempt.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmRetry(paymentToken: string) {
    if (!status) {
      return;
    }

    setBusy(true);
    try {
      const result = await confirmPayment(status.orderId, paymentToken);
      setError(result.message);
      const next = await fetchOrderStatus(status.publicOrderId);
      setStatus(next);
      queryClient.setQueryData(["order-status", status.publicOrderId], next);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to confirm payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  function dismissPendingCheckout() {
    setPendingCheckout(null);
    setBusy(false);
    setError("");
  }

  return (
    <OrderStatusPanel
      busy={busy}
      error={error}
      onDismissPayment={dismissPendingCheckout}
      onError={setError}
      onRetryCheckout={retryCheckout}
      onRetryPayment={confirmRetry}
      pendingCheckout={pendingCheckout}
      status={status}
    />
  );
}
