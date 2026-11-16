import { expect } from "@playwright/test";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5187";
const go = (page, path) =>
  page.evaluate((path) => {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);

export async function checkGiftExperience(page) {
  await page.goto(`${base}/dashboard`);
  await page.evaluate(() => {
    window.giftOriginalMe = window.fixtureData["users:me"];
    const user = {
      ...window.fixtureData["users:me"],
      badges: ["premium", "verified"],
      primaryBadge: "premium",
      premiumUntil: Date.now() + 86400000,
      premiumBadgeTier: "Glacier",
      premiumSince: Date.now(),
      premiumStreakSince: Date.now(),
      premiumGiftCount: 10,
    };
    window.setFixtureData("users:me", user);
    window.setFixtureData("users:profile", {
      user,
      serverRoles: [],
      mutualServers: [],
      mutualFriends: [],
      serverJoinedAt: null,
    });
  });
  const assertSingleTier = async (container) => {
    await expect(
      container.locator('[aria-label^="Glacier Premium:"]'),
    ).toHaveCount(1);
    await expect(
      container.locator(
        '[aria-label="Profile badges"] [aria-label*="Premium:"]',
      ),
    ).toHaveCount(0);
    await expect(
      container.locator('[aria-label^="Glacier Premium:"]'),
    ).toContainText("GLACIER");
    await expect(
      container.locator('[aria-label^="Premium Premium:"]'),
    ).toHaveCount(0);
  };
  await page
    .getByRole("button", { name: /Alex Morgan.*Making something good/ })
    .first()
    .click();
  await assertSingleTier(page.getByRole("menu"));
  await page.keyboard.press("Escape");
  await go(page, "/dashboard?settings=profile");
  await expect(
    page.getByRole("heading", { name: "My Profile", exact: true }),
  ).toBeVisible();
  await assertSingleTier(page.getByRole("region", { name: "Profile preview" }));
  await page.screenshot({
    path: "test-results/premium-single-tier-profile.png",
    animations: "disabled",
  });
  await go(page, "/dashboard?previewUser=me");
  await assertSingleTier(page.locator(".user-preview-enter"));
  await page.getByRole("button", { name: /View full profile/i }).click();
  await assertSingleTier(page.getByRole("dialog"));

  await go(page, "/dashboard?settings=premium");
  await page
    .getByLabel("Premium redeem code", { exact: true })
    .fill("KYRO-ABCD-EFGH-ABCD");
  await page
    .getByRole("button", { name: "Create gift link", exact: true })
    .click();
  await expect(
    page.getByLabel("Premium gift link", { exact: true }),
  ).toHaveValue("https://kyro-chat.cyou/gift/KYRO-ABCD-EFGH-ABCD");
  await page.evaluate(() =>
    window.setFixtureData("premiumCodes:giftPreview", {
      valid: true,
      days: 90,
      senderName: "Maya Chen",
      senderUsername: "maya_chen",
    }),
  );
  await go(page, "/gift/KYRO-ABCD-EFGH-ABCD");
  await expect(
    page.getByText("3 months of Premium", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/From Maya Chen/)).toBeVisible();
  assert.equal(
    await page.evaluate(
      () =>
        window.fixtureMutations.filter(
          (call) =>
            call.name === "premiumCodes:redeem" && call.args.fromGiftLink,
        ).length,
    ),
    0,
  );
  await page.screenshot({
    path: "test-results/premium-gift-claim.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Claim Premium gift", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard$/);
  const notice = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "You received Premium!" }),
  });
  await expect(notice).toContainText("Maya Chen");
  await expect(notice).toContainText("3 months");
  await page.screenshot({
    path: "test-results/premium-gift-notice.png",
    animations: "disabled",
  });
  await notice.getByRole("button", { name: "Enjoy Premium" }).click();
  await expect(notice).toHaveCount(0);
  await go(page, "/dashboard?settings=premium");
  await page
    .getByLabel("Premium redeem code", { exact: true })
    .fill("https://kyro-chat.cyou/gift/KYRO-ABCD-EFGH-ABCD");
  await expect(
    page.getByRole("button", { name: "Redeem code", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() =>
    window.setFixtureData("notifications:pendingPremiumGifts", [
      {
        id: "queued-gift",
        days: 30,
        senderName: "Leo Parker",
        senderUsername: "leo_parker",
        premiumUntil: Date.now() + 30 * 86400000,
      },
    ]),
  );
  await expect(
    page.getByRole("heading", { name: "You received Premium!" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Premium redeem code", { exact: true }),
  ).toHaveValue("https://kyro-chat.cyou/gift/KYRO-ABCD-EFGH-ABCD");
  await page
    .locator(".settings-dialog")
    .getByRole("button", { name: "Close settings", exact: true })
    .filter({ visible: true })
    .click();
  const queued = page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", { name: "You received Premium!" }),
    });
  await expect(queued).toContainText("Leo Parker");
  await queued
    .getByRole("button", { name: "Open Premium settings", exact: true })
    .click();
  await expect(queued).toHaveCount(0);

  await page.evaluate(() =>
    window.setFixtureData("premiumCodes:giftPreview", {
      valid: false,
      reason: "This gift has already been claimed.",
    }),
  );
  await go(page, "/gift/KYRO-ABCD-EFGH-ABCD");
  await expect(
    page.getByRole("heading", { name: "This gift is unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Claim Premium gift" }),
  ).toHaveCount(0);
  await page.evaluate(() => window.setFixtureData("fixture:signedOut", true));
  await expect(
    page.getByRole("heading", { name: "Sign in to claim your Premium gift" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const authUrl = new URL(page.url());
  assert.equal(authUrl.pathname, "/auth");
  assert.equal(
    authUrl.searchParams.get("returnTo"),
    "/gift/KYRO-ABCD-EFGH-ABCD",
  );
  await page.evaluate(() => {
    window.setFixtureData("fixture:signedOut", false);
    window.setFixtureData("users:me", window.giftOriginalMe);
  });
  await page.goto(`${base}/dashboard`);
  console.log(
    "PASS: one tier beside each profile name, gift link creation, preview and claim, sender/duration popup, dismissal, settings redemption and sign-in return path",
  );
}
