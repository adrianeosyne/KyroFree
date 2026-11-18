export const PREMIUM_REGULAR_PRICE = "$1.99";
export const PREMIUM_PRICE = `${PREMIUM_REGULAR_PRICE}/month`;

// One shared release window; opening or refreshing Premium never restarts it.
const releaseOfferStartsAt = Date.parse("2026-11-16T15:50:48Z");
export const PREMIUM_RELEASE_OFFER = {
  price: "$0.99",
  reason: "Celebrate official Kyro Release",
  startsAt: releaseOfferStartsAt,
  endsAt: releaseOfferStartsAt + 14 * 24 * 60 * 60 * 1000,
} as const;

export function premiumPricing(now: number) {
  const offerActive =
    now >= PREMIUM_RELEASE_OFFER.startsAt && now < PREMIUM_RELEASE_OFFER.endsAt;
  return {
    price: offerActive ? PREMIUM_RELEASE_OFFER.price : PREMIUM_REGULAR_PRICE,
    offerActive,
    remainingMs: offerActive ? PREMIUM_RELEASE_OFFER.endsAt - now : 0,
  };
}

export function premiumCountdown(remainingMs: number) {
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export const PREMIUM_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export function hasPremium(
  user: { premiumUntil?: number | null } | null | undefined,
  now = Date.now(),
): boolean {
  return (user?.premiumUntil ?? 0) > now;
}
export function uploadLimit(
  user: { premiumUntil?: number | null } | null | undefined,
): number {
  return (hasPremium(user) ? 200 : 10) * 1024 * 1024;
}
export function messageLimit(
  user: { premiumUntil?: number | null } | null | undefined,
): number {
  return hasPremium(user) ? 4000 : 2000;
}
