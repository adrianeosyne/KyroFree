import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkExpansion(page) {
  page.setDefaultTimeout(30000);
  await page.goto("http://127.0.0.1:5187/dashboard?settings=1", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  const settings = page.locator(".settings-dialog");
  await settings
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    settings.getByRole("heading", {
      name: "Notification profiles and schedules",
    }),
  ).toBeVisible();
  await settings
    .getByLabel("Active notification profile")
    .selectOption("focus");
  await settings.getByLabel("Schedule timezone").fill("Asia/Colombo");
  await settings.getByLabel("Enable quiet hours", { exact: true }).check();
  await settings.getByLabel("Quiet hours start", { exact: true }).fill("22:00");
  await settings
    .getByRole("button", { name: "Save profiles and schedules" })
    .click();
  await expect(
    settings.getByRole("button", { name: "Save profiles and schedules" }),
  ).toBeDisabled();
  const save = await page.evaluate(() =>
    window.fixtureMutations.find((m) => m.name === "attentionSettings:save"),
  );
  assert.equal(save.args.activeProfile, "focus");
  assert.equal(save.args.timezone, "Asia/Colombo");
  assert.equal(save.args.quietStart, 1320);
  await settings.getByLabel("Schedule timezone").fill("UTC");
  await page.evaluate(() =>
    window.setFixtureQueries({
      "attentionSettings:get": {
        ...window.fixtureMutations.find(
          (m) => m.name === "attentionSettings:save",
        ).args,
        revision: 2,
      },
    }),
  );
  await expect(settings.getByRole("alert")).toContainText(
    "changed on another device",
  );
  await expect(
    settings.getByRole("button", { name: "Save profiles and schedules" }),
  ).toBeDisabled();
  await settings.getByRole("button", { name: "Load latest" }).click();
  await settings
    .getByRole("button", { name: "Close settings", exact: true })
    .filter({ visible: true })
    .click();

  await page.evaluate(() => {
    const current = window.fixtureMutations.find(
      (m) => m.name === "attentionSettings:save",
    ).args;
    const minute = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
    window.setFixtureQuery("attentionSettings:get", {
      ...current,
      timezone: "UTC",
      themeEnabled: true,
      lightStart: (minute + 1439) % 1440,
      darkStart: (minute + 1) % 1440,
      revision: 3,
    });
  });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.evaluate(() => window.setFixtureTheme("dark"));
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.evaluate(() =>
    window.setFixtureQuery("attentionSettings:get", {
      ...window.fixtureMutations.find(
        (m) => m.name === "attentionSettings:save",
      ).args,
      themeEnabled: false,
      revision: 4,
    }),
  );
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.evaluate(() => {
    window.setFixtureQuery("appReleases:workspaces", [
      {
        id: "fixture-app",
        name: "Community bot",
        role: "owner",
        pending: false,
      },
    ]);
    window.setFixtureQuery("appReleases:collaborators", {
      isOwner: true,
      canStage: true,
      activeReleaseId: null,
      stagingApplicationId: null,
      members: [
        { id: "maya", name: "Maya", role: "maintainer", accepted: true },
      ],
    });
    window.setFixtureQuery("appReleases:list", [
      {
        _id: "fixture-release",
        version: "1.0.0",
        changelog: "Safe **release notes**",
        channel: "production",
        createdAt: Date.now(),
      },
    ]);
  });
  await page
    .getByRole("link", { name: "Releases and teams", exact: true })
    .click();
  await page.getByLabel("Application workspace").selectOption("fixture-app");
  await expect(page.getByText("Safe", { exact: false })).toBeVisible();
  await page.getByLabel("Release version").fill("1.1.0");
  await page.getByLabel("Release changelog").fill("New release notes");
  await page
    .getByRole("button", { name: "Publish production release", exact: true })
    .click();
  await expect(page.getByLabel("Release version")).toHaveValue("");
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find((m) => m.name === "appReleases:publish"),
      )
    ).args.channel,
    "production",
  );
  await page
    .getByRole("button", { name: "Activate version", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find((m) => m.name === "appReleases:activate"),
      )
    ).args.expectedActive,
    null,
  );
  await page.evaluate(() =>
    window.setFixtureQuery("appReleases:collaborators", {
      isOwner: false,
      canStage: true,
      activeReleaseId: null,
      stagingApplicationId: null,
      members: [],
    }),
  );
  await expect(
    page.getByRole("button", {
      name: "Publish production release",
      exact: true,
    }),
  ).not.toBeVisible();
  await page
    .getByRole("tab", { name: "Staging releases", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish staging release", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.setFixtureQuery("appReleases:collaborators", {
      isOwner: false,
      canStage: false,
      activeReleaseId: null,
      stagingApplicationId: null,
      members: [],
    }),
  );
  await expect(
    page.getByRole("button", { name: "Publish staging release", exact: true }),
  ).not.toBeVisible();

  await page.evaluate(() => {
    window.setFixtureQuery("competitions:clans", [
      {
        _id: "fixture-clan",
        userId: "maya",
        tag: "TEAM",
        name: "Chess club",
        game: "Chess",
        description: "A community team",
        memberCount: 1,
        joined: false,
        pending: false,
        isLeader: false,
        canManage: true,
      },
    ]);
    window.setFixtureQuery("competitions:clanMembers", [
      { id: "maya", name: "Maya", accepted: true },
      { id: "leo", name: "Leo", accepted: false },
    ]);
    window.setFixtureQuery("competitions:tournaments", [
      {
        _id: "fixture-tournament",
        title: "Community Cup",
        game: "Chess",
        description: "Tournament rules",
        capacity: 8,
        entrantCount: 2,
        status: "active",
        startsAt: Date.now() - 60000,
        timezone: "Asia/Colombo",
        joined: true,
        canManage: true,
      },
    ]);
    window.setFixtureQuery("competitions:tournament", {
      _id: "fixture-tournament",
      title: "Community Cup",
      game: "Chess",
      status: "active",
      revision: 4,
      registrations: ["maya", "leo"],
      canManage: true,
      names: { maya: "Maya", leo: "Leo" },
      matches: [
        {
          round: 1,
          slot: 0,
          a: "maya",
          b: "leo",
          winner: null,
          state: "ready",
        },
      ],
    });
    window.setFixtureQuery("competitions:leaderboard", [
      { _id: "fixture-stats", name: "Maya", wins: 2, tournaments: 3 },
    ]);
  });
  await page.goto("http://127.0.0.1:5187/dashboard/s/studio/competitions", {
    waitUntil: "domcontentloaded",
  });
  // Overrides are held in this page, so restore after navigation.
  await page.evaluate(() =>
    window.setFixtureQueries({
      "competitions:clans": [
        {
          _id: "fixture-clan",
          userId: "maya",
          tag: "TEAM",
          name: "Chess club",
          game: "Chess",
          description: "A community team",
          memberCount: 1,
          joined: false,
          pending: false,
          isLeader: false,
          canManage: true,
        },
      ],
      "competitions:clanMembers": [
        { id: "maya", name: "Maya", accepted: true },
        { id: "leo", name: "Leo", accepted: false },
      ],
      "competitions:tournaments": [
        {
          _id: "fixture-tournament",
          title: "Community Cup",
          game: "Chess",
          description: "Tournament rules",
          capacity: 8,
          entrantCount: 2,
          status: "active",
          startsAt: Date.now() - 60000,
          timezone: "Asia/Colombo",
          joined: true,
          canManage: true,
        },
      ],
      "competitions:tournament": {
        _id: "fixture-tournament",
        title: "Community Cup",
        game: "Chess",
        status: "active",
        revision: 4,
        registrations: ["maya", "leo"],
        canManage: true,
        names: { maya: "Maya", leo: "Leo" },
        matches: [
          {
            round: 1,
            slot: 0,
            a: "maya",
            b: "leo",
            winner: null,
            state: "ready",
          },
        ],
      },
      "competitions:leaderboard": [
        { _id: "fixture-stats", name: "Maya", wins: 2, tournaments: 3 },
      ],
    }),
  );
  await expect(
    page.getByRole("heading", { name: "Clans and competitions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Join clan", exact: true }).click();
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find((m) => m.name === "competitions:joinClan"),
      )
    ).args.join,
    true,
  );
  await page
    .getByRole("button", { name: "Members and requests", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Accept request", exact: true })
    .click();
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find(
          (m) => m.name === "competitions:reviewClanMember",
        ),
      )
    ).args.accept,
    true,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("tab", { name: "Tournaments", exact: true }).click();
  await page.getByRole("button", { name: "View bracket", exact: true }).click();
  await page.getByLabel("Round 1 match 1 score 1").fill("2");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Record result", exact: true })
    .click();
  const result = await page.evaluate(() =>
    window.fixtureMutations.find((m) => m.name === "competitions:result"),
  );
  assert.equal(result.args.expectedRevision, 4);
  assert.equal(result.args.scoreA, 2);
  await page.screenshot({
    path: "test-results/kyro-expansion-bracket-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("dialog")).toBeVisible();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: "test-results/kyro-expansion-bracket-phone-dark.png",
  });
  await page.evaluate(() => window.setFixtureTheme("light"));
  await page.screenshot({
    path: "test-results/kyro-expansion-bracket-phone-light.png",
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("tab", { name: "Leaderboards", exact: true }).click();
  await page.getByLabel("Leaderboard game").fill("Chess");
  await page
    .getByRole("button", { name: "Show leaderboard", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Maya", exact: true }),
  ).toBeVisible();
  console.log(
    "PASS expansion UI: schedules/conflicts/theme, release roles/activation, clan membership, scoring, mobile light/dark and leaderboard",
  );
}
