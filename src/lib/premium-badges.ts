/** Display metadata only; the backend determines whether a user holds Premium. */
export interface PremiumBadgeUser {
  badges?: readonly string[];
  premiumBadgeTier?: string | null;
  premiumSince?: number | null;
  premiumStreakSince?: number | null;
  premiumUntil?: number | null;
  premiumGiftCount?: number | null;
}

const DAY_MS = 86_400_000;

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

export const PREMIUM_BADGE_TIERS = [
  {
    name: "Premium",
    days: 0,
    symbol: "✦",
    colors: "from-pink-500 to-violet-500",
    art: ["#f0abfc", "#d946ef", "#7c3aed"],
  },
  {
    name: "Ember",
    days: 30,
    symbol: "♨",
    colors: "from-amber-700 to-orange-300",
    art: ["#fed7aa", "#f97316", "#9a3412"],
  },
  {
    name: "Iron",
    days: 90,
    symbol: "❖",
    colors: "from-slate-400 to-slate-100",
    art: ["#f8fafc", "#94a3b8", "#475569"],
  },
  {
    name: "Radiant",
    days: 180,
    symbol: "★",
    colors: "from-amber-500 to-yellow-100",
    art: ["#fef9c3", "#fbbf24", "#b45309"],
  },
  {
    name: "Glacier",
    days: 365,
    symbol: "❄",
    colors: "from-cyan-400 to-sky-100",
    art: ["#e0f2fe", "#22d3ee", "#0284c7"],
  },
  {
    name: "Crimson",
    days: 730,
    symbol: "♥",
    colors: "from-rose-700 to-pink-400",
    art: ["#fda4af", "#e11d48", "#9f1239"],
  },
  {
    name: "Verdant",
    days: 1095,
    symbol: "⬡",
    colors: "from-emerald-700 to-teal-300",
    art: ["#99f6e4", "#10b981", "#065f46"],
  },
  {
    name: "Celestial",
    days: 1825,
    symbol: "☾",
    colors: "from-violet-700 to-purple-300",
    art: ["#e9d5ff", "#a855f7", "#6d28d9"],
  },
] as const;

export function getPremiumBadgeTier(user: PremiumBadgeUser, now = Date.now()) {
  const assignedName =
    typeof user.premiumBadgeTier === "string"
      ? user.premiumBadgeTier.toLowerCase()
      : null;
  const assigned = PREMIUM_BADGE_TIERS.find(
    (tier) => tier.name.toLowerCase() === assignedName,
  );
  if (assigned) return assigned;
  const since = user.premiumStreakSince;
  const days =
    typeof since === "number" && Number.isFinite(since) && since > 0
      ? Math.max(0, Math.floor((now - since) / DAY_MS))
      : 0;
  return (
    [...PREMIUM_BADGE_TIERS].reverse().find((tier) => days >= tier.days) ??
    PREMIUM_BADGE_TIERS[0]
  );
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
