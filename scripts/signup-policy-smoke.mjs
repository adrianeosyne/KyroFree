import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";

// Exercise the real signup component with changing backend policy snapshots.
const fixture = path.resolve("tests/legal/signup-fixture.js");
const server = await createServer({
  configFile: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "signup-policy-fixture",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === "/auth") request.url = "/tests/legal/signup.html";
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@/hooks/use-auth", replacement: fixture },
      { find: "convex/react", replacement: fixture },
      { find: "@", replacement: path.resolve("src") },
    ],
  },
  optimizeDeps: {
    entries: ["tests/legal/signup.html"],
    include: ["react", "react-dom/client", "react/jsx-runtime", "react-router"],
  },
  server: { host: "127.0.0.1", port: 5189, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:5189)/, (route) =>
    route.abort(),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5189/auth", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  const submit = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await expect(submit).toBeDisabled();
  await expect(page.locator("#accept-terms")).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(
    "Loading current policies…",
  );
  await page.evaluate(() => window.signupFixture.load());
  await page.locator("#email").fill("signup-test@example.invalid");
  await page.locator("#password-input").fill("test-only-strong-password");
  await page.locator("#confirm-password").fill("test-only-strong-password");
  await page.locator("#username").fill("signup_test");
  for (const policy of ["terms", "privacy", "copyright"])
    await page.locator(`#accept-${policy}`).check();
  await expect(submit).toBeEnabled();

  await page.evaluate(() => window.signupFixture.updateTerms());
  await expect(page.locator("#accept-terms")).not.toBeChecked();
  await expect(page.locator("#accept-privacy")).toBeChecked();
  await expect(submit).toBeDisabled();
  await page
    .getByRole("link", { name: "Terms of Service", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Updated terms served by the backend."),
  ).toBeVisible();
  await expect(dialog.getByText(/Version .+-updated/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator("#accept-terms").check();
  await expect(submit).toBeEnabled();

  // A deployment between acceptance and submission must require another review.
  await page.evaluate(() => {
    window.signupFixture.rejectNext = true;
  });
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText(
    "The policies have changed. Review and accept the updated policies below, then create your account again.",
  );
  for (const policy of ["terms", "privacy", "copyright"])
    await expect(page.locator(`#accept-${policy}`)).not.toBeChecked();
  await expect(submit).toBeDisabled();
  await expect(page.locator("#email")).toHaveValue(
    "signup-test@example.invalid",
  );
  await expect(page.locator("#password-input")).toHaveValue(
    "test-only-strong-password",
  );
  await expect(page.locator("#username")).toHaveValue("signup_test");
  assert.equal(await page.evaluate(() => window.signupFixture.calls.length), 1);

  for (const policy of ["terms", "privacy", "copyright"])
    await page.locator(`#accept-${policy}`).check();
  await submit.click();
  await expect(
    page.getByText("Verify your email", { exact: true }),
  ).toBeVisible();
  const calls = await page.evaluate(() => window.signupFixture.calls);
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].args.legalAcceptance.termsVersion,
    calls[0].args.legalAcceptance.termsVersion + "-updated",
  );
  assert.equal(calls[1].args.legalAcceptance.termsAccepted, true);
  assert.equal(calls[1].args.legalAcceptance.privacyAccepted, true);
  assert.equal(calls[1].args.legalAcceptance.copyrightAccepted, true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: loading guard, current server content, policy changes require acceptance, readable stale-policy error, preserved draft, and successful retry.",
  );
} finally {
  await browser?.close();
  await server.close();
}
