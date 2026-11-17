import { expect } from "@playwright/test";

const now = Date.now();
const member = (id, name, overrides = {}) => ({
  id,
  name,
  username: id,
  avatarUrl: null,
  createdAt: now - 100000,
  lastSeen: now - 1000,
  presence: "online",
  isFounder: false,
  isStaff: false,
  badges: [],
  ban: null,
  activeWarnings: 0,
  ...overrides,
});
const members = [
  member("me", "Alex Morgan", { isStaff: true, badges: ["admin"] }),
  member("founder", "Kyro Founder", {
    isFounder: true,
    isStaff: true,
    badges: ["founder", "admin"],
  }),
  member("ordinary", "Ordinary Member"),
  member("staff", "Staff Member", { isStaff: true, badges: ["moderator"] }),
  member("trial", "Trial Staff Member", { badges: ["trialstaff"] }),
  member("peer", "Peer Admin", { isStaff: true, badges: ["admin"] }),
  member("manager", "Manager Member", { isStaff: true, badges: ["manager"] }),
  member("cofounder", "Co Founder Member", {
    isStaff: true,
    badges: ["cofounder"],
  }),
  member("banned", "Banned Member", {
    ban: {
      id: "ban-1",
      reason: "Existing ban",
      createdAt: now,
      expiresAt: now + 100000,
    },
  }),
];
const overview = {
  allowed: true,
  canViewIps: true,
  me: {
    id: "me",
    name: "Alex Morgan",
    platformRole: "admin",
    isAdmin: true,
    isStaff: true,
    isTrialStaff: false,
    isFounder: false,
    isModerator: false,
  },
  counts: {
    users: 5,
    online: 3,
    servers: 2,
    messages: 12,
    openReports: 2,
    openBugs: 2,
    activeBans: 1,
    activeWarnings: 1,
    admins: 2,
    moderators: 1,
  },
  recentActions: [
    {
      id: "recent-1",
      action: "badge_granted",
      details: "Verified badge granted",
      createdAt: now,
      actor: null,
    },
  ],
};
const report = (id, reason, reportedId, reportedName) => ({
  id,
  reason,
  details: "Review these account reports.",
  status: "open",
  resolution: null,
  createdAt: now,
  reporterId: "ordinary",
  reporterName: "Ordinary Member",
  reportedId,
  reportedName,
  serverId: null,
  serverName: null,
  messageId: null,
  messageContent: null,
  messageAuthorName: null,
});
const bugs = [
  "open",
  "acknowledged",
  "fixed",
  "not_a_bug",
  "legacy_status",
].map((status, index) => ({
  id: `bug-${index}`,
  title: `Fixture bug ${index}`,
  details: "A reproducible fixture bug report.",
  category: index === 4 ? "legacy_category" : "other",
  status,
  staffNote: index === 1 ? "Investigating" : null,
  createdAt: now,
  reporter: index === 3 ? null : { id: "ordinary", name: "Ordinary Member" },
}));
const queries = {
  "admin:overview": overview,
  "admin:searchMembers": members,
  "admin:reportQueue": [
    report("report-1", "Ordinary report", "ordinary", "Ordinary Member"),
    report("report-self", "Self report", "me", "Alex Morgan"),
  ],
  "bugReports:list": bugs,
  "admin:banList": [
    {
      id: "ban-1",
      userId: "banned",
      userName: "Banned Member",
      username: "banned",
      reason: "Existing ban",
      createdAt: now,
      expiresAt: now + 100000,
      liftedAt: null,
      liftReason: null,
      bannedByName: "Kyro Founder",
      active: true,
    },
  ],
  "admin:warningList": [
    {
      id: "warning-1",
      userId: "ordinary",
      userName: "Ordinary Member",
      username: "ordinary",
      reason: "Existing warning",
      createdAt: now,
      expiresAt: now + 100000,
      issuedByName: "Kyro Founder",
    },
  ],
  "emailOutbox:failures": [
    {
      id: "email-1",
      template: "warning_issued",
      eventKey: "fixture-warning",
      lastErrorCode: "SMTP_TIMEOUT",
      attempts: 2,
      updatedAt: now,
      status: "failed",
    },
    {
      id: "email-expired",
      template: "email_verification",
      eventKey: "fixture-expired",
      lastErrorCode: "CODE_EXPIRED",
      attempts: 1,
      updatedAt: now,
      status: "failed",
    },
  ],
  "admin:actionLog": [
    {
      id: "activity-1",
      action: "badge_granted",
      targetType: "user",
      targetId: "ordinary",
      details: "Fixture staff activity",
      createdAt: now,
      actorName: "Kyro staff",
    },
  ],
  "admin:ipDirectory": {
    captured: 1,
    total: 2,
    users: [
      {
        id: "ordinary",
        name: "Ordinary Member",
        username: "ordinary",
        lastIp: "192.0.2.1",
        lastIpAt: now,
        lastSeen: now,
        online: true,
        device: "mobile",
      },
      {
        id: "new",
        name: "New Member",
        username: null,
        lastIp: null,
        lastIpAt: null,
        lastSeen: null,
        online: false,
        device: null,
      },
    ],
  },
};

async function callSeen(page, name, args) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ name, args }) =>
          window.fixtureMutations?.some(
            (call) =>
              call.name === name &&
              Object.entries(args).every(
                ([key, value]) => call.args[key] === value,
              ),
          ) ?? false,
        { name, args },
      ),
    )
    .toBe(true);
}

export async function checkAdminPortal(page) {
  const errors = [];
  const recordError = (error) => errors.push(error.message);
  page.on("pageerror", recordError);
  const nav = page.getByRole("navigation", { name: "Admin portal sections" });
  const openTab = async (name) => {
    await nav.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await expect(
      page.getByText("This page hit an error", { exact: true }),
    ).toHaveCount(0);
  };
  try {
    await page.evaluate((fixtureQueries) => {
      localStorage.setItem(
        "kyro.fixture.queries",
        JSON.stringify(fixtureQueries),
      );
      localStorage.setItem(
        "kyro.fixture.profile",
        JSON.stringify({
          badges: ["admin", "premium", "verifiedserverowner", "future_badge"],
        }),
      );
    }, queries);

    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto("http://127.0.0.1:5187/dashboard/admin");
      await expect(
        page.getByRole("heading", { name: "Admin Portal", exact: true }),
      ).toBeVisible();
      await expect(nav.getByRole("button")).toHaveCount(9);
      for (const [tab, expected] of [
        ["Overview", "Your staff identity"],
        ["IP detector", "192.0.2.1"],
        [
          "Badges",
          "Grant or revoke platform badges. Founder accounts are protected.",
        ],
        ["Reports", "Ordinary report"],
        ["Bugs", "Fixture bug 4"],
        ["Bans", "Ban history"],
        ["Warnings", "Existing warning"],
        ["Email", "Email delivery"],
        ["Activity", "Fixture staff activity"],
      ]) {
        await openTab(tab);
        await expect(
          page.getByText(expected, { exact: tab !== "Warnings" }),
        ).toBeVisible();
      }
      await openTab("Overview");
      await expect(page.getByText("Premium", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Verified Server Owner", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("future_badge", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/kyro-admin-overview-${width}.png`,
      });

      await openTab("Badges");
      const own = page.getByRole("group", {
        name: "Badges for Alex Morgan",
        exact: true,
      });
      await expect(
        own.getByRole("button", { name: "Admin", exact: true }),
      ).toBeDisabled();
      const protectedFounder = page.getByRole("group", {
        name: "Badges for Kyro Founder",
        exact: true,
      });
      await expect(
        protectedFounder.getByRole("button", { name: "Verified", exact: true }),
      ).toBeDisabled();
      const regular = page.getByRole("group", {
        name: "Badges for Ordinary Member",
        exact: true,
      });
      await expect(
        regular.getByRole("button", { name: "Kyro Founder", exact: true }),
      ).toBeDisabled();

      await page.evaluate(() => {
        window.fixtureMutations = [];
        window.setFixtureMutationErrors({
          "users:setBadges": "Fixture badge update rejected",
        });
      });
      const verified = regular.getByRole("button", {
        name: "Verified",
        exact: true,
      });
      await verified.click();
      await expect(
        page.getByText("Fixture badge update rejected", { exact: true }),
      ).toBeVisible();
      await expect(verified).toBeEnabled();
      await expect(
        own.getByRole("button", { name: "Verified", exact: true }),
      ).toBeEnabled();
      await page.evaluate(() => window.setFixtureMutationErrors({}));
      await verified.click();
      await callSeen(page, "users:setBadges", {
        userId: "ordinary",
        verified: true,
      });
      await expect(verified).toBeEnabled();

      await openTab("Reports");
      await expect(
        page
          .getByRole("group", { name: "Report: Self report" })
          .getByRole("button", { name: "Ban user" }),
      ).toHaveCount(0);
      await page
        .getByRole("group", { name: "Report: Ordinary report" })
        .getByRole("button", { name: "Resolve", exact: true })
        .click();
      await callSeen(page, "reports:resolve", {
        reportId: "report-1",
        status: "resolved",
      });

      await openTab("Bugs");
      await expect(
        page.getByText("Unknown status", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("group", { name: "Bug report: Fixture bug 0" })
        .getByRole("button", { name: "Fixed", exact: true })
        .click();
      await callSeen(page, "bugReports:updateStatus", {
        reportId: "bug-0",
        status: "fixed",
      });

      await openTab("Bans");
      await page
        .getByRole("textbox", { name: "Find an account to ban" })
        .fill("member");
      await expect(
        page.getByRole("button", { name: /Ordinary Member @ordinary/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Staff Member @staff/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Trial Staff Member @trial/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /Alex Morgan @me|Kyro Founder @founder|Banned Member @banned/,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: /Peer Admin @peer|Manager Member @manager|Co Founder Member @cofounder/,
        }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: /Ordinary Member @ordinary/ })
        .click();
      await page
        .getByRole("textbox", { name: "Ban reason" })
        .fill("Fixture moderation reason");
      await page
        .getByRole("button", { name: "Ban account", exact: true })
        .click();
      await callSeen(page, "admin:banUser", {
        userId: "ordinary",
        days: 7,
        reason: "Fixture moderation reason",
      });
      await expect(
        page.getByRole("textbox", { name: "Find an account to ban" }),
      ).toHaveValue("");
      await page.getByRole("button", { name: "Lift ban", exact: true }).click();
      await callSeen(page, "admin:unbanUser", { banId: "ban-1" });

      await openTab("Warnings");
      await page
        .getByRole("button", { name: "Clear warning", exact: true })
        .click();
      await callSeen(page, "admin:liftWarning", { warningId: "warning-1" });
      await openTab("Email");
      await expect(
        page.getByRole("button", { name: "Retry", exact: true }),
      ).toHaveCount(1);
      await page.getByRole("button", { name: "Retry", exact: true }).click();
      await callSeen(page, "emailOutbox:retry", { outboxId: "email-1" });

      const moderator = {
        ...overview,
        canViewIps: false,
        me: {
          ...overview.me,
          platformRole: "moderator",
          isAdmin: false,
          isModerator: true,
        },
      };
      await page.evaluate(
        (value) => window.setFixtureQuery("admin:overview", value),
        moderator,
      );
      await openTab("Bans");
      await page
        .getByRole("textbox", { name: "Find an account to ban" })
        .fill("member");
      await expect(
        page.getByRole("button", { name: /Ordinary Member @ordinary/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Staff Member @staff/ }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /Trial Staff Member @trial/ }),
      ).toHaveCount(0);

      const readOnly = {
        ...overview,
        canViewIps: false,
        me: {
          ...overview.me,
          platformRole: "trialstaff",
          isAdmin: false,
          isStaff: false,
          isTrialStaff: true,
        },
      };
      await page.evaluate(
        (value) => window.setFixtureQuery("admin:overview", value),
        readOnly,
      );
      await expect(
        nav.getByRole("button", { name: "IP detector" }),
      ).toHaveCount(0);
      for (const tab of [
        "Badges",
        "Reports",
        "Bugs",
        "Bans",
        "Warnings",
        "Email",
        "Activity",
        "Overview",
      ]) {
        await openTab(tab);
        if (tab === "Badges") {
          await expect(
            page
              .getByRole("group", { name: "Badges for Ordinary Member" })
              .getByRole("button", { name: "Verified", exact: true }),
          ).toBeDisabled();
        } else if (tab === "Reports") {
          await expect(
            page.getByRole("button", { name: "Resolve", exact: true }),
          ).toHaveCount(0);
        } else if (tab === "Bugs") {
          await expect(
            page.getByRole("button", { name: "Fixed", exact: true }),
          ).toHaveCount(0);
        } else if (tab === "Bans") {
          await expect(
            page.getByRole("textbox", { name: "Find an account to ban" }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("button", { name: "Lift ban", exact: true }),
          ).toHaveCount(0);
        } else if (tab === "Warnings") {
          await expect(
            page.getByRole("button", { name: "Clear warning", exact: true }),
          ).toHaveCount(0);
        } else if (tab === "Email") {
          await expect(
            page.getByRole("button", { name: "Retry", exact: true }),
          ).toHaveCount(0);
        }
      }
      await page.evaluate(() =>
        window.setFixtureQuery("admin:overview", { allowed: false }),
      );
      await expect(page.getByText("Staff only", { exact: true })).toBeVisible();
      await expect(nav).toHaveCount(0);
      await page.evaluate((value) => {
        window.setFixtureQuery("admin:overview", value);
        localStorage.setItem(
          "kyro.fixture.queries",
          JSON.stringify({
            ...JSON.parse(localStorage.getItem("kyro.fixture.queries")),
            "admin:overview": value,
          }),
        );
      }, overview);
    }
    // A banned viewer is denied by overview. The protected bug query must
    // remain skipped even when it would throw for that same account.
    await page.evaluate(() => {
      localStorage.setItem(
        "kyro.fixture.queries",
        JSON.stringify({ "admin:overview": { allowed: false } }),
      );
      localStorage.setItem(
        "kyro.fixture.queryErrors",
        JSON.stringify({ "bugReports:list": "Your Kyro account is banned" }),
      );
    });
    await page.goto("http://127.0.0.1:5187/dashboard/admin");
    await expect(page.getByText("Staff only", { exact: true })).toBeVisible();
    await expect(
      page.getByText("This page hit an error", { exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(
      "PASS: Admin Portal renders every tab and automatic/unknown badges on desktop and mobile; protected actions, moderation, read-only access and rejected updates work",
    );
  } finally {
    page.off("pageerror", recordError);
    await page.evaluate(() => {
      localStorage.removeItem("kyro.fixture.queries");
      localStorage.removeItem("kyro.fixture.profile");
      localStorage.removeItem("kyro.fixture.mutationErrors");
      localStorage.removeItem("kyro.fixture.queryErrors");
      window.setFixtureMutationErrors({});
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("http://127.0.0.1:5187/dashboard");
  }
}
