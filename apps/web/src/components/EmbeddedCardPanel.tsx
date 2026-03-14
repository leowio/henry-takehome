import { EmbeddedCheckout } from "@henrylabs-interview/payments";
import { useEffect, useRef } from "react";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/selia/card";
import { SectionKicker } from "./ui/section-kicker";

type EmbeddedCardPanelProps = {
  checkoutId: string;
  disabled: boolean;
  onToken: (paymentToken: string) => void;
  onError: (message: string) => void;
};

export function EmbeddedCardPanel(props: EmbeddedCardPanelProps) {
  const hostId = "embedded-checkout-host";
  const mountedCheckoutId = useRef<string | null>(null);

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
    <Card className="overflow-hidden bg-white/92">
      <CardHeader className="border-b border-card-border/70 bg-card/80">
        <SectionKicker>Secure card entry</SectionKicker>
        <CardTitle className="text-lg">Processor-hosted form</CardTitle>
      </CardHeader>
      <CardBody>
        <div
          id={hostId}
          className={
            props.disabled ? "min-h-[290px] opacity-70" : "min-h-[290px]"
          }
        />
      </CardBody>
    </Card>
  );
}
