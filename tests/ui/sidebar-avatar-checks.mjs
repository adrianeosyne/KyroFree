import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

export async function checkSidebarAvatarLayout(browser) {
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
    const artwork = process.argv.includes("--reported-art")
      ? {
          avatar: `data:image/png;base64,${(await fs.readFile("test-results/reported-avatar.png")).toString("base64")}`,
          decoration: `data:image/png;base64,${(await fs.readFile("test-results/reported-decoration.png")).toString("base64")}`,
        }
      : await page.evaluate(() => {
          const avatar = document.createElement("canvas");
          avatar.width = avatar.height = 256;
          const a = avatar.getContext("2d");
          a.fillStyle = "#f5f3ff";
          a.font = "bold 150px sans-serif";
          a.textAlign = "center";
          a.fillText("A", 128, 181);
          const decoration = document.createElement("canvas");
          decoration.width = decoration.height = 256;
          const d = decoration.getContext("2d");
          d.strokeStyle = "#38bdf8";
          d.lineWidth = 27;
          d.beginPath();
          d.arc(128, 128, 109, 0, Math.PI * 2);
          d.stroke();
          return {
            avatar: avatar.toDataURL(),
            decoration: decoration.toDataURL(),
          };
        });
    const profile = {
      name: "Adrian Eosyne",
      username: "adrianeosyne",
      customStatus: null,
      badges: ["verified", "premium"],
      primaryBadge: "verified",
      premiumBadgeTier: "Ember",
      premiumUntil: Date.now() + 90 * 86400000,
      serverTag: "KYRO",
      device: "desktop",
      displayNameFont: "handwritten",
      presence: "dnd",
      avatarDecoration: "community:layout-fixture",
      avatarDecorationUrl: artwork.decoration,
      avatarUrl: artwork.avatar,
    };
    await page.evaluate(
      (profile) =>
        localStorage.setItem("kyro.fixture.profile", JSON.stringify(profile)),
      profile,
    );
    await page.goto("http://127.0.0.1:5187/dashboard");
    const sidebar = page.locator(".kyro-sidebar");
    await expect(sidebar).toBeVisible();
    const sidebarBounds = await sidebar.boundingBox();
    assert(
      sidebarBounds.width > 264 && sidebarBounds.width <= 300,
      "The sidebar gains a small amount of width",
    );
    const account = sidebar.getByRole("button", {
      name: /Adrian Eosyne.*adrianeosyne/,
    });
    const name = account.locator(".display-name > span").first();
    await expect(name).toBeVisible();
    assert(
      await name.evaluate((e) => e.clientWidth >= 96),
      "The account name remains readable beside its badges",
    );
    assert(
      await name.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      "The account's normal display name fits in full",
    );
    await expect(
      account.locator('[aria-label^="Premium · Ember:"]'),
    ).toBeVisible();
    await expect(
      account.getByRole("button", { name: "KYRO", exact: true }),
    ).toBeVisible();
    await expect(
      account.getByLabel("Active on desktop", { exact: true }),
    ).toBeVisible();
    await page.evaluate(
      (profile) =>
        window.setFixtureQuery("conversations:list", [
          {
            id: "dm-maya",
            type: "dm",
            participants: [
              { id: "me", name: profile.name },
              { ...profile, id: "maya", name: "Vewity", username: "aras" },
            ],
            name: null,
            lastMessagePreview: "Hello there",
            unread: false,
          },
        ]),
      profile,
    );
    const contact = sidebar
      .locator('a[href="/dashboard/dm/dm-maya"] .display-name > span')
      .first();
    await expect(contact).toHaveText("Vewity");
    assert(
      await contact.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      "Short contact names fit alongside badges",
    );
    for (const width of [240, 272, 320]) {
      await page.evaluate(
        (width) =>
          window.setFixtureData("workspace:get", {
            ...window.fixtureData["workspace:get"],
            premiumUntil: Date.now() + 86400000,
            theme: {
              ...window.fixtureData["workspace:get"].theme,
              sidebarWidth: width,
            },
          }),
        width,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-workspace",
        "true",
      );
      await expect(sidebar).toHaveCSS("width", `${width}px`);
      assert(
        await name.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        "The account name fits at customized widths; badges can wrap when needed",
      );
    }
    await page.evaluate(() =>
      window.setFixtureData("workspace:get", {
        ...window.fixtureData["workspace:get"],
        theme: {
          ...window.fixtureData["workspace:get"].theme,
          sidebarWidth: 272,
        },
      }),
    );
    await expect(sidebar).toHaveCSS("width", "272px");
    await sidebar.screenshot({
      path: "test-results/kyro-sidebar-name-width.png",
    });

    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto("http://127.0.0.1:5187/dashboard?previewUser=me");
      const preview = page.locator(".user-preview-enter");
      await expect(preview).toBeVisible();
      const decoration = preview.locator("img.avatar-decoration-art");
      await expect(decoration).toBeVisible();
      await expect
        .poll(() =>
          decoration.evaluate((e) => e.complete && e.naturalWidth > 0),
        )
        .toBe(true);
      const portrait = decoration.locator("..");
      const artBounds = await decoration.boundingBox(),
        portraitBounds = await portrait.boundingBox();
      assert(
        artBounds.width > portraitBounds.width * 1.2,
        "The decoration surrounds the portrait instead of shrinking inside it",
      );
      assert(
        Math.abs(artBounds.width - artBounds.height) < 1,
        "Square artwork stays square",
      );
      assert(
        Math.abs(
          artBounds.x +
            artBounds.width / 2 -
            portraitBounds.x -
            portraitBounds.width / 2,
        ) < 1,
        "The decoration stays centered horizontally",
      );
      assert(
        Math.abs(
          artBounds.y +
            artBounds.height / 2 -
            portraitBounds.y -
            portraitBounds.height / 2,
        ) < 1,
        "The decoration stays centered vertically",
      );
      const wrapper = await portrait.locator("..").boundingBox();
      assert(
        Math.abs(wrapper.width - wrapper.height) < 1,
        "The avatar wrapper has no extra baseline space",
      );
      await page.keyboard.press("Escape");
      await preview.screenshot({
        path: `test-results/kyro-avatar-fit-${width}.png`,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "The page fits the viewport",
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: modest sidebar width, readable account/contact names with badges and tags, and centered avatar decorations on desktop and phone",
    );
  } finally {
    await context.close();
  }
}
