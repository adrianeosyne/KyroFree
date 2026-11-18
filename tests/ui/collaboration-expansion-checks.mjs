import assert from "node:assert/strict";
import { expect } from "@playwright/test";
export async function checkWorkspace(page) {
  page.setDefaultTimeout(30000);
  await page.goto("http://127.0.0.1:5187/dashboard/social?section=portfolio", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await expect(
    page.getByRole("heading", { name: "Portfolio", exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await page
    .getByRole("button", { name: "Add portfolio project", exact: true })
    .click();
  await page
    .getByLabel("Project title", { exact: true })
    .fill("Community website");
  await page
    .getByLabel("Project URL", { exact: true })
    .fill("https://example.com/project");
  await page
    .getByLabel("Project skills", { exact: true })
    .fill("Design, TypeScript");
  await page.getByLabel("Gallery visibility").selectOption("public");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const project = await page.evaluate(() =>
    window.fixtureMutations.find((m) => m.name === "socialGallery:saveProject"),
  );
  assert.deepEqual(project.args.skills, ["Design", "TypeScript"]);
  await page.evaluate(() =>
    window.setFixtureQueries({
      "socialGallery:projects": [
        {
          _id: "project",
          userId: "me",
          title: "Community website",
          url: "https://example.com/project",
          description: "A shared project",
          skills: ["Design"],
          privacy: "public",
          mine: true,
          revision: 3,
        },
      ],
      "socialGallery:collections": [
        {
          _id: "collection",
          userId: "me",
          name: "Community inspiration",
          description: "Shared resources",
          privacy: "private",
          mine: true,
          canEdit: true,
          pending: false,
          role: "owner",
          revision: 1,
        },
      ],
      "socialGallery:info": {
        _id: "collection",
        userId: "me",
        name: "Community inspiration",
        description: "Shared resources",
        mine: true,
        canEdit: true,
        revision: 1,
      },
      "socialGallery:collection": [
        {
          _id: "item",
          collectionId: "collection",
          kind: "link",
          title: "Reference",
          description: "Ideas",
          url: "https://example.com",
          canRemove: true,
        },
      ],
      "socialGallery:members": [
        {
          _id: "membership",
          userId: "maya",
          name: "Maya",
          role: "editor",
          accepted: true,
        },
      ],
    }),
  );
  await expect(
    page.getByRole("link", { name: "Community website", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.evaluate(() =>
    window.setFixtureMutationErrors({
      "socialGallery:saveProject":
        "This changed on another device. Reload the latest version before saving.",
    }),
  );
  await page
    .getByLabel("Project title", { exact: true })
    .fill("My unsaved project");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(
    page.getByText(
      "This changed on another device. Reload the latest version before saving.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue(
    "My unsaved project",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.evaluate(() => window.setFixtureMutationErrors({}));
  await page.getByRole("tab", { name: "Collections", exact: true }).click();
  await page
    .getByRole("button", { name: "Open collection", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Open saved link", exact: true }),
  ).toHaveAttribute("href", "https://example.com");
  await page
    .getByRole("button", { name: "Add link or sticker", exact: true })
    .click();
  await page.getByLabel("Collection item title").fill("Useful reference");
  await page
    .getByLabel("Collection item URL")
    .fill("https://example.com/guide");
  await page
    .getByRole("button", { name: "Add collection item", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find((m) => m.name === "socialGallery:addItem"),
      )
    ).args.collectionId,
    "collection",
  );
  await page.getByLabel("Search collection invitees").fill("maya");
  await page
    .getByLabel("Collection invitee", { exact: true })
    .selectOption("maya");
  await page.getByLabel("Collection invitation role").selectOption("editor");
  await page
    .getByRole("button", { name: "Invite collection member", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.fixtureMutations.find((m) => m.name === "socialGallery:invite")
            ?.args.role,
      ),
    )
    .toBe("editor");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/kyro-social-gallery-phone.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await page.setViewportSize({ width: 1440, height: 960 });

  await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-leo", {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("button", { name: "Conversation workspace", exact: true })
    .click();
  await page.getByRole("tab", { name: "Whiteboards", exact: true }).click();
  await page.getByLabel("Whiteboard title").fill("Release plan");
  await page
    .getByRole("button", { name: "Create whiteboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Release plan", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add rectangle", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.fixtureMutations.find(
            (m) => m.name === "whiteboards:saveObject",
          )?.args.kind,
      ),
    )
    .toBe("rectangle");
  await page.evaluate(() =>
    window.setFixtureQuery("whiteboards:objects", [
      {
        _id: "shape",
        boardId: "fixture-board",
        key: "shape",
        kind: "rectangle",
        x: 100,
        y: 100,
        width: 220,
        height: 140,
        color: "#2563eb",
        text: "",
        points: [],
        revision: 1,
        userId: "me",
        updatedById: "me",
        updatedAt: Date.now(),
      },
    ]),
  );
  await page
    .getByRole("button", { name: "Select rectangle", exact: true })
    .click();
  await page.evaluate(() =>
    window.setFixtureQuery("whiteboards:objects", [
      {
        _id: "shape",
        boardId: "fixture-board",
        key: "shape",
        kind: "rectangle",
        x: 200,
        y: 100,
        width: 220,
        height: 140,
        color: "#2563eb",
        text: "",
        points: [],
        revision: 2,
        userId: "me",
        updatedById: "me",
        updatedAt: Date.now(),
      },
    ]),
  );
  await expect(page.getByRole("alert")).toContainText("This object changed");
  await expect(
    page.getByRole("button", { name: "Save selected object", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Select rectangle", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save selected object", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Whiteboard tool").selectOption("draw");
  const canvas = page.getByRole("img", {
      name: "Release plan whiteboard canvas",
      exact: true,
    }),
    box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.fixtureMutations
          .filter((m) => m.name === "whiteboards:saveObject")
          .some((m) => m.args.kind === "stroke" && m.args.points.length > 2),
      ),
    )
    .toBe(true);
  await page.screenshot({ path: "test-results/kyro-whiteboard-desktop.png" });
  await page.evaluate(() =>
    window.setFixtureQuery("whiteboards:info", {
      _id: "fixture-board",
      userId: "maya",
      title: "Release plan",
      mine: false,
      canEdit: false,
      updatedByName: "Maya",
      revision: 2,
    }),
  );
  await expect(
    page.getByRole("button", { name: "Add rectangle", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Tasks", exact: true }).click();
  await page.evaluate(() =>
    window.setFixtureQuery("collaboration:tasks", [
      {
        _id: "task",
        title: "Release checklist",
        description: "",
        status: "doing",
        startsAt: Date.now(),
        dueAt: Date.now() + 86400000,
        timezone: "UTC",
        revision: 3,
      },
    ]),
  );
  await page
    .getByRole("button", { name: "Timeline view", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Release checklist timeline", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit task dates", exact: true })
    .click();
  await page.getByLabel("Task planned start").fill("2026-11-20T10:00");
  await page
    .getByLabel("Task deadline", { exact: true })
    .fill("2026-11-21T10:00");
  await page
    .getByRole("button", { name: "Save task dates", exact: true })
    .click();
  assert.equal(
    (
      await page.evaluate(() =>
        window.fixtureMutations.find(
          (m) => m.name === "collaboration:scheduleTask",
        ),
      )
    ).args.expectedRevision,
    3,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.setFixtureTheme("light"));
  await page.screenshot({ path: "test-results/kyro-timeline-phone.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  console.log(
    "PASS workspace UI: portfolios/conflicts, shared collections, invitations, concurrent whiteboard edits/drawing and timeline dates",
  );
}
