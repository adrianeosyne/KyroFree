import { expect } from "@playwright/test";
import assert from "node:assert/strict";
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEekAAAAASUVORK5CYII=",
  "base64",
);
export async function checkFeatures(page) {
  await page.goto("http://127.0.0.1:5187/dashboard?settings=premium");
  const settings = page.locator(".settings-dialog");
  const nav = settings.getByRole("navigation", { name: "Settings sections" });
  await expect(
    settings.getByRole("heading", { name: "Play. Create. Make it yours." }),
  ).toBeVisible();
  await expect(
    settings.getByText("$1.99", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/kyro-premium-desktop.png",
    animations: "disabled",
  });
  await nav
    .getByRole("button", { name: "Workspace Studio", exact: true })
    .click();
  await expect(
    settings.getByRole("heading", { name: "Build your own Kyro." }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.setFixtureData("workspace:get", {
      premiumUntil: Date.now() + 86400000,
      theme: {
        background: "#0c0d14",
        panel: "#151724",
        accent: "#9580ff",
        text: "#eef0ff",
        radius: 14,
        sidebarWidth: 240,
        panelOpacity: 95,
        backgroundOpacity: 18,
        backgroundBlur: 0,
        font: "system",
        spacing: 100,
        borderWidth: 1,
        shadow: 20,
        backgroundPosition: "center",
        backgroundFit: "cover",
        contrast: 100,
      },
      backgroundUrl: null,
    }),
  );
  await expect(
    settings.getByRole("heading", { name: "Your workspace. Your world." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-workspace", "true");
  await settings.getByLabel("Corner radius", { exact: true }).fill("22");
  await settings
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  const saved = await page.evaluate(() =>
    window.fixtureMutations.findLast((x) => x.name === "workspace:save"),
  );
  assert.equal(saved.args.theme.radius, 22);
  await page.evaluate(() =>
    window.setFixtureData("workspace:get", {
      premiumUntil: null,
      theme: {},
      backgroundUrl: null,
    }),
  );
  await expect(page.locator("html")).not.toHaveAttribute("data-workspace");
  await nav.getByRole("button", { name: "My Profile", exact: true }).click();
  await settings.getByLabel("Search profile themes").fill("Cyberpunk");
  await expect(
    settings.getByRole("button", { name: "Cyberpunk Arena", exact: true }),
  ).toBeVisible();
  await settings.getByLabel("Search avatar frames").fill("Dragon");
  await expect(
    settings.getByRole("button", { name: /Dragon Sentinel$/ }),
  ).toBeVisible();
  await nav
    .getByRole("button", { name: "Decoration Workshop", exact: true })
    .click();
  await settings.getByLabel("Artwork file").setInputFiles({
    name: "original.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(
    settings.getByRole("img", { name: "Your decoration preview" }),
  ).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Submit for review" }),
  ).toBeDisabled();
  await settings.getByLabel("Decoration name").fill("My neon rune");
  await settings
    .getByText("I created this artwork and own the rights to share it.", {
      exact: true,
    })
    .click();
  await expect(
    settings.getByRole("button", { name: "Submit for review" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/kyro-workshop-desktop.png",
    animations: "disabled",
  });
  await nav.getByRole("button", { name: "Accessibility", exact: true }).click();
  await settings.getByRole("switch", { name: "Use the Kyro cursor" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-custom-cursor",
    "false",
  );
  await settings.getByRole("switch", { name: "Use the Kyro cursor" }).click();
  await nav.getByRole("button", { name: "Premium", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/kyro-premium-mobile.png",
    animations: "disabled",
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Premium mobile overflows viewport",
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await settings
    .getByRole("button", { name: "Close settings", exact: true })
    .filter({ visible: true })
    .click();
  await page.goto("http://127.0.0.1:5187/dashboard/s/studio/settings/overview");
  await expect(
    page.getByRole("heading", { name: "Make a great first impression." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/kyro-server-profile.png",
    animations: "disabled",
  });
  await page.getByLabel("Search server settings").fill("safety");
  await page
    .getByRole("navigation", { name: "Server settings" })
    .getByRole("button", { name: "Safety & onboarding", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A safer community starts here." }),
  ).toBeVisible();
  await page.getByLabel("Search server settings").fill("");
  await page
    .getByRole("navigation", { name: "Server settings" })
    .getByRole("button", { name: "Events & supercharge" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Schedule an event" }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5187/dashboard/s/studio/c/general");
  await page.evaluate(() => {
    window.fixtureMutations = [];
    window.revokedPreviewUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.revokedPreviewUrls.push(url);
      revoke(url);
    };
  });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let index = 0;
  await page.route("**/fixture-upload", async (route) => {
    index++;
    await pending;
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ storageId: `preview-${index}` }),
      });
    } catch {}
  });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "first.png", mimeType: "image/png", buffer: pixel },
      { name: "second.png", mimeType: "image/png", buffer: pixel },
    ]);
  await expect(
    page.getByRole("button", { name: "Preview first.png", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  const composer = page.locator("textarea").first();
  await composer.fill("Pictures ready for review");
  await composer.press("Enter");
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.filter((x) => x.name === "messages:send"),
      )
    ).length,
    0,
  );
  await page
    .getByRole("button", { name: "Preview first.png", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Full preview of first.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next image", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Full preview of second.png" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to message" }).click();
  await page.screenshot({
    path: "test-results/kyro-attachment-previews.png",
    animations: "disabled",
  });
  release();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Remove first.png", exact: true })
    .click();
  assert.equal(
    (await page.evaluate(() => window.revokedPreviewUrls)).length,
    1,
  );
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Preview second.png", exact: true }),
  ).toHaveCount(0);
  const sent = await page.evaluate(() =>
    window.fixtureMutations.filter((x) => x.name === "messages:send"),
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].args.attachments.length, 1);
  assert.equal(
    (await page.evaluate(() => window.revokedPreviewUrls)).length,
    2,
  );
  await page.unroute("**/fixture-upload");
  await page.route("**/fixture-upload", (route) =>
    route.fulfill({ status: 503, body: "temporary failure" }),
  );
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: pixel });
  await expect(
    page.getByRole("button", { name: "Retry retry.png" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/fixture-upload");
  await page.route("**/fixture-upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"storageId":"retried"}',
    }),
  );
  await page.getByRole("button", { name: "Retry retry.png" }).click();
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Remove retry.png" }).click();
  await page.unroute("**/fixture-upload");
  await page.goto("http://127.0.0.1:5187/dashboard");
  console.log(
    "PASS: Premium and studio gates, catalog search, original-art preview, cursor toggle, responsive settings, server settings, pending image gallery, send gate, removal, cleanup and retry",
  );
}
