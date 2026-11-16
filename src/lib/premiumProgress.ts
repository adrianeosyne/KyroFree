import { hasPremium } from "./entitlements";
export const DAY_MS = 86400000;
export const PREMIUM_DURATIONS = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
] as const;
export const PREMIUM_TIERS = [
  {
    name: "Premium",
    days: 0,
    symbol: "✦",
    colors: "from-pink-500 to-violet-500",
    label: "Starting tier",
  },
  {
    name: "Bronze",
    days: 30,
    symbol: "♨",
    colors: "from-amber-700 to-orange-300",
    label: "1 month",
  },
  {
    name: "Silver",
    days: 90,
    symbol: "❖",
    colors: "from-slate-400 to-slate-100",
    label: "3 months",
  },
  {
    name: "Gold",
    days: 180,
    symbol: "★",
    colors: "from-amber-500 to-yellow-100",
    label: "6 months",
  },
  {
    name: "Frost",
    days: 365,
    symbol: "❄",
    colors: "from-cyan-400 to-sky-100",
    label: "1 year",
  },
  {
    name: "Ruby",
    days: 730,
    symbol: "♥",
    colors: "from-rose-700 to-pink-400",
    label: "2 years",
  },
  {
    name: "Emerald",
    days: 1095,
    symbol: "⬡",
    colors: "from-emerald-700 to-teal-300",
    label: "3 years",
  },
  {
    name: "Amethyst",
    days: 1825,
    symbol: "☾",
    colors: "from-violet-700 to-purple-300",
    label: "5 years",
  },
] as const;
export type PremiumHistory = {
  premiumUntil?: number | null;
  premiumSince?: number | null;
  premiumStreakSince?: number | null;
  premiumGiftCount?: number | null;
  badges?: readonly string[];
};
export function premiumDays(user: PremiumHistory, now = Date.now()) {
  return hasPremium(user, now) && user.premiumStreakSince
    ? Math.max(0, Math.floor((now - user.premiumStreakSince) / DAY_MS))
    : 0;
}
export function premiumTier(user: PremiumHistory, now = Date.now()) {
  const days = premiumDays(user, now);
  return [...PREMIUM_TIERS].reverse().find((t) => days >= t.days)!;
}
export function gifterTier(count: number) {
  return count >= 50
    ? "Legendary Gifter"
    : count >= 25
      ? "Super Gifter"
      : count >= 10
        ? "Big Gifter"
        : "Gifter";
}
