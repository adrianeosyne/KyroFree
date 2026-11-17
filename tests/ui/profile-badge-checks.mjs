import { expect } from "@playwright/test";

export async function checkProfileBadges(page) {
  const dialog = page.locator(".settings-dialog");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    for (const profile of [
      {
        badges: ["premium", "founder", "future_badge", "verified"],
        primaryBadge: "premium",
        labels: ["Kyro Founder", "Verified"],
      },
      {
        badges: ["premium", "future_badge"],
        primaryBadge: "premium",
        labels: [],
      },
      {
        badges: ["founder", "verified"],
        primaryBadge: "verified",
        labels: ["Kyro Founder", "Verified"],
      },
      { badges: [], primaryBadge: "none", labels: [] },
    ]) {
      await page.evaluate(
        ({ badges, primaryBadge }) =>
          localStorage.setItem(
            "kyro.fixture.profile",
            JSON.stringify({ badges, primaryBadge }),
          ),
        profile,
      );
      await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
      await dialog
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("button", { name: "My Profile", exact: true })
        .click();
      await expect(
        dialog.getByRole("heading", { name: "My Profile", exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByText("Profile picture", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("This page hit an error", { exact: true }),
      ).toHaveCount(0);
      const badgeSection = dialog
        .locator("section")
        .filter({ has: page.getByText("Badge", { exact: true }) });
      await expect(badgeSection.getByRole("button")).toHaveCount(
        profile.labels.length,
      );
      for (const label of profile.labels)
        await expect(
          badgeSection.getByRole("button", { name: new RegExp(label) }),
        ).toBeVisible();
      if (profile.primaryBadge === "verified")
        await expect(
          badgeSection.getByRole("button", { name: /Verified/ }),
        ).toHaveAttribute("aria-pressed", "true");
      if (profile.primaryBadge === "premium" && profile.labels.length) {
        await expect(
          badgeSection.getByRole("button", { name: /Kyro Founder/ }),
        ).toHaveAttribute("aria-pressed", "true");
        await page.screenshot({
          path: `test-results/kyro-profile-legacy-badges-${width}.png`,
        });
        await badgeSection.getByRole("button", { name: /Verified/ }).click();
        await expect(
          badgeSection.getByRole("button", { name: /Verified/ }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect
          .poll(() =>
            page.evaluate(() =>
              window.fixtureMutations?.some(
                (call) =>
                  call.name === "users:updateProfile" &&
                  call.args.primaryBadge === "verified",
              ),
            ),
          )
          .toBe(true);
      }
    }
  }
  await page.evaluate(() => localStorage.removeItem("kyro.fixture.profile"));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:5187/dashboard");
  console.log(
    "PASS: My Profile opens with legacy, unknown, valid and empty badge data on desktop and mobile; supported badges remain selectable",
  );
}
