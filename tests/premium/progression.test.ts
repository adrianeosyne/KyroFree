import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  premiumDays,
  premiumTier,
} from "../../src/lib/premiumProgress";
import { getPremiumBadgeTier } from "../../src/lib/premium-badges";

const start = Date.UTC(2026, 0, 1);
const user = {
  badges: ["premium"],
  premiumStreakSince: start,
  premiumUntil: start + 2000 * DAY_MS,
};

describe("Premium milestone progression", () => {
  it.each([
    [30, "Premium", "Ember"],
    [90, "Ember", "Iron"],
    [180, "Iron", "Radiant"],
    [365, "Radiant", "Glacier"],
    [730, "Glacier", "Crimson"],
    [1095, "Crimson", "Verdant"],
    [1825, "Verdant", "Celestial"],
  ])(
    "advances at day %i across both badge renderers",
    (days, before, after) => {
      const threshold = start + Number(days) * DAY_MS;
      for (const resolve of [premiumTier, getPremiumBadgeTier]) {
        expect(resolve(user, threshold - 1).name).toBe(before);
        expect(resolve(user, threshold).name).toBe(after);
        expect(resolve(user, threshold + 1).name).toBe(after);
      }
    },
  );

  it("uses the continuous streak independently of edited historical dates", () => {
    const now = start + 400 * DAY_MS;
    const renewed = {
      ...user,
      premiumSince: start,
      premiumStreakSince: now - DAY_MS,
    };
    expect(premiumDays(renewed, now)).toBe(1);
    expect(premiumTier(renewed, now).name).toBe("Premium");
    expect(getPremiumBadgeTier(renewed, now).name).toBe("Premium");
  });

  it("preserves founder assignments and restores progression when cleared", () => {
    const now = start + 31 * DAY_MS;
    for (const resolve of [premiumTier, getPremiumBadgeTier]) {
      expect(resolve({ ...user, premiumBadgeTier: "Premium" }, now).name).toBe(
        "Premium",
      );
      expect(
        resolve({ ...user, premiumBadgeTier: "Celestial" }, now).name,
      ).toBe("Celestial");
      expect(resolve({ ...user, premiumBadgeTier: null }, now).name).toBe(
        "Ember",
      );
    }
  });

  it("ignores stale earned or assigned tiers at expiry", () => {
    const expired = {
      ...user,
      premiumUntil: start + 31 * DAY_MS,
      premiumBadgeTier: "Celestial" as const,
    };
    for (const resolve of [premiumTier, getPremiumBadgeTier])
      expect(resolve(expired, expired.premiumUntil).name).toBe("Premium");
    expect(premiumDays(expired, expired.premiumUntil)).toBe(0);
  });

  it.each([undefined, null, 0, -1, NaN, Infinity, start + 32 * DAY_MS])(
    "does not award progress for an invalid, missing, or future streak (%s)",
    (premiumStreakSince) => {
      const missing = { ...user, premiumSince: start, premiumStreakSince };
      for (const resolve of [premiumTier, getPremiumBadgeTier])
        expect(resolve(missing, start + 31 * DAY_MS).name).toBe("Premium");
    },
  );

  it("supports display metadata without expiry while respecting explicit expiry", () => {
    const display = { badges: ["premium"], premiumStreakSince: start };
    expect(getPremiumBadgeTier(display, start + 31 * DAY_MS).name).toBe(
      "Ember",
    );
    expect(
      getPremiumBadgeTier(
        { ...display, premiumUntil: null },
        start + 31 * DAY_MS,
      ).name,
    ).toBe("Premium");
  });
});
