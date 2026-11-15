import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const cursorPng = readFileSync(
  new URL("../../public/logo-32.png", import.meta.url),
);
// A two-frame original GIF fixture (magenta and cyan), looping every 100 ms.
const animatedGif = Buffer.from(
  "47494638396101000100800000ff00ff00ffff21ff0b4e45545343415045322e30030100000021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b",
  "hex",
);

export async function checkWorkspaceAssets(page, settings, nav) {
  await settings
    .getByRole("button", { name: "Orbitron Command font theme", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "Neon Shard cursor", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  const savedTheme = await page.evaluate(
    () =>
      window.fixtureMutations.findLast((x) => x.name === "workspace:save").args
        .theme,
  );
  assert.equal(savedTheme.font, "orbitron");
  assert.equal(savedTheme.cursor, "neon-shard");
  await page.evaluate((theme) => {
    window.workspaceFixture = {
      premiumUntil: Date.now() + 86400000,
      theme,
      backgroundUrl: null,
      backgroundPosterUrl: null,
      backgroundMayAnimate: false,
      cursorUrl: null,
    };
    window.setFixtureData("workspace:get", window.workspaceFixture);
  }, savedTheme);
  await expect(page.locator("body")).toHaveCSS("font-family", /Orbitron/);
  await expect(page.locator("body")).toHaveCSS("cursor", /neon-shard-default/);
  await expect(
    settings.getByRole("button", { name: "Save workspace", exact: true }),
  ).toHaveCSS("cursor", /neon-shard-pointer/);
  assert(
    await page.evaluate(
      async () => (await document.fonts.load("16px Orbitron")).length > 0,
    ),
    "Bundled font failed to load",
  );
  await settings.getByLabel("Enable custom cursors").uncheck();
  await expect(page.locator("html")).toHaveAttribute(
    "data-custom-cursor",
    "false",
  );
  await expect(page.locator("body")).not.toHaveCSS("cursor", /neon-shard/);
  await settings.getByLabel("Enable custom cursors").check();
  await settings
    .getByRole("heading", { name: "Font themes", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/kyro-workspace-fonts-desktop.png",
    animations: "disabled",
  });
  await settings
    .getByRole("heading", { name: "Cursor collection", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/kyro-workspace-cursors-desktop.png",
    animations: "disabled",
  });

  let uploads = [];
  await page.route("**/fixture-upload", (route) => {
    const storageId = `studio-upload-${uploads.length}`;
    uploads.push({
      storageId,
      type: route.request().headers()["content-type"],
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ storageId }),
    });
  });
  await settings.getByLabel("Background image", { exact: true }).setInputFiles({
    name: "my-world.gif",
    mimeType: "image/gif",
    buffer: animatedGif,
  });
  const background = settings.getByRole("img", {
    name: "Selected background preview",
    exact: true,
  });
  await expect(
    settings.getByText("Preparing your background preview…", { exact: true }),
  ).toHaveCount(0);
  await expect(background).toBeVisible();
  assert.equal(uploads.length, 0, "Background uploaded before confirmation");
  assert.equal(
    await background.evaluate(async (img) =>
      (await fetch(img.src)).headers.get("Content-Type"),
    ),
    "image/jpeg",
    "Reduced-motion preview is not a still frame",
  );
  await nav.getByRole("button", { name: "Accessibility", exact: true }).click();
  const reduceMotion = settings.getByRole("switch", {
    name: "Reduce motion",
    exact: true,
  });
  if ((await reduceMotion.getAttribute("aria-checked")) === "true")
    await reduceMotion.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "false",
  );
  await nav
    .getByRole("button", { name: "Workspace Studio", exact: true })
    .click();
  // Selecting a tab releases the unsaved preview, so select it again with motion enabled.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await settings.getByLabel("Background image", { exact: true }).setInputFiles({
    name: "my-world.gif",
    mimeType: "image/gif",
    buffer: animatedGif,
  });
  await expect(
    settings.getByText("Preparing your background preview…", { exact: true }),
  ).toHaveCount(0);
  await expect(background).toBeVisible();
  assert.equal(
    await background.evaluate(async (img) =>
      (await fetch(img.src)).headers.get("Content-Type"),
    ),
    "image/gif",
  );
  await settings
    .getByRole("button", { name: "Apply background", exact: true })
    .click();
  await expect(background).toHaveCount(0);
  assert.deepEqual(
    uploads.map((x) => x.type),
    ["image/gif", "image/jpeg"],
  );
  const backgroundCall = await page.evaluate(() =>
    window.fixtureMutations.findLast((x) => x.name === "workspace:background"),
  );
  assert.equal(backgroundCall.args.storageId, uploads[0].storageId);
  assert.equal(backgroundCall.args.posterStorageId, uploads[1].storageId);
  await page.evaluate(
    (gif) => {
      Object.assign(window.workspaceFixture, {
        backgroundUrl: gif,
        backgroundPosterUrl: "/logo-32.png",
        backgroundMayAnimate: true,
      });
      window.setFixtureData("workspace:get", { ...window.workspaceFixture });
    },
    `data:image/gif;base64,${animatedGif.toString("base64")}`,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--workspace-image"),
      ),
    )
    .toContain("data:image/gif");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--workspace-image"),
      ),
    )
    .toContain("/logo-32.png");

  await settings.getByLabel("Cursor image", { exact: true }).setInputFiles({
    name: "my-cursor.png",
    mimeType: "image/png",
    buffer: cursorPng,
  });
  const cursor = settings.getByRole("img", {
    name: "Selected cursor preview",
    exact: true,
  });
  await expect(cursor).toBeVisible();
  assert.equal(uploads.length, 2, "Cursor uploaded before confirmation");
  const previewUrl = await cursor.getAttribute("src");
  await settings.getByLabel("Cursor click point X", { exact: true }).fill("2");
  await settings.getByLabel("Cursor click point Y", { exact: true }).fill("1");
  assert.equal(await cursor.getAttribute("src"), previewUrl);
  assert(
    await cursor.evaluate(async (img) => {
      await fetch(img.src);
      return img.complete && img.naturalWidth === 32;
    }),
    "Cursor preview URL was revoked while changing the click point",
  );
  await expect(
    settings.getByLabel("Cursor click point X", { exact: true }),
  ).toHaveCSS("cursor", "text");
  await settings
    .getByRole("button", { name: "Apply uploaded cursor", exact: true })
    .click();
  await expect(cursor).toHaveCount(0);
  const cursorCall = await page.evaluate(() =>
    window.fixtureMutations.findLast((x) => x.name === "workspaceCursors:set"),
  );
  assert.equal(cursorCall.args.hotspotX, 2);
  assert.equal(cursorCall.args.hotspotY, 1);
  assert.equal(cursorCall.args.storageId, uploads[2].storageId);
  await page.evaluate(() => {
    Object.assign(window.workspaceFixture, {
      theme: { ...window.workspaceFixture.theme, cursor: "uploaded" },
      cursorUrl: "/logo-32.png",
      cursorHotspotX: 2,
      cursorHotspotY: 1,
    });
    window.setFixtureData("workspace:get", { ...window.workspaceFixture });
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue(
          "--kyro-cursor-default",
        ),
      ),
    )
    .toContain("2 1, auto");
  await settings
    .getByRole("button", { name: "Remove uploaded cursor", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (x) => x.name === "workspaceCursors:set",
        ).args.storageId,
    ),
    null,
  );
  await settings
    .getByRole("button", { name: "Remove background", exact: true })
    .click();
  assert.equal(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (x) => x.name === "workspace:background",
        ).args.storageId,
    ),
    null,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await settings
    .getByRole("heading", { name: "Cursor collection", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/kyro-workspace-cursors-mobile.png",
    animations: "disabled",
  });
  assert(
    await settings.evaluate((el) => el.scrollWidth <= el.clientWidth),
    "Workspace controls overflow on mobile",
  );
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.unroute("**/fixture-upload");
  console.log(
    "PASS: Premium fonts, built-in and uploaded cursors, click-point preview, background confirmation, animation, reduced motion and responsive controls",
  );
}
