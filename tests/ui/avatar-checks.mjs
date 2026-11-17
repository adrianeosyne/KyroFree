import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkAvatarDecorations(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1:5187)/, (route) =>
    route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("http://127.0.0.1:5187/dashboard");
    await expect(
      page.getByRole("heading", { name: /Good to see you/ }),
    ).toBeVisible();
    // A transparent ring with a 200px portrait opening on a 256px canvas.
    // Its opening should surround the portrait at every rendered avatar size.
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.arc(128, 128, 112, 0, Math.PI * 2);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 24;
      ctx.stroke();
      const artwork = canvas.toDataURL("image/png");
      const user = {
        ...window.fixtureData["users:me"],
        avatarUrl: "/logo-192.png",
        avatarDecoration: "community:fit-regression",
        avatarDecorationUrl: artwork,
        presence: "dnd",
      };
      window.setFixtureData("users:me", user);
      window.setFixtureData("users:profile", {
        user,
        mutualServers: [],
        mutualFriends: [],
        serverRoles: [],
        serverJoinedAt: null,
      });
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.evaluate(() => {
        history.pushState(null, "", "/dashboard?user=me");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      const profile = page.getByRole("dialog");
      await expect(profile).toBeVisible();
      const decoration = profile.locator('img[src^="data:image/png"]');
      await expect(decoration).toBeVisible();
      await expect(
        profile.getByLabel("Do not disturb", { exact: true }).first(),
      ).toBeVisible();
      const geometry = await page
        .locator('img[src^="data:image/png"]')
        .evaluateAll((images) =>
          images.map((image) => {
            const art = image.getBoundingClientRect();
            const portrait = image.parentElement.getBoundingClientRect();
            return {
              opening: art.width * (200 / 256),
              portrait: portrait.width,
              square: Math.abs(art.width - art.height) < 1,
              centered:
                Math.abs(
                  art.x + art.width / 2 - portrait.x - portrait.width / 2,
                ) < 1 &&
                Math.abs(
                  art.y + art.height / 2 - portrait.y - portrait.height / 2,
                ) < 1,
            };
          }),
        );
      assert(geometry.length > 0);
      for (const fit of geometry) {
        assert(
          fit.opening >= fit.portrait,
          `Frame opening surrounds the ${fit.portrait}px portrait at ${width}px`,
        );
        assert(
          fit.square && fit.centered,
          "Decoration stays square and centered on the portrait",
        );
      }
      await profile.screenshot({
        path: `test-results/avatar-decoration-${width}.png`,
        animations: "disabled",
        scale: "css",
      });
      await profile.getByRole("button", { name: "Close", exact: true }).click();
      await expect(profile).toHaveCount(0);
    }
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
  console.log(
    "PASS: uploaded avatar frames surround portraits in desktop and mobile profiles, with visible presence indicators",
  );
}
