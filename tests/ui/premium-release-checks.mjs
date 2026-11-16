import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export async function checkReleasePromotion(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:5187)/, (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  const startsAt = new Date("2026-11-16T15:50:48Z").getTime();
  const endsAt = startsAt + 14 * 86400000;
  try {
    await page.clock.setFixedTime(new Date(startsAt + 86400000));
    await page.goto("http://127.0.0.1:5187/dashboard?settings=premium");
    const settings = page.locator(".settings-dialog");
    const currentPrice = settings
      .locator("[data-premium-current-price]")
      .first();
    const offer = settings.getByRole("region", { name: "Kyro release offer" });
    const timer = offer.getByRole("timer", { name: "Release offer countdown" });
    await expect(currentPrice).toHaveText("$0.99");
    await expect(settings.locator("del")).toContainText("$1.99");
    await expect(
      offer.getByRole("heading", {
        name: "Celebrate official Kyro Release",
      }),
    ).toBeVisible();
    await expect(timer.locator("div").nth(0)).toHaveText(/13\s*days/);
    await page.reload();
    await expect(timer.locator("div").nth(0)).toHaveText(/13\s*days/);
    await settings.screenshot({
      path: "test-results/kyro-premium-release-desktop.png",
      animations: "disabled",
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await offer.scrollIntoViewIfNeeded();
    await expect(timer).toBeVisible();
    assert(
      await offer.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
      "Release offer fits the mobile settings panel",
    );
    await settings.screenshot({
      path: "test-results/kyro-premium-release-mobile.png",
      animations: "disabled",
    });

    await page.clock.setFixedTime(new Date(endsAt - 61000));
    await expect(timer.locator("div").nth(2)).toHaveText(/01\s*minutes/);
    await page.clock.setFixedTime(new Date(endsAt - 59000));
    await expect(timer.locator("div").nth(2)).toHaveText(/00\s*minutes/);
    await expect(timer.locator("div").nth(3)).toHaveText(/59\s*seconds/);
    await page.clock.setFixedTime(new Date(endsAt - 500));
    await expect(timer.locator("div").nth(3)).toHaveText(/01\s*seconds/);
    await page.clock.setFixedTime(new Date(endsAt));
    await expect(currentPrice).toHaveText("$1.99");
    await expect(offer).toHaveCount(0);
    await expect(settings.locator("del")).toHaveCount(0);
    await page.reload();
    await expect(currentPrice).toHaveText("$1.99");
    await expect(offer).toHaveCount(0);
    console.log(
      "PASS: release price, regular price, reason, fixed countdown, refresh persistence, mobile layout and automatic expiration",
    );
  } finally {
    await context.close();
  }
}
