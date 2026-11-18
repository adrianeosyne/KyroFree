import { expect } from "@playwright/test";

export async function checkPremiumMilestones(browser) {
  const start = new Date("2026-11-18T12:00:00Z").getTime();
  for (const width of [1440, 390]) {
    for (const surface of ["message", "settings"]) {
      const context = await browser.newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      });
      await context.route(/^https?:\/\/(?!127\.0\.0\.1:5187)/, (route) =>
        route.abort(),
      );
      const page = await context.newPage();
      try {
        await page.clock.install({ time: new Date(start) });
        await page.clock.setFixedTime(new Date(start));
        await context.addInitScript(
          ({ start }) => {
            const subscription = {
              premiumStreakSince: start - 30 * 86400000 + 15000,
              premiumUntil: start + 90 * 86400000,
              premiumBadgeTier: null,
            };
            localStorage.setItem(
              "kyro.fixture.profile",
              JSON.stringify({
                ...subscription,
                badges: ["founder", "premium"],
                primaryBadge: "founder",
              }),
            );
            localStorage.setItem(
              "kyro.fixture.queries",
              JSON.stringify({
                "premium:status": {
                  ...subscription,
                  premiumGiftCount: 0,
                  hidePremiumBadge: false,
                  requests: [],
                },
              }),
            );
          },
          { start },
        );
        await page.goto(
          `http://127.0.0.1:5187/dashboard${surface === "message" ? "/dm/dm-maya" : "?settings=premium"}`,
        );
        const badge =
          surface === "message"
            ? page
                .locator(".message-row")
                .filter({
                  has: page.getByRole("button", {
                    name: /Open Alex Morgan's profile/,
                  }),
                })
                .first()
                .locator('.display-name [aria-label^="Premium"]')
            : page.locator(".settings-dialog [aria-label*='days in a row']");
        await expect(badge).toBeVisible();
        await expect(badge).toContainText("PREMIUM");
        // No fixture changes, navigation, or reload: only time passes.
        await page.clock.setFixedTime(new Date(start + 30000));
        await page.clock.fastForward(30000);
        await expect(badge).toContainText("EMBER");
        if (surface === "settings")
          await expect(badge).toHaveAttribute("aria-label", /30 days in a row/);

        if (surface === "message") {
          await page
            .getByRole("button", { name: /Open Alex Morgan's profile/ })
            .first()
            .click();
          await page
            .getByRole("button", { name: "View full profile", exact: true })
            .click();
          const profile = page
            .getByRole("dialog")
            .filter({ has: page.getByText("alex_morgan", { exact: false }) });
          await expect(
            profile.locator('.display-name [aria-label^="Premium"]'),
          ).toContainText("EMBER");
          const tray = profile.getByLabel("Profile badges", { exact: true });
          await expect(
            tray.getByLabel("Kyro Founder: Built Kyro from the ground up.", {
              exact: true,
            }),
          ).toBeVisible();
          await expect(tray.locator('[aria-label^="Premium"]')).toHaveCount(0);
          await profile.screenshot({
            path: `test-results/kyro-premium-separated-${width}.png`,
          });
        }
      } finally {
        await context.close();
      }
    }
  }
  console.log(
    "PASS: Premium becomes Ember in open messages and settings without data changes or reload, and stays outside the profile badge capsule on desktop and phone",
  );
}
