import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export async function checkBadges(page) {
  await page.evaluate(() => {
    window.setFixtureData("users:me", {
      ...window.fixtureData["users:currentUser"],
      isFounder: true,
      badges: ["founder"],
    });
    window.setFixtureData("admin:overview", {
      allowed: true,
      me: {
        platformRole: "founder",
        isFounder: true,
        isAdmin: true,
        isStaff: true,
      },
      counts: {
        users: 5,
        online: 2,
        servers: 3,
        openReports: 0,
        openBugs: 0,
        activeBans: 0,
        activeWarnings: 0,
        admins: 1,
        moderators: 0,
      },
      recentActions: [],
    });
    window.setFixtureData("premium:memberStatus", {
      premiumUntil: null,
      premiumBadgeTier: null,
      premiumSince: null,
      premiumStreakSince: null,
    });
  });
  await page.evaluate(() => {
    history.pushState(null, "", "/dashboard/admin");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.getByRole("button", { name: "Premium", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Premium", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Select my account", exact: true })
    .click();
  await expect(page.getByLabel("Premium recipient")).toHaveValue(/Alex Morgan/);
  const earliestSince = await page.evaluate(() => Date.now() - 90_000);
  await expect
    .poll(() =>
      page
        .getByLabel("Premium since", { exact: true })
        .evaluate((input) => new Date(input.value).getTime()),
    )
    .toBeGreaterThan(earliestSince);
  await page
    .getByLabel("Subscription duration", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel("Subscription duration in days", { exact: true })
    .fill("45");
  await expect(
    page.getByRole("status").filter({ hasText: "Premium expires" }),
  ).toContainText("45 days remaining");
  await page
    .getByLabel("Subscription duration", { exact: true })
    .selectOption("30");
  await page.getByLabel("Premium badge tier").selectOption("Celestial");
  await page
    .getByRole("button", { name: "Assign badge tier", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (c) => c.name === "premium:setBadgeTier",
        ).args,
    ),
    { userId: "me", tier: "Celestial" },
  );
  await page.evaluate(() =>
    window.setFixtureData("premium:memberStatus", {
      premiumUntil: Date.now() + 86400000,
      premiumBadgeTier: "Celestial",
      premiumSince: Date.now(),
      premiumStreakSince: Date.now(),
    }),
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Current badge tier:" }),
  ).toContainText("Celestial");
  await page.getByLabel("Premium badge tier").selectOption("automatic");
  await page
    .getByRole("button", { name: "Use automatic badge tier", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (c) => c.name === "premium:setBadgeTier",
        ).args,
    ),
    { userId: "me", tier: null },
  );
  await page.getByLabel("Premium recipient").fill("Maya");
  await expect(
    page.getByRole("button", { name: "Assign badge tier", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Use automatic badge tier", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Maya Chen.*@maya_chen/ }).click();
  await page.getByLabel("Premium badge tier").selectOption("Iron");
  await page
    .getByRole("button", { name: "Assign badge tier", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (c) => c.name === "premium:setBadgeTier",
        ).args,
    ),
    { userId: "maya", tier: "Iron" },
  );
  await page.evaluate(() =>
    window.setFixtureData("premium:memberStatus", {
      premiumUntil: Date.now() + 30 * 86400000,
      premiumSince: Date.now() - 200 * 86400000,
      premiumStreakSince: Date.now(),
      premiumBadgeTier: "Iron",
    }),
  );
  await page.getByLabel("Premium days in a row", { exact: true }).fill("29");
  await expect(
    page.getByRole("status").filter({ hasText: "Premium expires" }),
  ).toContainText("1 day remaining");
  await page
    .getByRole("button", { name: "Save subscription", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (call) => call.name === "premium:updateSubscription",
        ).args,
    ),
    { userId: "maya", streakDays: 29 },
  );
  await page.evaluate(() =>
    window.setFixtureData("premium:memberStatus", {
      premiumUntil: Date.now() + 86400000,
      premiumSince: Date.now() - 200 * 86400000,
      premiumStreakSince: Date.now() - 29 * 86400000,
      premiumBadgeTier: "Iron",
    }),
  );
  await page
    .getByLabel("Subscription duration", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel("Subscription duration in days", { exact: true })
    .fill("45");
  await expect(
    page.getByRole("status").filter({ hasText: "Premium expires" }),
  ).toContainText("16 days remaining");
  await page
    .getByRole("button", { name: "Save subscription", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (call) => call.name === "premium:updateSubscription",
        ).args,
    ),
    { userId: "maya", durationDays: 45 },
  );
  await page.evaluate(() =>
    window.setFixtureData("premium:memberStatus", {
      premiumUntil: Date.now() + 16 * 86400000,
      premiumSince: Date.now() - 200 * 86400000,
      premiumStreakSince: Date.now() - 29 * 86400000,
      premiumBadgeTier: "Iron",
    }),
  );
  await page
    .getByLabel("Premium since", { exact: true })
    .fill("2026-09-01T09:30");
  await page
    .getByRole("button", { name: "Save subscription", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (call) => call.name === "premium:updateSubscription",
        ).args,
    ),
    {
      userId: "maya",
      premiumSince: await page.evaluate(() =>
        new Date("2026-09-01T09:30").getTime(),
      ),
    },
  );
  await page
    .getByLabel("Grant duration", { exact: true })
    .selectOption("custom");
  await page.getByLabel("Grant duration in days", { exact: true }).fill("45");
  await page
    .getByRole("button", { name: "Grant 45 days", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (call) => call.name === "premium:grant",
        ).args,
    ),
    { userId: "maya", days: 45 },
  );
  await page
    .getByRole("button", { name: "Remove Premium", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast((c) => c.name === "premium:grant")
          .args,
    ),
    { userId: "maya", revoke: true },
  );
  await page.screenshot({
    path: "test-results/premium-founder-controls.png",
    animations: "disabled",
  });
  await page
    .getByLabel("Premium code duration", { exact: true })
    .selectOption("custom");
  await page
    .getByLabel("Premium code duration in days", { exact: true })
    .fill("45");
  await page
    .getByLabel("Number of Premium codes", { exact: true })
    .selectOption("1");
  await page
    .getByRole("button", { name: "Generate Premium code", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (call) => call.name === "premiumCodes:generate",
        ).args.days,
    ),
    45,
  );
  await page.goto("http://127.0.0.1:5187/dashboard/badge-preview");
  await expect(page.getByTestId("gift-0").locator("svg")).toHaveCount(0);
  await expect(
    page
      .getByTestId("gifts-only-profile")
      .getByLabel("Super Gifter: 25 Premium gifts given"),
  ).toBeVisible();
  for (const [count, name, color] of [
    [1, "Gifter", "#fb72b7"],
    [9, "Gifter", "#fb72b7"],
    [10, "Big Gifter", "#ae72ff"],
    [24, "Big Gifter", "#ae72ff"],
    [25, "Super Gifter", "#f472b6"],
    [49, "Super Gifter", "#f472b6"],
    [50, "Legendary Gifter", "#fde68a"],
    [100, "Legendary Gifter", "#fde68a"],
  ]) {
    const badge = page.getByTestId(`gift-${count}`).locator("[tabindex]");
    await expect(badge).toHaveText("");
    await expect(badge.locator("stop").first()).toHaveAttribute(
      "stop-color",
      color,
    );
    await badge.hover();
    await expect(page.getByRole("tooltip")).toContainText(name);
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCSS(
      "background-color",
      "rgb(17, 24, 42)",
    );
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCSS(
      "text-align",
      "center",
    );
    await expect(page.getByRole("tooltip")).toContainText(
      `${count} Premium ${count === 1 ? "gift" : "gifts"} given`,
    );
    await page.mouse.move(1000, 0);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
  await page.mouse.move(0, 0);
  await page.getByTestId("gift-10").locator("[tabindex]").focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "10 Premium gifts given",
  );
  await page
    .getByTestId("gift-10")
    .locator("[tabindex]")
    .evaluate((element) => element.blur());
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.locator('[aria-label^="Celestial:"]').hover();
  await expect(page.getByRole("tooltip").locator("strong")).toHaveText(
    "Celestial",
  );
  await expect(page.getByRole("tooltip")).not.toContainText(
    /assigned|founder/i,
  );
  await expect(page.locator('[aria-label^="Celestial:"]')).toContainText(
    "CELESTIAL",
  );
  await expect(page.locator('[aria-label^="Celestial:"]')).not.toHaveCSS(
    "-webkit-text-fill-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.mouse.move(1000, 0);
  for (const tier of ["Premium", "Ember"]) {
    await page
      .getByTestId(`premium-tier-${tier}`)
      .locator("[tabindex]")
      .hover();
    await expect(page.getByRole("tooltip").locator("strong")).toHaveText(tier);
    await page.mouse.move(1000, 0);
  }
  await page.screenshot({
    path: "test-results/gift-badge-variants.png",
    animations: "disabled",
  });
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewportSize(viewport);
  console.log(
    "PASS: founder self-assignment, tier reset, member search, removal, gift icons/counts/thresholds, focus tooltip and Premium tier label",
  );
}
