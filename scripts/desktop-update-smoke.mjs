// Exercises the web updater in a real browser against a simulated deployment.
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import assert from "node:assert/strict";

const output = await build({
  entryPoints: ["src/lib/desktopWebUpdates.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "desktopUpdates",
  define: {
    "import.meta.env.PROD": "true",
    __KYRO_WEB_BUILD__: '"original-build"',
  },
  plugins: [
    {
      name: "test-drafts",
      setup(builder) {
        builder.onResolve({ filter: /^\.\/store$/ }, () => ({
          path: "drafts",
          namespace: "test",
        }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents:
            "export const useUiStore = { getState: () => ({ drafts: window.smokeDrafts || {} }) };",
        }));
      },
    },
  ],
});
const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of [
    "idle",
    "active call",
    "upload",
    "draft",
    "hidden draft",
    "typing",
    "dialog",
    "unavailable manifest",
    "invalid manifest",
  ]) {
    const context = await browser.newContext({
      userAgent: "Kyro Electron/45.2.3",
    });
    const page = await context.newPage();
    let navigations = 0,
      checks = 0;
    await page.route("https://desktop-update.test/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/desktop-version.json") {
        checks++;
        await route.fulfill({
          status: scenario === "unavailable manifest" ? 503 : 200,
          contentType: "application/json",
          body: JSON.stringify({
            build: scenario === "invalid manifest" ? "<bad>" : "updated-build",
          }),
        });
      } else {
        navigations++;
        await route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Kyro updater test</title><textarea></textarea><main></main>",
        });
      }
    });
    await page.goto("https://desktop-update.test/dashboard");
    await page.clock.install();
    await page.addScriptTag({ content: output.outputFiles[0].text });
    await page.evaluate((scenario) => {
      if (scenario === "active call" || scenario === "upload")
        document.querySelector("main").dataset.kyroUpdateBlocked = "true";
      if (scenario === "draft")
        document.querySelector("textarea").value = "unsent message";
      if (scenario === "hidden draft")
        window.smokeDrafts = { anotherChannel: "unsent message" };
      if (scenario === "dialog")
        document.querySelector("main").setAttribute("role", "dialog");
      window.desktopUpdates.startDesktopWebUpdates();
    }, scenario);
    if (scenario === "typing") {
      await page.clock.fastForward(45_000);
      await page.evaluate(() => window.dispatchEvent(new Event("input")));
      await page.clock.fastForward(15_000);
    } else await page.clock.fastForward(60_000);
    // Give the real fetch promise and possible navigation time to settle.
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(checks, 1, `${scenario}: checks latest website build`);
    assert.equal(
      navigations,
      scenario === "idle" ? 2 : 1,
      `${scenario}: refresh policy`,
    );
    if (
      [
        "active call",
        "upload",
        "draft",
        "hidden draft",
        "dialog",
        "typing",
      ].includes(scenario)
    ) {
      await page.evaluate(() => {
        document
          .querySelector("main")
          .removeAttribute("data-kyro-update-blocked");
        document.querySelector("main").removeAttribute("role");
        document.querySelector("textarea").value = "";
        window.smokeDrafts = {};
      });
      await page.clock.fastForward(60_000);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(
        navigations,
        2,
        `${scenario}: deferred update applies once safe`,
      );
    }
    console.log(`PASS: web auto-update — ${scenario}`);
    await context.close();
  }
} finally {
  await browser.close();
}
