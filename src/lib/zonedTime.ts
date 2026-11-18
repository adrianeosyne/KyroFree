function parts(instant: number, timezone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
}
export function zonedInput(instant: number, timezone: string) {
  const p = parts(instant, timezone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Reject DST gaps/overlaps rather than silently choosing an unintended instant. */
export function zonedInstant(input: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))
    throw new Error("Choose a date and time.");
  const desired = Date.parse(`${input}:00Z`);
  if (!Number.isFinite(desired)) throw new Error("Choose a valid date.");
  let guess = desired;
  for (let i = 0; i < 3; i++)
    guess += desired - Date.parse(`${zonedInput(guess, timezone)}:00Z`);
  const matches = [
    guess - 7200000,
    guess - 3600000,
    guess - 1800000,
    guess,
    guess + 1800000,
    guess + 3600000,
    guess + 7200000,
  ].filter((value) => zonedInput(value, timezone) === input);
  if (matches.length !== 1)
    throw new Error(
      "This local time is missing or repeated during a clock change. Choose another time.",
    );
  return matches[0];
}
export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function displayInstant(instant: number, timezone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(instant);
}
