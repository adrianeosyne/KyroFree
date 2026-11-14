// Read-only browser checks: never submit a registration or contact a recipient.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const origin = process.argv[2] || "http://127.0.0.1:4176";
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  await page.goto(`${origin}/copyright`);
  await expect(
    page.getByRole("heading", { name: "Copyright Policy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Adrian Eosyne", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "7. Legal remedies and penalties" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Legal policies" }).getByRole("link"),
  ).toHaveCount(3);
  await page.screenshot({
    path: "test-results/copyright-page.png",
    fullPage: true,
  });

  await page.goto(`${origin}/auth`);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const submit = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await page.locator("#email").fill("policy-ui-test@example.invalid");
  await page.locator("#password-input").fill("not-a-real-account-password");
  await page.locator("#confirm-password").fill("not-a-real-account-password");
  await page.locator("#username").fill("policy_ui_test");
  for (const policy of ["terms", "privacy", "copyright"]) {
    await expect(page.locator(`#accept-${policy}`)).not.toBeChecked();
  }
  await page
    .getByRole("link", { name: "Copyright Policy", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Copyright Policy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.locator("#email")).toHaveValue(
    "policy-ui-test@example.invalid",
  );
  await expect(page.locator("#password-input")).toHaveValue(
    "not-a-real-account-password",
  );
  await expect(page.locator("#accept-copyright")).not.toBeChecked();
  await page.locator("#accept-terms").check();
  await page.locator("#accept-privacy").check();
  await expect(submit).toBeDisabled();
  await page.locator("#accept-copyright").check();
  await expect(submit).toBeEnabled();
  await page.locator("#accept-privacy").uncheck();
  await expect(submit).toBeDisabled();
  await page.screenshot({
    path: "test-results/registration-policies.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(submit).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "test-results/registration-policies-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Back to sign-in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  for (const policy of ["terms", "privacy", "copyright"])
    await expect(page.locator(`#accept-${policy}`)).not.toBeChecked();
  console.log(
    "PASS: public copyright page, three explicit acceptances, policy review without draft loss, mobile layout, and fresh unchecked signup.",
  );
} finally {
  await browser.close();
}
