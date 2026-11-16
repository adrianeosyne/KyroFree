import { PREMIUM_DURATIONS } from "./premiumProgress";

export function normalizePremiumCode(input: string): string | null {
  let code = input.trim();
  if (/^https?:\/\//i.test(code)) {
    try {
      const url = new URL(code);
      if (
        url.protocol !== "https:" ||
        !["kyro-chat.cyou", "www.kyro-chat.cyou"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port
      )
        return null;
      const match = url.pathname.match(/^\/gift\/([^/]+)\/?$/);
      if (!match) return null;
      code = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  code = code.toUpperCase();
  return /^KYRO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code) ? code : null;
}

export function premiumGiftLink(code: string): string {
  return `https://kyro-chat.cyou/gift/${encodeURIComponent(code)}`;
}

export function premiumDuration(days: number): string {
  return (
    PREMIUM_DURATIONS.find((duration) => duration.days === days)?.label ??
    `${days} ${days === 1 ? "day" : "days"}`
  );
}
