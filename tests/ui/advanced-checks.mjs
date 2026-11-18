import assert from "node:assert/strict";
import { expect } from "@playwright/test";

export async function checkAdvanced(page, context) {
  page.setDefaultNavigationTimeout(120000);
  await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-leo", {
    waitUntil: "domcontentloaded",
  });
  const input = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(input).toBeVisible({ timeout: 120000 });
  await expect(
    page.getByLabel("Message expiry", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.setFixtureData("notifications:list", [
      {
        id: "temporary-inbox-preview",
        type: "mention",
        title: "Temporary inbox preview",
        body: "This cached preview must expire",
        read: false,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3000,
        link: null,
        actor: null,
      },
    ]),
  );
  await page
    .getByRole("button", { name: "Inbox", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("This cached preview must expire", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("This cached preview must expire", { exact: true }),
  ).toHaveCount(0, { timeout: 6000 });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.evaluate(() => window.setFixtureData("notifications:list", []));
  await input.fill("Draft survives a slow save");
  await expect(page.getByText("Draft synced", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.fixtureMutationDelay = { "advancedMessages:savePrivate": 1200 };
  });
  await input.fill("Save in progress");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.fixtureMutations.filter(
            (row) => row.name === "advancedMessages:savePrivate",
          ).length,
      ),
    )
    .toBe(2);
  await input.fill("Typed while saving");
  await expect(page.getByText("Draft synced", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("Typed while saving");
  await page.evaluate(() => {
    window.fixtureMutationDelay = {};
    const key = "private:conversation:dm-leo";
    const state = window.fixtureData[key];
    window.setFixtureData(key, {
      ...state,
      draft: {
        ...state.draft,
        content: "Another device",
        revision: state.draft.revision + 1,
      },
    });
  });
  await expect(input).toHaveValue("Another device");
  await input.fill("My competing edit");
  await page.evaluate(() => {
    const key = "private:conversation:dm-leo";
    const state = window.fixtureData[key];
    window.setFixtureData(key, {
      ...state,
      draft: {
        ...state.draft,
        content: "Concurrent remote edit",
        revision: state.draft.revision + 1,
      },
    });
  });
  await expect(
    page.getByText("Another device has a different draft", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Keep my draft", exact: true })
    .click();
  await expect(page.getByText("Draft synced", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("My competing edit");
  await page.evaluate(() =>
    window.setFixtureMutationErrors({
      "advancedMessages:savePrivate": "Storage unavailable",
    }),
  );
  await input.fill("Retry after an error");
  await expect(
    page.getByText("Draft sync failed", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.setFixtureMutationErrors({}));
  await page
    .getByRole("button", { name: "Keep my draft", exact: true })
    .click();
  await expect(page.getByText("Draft synced", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await input.fill("Composed offline");
  await expect(
    page.getByText("Draft saved on this device · offline", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("kyro.cloudDraft:me:conversation:dm-leo"),
        ).content,
    ),
    "Composed offline",
  );
  await context.setOffline(false);
  await expect(page.getByText("Draft synced", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Schedule text message", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Send when the time is right",
  );
  await page.getByLabel("Timezone", { exact: true }).fill("Asia/Colombo");
  await page
    .getByRole("button", { name: "Schedule message", exact: true })
    .click();
  await expect(input).toHaveValue("");
  assert.equal(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (row) => row.name === "advancedMessages:schedule",
        ).args.timezone,
    ),
    "Asia/Colombo",
  );

  const ownMessage = page.locator("#message-message-1");
  await ownMessage.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Save to collection", exact: true })
    .click();
  await page.getByLabel("New collection name").fill("Project notes");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Save message", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await ownMessage.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remind me", exact: true }).click();
  await page.getByLabel("Private reminder note").fill("Follow up tomorrow");
  await page.getByRole("button", { name: "Set reminder", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await ownMessage.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Edit history", exact: true })
    .click();
  await expect(
    page.getByText("No previous versions have been recorded.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await ownMessage.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Forward", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Maya Chen/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Conversation workspace", exact: true })
    .click();
  await page
    .getByLabel("Private conversation note")
    .fill("Context only I can read");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await page.getByLabel("New document title").fill("Release checklist");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByLabel("Document Markdown")
    .fill("# Release\nReview permissions before launch.");
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  await expect(page.getByText(/Version 2 · Changes appear/)).toBeVisible();
  await page.screenshot({
    path: "test-results/advanced-documents-desktop.png",
  });

  await page.goto("http://127.0.0.1:5187/dashboard/library");
  await page.getByRole("tab", { name: "Scheduled", exact: true }).click();
  // A reload resets fixture data, so seed a deterministic result for the real UI.
  await page.evaluate(() =>
    window.setFixtureData("advancedMessages:schedules", [
      {
        _id: "later",
        content: "Scheduled plan",
        status: "pending",
        timezone: "Asia/Colombo",
        sendAt: Date.now() + 60000,
      },
    ]),
  );
  await expect(page.getByText("Scheduled plan", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Personal tasks", exact: true }).click();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.getByLabel("Task title").fill("Review release");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(page.getByText("Review release", { exact: true })).toBeVisible();

  await page.goto("http://127.0.0.1:5187/dashboard/social");
  await page
    .getByLabel("New public post")
    .fill("A release update for our friends");
  await page.getByRole("button", { name: "Share post", exact: true }).click();
  await expect(
    page.getByText("A release update for our friends", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Stories", exact: true }).click();
  await expect(page.getByLabel("Story lifetime")).toBeVisible();
  await page.getByRole("tab", { name: "Interests", exact: true }).click();
  await page.getByLabel("Selected interests").fill("minecraft, music");
  await page
    .getByRole("button", { name: "Save interests", exact: true })
    .click();
  assert.deepEqual(
    await page.evaluate(
      () =>
        window.fixtureMutations.findLast(
          (row) => row.name === "socialFeed:saveInterests",
        ).args.interests,
    ),
    ["minecraft", "music"],
  );

  await page.goto("http://127.0.0.1:5187/dashboard/s/studio/knowledge");
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.getByLabel("Page title").fill("Getting started");
  await page.getByLabel("Page category", { exact: true }).fill("Guides");
  await page
    .getByLabel("Page Markdown")
    .fill("Find your community and introduce yourself.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByText("Getting started", { exact: true }),
  ).toBeVisible();

  await page.goto("http://127.0.0.1:5187/dashboard/s/studio/gaming");
  await page.getByText("Your game activity", { exact: true }).click();
  await page.getByLabel("Current game", { exact: true }).fill("Minecraft");
  await page
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await page.getByRole("button", { name: "Host party", exact: true }).click();
  await page.getByLabel("Party game", { exact: true }).fill("Minecraft");
  await page
    .getByLabel("Party title", { exact: true })
    .fill("Creative building");
  await page.getByLabel("Party region", { exact: true }).fill("Asia");
  await page.getByLabel("Party language", { exact: true }).fill("English");
  await page
    .getByRole("button", { name: "Publish party", exact: true })
    .click();
  await expect(
    page.getByText("Creative building", { exact: true }),
  ).toBeVisible();

  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => window.setFixtureTheme(value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "library",
      "social",
      "s/studio/knowledge",
      "s/studio/gaming",
    ]) {
      await page.goto(`http://127.0.0.1:5187/dashboard/${route}`);
      await expect(page.locator("main h1").last()).toBeVisible();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Overflow on ${route}, ${theme}`,
      );
      await expect(page.locator("main").last()).toHaveCSS("opacity", "1");
      await page.screenshot({
        path: `test-results/advanced-${route.replaceAll("/", "-")}-${theme}-mobile.png`,
      });
    }
  }
  await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
  const dialog = page.locator(".settings-dialog");
  const nav = dialog.getByRole("navigation", { name: "Settings sections" });
  await nav
    .getByRole("button", { name: "Data & Storage", exact: true })
    .click();
  await expect(dialog.getByLabel("Cloud drafts retention")).toBeVisible();
  await nav
    .getByRole("button", { name: "Devices & Sessions", exact: true })
    .click();
  await dialog.getByLabel("Account freeze password").fill("fixture-password");
  page.once("dialog", (message) => message.accept());
  await dialog
    .getByRole("button", { name: "Freeze account", exact: true })
    .click();
  await expect(
    dialog.getByText("Your account is frozen.", { exact: true }),
  ).toBeVisible();
  console.log(
    "Advanced UI: drafts, scheduling, notes, documents, tasks, social, wiki, responsive layouts and retention passed.",
  );
}
