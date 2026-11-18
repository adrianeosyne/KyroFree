import { devices, expect } from "@playwright/test";
import assert from "node:assert/strict";

const base = "http://127.0.0.1:5187";
export async function checkMobile(browser) {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:5187)/, (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/dashboard`);
    const banner = page.getByRole("complementary", {
      name: "Download Kyro for Android",
      exact: true,
    });
    await expect(banner).toBeVisible();
    const dock = page.getByRole("navigation", {
      name: "Mobile navigation",
      exact: true,
    });
    await dock.getByRole("button", { name: "Chats", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Messages." }),
    ).toBeVisible();
    await expect(
      dock.getByRole("button", { name: "Chats", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const main = page.locator("main");
    await page.getByLabel("Search mobile messages").fill("Leo");
    await expect(main.locator('a[href="/dashboard/dm/dm-leo"]')).toBeVisible();
    await expect(main.locator('a[href="/dashboard/dm/dm-maya"]')).toHaveCount(
      0,
    );
    await page.getByLabel("Search mobile messages").clear();
    await page
      .getByRole("group", { name: "Mobile message filters" })
      .getByRole("button", { name: "Unread", exact: true })
      .click();
    await expect(main.locator('a[href="/dashboard/dm/dm-leo"]')).toHaveCount(0);
    await page.screenshot({
      path: "test-results/android-mobile-messages.png",
      animations: "disabled",
    });
    await main.locator('a[href="/dashboard/dm/dm-maya"]').click();
    await expect(
      page.getByRole("button", { name: "Back to messages", exact: true }),
    ).toBeVisible();
    await expect(dock).toBeHidden();
    await expect(page.locator("textarea")).toHaveCSS("font-size", "16px");
    await page.locator("textarea").fill("A message from my phone");
    await page.screenshot({
      path: "test-results/android-mobile-chat.png",
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Back to messages", exact: true })
      .click();
    await banner.getByRole("link", { name: "Download", exact: true }).click();
    await expect(page).toHaveURL(/\/download#android$/);
    await expect(
      page.getByRole("heading", { name: "Kyro for Android", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download Android APK", exact: true }),
    ).toHaveAttribute(
      "href",
      /releases\/download\/android-v1\.0\.0\/Kyro-Android-1\.0\.0\.apk$/,
    );
    await expect(
      page.getByRole("link", { name: "View Android source", exact: true }),
    ).toHaveAttribute(
      "href",
      /github\.com\/adrianeosyne\/KyroFree\/tree\/main\/mobile\/android$/,
    );
    await page.screenshot({
      path: "test-results/android-download-mobile.png",
      fullPage: true,
    });
    await page.goto(`${base}/dashboard`);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await dock.getByRole("button", { name: "Chats", exact: true }).click();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Mobile content fits ${width}px`,
      );
    }
    await banner
      .getByRole("button", { name: "Dismiss app download prompt", exact: true })
      .click();
    await page.reload();
    await expect(banner).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }

  const native = await browser.newContext({
    ...devices["Pixel 7"],
    userAgent: `${devices["Pixel 7"].userAgent} KyroAndroid/1.0.0`,
  });
  try {
    const page = await native.newPage();
    await page.goto(`${base}/dashboard/chats`);
    await expect(
      page.getByRole("heading", { name: "Messages." }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", {
        name: "Download Kyro for Android",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await native.close();
  }

  const iphone = await browser.newContext({ ...devices["iPhone 13"] });
  try {
    const page = await iphone.newPage();
    await page.goto(`${base}/auth`);
    await expect(
      page.getByRole("complementary", {
        name: "Install Kyro on your phone",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Install", exact: true }).click();
    await expect(page).toHaveURL(/\/download#web-app$/);
    await expect(
      page.getByText(
        "In Safari, tap Share, then Add to Home Screen. Kyro opens in its own window.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await iphone.close();
  }
  console.log(
    "PASS: Android browser prompt, source and APK links, native suppression, mobile messages/search/unread/back, 320–430px layouts and iPhone web installation",
  );
}
