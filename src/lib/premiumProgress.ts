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
    name: "Ember",
    days: 30,
    symbol: "♨",
    colors: "from-amber-700 to-orange-300",
    label: "1 month",
  },
  {
    name: "Iron",
    days: 90,
    symbol: "❖",
    colors: "from-slate-400 to-slate-100",
    label: "3 months",
  },
  {
    name: "Radiant",
    days: 180,
    symbol: "★",
    colors: "from-amber-500 to-yellow-100",
    label: "6 months",
  },
  {
    name: "Glacier",
    days: 365,
    symbol: "❄",
    colors: "from-cyan-400 to-sky-100",
    label: "1 year",
  },
  {
    name: "Crimson",
    days: 730,
    symbol: "♥",
    colors: "from-rose-700 to-pink-400",
    label: "2 years",
  },
  {
    name: "Verdant",
    days: 1095,
    symbol: "⬡",
    colors: "from-emerald-700 to-teal-300",
    label: "3 years",
  },
  {
    name: "Celestial",
    days: 1825,
    symbol: "☾",
    colors: "from-violet-700 to-purple-300",
    label: "5 years",
  },
] as const;
export type PremiumBadgeTier = (typeof PREMIUM_TIERS)[number]["name"];
export type PremiumHistory = {
  premiumUntil?: number | null;
  premiumSince?: number | null;
  premiumStreakSince?: number | null;
  premiumGiftCount?: number | null;
  premiumBadgeTier?: PremiumBadgeTier | null;
  badges?: readonly string[];
};
export function premiumDays(user: PremiumHistory, now = Date.now()) {
  return hasPremium(user, now) && user.premiumStreakSince
    ? Math.max(0, Math.floor((now - user.premiumStreakSince) / DAY_MS))
    : 0;
}
export function premiumTier(user: PremiumHistory, now = Date.now()) {
  const assigned = hasPremium(user, now)
    ? PREMIUM_TIERS.find((tier) => tier.name === user.premiumBadgeTier)
    : undefined;
  if (assigned) return assigned;
  const days = premiumDays(user, now);
  return [...PREMIUM_TIERS].reverse().find((t) => days >= t.days)!;
}
export const GIFTER_TIERS = [
  { name: "Gifter", gifts: 1, colors: ["#fb72b7", "#ed4f9d"] },
  { name: "Big Gifter", gifts: 10, colors: ["#ae72ff", "#7c3aed"] },
  { name: "Super Gifter", gifts: 25, colors: ["#f472b6", "#38bdf8"] },
  { name: "Legendary Gifter", gifts: 50, colors: ["#fde68a", "#f59e0b"] },
] as const;
export function gifterBadgeTier(count: number) {
  return (
    [...GIFTER_TIERS].reverse().find((tier) => count >= tier.gifts) ??
    GIFTER_TIERS[0]
  );
}
export function gifterTier(count: number) {
  return gifterBadgeTier(count).name;
}
