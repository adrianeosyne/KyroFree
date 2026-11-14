import { expect } from "@playwright/test";
import assert from "node:assert/strict";

export async function checkSettings(page, context) {
  await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
  const dialog = page.locator(".settings-dialog");
  const nav = dialog.getByRole("navigation", { name: "Settings sections" });
  const openTab = (name) =>
    nav.getByRole("button", { name, exact: true }).click();
  const capture = async (file) => {
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.screenshot({ path: file, animations: "disabled" });
  };
  const close = () =>
    dialog
      .getByRole("button", { name: "Close settings", exact: true })
      .filter({ visible: true })
      .click();
  await expect(
    dialog.getByRole("heading", { name: "My Account", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("a***@example.com", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Reveal", exact: true }).click();
  await expect(
    dialog.getByText("alex@example.com", { exact: true }),
  ).toBeVisible();
  await capture("test-results/kyro-settings-account.png");

  const search = dialog.getByRole("textbox", { name: "Search settings" });
  await search.fill("sounds");
  await expect(nav.getByRole("button")).toHaveCount(1);
  await openTab("Notifications");
  await search.fill("nothing-matches-this");
  await expect(nav.getByRole("status")).toContainText("No settings found");
  await dialog.getByRole("button", { name: "Clear settings search" }).click();
  const callSound = dialog.getByRole("switch", {
    name: "Incoming call sounds",
  });
  await callSound.click();
  await expect(callSound).not.toBeChecked();
  const volume = dialog.getByRole("slider", { name: "Notification volume" });
  await volume.focus();
  await page.keyboard.press("Home");
  await expect(
    dialog.getByRole("button", { name: "Preview sound" }),
  ).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("button", { name: "Preview sound" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/kyro-settings-notifications.png",
  });

  await openTab("Chat");
  await dialog
    .getByRole("switch", { name: "Send messages with Enter" })
    .click();
  await dialog.getByRole("switch", { name: "Show when I’m typing" }).click();
  await dialog
    .getByRole("switch", { name: "Show image and GIF previews" })
    .click();
  await dialog.getByRole("slider", { name: "Message text size" }).focus();
  await page.keyboard.press("End");
  await capture("test-results/kyro-settings-chat.png");
  await openTab("Keybinds");
  await expect(
    dialog.getByText("Send a message", { exact: true }).locator(".."),
  ).toContainText("Ctrl");
  await openTab("Accessibility");
  await dialog.getByRole("switch", { name: "Reduce motion" }).click();
  await dialog.getByRole("switch", { name: "Always underline links" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-underline-links",
    "true",
  );

  await context.grantPermissions(["microphone"], {
    origin: "http://127.0.0.1:5187",
  });
  await page.evaluate(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      window.fixtureMicTracks = stream.getTracks();
      return stream;
    };
  });
  await openTab("Voice & Audio");
  await dialog.getByRole("button", { name: "Test microphone" }).click();
  await expect(dialog.getByRole("button", { name: "Stop test" })).toBeVisible();
  await expect(
    dialog.getByRole("meter", { name: "Microphone input level" }),
  ).toBeVisible();
  await openTab("Appearance");
  assert(
    await page.evaluate(() =>
      window.fixtureMicTracks.every((track) => track.readyState === "ended"),
    ),
    "Leaving voice settings stops microphone capture",
  );
  await dialog.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await capture("test-results/kyro-settings-light.png");
  await dialog.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await openTab("My Profile");
  await expect(
    dialog.getByText("Profile picture", { exact: true }),
  ).toBeVisible();
  await openTab("Privacy & Safety");
  await expect(
    dialog.getByRole("switch", {
      name: "Suggest me to people with similar interests",
    }),
  ).toBeVisible();
  await openTab("Devices & Sessions");
  await expect(
    dialog.getByText("Two-step verification", { exact: true }),
  ).toBeVisible();
  await openTab("Data & Storage");
  await openTab("My Files");
  await openTab("Help & Feedback");
  await expect(
    dialog.getByRole("link", { name: /Build with Kyro/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Report a bug" }),
  ).toBeVisible();
  await close();

  await page.evaluate(() => localStorage.setItem("kyro.fixture.media", "1"));
  await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
  await expect(
    page.getByRole("link", {
      name: "https://example.com/settings-preview.png",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Shared image or GIF", exact: true }),
  ).toHaveCount(0);
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("A multiline message");
  await composer.press("Enter");
  await expect(composer).toHaveValue("A multiline message\n");
  assert.equal(
    await composer.evaluate((element) => getComputedStyle(element).fontSize),
    "20px",
  );
  assert.equal(
    await page.evaluate(
      () =>
        (window.fixtureMutations ?? []).filter(
          (call) => call.name === "messages:setTyping",
        ).length,
    ),
    0,
    "Typing preference is respected",
  );
  await composer.press("Control+Enter");
  await expect(composer).toHaveValue("");
  assert(
    await page.evaluate(() =>
      (window.fixtureMutations ?? []).some(
        (call) =>
          call.name === "messages:send" &&
          call.args.content.includes("A multiline message"),
      ),
    ),
    "Ctrl+Enter sends the message",
  );

  await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
  await openTab("Chat");
  await expect(
    dialog.getByRole("switch", { name: "Send messages with Enter" }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("switch", { name: "Show when I’m typing" }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("switch", { name: "Show image and GIF previews" }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("slider", { name: "Message text size" }),
  ).toHaveAttribute("aria-valuenow", "20");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("test-results/kyro-settings-mobile.png");
  assert(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
    "Settings fits phone viewport",
  );
  await openTab("My Account");
  assert(
    await dialog
      .locator("h3")
      .first()
      .evaluate(
        (element) => element.clientWidth >= 100 && element.clientHeight < 90,
      ),
    "Mobile profile name has enough room to read",
  );
  await capture("test-results/kyro-settings-account-mobile.png");
  assert(
    await dialog
      .locator(".settings-content")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
    "Account details fit phone viewport",
  );
  await close();
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
  await openTab("Chat");
  await dialog
    .getByRole("switch", { name: "Show image and GIF previews" })
    .click();
  await close();
  await page.goto("http://127.0.0.1:5187/dashboard/dm/dm-maya");
  await expect(
    page.getByRole("img", { name: "Shared image or GIF", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", {
      name: "https://example.com/settings-preview.png",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem(
      "kyro.prefs.v1",
      JSON.stringify({ notificationSounds: false }),
    ),
  );
  await page.goto("http://127.0.0.1:5187/dashboard?settings=1");
  await openTab("Notifications");
  await expect(
    dialog.getByRole("switch", { name: "Incoming call sounds" }),
  ).not.toBeChecked();
  await expect(
    dialog.getByRole("switch", { name: "Mention & reply sounds" }),
  ).not.toBeChecked();
  await close();
  // Restore defaults for the remaining app checks.
  await page.evaluate(() => {
    localStorage.removeItem("kyro.prefs.v1");
    localStorage.removeItem("kyro.fixture.media");
  });
  await page.goto("http://127.0.0.1:5187/dashboard");
  console.log(
    "PASS: settings search, all sections, email reveal, persisted preferences, send behavior, typing privacy, microphone cleanup and responsive layouts",
  );
}
