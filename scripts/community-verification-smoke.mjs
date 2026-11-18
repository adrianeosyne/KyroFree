import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
const server = await createServer({
  configFile: false,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "convex/react",
        replacement: path.resolve("tests/community/ui-fixture.js"),
      },
      { find: "@", replacement: path.resolve("src") },
    ],
  },
  optimizeDeps: {
    entries: ["tests/community/ui.html"],
    include: ["react", "react-dom/client", "react/jsx-runtime"],
  },
  server: { host: "127.0.0.1", port: 5190, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:5190)/, (route) =>
    route.abort(),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5190/tests/community/ui.html", {
    waitUntil: "domcontentloaded",
  });
  const heartbeatCount = () =>
    page.evaluate(
      () =>
        window.communityFixture.calls.filter(
          (call) => call.name === "users:heartbeat",
        ).length,
    );
  await expect.poll(heartbeatCount).toBe(1);
  await page.evaluate(() =>
    window.communityFixture.update({ connected: false }),
  );
  await page.evaluate(() =>
    window.communityFixture.update({ connected: true }),
  );
  await expect.poll(heartbeatCount).toBe(2);
  await page.evaluate(() =>
    window.communityFixture.update({ authenticated: false, connected: false }),
  );
  await page.evaluate(() =>
    window.communityFixture.update({ connected: true, canVerify: false }),
  );
  await expect(
    page.getByRole("button", { name: "Verify server", exact: true }),
  ).toHaveCount(0);
  assert.equal(await heartbeatCount(), 2);
  await page.evaluate(() =>
    window.communityFixture.update({ authenticated: true, canVerify: true }),
  );
  await expect.poll(heartbeatCount).toBe(3);
  await page
    .getByRole("button", { name: "Verify server", exact: true })
    .click();
  await expect(
    page.getByLabel("Verified Community", { exact: true }),
  ).toBeVisible();
  const tray = page.getByLabel("Profile badges", { exact: true });
  await expect(tray).toBeVisible();
  await tray.locator("svg").hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Verified Server Owner",
  );
  await expect(page.getByRole("tooltip")).toContainText(
    "Owns a server verified by the Kyro team.",
  );
  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "Remove verification", exact: true })
    .click();
  await expect(
    page.getByLabel("Verified Community", { exact: true }),
  ).toHaveCount(0);
  await expect(tray).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: reconnect renews presence immediately; signed-out accounts stop; verification controls, blue tick, owner badge description, revocation and mobile layout.",
  );
} finally {
  await browser?.close();
  await server.close();
}
