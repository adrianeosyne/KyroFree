import { describe, expect, it } from "vitest";
import {
  PREMIUM_PRICE,
  PREMIUM_RELEASE_OFFER,
  premiumCountdown,
  premiumPricing,
} from "../../src/lib/entitlements";

describe("Premium release pricing", () => {
  const { startsAt, endsAt } = PREMIUM_RELEASE_OFFER;

  it("keeps the default price and limits the release offer to exactly two weeks", () => {
    expect(PREMIUM_PRICE).toBe("$1.99/month");
    expect(endsAt - startsAt).toBe(14 * 86400000);
    expect(premiumPricing(startsAt - 1).price).toBe("$1.99");
    expect(premiumPricing(startsAt)).toEqual({
      price: "$0.99",
      offerActive: true,
      remainingMs: 14 * 86400000,
    });
  });

  it("restores the regular price at the shared deadline", () => {
    expect(premiumPricing(endsAt - 1).price).toBe("$0.99");
    expect(premiumPricing(endsAt)).toEqual({
      price: "$1.99",
      offerActive: false,
      remainingMs: 0,
    });
    expect(premiumPricing(endsAt + 86400000).price).toBe("$1.99");
  });

  it("counts down through day and second boundaries without negative values", () => {
    expect(
      premiumCountdown(premiumPricing(startsAt + 1000).remainingMs),
    ).toEqual({ days: 13, hours: 23, minutes: 59, seconds: 59 });
    expect(premiumCountdown(500)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 1,
    });
    expect(premiumCountdown(-1000)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});
