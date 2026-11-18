import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export async function checkBadgeVisibility(page) {
  const profile = {
    badges: ["premium", "verifiedserverowner", "future_badge"],
    primaryBadge: "verifiedserverowner",
    premiumBadgeTier: "Radiant",
    displayNameColorMode: "gradient",
    displayNameColor: "#ff7043",
    displayNameColor2: "#8b5cf6",
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(
      (value) =>
        localStorage.setItem("kyro.fixture.profile", JSON.stringify(value)),
      profile,
    );
    await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
    const mine = page
      .locator(".message-row")
      .filter({
        has: page.getByRole("button", { name: /Open Alex Morgan's profile/ }),
      })
      .first();
    const name = mine.locator(".display-name").first();
    await expect(
      name.getByLabel(
        "Verified Server Owner: Owns a server verified by the Kyro team.",
        { exact: true },
      ),
    ).toBeVisible();
    const premium = name.getByLabel(
      "Premium · Radiant: Premium membership badge",
      { exact: true },
    );
    await expect(premium).toBeVisible();
    await expect(premium).toContainText("RADIANT");
    assert.equal(
      await name
        .locator(":scope > span")
        .first()
        .evaluate((element) => getComputedStyle(element).webkitTextFillColor),
      "rgba(0, 0, 0, 0)",
      "The gradient stays on the name text",
    );
    assert.notEqual(
      await premium.evaluate(
        (element) =>
          getComputedStyle(element.querySelector("span")).webkitTextFillColor,
      ),
      "rgba(0, 0, 0, 0)",
      "Premium text remains visible beside a gradient name",
    );
    await page.screenshot({
      path: `test-results/kyro-badges-restored-${width}.png`,
    });
    await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
    const dialog = page.locator(".settings-dialog");
    await dialog
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("button", { name: "My Profile", exact: true })
      .click();
    const tray = dialog.getByLabel("Profile badges", { exact: true });
    await expect(tray.locator('[aria-label^="Premium"]')).toHaveCount(0);
    await expect(
      dialog
        .locator(".display-name")
        .getByLabel("Premium · Radiant: Premium membership badge", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      tray.getByLabel(
        "Verified Server Owner: Owns a server verified by the Kyro team.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("This page hit an error", { exact: true }),
    ).toHaveCount(0);
  }
  for (const profile of [
    {
      badges: ["premium"],
      primaryBadge: "premium",
      premiumBadgeTier: "future_tier",
    },
    { badges: ["admin", "future_badge"], primaryBadge: "future_badge" },
    { badges: ["future_badge"], primaryBadge: "future_badge" },
  ]) {
    await page.evaluate(
      (value) =>
        localStorage.setItem("kyro.fixture.profile", JSON.stringify(value)),
      profile,
    );
    await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
    const mine = page
      .locator(".message-row")
      .filter({
        has: page.getByRole("button", { name: /Open Alex Morgan's profile/ }),
      })
      .first();
    await expect(mine).toBeVisible();
    if (profile.badges.includes("premium"))
      await expect(
        mine.getByLabel("Premium: Premium membership badge", { exact: true }),
      ).toBeVisible();
    if (profile.badges.includes("admin"))
      await expect(
        mine.getByLabel("Admin: Runs the Kyro platform.", { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByText("This page hit an error", { exact: true }),
    ).toHaveCount(0);
  }
  const membershipSince = Date.UTC(2024, 1, 3, 12);
  const sinceText = await page.evaluate(
    (value) =>
      `Premium since ${new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`,
    membershipSince,
  );
  const sinceProfile = {
    badges: ["premium"],
    primaryBadge: "premium",
    premiumBadgeTier: "Radiant",
    premiumSince: membershipSince,
    premiumStreakSince: Date.UTC(2025, 5, 10, 12),
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(
      (value) =>
        localStorage.setItem("kyro.fixture.profile", JSON.stringify(value)),
      sinceProfile,
    );
    await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
    const mine = page
      .locator(".message-row")
      .filter({
        has: page.getByRole("button", { name: /Open Alex Morgan's profile/ }),
      })
      .first();
    const inline = mine.getByLabel(`Premium · Radiant: ${sinceText}`, {
      exact: true,
    });
    await expect(inline).toBeVisible();
    await inline.hover();
    await expect(page.getByRole("tooltip")).toContainText(sinceText);
    // Continuous pointer movement leaves Radix's trigger-to-tooltip grace area.
    await page.mouse.move(0, 0, { steps: 8 });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await inline.focus();
    await expect(page.getByRole("tooltip")).toContainText(sinceText);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
    const dialog = page.locator(".settings-dialog");
    await dialog
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("button", { name: "My Profile", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Profile badges", { exact: true }),
    ).toHaveCount(0);
    const profileBadge = dialog
      .locator(".display-name")
      .getByLabel(`Premium · Radiant: ${sinceText}`, { exact: true })
      .first();
    await expect(profileBadge).toBeVisible();
    await profileBadge.hover();
    await expect(page.getByRole("tooltip")).toContainText(sinceText);
    await page.mouse.move(0, 0, { steps: 8 });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await profileBadge.focus();
    await expect(page.getByRole("tooltip")).toContainText(sinceText);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
  for (const since of [
    undefined,
    null,
    0,
    -1,
    "not-a-date",
    8640000000000001,
  ]) {
    await page.evaluate(
      (value) =>
        localStorage.setItem("kyro.fixture.profile", JSON.stringify(value)),
      { ...sinceProfile, premiumSince: since },
    );
    await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
    const mine = page
      .locator(".message-row")
      .filter({
        has: page.getByRole("button", { name: /Open Alex Morgan's profile/ }),
      })
      .first();
    const inline = mine.getByLabel(
      "Premium · Radiant: Premium membership badge",
      { exact: true },
    );
    await expect(inline).toBeVisible();
    await inline.hover();
    await expect(page.getByRole("tooltip")).toContainText(
      "Premium membership badge",
    );
    await expect(page.getByRole("tooltip")).not.toContainText("Premium since");
    await expect(page.getByRole("tooltip")).not.toContainText("Invalid Date");
    await page.mouse.move(0, 0, { steps: 8 });
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const [count, tier] of [
      [0, null],
      [1, "Gifter"],
      [9, "Gifter"],
      [10, "Big Gifter"],
      [24, "Big Gifter"],
      [25, "Super Gifter"],
      [49, "Super Gifter"],
      [50, "Legendary Gifter"],
      [-1, null],
      [0.5, null],
    ]) {
      await page.evaluate(
        (value) =>
          localStorage.setItem(
            "kyro.fixture.profile",
            JSON.stringify({ badges: [], premiumGiftCount: value }),
          ),
        count,
      );
      await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
      const dialog = page.locator(".settings-dialog");
      await dialog
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("button", { name: "My Profile", exact: true })
        .click();
      const tray = dialog.getByLabel("Profile badges", { exact: true });
      if (tier)
        await expect(
          tray.getByLabel(
            `${tier}: ${count} Premium ${count === 1 ? "gift" : "gifts"} given`,
            { exact: true },
          ),
        ).toBeVisible();
      else await expect(tray).toHaveCount(0);
      await expect(
        page.getByText("This page hit an error", { exact: true }),
      ).toHaveCount(0);
    }
  }
  const longName = "W".repeat(64);
  const longProfile = { ...profile, name: longName };
  const checkBounds = async (name, shouldTruncate) => {
    assert(
      await name
        .locator(":scope > span")
        .first()
        .evaluate((element) => element.getBoundingClientRect().width >= 24),
      "The name keeps enough width to show text beside its badges",
    );
    for (const label of [
      "Verified Server Owner: Owns a server verified by the Kyro team.",
      "Premium · Radiant: Premium membership badge",
    ]) {
      const badge = name.getByLabel(label, { exact: true });
      await expect(badge).toBeVisible();
      const nameBounds = await name.boundingBox();
      const badgeBounds = await badge.boundingBox();
      assert(
        badgeBounds.x >= nameBounds.x - 1 &&
          badgeBounds.x + badgeBounds.width <=
            nameBounds.x + nameBounds.width + 1,
        "The full badge fits beside the truncated name",
      );
    }
    if (shouldTruncate)
      assert(
        await name
          .locator(":scope > span")
          .first()
          .evaluate((element) => element.scrollWidth > element.clientWidth),
        "A long name truncates while the earned badges remain visible",
      );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "A long display name does not widen the page",
    );
  };
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(
      (value) =>
        localStorage.setItem("kyro.fixture.profile", JSON.stringify(value)),
      longProfile,
    );
    await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
    const mine = page
      .locator(".message-row")
      .filter({
        has: page.getByRole("button", {
          name: `Open ${longName}'s profile`,
          exact: true,
        }),
      })
      .first();
    await expect(mine).toBeVisible();
    await checkBounds(mine.locator(".display-name").first(), width < 768);
    await page.evaluate((value) => {
      window.setFixtureQuery("conversations:get", {
        id: "dm-maya",
        type: "dm",
        name: null,
        participants: [
          { id: "me", name: "Alex Morgan" },
          {
            ...value,
            id: "maya",
            username: "maya_chen",
            avatarUrl: null,
            presence: "online",
          },
        ],
      });
    }, longProfile);
    await checkBounds(page.locator("p > .display-name").first(), width < 768);
    await page.screenshot({
      path: `test-results/kyro-long-name-header-${width}.png`,
    });

    await page.goto("http://127.0.0.1:5187/dashboard/s/studio/c/general");
    await page.evaluate((value) => {
      window.setFixtureQuery("servers:members", {
        online: [
          {
            user: {
              ...value,
              id: "me",
              username: "alex_morgan",
              avatarUrl: null,
              presence: "online",
              customStatus: null,
            },
            nickname: null,
            isOwner: false,
            topRoleColor: null,
            topRoleName: "Member",
            topHoistedRoleName: null,
          },
        ],
        offline: [],
        myPermissions: [],
      });
    }, longProfile);
    const toggle = page.getByRole("button", { name: "Toggle member list" });
    if ((await toggle.getAttribute("aria-expanded")) === "false")
      await toggle.click();
    const members = page.getByRole("complementary", { name: "Member list" });
    await expect(members).toBeVisible();
    const member = members.getByRole("button", {
      name: `Open ${longName}'s profile`,
      exact: true,
    });
    await checkBounds(member.locator(".display-name"), true);
    await page.screenshot({
      path: `test-results/kyro-long-name-badges-${width}.png`,
    });
  }
  await page.evaluate(() => localStorage.removeItem("kyro.fixture.profile"));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:5187/dashboard");
  console.log(
    "PASS: Premium tiers, gifting achievements, verified server owner and staff badges display on profiles; gradient names, unknown metadata and 64-character names keep badges visible in messages, headers and phone rosters",
  );
}
