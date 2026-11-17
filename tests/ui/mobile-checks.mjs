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
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/auth`);
    await expect(
      page.getByRole("complementary", {
        name: "Install Kyro on your phone",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Install", exact: true }).click();
    await expect(page).toHaveURL(/\/install\/ios$/);
    await expect(
      page.getByRole("heading", { name: /Install Kyro on your iPhone/ }),
    ).toBeVisible();
    await expect(
      page.getByText("1. Tap Safari’s Share button", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("2. Choose Add to Home Screen", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("3. Tap Add", { exact: true })).toBeVisible();
    await page.goto(`${base}/download#ios`);
    await expect(
      page.getByRole("heading", { name: "Kyro for iOS", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View iOS source", exact: true }),
    ).toHaveAttribute(
      "href",
      "https://github.com/adrianeosyne/KyroFree/tree/main/mobile/ios",
    );
    await expect(
      page.getByRole("link", {
        name: "Native developer build guide",
        exact: true,
      }),
    ).toHaveAttribute("href", /mobile\/ios#build-and-test$/);
    await expect(
      page.getByRole("link", {
        name: "Install on iPhone or iPad",
        exact: true,
      }),
    ).toHaveAttribute("href", "/install/ios");
    await expect(
      page.getByRole("link", { name: "Install Kyro on iPhone", exact: true }),
    ).toHaveAttribute("href", "/install/ios");
    await page
      .getByRole("button", { name: "Show install steps", exact: true })
      .click();
    const guide = page.getByRole("dialog", {
      name: "Install Kyro on your iPhone",
      exact: true,
    });
    await expect(guide).toBeVisible();
    await expect(
      guide.getByText("2. Choose Add to Home Screen", { exact: true }),
    ).toBeVisible();
    await guide
      .getByRole("link", { name: "Open the installation page", exact: true })
      .click();
    await expect(page).toHaveURL(/\/install\/ios$/);
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
    await expect(page.locator(".kyro-page-enter")).toHaveCSS("opacity", "1");
    for (const width of [320, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `iPhone installation page fits ${width}px`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("link", { name: "Show install steps", exact: true })
      .click();
    assert(
      await page.evaluate(() => scrollY > 0),
      "Install button scrolls to the Safari steps",
    );
    assert(
      await page.evaluate(() => {
        const footerBottom =
          document.querySelector("footer").getBoundingClientRect().bottom +
          scrollY;
        return document.documentElement.scrollHeight <= footerBottom + 2;
      }),
      "Installation page has no empty tail after its footer",
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/iphone-only-install.png",
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
    assert.deepEqual(errors, []);
  } finally {
    await iphone.close();
  }

  const installedIOS = await browser.newContext({ ...devices["iPhone 13"] });
  try {
    await installedIOS.addInitScript(() =>
      Object.defineProperty(navigator, "standalone", {
        value: true,
        configurable: true,
      }),
    );
    const page = await installedIOS.newPage();
    await page.goto(`${base}/install/ios`);
    await expect(
      page.getByText("Kyro is installed", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Show install steps", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Show install steps", exact: true }),
    ).toHaveCount(0);
    await page.goto(`${base}/download`);
    await expect(
      page
        .locator("main > div")
        .first()
        .getByRole("link", { name: "Open Kyro", exact: true }),
    ).toHaveAttribute("href", "/dashboard");
    await page.goto(`${base}/dashboard/chats`);
    await expect(
      page.getByRole("complementary", {
        name: "Install Kyro on your phone",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Messages." }),
    ).toBeVisible();
    await page.goto(`${base}/auth`);
    await expect(
      page.getByRole("complementary", {
        name: "Install Kyro on your phone",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await installedIOS.close();
  }

  const nativeIOS = await browser.newContext({
    ...devices["iPhone 13"],
    userAgent: `${devices["iPhone 13"].userAgent} KyroIOS/1.0.0`,
  });
  try {
    const page = await nativeIOS.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/dashboard/chats`);
    await expect(
      page.getByRole("heading", { name: "Messages." }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", {
        name: "Install Kyro on your phone",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.goto(`${base}/auth`);
    await expect(
      page.getByRole("complementary", {
        name: "Install Kyro on your phone",
        exact: true,
      }),
    ).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally {
    await nativeIOS.close();
  }
  console.log(
    "PASS: Android regression checks, iPhone-only Safari installation, guide dialog, 320–768px layouts, native and home-screen install suppression",
  );
}
