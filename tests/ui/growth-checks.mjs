import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function checkGrowth(page) {
  page.setDefaultTimeout(30000);
  await page.goto("http://127.0.0.1:5187/dashboard/s/studio/growth", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(
    page.getByRole("heading", { name: "Community tools" }),
  ).toBeVisible({ timeout: 120000 });
  await page.evaluate(() =>
    window.setFixtureQueries({
      "communityGrowth:goals": [
        {
          _id: "goal",
          title: "First post",
          description: "Contribute to your community",
          kind: "achievement",
          metric: "messages",
          target: 1,
          progress: 1,
          joined: false,
          awardedAt: null,
          archived: false,
          revision: 1,
          closed: false,
        },
      ],
      "communityGrowth:resources": [
        {
          _id: "resource",
          title: "Community guide",
          url: "https://example.com/guide",
          description: "Read **the guide**",
          category: "Guides",
          revision: 3,
        },
      ],
      "communityGrowth:partnerships": [
        {
          _id: "partner",
          sourceId: "elsewhere",
          targetId: "studio",
          partnerName: "Partner community",
          partnerId: "elsewhere",
          status: "pending",
          incoming: true,
          notes: "Co-host an event",
          revision: 2,
        },
      ],
      "communityBackups:list": [
        { _id: "backup", label: "Saved configuration", createdAt: Date.now() },
      ],
      "communityBackups:detail": {
        _id: "backup",
        label: "Saved configuration",
        currentName: "Studio",
        currentFingerprint: "before",
        changedSections: ["community"],
        canRestore: true,
        snapshot: {
          community: { name: "Old Studio" },
          roles: [],
          categories: [],
          channels: [],
        },
        createdAt: Date.now(),
      },
      "communityGrowth:analytics": {
        days: [
          {
            day: Date.now(),
            messages: 3,
            joins: 1,
            leaves: 0,
            activeMembers: 2,
            retainedFromYesterday: 1,
            retentionPercent: 50,
          },
        ],
        memberCount: 4,
        observationStartedAt: Date.now(),
      },
      "moderationAppeals:queue": [
        {
          _id: "appeal",
          memberName: "Maya",
          action: "ban",
          reason: "Original moderation",
          statement: "Please review the evidence for this decision.",
          status: "pending",
          revision: 4,
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Claim achievement", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.fixtureMutations.find(
            (m) => m.name === "communityGrowth:claimGoal",
          )?.args.goalId,
      ),
    )
    .toBe("goal");
  await page
    .getByRole("button", { name: "Create achievement or quest", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Goal title").fill("Help newcomers");
  await form.getByRole("button", { name: "Publish goal", exact: true }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("tab", { name: "Resources", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Community guide", exact: true }),
  ).toHaveAttribute("href", "https://example.com/guide");
  await page.getByLabel("Search resources").fill("guide");
  await page
    .getByRole("button", { name: "Search resources", exact: true })
    .click();
  await page.getByRole("tab", { name: "Partnerships", exact: true }).click();
  await expect(
    page.getByText("Co-host an event", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Accept partnership", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.fixtureMutations.find(
            (m) => m.name === "communityGrowth:decidePartnership",
          )?.args.decision,
      ),
    )
    .toBe("accept");
  await page
    .getByRole("tab", { name: "Configuration history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review backup", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Old Studio");
  await page.getByLabel("Confirm community name").fill("Studio");
  await page.evaluate(() =>
    window.setFixtureQuery("communityBackups:detail", {
      _id: "backup",
      label: "Saved configuration",
      currentName: "Renamed",
      currentFingerprint: "after",
      changedSections: ["community"],
      canRestore: true,
      snapshot: {
        community: { name: "Old Studio" },
        roles: [],
        categories: [],
        channels: [],
      },
      createdAt: Date.now(),
    }),
  );
  await expect(page.getByRole("alert")).toContainText("Configuration changed");
  await expect(
    page.getByRole("button", { name: "Restore reviewed configuration" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Review latest configuration" })
    .click();
  await page.getByLabel("Confirm community name").fill("Renamed");
  await page
    .getByRole("button", { name: "Restore reviewed configuration" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const restore = await page.evaluate(() =>
    window.fixtureMutations.find((m) => m.name === "communityBackups:restore"),
  );
  assert.equal(restore.args.expectedFingerprint, "after");
  await page.getByRole("tab", { name: "Appeals", exact: true }).click();
  await page
    .getByRole("button", { name: "Review appeal", exact: true })
    .click();
  await page.getByLabel("Appeal decision").selectOption("accept");
  await page
    .getByLabel("Review response")
    .fill("The evidence supports overturning this action.");
  await page
    .getByRole("button", { name: "Save appeal decision", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find(
          (m) => m.name === "moderationAppeals:decide",
        ),
      )
    ).args.expectedRevision,
    4,
  );
  await page.getByRole("tab", { name: "Growth history", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({ path: "test-results/kyro-growth-desktop.png" });
  await page.evaluate(() =>
    window.setFixtureQuery("servers:get", {
      ...window.fixtureData["servers:get"],
      name: "Studio",
      isOwner: false,
      permissions: ["view_channel", "send_messages"],
    }),
  );
  await expect(
    page.getByRole("tab", { name: "Configuration history", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Appeals", exact: true }),
  ).not.toBeVisible();

  await page.goto("http://127.0.0.1:5187/dashboard/appeals", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() =>
    window.setFixtureQuery("moderationAppeals:cases", [
      {
        _id: "case",
        communityName: "Studio",
        action: "ban",
        reason: "Original action",
        createdAt: Date.now(),
        canAppeal: true,
        appeal: null,
      },
    ]),
  );
  await page
    .getByRole("button", { name: "Submit appeal", exact: true })
    .click();
  await page
    .getByLabel("Appeal statement")
    .fill("Please consider the context and review this decision.");
  await page.evaluate(() =>
    window.setFixtureMutationErrors({
      "moderationAppeals:submit": "An appeal already exists for this case.",
    }),
  );
  await page.getByRole("button", { name: "Send appeal", exact: true }).click();
  await expect(
    page.getByText("An appeal already exists for this case.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Appeal statement")).toHaveValue(
    "Please consider the context and review this decision.",
  );
  await page.evaluate(() => window.setFixtureMutationErrors({}));
  await page.getByRole("button", { name: "Send appeal", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark", "light"]) {
    await page.evaluate((theme) => window.setFixtureTheme(theme), theme);
    await expect(
      page.getByRole("heading", { name: "Your moderation appeals" }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `test-results/kyro-appeals-phone-${theme}.png`,
    });
  }
  console.log(
    "PASS growth UI: goals, resources, partnerships, restoration conflicts, permission changes and appeals on desktop/phone",
  );
}
