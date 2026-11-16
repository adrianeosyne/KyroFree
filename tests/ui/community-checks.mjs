import { expect } from "@playwright/test";
import { checkBadges } from "./badge-checks.mjs";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5187";
async function go(page, path) {
  await page.evaluate((path) => {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
export async function checkCommunity(page) {
  await page.goto(`${base}/dashboard?settings=premium`);
  const settings = page.locator(".settings-dialog");
  await settings
    .getByLabel("Premium redeem code", { exact: true })
    .fill("KYRO-ABCD-EFGH-ABCD");
  await settings
    .getByRole("button", { name: "Redeem code", exact: true })
    .click();
  await expect(
    settings.getByText("Premium active through", { exact: false }),
  ).toBeVisible();
  await expect(
    settings.getByLabel("Premium redeem code", { exact: true }),
  ).toHaveValue("");
  await settings.getByLabel("Gift this code to another member").check();
  await settings.getByLabel("Gift recipient", { exact: true }).fill("Maya");
  await settings.getByRole("button", { name: /Maya Chen/ }).click();
  await settings
    .getByLabel("Premium redeem code", { exact: true })
    .fill("KYRO-ABCD-EFGH-ABCD");
  await settings
    .getByRole("button", { name: "Redeem and gift", exact: true })
    .click();
  assert(
    await page.evaluate(() =>
      window.fixtureMutations.some(
        (c) =>
          c.name === "premiumCodes:redeem" && c.args.recipientId === "maya",
      ),
    ),
  );
  await expect(
    settings.getByLabel("Payment reference", { exact: true }),
  ).toHaveCount(0);
  await page.goto(`${base}/dashboard/s/studio/c/general`);
  await page.evaluate(() => {
    const messages = window.fixtureData["messages:list"];
    window.setFixtureData("messages:list", {
      ...messages,
      messages: messages.messages.map((m) => ({
        ...m,
        author: {
          ...m.author,
          badges: ["premium"],
          premiumUntil: Date.now() + 86400000,
          premiumSince: Date.now() - 400 * 86400000,
          premiumStreakSince: Date.now() - 400 * 86400000,
        },
      })),
    });
  });
  const badge = page.getByLabel(/^Frost Premium:/).first();
  await expect(badge).toBeVisible();
  await badge.hover();
  await expect(page.getByRole("tooltip")).toContainText("400 days in a row");
  await expect(page.getByRole("tooltip")).toContainText("Premium since");
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    window.setFixtureData("workspace:get", {
      ...window.fixtureData["workspace:get"],
      premiumUntil: Date.now() + 86400000,
      theme: {
        ...window.fixtureData["workspace:get"].theme,
        backgroundOpacity: 70,
        backgroundBlur: 0,
      },
      backgroundUrl: "/logo-512.png",
    });
  });
  const chat = page.locator(".kyro-chat-surface");
  await expect
    .poll(() =>
      chat.evaluate((el) => getComputedStyle(el, "::before").backgroundImage),
    )
    .toContain("logo-512.png");
  await page.screenshot({
    path: "test-results/kyro-chat-background.png",
    animations: "disabled",
  });
  await go(page, "/dashboard/s/studio/lobby");
  await expect(
    page.getByRole("heading", {
      name: "Welcome to Creative Studio",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit lobby", exact: true }).click();
  const accentBefore = await page.getByLabel("Lobby accent color").inputValue();
  await page
    .getByRole("button", { name: "Apply Aurora lobby theme", exact: true })
    .click();
  await expect(page.getByLabel("Lobby accent color")).toHaveValue("#75efcf");
  await page
    .getByRole("button", { name: "Undo lobby change", exact: true })
    .click();
  await expect(page.getByLabel("Lobby accent color")).toHaveValue(accentBefore);
  await page
    .getByRole("button", { name: "Redo lobby change", exact: true })
    .click();
  await expect(page.getByLabel("Lobby accent color")).toHaveValue("#75efcf");
  const sectionsBefore = await page.getByLabel(/^Title for /).count();
  await page
    .getByRole("button", { name: /^Duplicate .* section$/ })
    .first()
    .click();
  await expect(page.getByLabel(/^Title for /)).toHaveCount(sectionsBefore + 1);
  await page
    .getByRole("button", { name: "Undo lobby change", exact: true })
    .click();
  await expect(page.getByLabel(/^Title for /)).toHaveCount(sectionsBefore);
  await page
    .getByRole("button", { name: "Redo lobby change", exact: true })
    .click();
  await expect(page.getByLabel(/^Title for /)).toHaveCount(sectionsBefore + 1);
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await page.getByLabel("Enable server lobby").check();
  await page
    .getByLabel("Lobby title", { exact: true })
    .fill("Your next adventure starts here");
  await page.getByLabel("Lobby layout").selectOption("spotlight");
  await page.getByRole("button", { name: "Add button", exact: true }).click();
  await page.getByLabel("Button 1 label").fill("Our clips");
  await page.getByLabel("Button 1 link").fill("https://example.com/clips");
  await page
    .getByRole("button", { name: /Move .* down/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Save lobby", exact: true }).click();
  const saved = await page.evaluate(
    () =>
      window.fixtureMutations.findLast((c) => c.name === "lobby:save").args
        .config,
  );
  assert.equal(saved.enabled, true);
  assert.equal(saved.layout, "spotlight");
  assert.equal(saved.buttons[0].url, "https://example.com/clips");
  await expect(page.getByRole("status")).toHaveText("All changes saved.");
  assert.equal(saved.accent, "#75efcf");
  assert.equal(
    new Set(saved.sections.map((section) => section.id)).size,
    saved.sections.length,
  );
  await page.getByRole("button", { name: "View lobby", exact: true }).click();
  await page.screenshot({
    path: "test-results/kyro-lobby-desktop.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/kyro-lobby-mobile.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await go(page, "/dashboard/s/studio");
  await expect(page).toHaveURL(/\/studio\/lobby$/);
  await go(page, "/dashboard/s/studio/settings/safety");
  await expect(
    page.getByRole("heading", { name: "AutoMod", exact: true }),
  ).toBeVisible();
  const savesBeforePreset = await page.evaluate(
    () =>
      (window.fixtureMutations ?? []).filter(
        (c) => c.name === "automod:updateSettings",
      ).length,
  );
  await page
    .getByRole("button", { name: "Apply Strict AutoMod preset", exact: true })
    .click();
  await expect(
    page.getByLabel("Block all links", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Maximum mentions", { exact: true }),
  ).toHaveValue("3");
  assert.equal(
    await page.evaluate(
      () =>
        (window.fixtureMutations ?? []).filter(
          (c) => c.name === "automod:updateSettings",
        ).length,
    ),
    savesBeforePreset,
  );
  await page
    .getByRole("button", { name: "Discard AutoMod changes", exact: true })
    .click();
  await expect(
    page.getByLabel("Maximum mentions", { exact: true }),
  ).toHaveValue("10");
  await page
    .getByRole("button", { name: "Apply Strict AutoMod preset", exact: true })
    .click();
  await page.getByLabel("Blocked words", { exact: true }).fill("spoiler");
  await page.getByRole("button", { name: "Save AutoMod", exact: true }).click();
  const automod = await page.evaluate(
    () =>
      window.fixtureMutations.findLast(
        (c) => c.name === "automod:updateSettings",
      ).args,
  );
  assert.equal(automod.blockLinks, true);
  assert.equal(automod.maxMentions, 3);
  assert.deepEqual(automod.blockedWords, ["spoiler"]);
  await page.screenshot({
    path: "test-results/kyro-automod-presets.png",
    animations: "disabled",
  });
  await go(page, "/dashboard/shards");
  await expect(
    page.getByRole("heading", { name: "The top 50", exact: true }),
  ).toBeVisible();
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
  });
  await go(page, "/dashboard/admin");
  await page
    .getByRole("button", { name: "Premium", exact: true })
    .click();
  await page.getByLabel("Premium code duration").selectOption("365");
  await page
    .getByRole("button", { name: "Generate Premium code", exact: true })
    .click();
  await expect(
    page.getByLabel("Generated Premium code", { exact: true }),
  ).toHaveText("KYRO-ABCD-EFGH-ABCD");
  assert.equal(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (c) => c.name === "premiumCodes:generate",
        ).args.days,
    ),
    365,
  );
  await page
    .getByRole("button", { name: "Clear displayed codes", exact: true })
    .click();
  await page.getByLabel("Number of Premium codes").selectOption("5");
  await page.getByLabel("Premium code redemption window").selectOption("7");
  await page
    .getByRole("button", { name: "Generate 5 Premium codes", exact: true })
    .click();
  await expect(
    page.getByLabel("Generated Premium codes", { exact: true }),
  ).toHaveCount(5);
  const batch = await page.evaluate(
    () =>
      window.fixtureMutations.findLast(
        (c) => c.name === "premiumCodes:generateBatch",
      ).args,
  );
  assert.deepEqual(batch, { days: 365, count: 5, expiresInDays: 7 });
  await expect(
    page.getByRole("button", { name: "Copy all codes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear displayed codes", exact: true })
    .click();
  await expect(
    page.getByLabel("Generated Premium codes", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search Premium code ending").fill("ABCE");
  await expect(
    page.getByText("KYRO-••••-••••-ABCE", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revoke code", exact: true }).click();
  await page.getByLabel("Filter Premium code status").selectOption("revoked");
  await expect(
    page.getByText("365 days · Revoked", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search Premium code ending").fill("ZZZZ");
  await expect(
    page.getByText("No codes match these filters.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filter Premium code status").selectOption("all");
  await page.getByLabel("Search Premium code ending").fill("");
  await page.screenshot({
    path: "test-results/kyro-premium-code-admin.png",
    animations: "disabled",
  });
  await checkBadges(page);
  await page.goto(`${base}/dashboard`);
  console.log(
    "PASS: Premium redemption, gift recipient, since tooltip, chat background, lobby editing and routing, mobile layout, Shards and founder code generation",
  );
}
export async function checkOffline(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/dashboard`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    await context.setOffline(true);
    await page.goto(`${base}/dashboard/s/studio`);
    await expect(
      page.getByRole("heading", {
        name: "Your world is still here.",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Retry connection", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Still offline");
    await page.screenshot({ path: "test-results/kyro-offline-mobile.png" });
    await context.setOffline(false);
    await expect(page.locator(".kyro-app-shell")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    console.log(
      "PASS: service worker offline navigation and automatic reconnection",
    );
  } finally {
    await context.setOffline(false);
    await page
      .evaluate(async () => {
        for (const r of await navigator.serviceWorker.getRegistrations())
          await r.unregister();
      })
      .catch(() => {});
    await context.close();
  }
}
