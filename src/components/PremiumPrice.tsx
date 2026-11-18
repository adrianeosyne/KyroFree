import { useNow } from "@/hooks/use-now";
import {
  PREMIUM_REGULAR_PRICE,
  PREMIUM_RELEASE_OFFER,
  premiumCountdown,
  premiumPricing,
} from "@/lib/entitlements";

export function PremiumPrice({
  suffix = "",
  showRegularPrice = false,
  showOfferLabel = false,
}: {
  suffix?: string;
  showRegularPrice?: boolean;
  showOfferLabel?: boolean;
}) {
  const now = useNow(1000);
  const pricing = premiumPricing(now);
  return (
    <>
      {showRegularPrice && pricing.offerActive && (
        <del className="mr-3 text-lg font-normal text-muted-foreground">
          <span className="sr-only">Regular price </span>
          {PREMIUM_REGULAR_PRICE}
        </del>
      )}
      <span data-premium-current-price>
        {pricing.price}
        {suffix}
      </span>
      {showOfferLabel && pricing.offerActive && " (release offer)"}
    </>
  );
}

export function PremiumReleaseOffer() {
  const now = useNow(1000);
  const pricing = premiumPricing(now);
  if (!pricing.offerActive) return null;
  const countdown = premiumCountdown(pricing.remainingMs);
  return (
    <section
      aria-label="Kyro release offer"
      className="mt-5 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">
        Two-week release offer
      </p>
      <h3 className="mt-2 text-lg font-bold">{PREMIUM_RELEASE_OFFER.reason}</h3>
      <p className="mt-3 text-xs text-muted-foreground">Offer ends in</p>
      <div
        role="timer"
        aria-label="Release offer countdown"
        aria-live="off"
        className="mt-2 grid max-w-sm grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {Object.entries(countdown).map(([unit, value]) => (
          <div
            key={unit}
            className="rounded-xl bg-background/50 p-2 text-center"
          >
            <span className="block text-2xl font-bold tabular-nums">
              {String(value).padStart(2, "0")}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {unit}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {PREMIUM_RELEASE_OFFER.price} per month during the offer. Regular price{" "}
        {PREMIUM_REGULAR_PRICE} per month afterwards.
      </p>
    </section>
  );
}
