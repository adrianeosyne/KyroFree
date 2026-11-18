export type AttentionProfile = {
  id: string;
  name: string;
  mentions: boolean;
  calls: boolean;
};
export type AttentionPolicy = {
  timezone: string;
  profiles: AttentionProfile[];
  activeProfile: string;
  quietEnabled: boolean;
  quietStart: number;
  quietEnd: number;
  quietDays: number[];
  themeEnabled: boolean;
  lightStart: number;
  darkStart: number;
};
export const defaultAttention: AttentionPolicy = {
  timezone: "UTC",
  profiles: [
    { id: "standard", name: "Standard", mentions: true, calls: true },
    { id: "focus", name: "Focus", mentions: false, calls: true },
    { id: "quiet", name: "Quiet", mentions: false, calls: false },
  ],
  activeProfile: "standard",
  quietEnabled: false,
  quietStart: 1320,
  quietEnd: 480,
  quietDays: [0, 1, 2, 3, 4, 5, 6],
  themeEnabled: false,
  lightStart: 420,
  darkStart: 1140,
};
export function zonedClock(timezone: string, at = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return {
    minute: Number(get("hour")) * 60 + Number(get("minute")),
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      get("weekday"),
    ),
  };
}
export function inQuietHours(policy: AttentionPolicy, at = Date.now()) {
  if (!policy.quietEnabled) return false;
  const { minute, day } = zonedClock(policy.timezone, at);
  if (policy.quietStart < policy.quietEnd)
    return (
      policy.quietDays.includes(day) &&
      minute >= policy.quietStart &&
      minute < policy.quietEnd
    );
  // An overnight interval belongs to the day on which it starts.
  return (
    (minute >= policy.quietStart && policy.quietDays.includes(day)) ||
    (minute < policy.quietEnd && policy.quietDays.includes((day + 6) % 7))
  );
}
export function scheduledTheme(
  policy: AttentionPolicy,
  at = Date.now(),
): "light" | "dark" | null {
  if (!policy.themeEnabled) return null;
  const { minute } = zonedClock(policy.timezone, at);
  const light =
    policy.lightStart < policy.darkStart
      ? minute >= policy.lightStart && minute < policy.darkStart
      : minute >= policy.lightStart || minute < policy.darkStart;
  return light ? "light" : "dark";
}
let currentPolicy: AttentionPolicy | null = null;
export function setAttentionPolicy(policy: AttentionPolicy | null) {
  currentPolicy = policy;
}
export function attentionTheme(at = Date.now()) {
  return currentPolicy ? scheduledTheme(currentPolicy, at) : null;
}
export function allowAlert(kind: "mentions" | "calls", at = Date.now()) {
  if (!currentPolicy) return true;
  const profile = currentPolicy.profiles.find(
    (p) => p.id === currentPolicy!.activeProfile,
  );
  return Boolean(profile?.[kind]) && !inQuietHours(currentPolicy, at);
}
export const minuteText = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
export const parseMinute = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
