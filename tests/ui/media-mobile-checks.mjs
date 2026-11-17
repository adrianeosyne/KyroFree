import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export async function checkMediaAndMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:5187)/, (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const touch = await context.newCDPSession(page);
  const sendTouch = (type, points = []) =>
    touch.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((point, id) => ({ ...point, id })),
    });
  const settleFrame = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  try {
    await page.goto("http://127.0.0.1:5187/dashboard/s/studio/c/general");
    const row = page.locator(".message-row").last();
    await expect(row).toBeVisible();
    const toolbars = page.locator(".message-toolbar");
    for (const toolbar of await toolbars.all())
      await expect(toolbar).toBeHidden();
    // A tap and a scrolling gesture must not open message actions.
    await row.locator(".chat-text").tap();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(row.locator(".message-toolbar")).toBeHidden();
    let rect = await row.locator(".chat-text").boundingBox();
    await sendTouch("touchStart", [{ x: rect.x + 30, y: rect.y + 8 }]);
    await sendTouch("touchMove", [{ x: rect.x + 30, y: rect.y - 32 }]);
    await sendTouch("touchEnd");
    await page.waitForTimeout(800);
    await expect(page.getByRole("menu")).toHaveCount(0);
    // Hold on the message body to open the shared actions menu.
    rect = await row.locator(".chat-text").boundingBox();
    await sendTouch("touchStart", [{ x: rect.x + 30, y: rect.y + 8 }]);
    await expect(page.getByRole("menu")).toBeVisible();
    await sendTouch("touchEnd");
    await expect(
      page.getByRole("menuitem", { name: "Reply", exact: true }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Reply", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Cancel reply" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel reply" }).tap();
    for (const toolbar of await toolbars.all())
      await expect(toolbar).toBeHidden();

    const toggle = page.getByRole("button", { name: "Toggle member list" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.tap();
    const members = page.getByRole("dialog", { name: "Members" });
    await expect(members).toBeVisible();
    await expect(
      members.getByRole("complementary", { name: "Member list" }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/kyro-members-mobile.png" });
    await members
      .getByRole("button", { name: "Open Maya Chen's profile" })
      .tap();
    await expect(members).toHaveCount(0);
    await expect(page).toHaveURL(/previewUser=maya/);
    await expect(page.locator(".user-preview-enter")).toBeVisible();
    await page
      .getByRole("button", { name: "Close preview", exact: true })
      .tap();
    await toggle.tap();
    await members.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(members).toHaveCount(0);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Members" })).toHaveCount(0);

    // Check the roster at the tablet breakpoint and after rotating to desktop.
    await page.setViewportSize({ width: 800, height: 900 });
    await toggle.tap();
    await expect(members).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(members).toHaveCount(0);
    await expect(
      page.getByRole("complementary", { name: "Member list" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(members).toHaveCount(0);

    await page.goto("http://127.0.0.1:5187/dashboard/crop-fixture");
    for (const [kind, sourceWidth, sourceHeight, width, height] of [
      ["avatar", 1200, 700, 512, 512],
      ["icon", 700, 1200, 512, 512],
      ["profile", 900, 1000, 1500, 500],
      ["server", 1800, 600, 1600, 500],
    ]) {
      const source = await page.evaluate(
        ({ width, height }) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          const pixels = ctx.createImageData(width, height);
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4;
              pixels.data[i] = Math.round((x / width) * 255);
              pixels.data[i + 1] = Math.round((y / height) * 255);
              pixels.data[i + 2] = 128;
              pixels.data[i + 3] = 255;
            }
          ctx.putImageData(pixels, 0, 0);
          return canvas.toDataURL("image/png").split(",")[1];
        },
        { width: sourceWidth, height: sourceHeight },
      );
      await page
        .getByRole("combobox", { name: "Image type" })
        .selectOption(kind);
      await page.getByLabel("Choose crop image").setInputFiles({
        name: `${kind}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(source, "base64"),
      });
      const dialog = page.getByRole("dialog", { name: "Crop fixture" });
      const save = dialog.getByRole("button", { name: "Crop and use" });
      await expect(save).toBeEnabled();
      const frame = dialog.getByLabel("Image crop preview");
      const zoom = dialog.getByRole("slider", { name: "Zoom", exact: true });
      const horizontal = dialog.getByRole("slider", {
        name: "Horizontal position",
      });
      const vertical = dialog.getByRole("slider", {
        name: "Vertical position",
      });
      const bounds = await frame.boundingBox();
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      await sendTouch("touchStart", [
        { x: cx - 25, y: cy },
        { x: cx + 25, y: cy },
      ]);
      await sendTouch("touchMove", [
        { x: cx - 50, y: cy },
        { x: cx + 50, y: cy },
      ]);
      await sendTouch("touchEnd");
      await expect
        .poll(async () => Number(await zoom.getAttribute("aria-valuenow")))
        .toBeCloseTo(200, 0);
      await settleFrame();
      const before = await frame.locator("img").boundingBox();
      await sendTouch("touchStart", [{ x: cx, y: cy }]);
      await sendTouch("touchMove", [{ x: cx + 18, y: cy + 12 }]);
      await sendTouch("touchEnd");
      await settleFrame();
      await expect
        .poll(
          async () => (await frame.locator("img").boundingBox()).x - before.x,
        )
        .toBeCloseTo(18, 0);
      await expect
        .poll(
          async () => (await frame.locator("img").boundingBox()).y - before.y,
        )
        .toBeCloseTo(12, 0);
      await dialog.getByRole("button", { name: "Reset crop" }).tap();
      await expect(zoom).toHaveAttribute("aria-valuenow", "100");
      await expect(horizontal).toHaveAttribute("aria-valuenow", "0");
      await expect(vertical).toHaveAttribute("aria-valuenow", "0");
      await zoom.focus();
      await page.keyboard.press("End");
      await horizontal.focus();
      await page.keyboard.press("Home");
      await vertical.focus();
      await page.keyboard.press("End");
      await expect(zoom).toHaveAttribute("aria-valuenow", "400");
      await expect(horizontal).toHaveAttribute("aria-valuenow", "-100");
      await expect(vertical).toHaveAttribute("aria-valuenow", "100");
      await settleFrame();
      const expectedPixels = await frame.evaluate(
        (frame, { width, height }) => {
          const img = frame.querySelector("img");
          const f = frame.getBoundingClientRect();
          const i = img.getBoundingClientRect();
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            img,
            ((i.x - f.x) / f.width) * width,
            ((i.y - f.y) / f.height) * height,
            (i.width / f.width) * width,
            (i.height / f.height) * height,
          );
          return [0.05, 0.25, 0.5, 0.75, 0.95].flatMap((y) =>
            [0.05, 0.25, 0.5, 0.75, 0.95].map((x) => [
              ...ctx.getImageData(
                Math.floor(x * width),
                Math.floor(y * height),
                1,
                1,
              ).data,
            ]),
          );
        },
        { width, height },
      );
      await page.screenshot({
        path: `test-results/kyro-crop-${kind}-mobile.png`,
      });
      await save.tap();
      await expect(dialog).toHaveCount(0);
      const result = await page.evaluate(async () => {
        const img = new Image();
        img.src = window.fixtureCrop.url;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return {
          ...window.fixtureCrop,
          width: canvas.width,
          height: canvas.height,
          pixels: [0.05, 0.25, 0.5, 0.75, 0.95].flatMap((y) =>
            [0.05, 0.25, 0.5, 0.75, 0.95].map((x) => [
              ...ctx.getImageData(
                Math.floor(x * canvas.width),
                Math.floor(y * canvas.height),
                1,
                1,
              ).data,
            ]),
          ),
        };
      });
      assert.equal(result.width, width);
      assert.equal(result.height, height);
      assert.equal(result.type, "image/webp");
      assert.equal(result.name, `${kind}-cropped.webp`);
      for (let i = 0; i < result.pixels.length; i++) {
        assert.equal(result.pixels[i][3], 255, `${kind}: no blank crop edges`);
        for (let c = 0; c < 3; c++)
          assert(
            Math.abs(result.pixels[i][c] - expectedPixels[i][c]) <= 6,
            `${kind}: saved pixels match preview at sample ${i}: ${JSON.stringify(result.pixels[i])} vs ${JSON.stringify(expectedPixels[i])}`,
          );
      }
    }
    // Broken images cannot silently export an empty crop.
    await page.getByLabel("Choose crop image").setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("invalid image"),
    });
    await expect(page.getByRole("status")).toContainText("could not be opened");
    await expect(
      page.getByRole("button", { name: "Crop and use" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).tap();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: touch-only long press actions, tap/scroll dismissal, phone/tablet members and profile selection, crop pinch/pan/reset, preview/export pixels for all four image types, invalid image handling",
    );
  } catch (error) {
    await page.screenshot({ path: "test-results/media-mobile-failure.png" });
    console.error(errors);
    throw error;
  } finally {
    await context.close();
  }
}
