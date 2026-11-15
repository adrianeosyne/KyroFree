export const PREMIUM_PRICE = "$1.99/month";
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
