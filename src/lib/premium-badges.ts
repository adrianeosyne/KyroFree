import { PREMIUM_TIERS, premiumTier } from "./premiumProgress";

/** Display metadata only; the backend determines whether a user holds Premium. */
export interface PremiumBadgeUser {
  badges?: readonly string[];
  premiumBadgeTier?: string | null;
  premiumSince?: number | null;
  premiumStreakSince?: number | null;
  premiumUntil?: number | null;
  premiumGiftCount?: number | null;
}

/** The recorded membership start, never inferred from a tier or a streak. */
export function getPremiumSinceText(
  user: PremiumBadgeUser,
  now = Date.now(),
): string | null {
  const since = user.premiumSince;
  if (
    typeof since !== "number" ||
    !Number.isFinite(since) ||
    since <= 0 ||
    since > now
  )
    return null;
  const date = new Date(since);
  if (!Number.isFinite(date.getTime())) return null;
  return `Premium since ${date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}`;
}

const PREMIUM_BADGE_ART = {
  Premium: ["#f0abfc", "#d946ef", "#7c3aed"],
  Ember: ["#fed7aa", "#f97316", "#9a3412"],
  Iron: ["#f8fafc", "#94a3b8", "#475569"],
  Radiant: ["#fef9c3", "#fbbf24", "#b45309"],
  Glacier: ["#e0f2fe", "#22d3ee", "#0284c7"],
  Crimson: ["#fda4af", "#e11d48", "#9f1239"],
  Verdant: ["#99f6e4", "#10b981", "#065f46"],
  Celestial: ["#e9d5ff", "#a855f7", "#6d28d9"],
} as const;

export const PREMIUM_BADGE_TIERS = PREMIUM_TIERS.map((tier) => ({
  ...tier,
  art: PREMIUM_BADGE_ART[tier.name],
}));

export function getPremiumBadgeTier(user: PremiumBadgeUser, now = Date.now()) {
  const assignedName =
    typeof user.premiumBadgeTier === "string"
      ? user.premiumBadgeTier.toLowerCase()
      : null;
  const assigned = PREMIUM_TIERS.find(
    (tier) => tier.name.toLowerCase() === assignedName,
  );
  const tier = premiumTier(
    {
      ...user,
      premiumBadgeTier: assigned?.name,
      // Older display-only metadata can omit expiry; its held badge is
      // authoritative. An explicit expiry always takes precedence.
      premiumUntil:
        user.premiumUntil === undefined && user.badges?.includes("premium")
          ? Number.MAX_SAFE_INTEGER
          : user.premiumUntil,
    },
    now,
  );
  return PREMIUM_BADGE_TIERS.find((entry) => entry.name === tier.name)!;
}

export const PREMIUM_GIFTER_TIERS = [
  { name: "Gifter", gifts: 1, colors: ["#fb72b7", "#ed4f9d"] },
  { name: "Big Gifter", gifts: 10, colors: ["#ae72ff", "#7c3aed"] },
  { name: "Super Gifter", gifts: 25, colors: ["#f472b6", "#38bdf8"] },
  { name: "Legendary Gifter", gifts: 50, colors: ["#fde68a", "#f59e0b"] },
] as const;

export function getGifterBadgeTier(count: number | null | undefined) {
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1)
    return null;
  return (
    [...PREMIUM_GIFTER_TIERS].reverse().find((tier) => count >= tier.gifts) ??
    null
  );
}
