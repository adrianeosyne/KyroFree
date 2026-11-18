export function text(
  value: string,
  label: string,
  max: number,
  allowEmpty = false,
) {
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > max)
    throw new Error(
      `${label} must contain ${allowEmpty ? "0" : "1"}–${max} characters.`,
    );
  return result;
}
export function timezone(value: string) {
  if (value.length > 100) throw new Error("Choose a valid timezone.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new Error("Choose a valid timezone.");
  }
  return value;
}
export function futureTime(value: number, label: string, minMs = 10_000) {
  if (
    !Number.isSafeInteger(value) ||
    value < Date.now() + minMs ||
    value > Date.now() + 366 * 86400_000
  )
    throw new Error(
      `${label} must be between ${Math.ceil(minMs / 1000)} seconds and one year from now.`,
    );
  return value;
}
export function lifetime(value?: number) {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value < 60 || value > 30 * 86400)
  )
    throw new Error("Message expiry must be between one minute and 30 days.");
  return value;
}
export function revision(actual: number, expected: number) {
  if (!Number.isSafeInteger(expected) || actual !== expected)
    throw new Error(
      "This changed on another device. Reload the latest version before saving.",
    );
}
