import { EmbeddedCheckout } from "@henrylabs-interview/payments";
import { useEffect, useRef } from "react";

type EmbeddedCardPanelProps = {
  checkoutId: string;
  disabled: boolean;
  onDismiss: () => void;
  onToken: (paymentToken: string) => void;
  onError: (message: string) => void;
};

export function EmbeddedCardPanel(props: EmbeddedCardPanelProps) {
  const hostId = "embedded-checkout-host";
  const mountedCheckoutId = useRef<string | null>(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (mountedCheckoutId.current === props.checkoutId) {
      return;
    }

    mountedCheckoutId.current = props.checkoutId;

    const embedded = new EmbeddedCheckout({ checkoutId: props.checkoutId });
    void embedded
      .render(`#${hostId}`, (paymentToken) => {
        props.onToken(paymentToken);
      })
      .catch(() => {
        props.onError("Unable to mount the secure card form.");
      });
  }, [props]);

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#221b16]/45 px-4 py-6 backdrop-blur-[2px]"
      onClick={props.onDismiss}
    >
      <div
        className="w-full max-w-[min(92vw,34rem)] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          id={hostId}
          className={
            props.disabled
              ? "min-h-[290px] w-full max-w-full overflow-hidden opacity-70"
              : "min-h-[290px] w-full max-w-full overflow-hidden"
          }
        />
      </div>
    </div>
  );
}
