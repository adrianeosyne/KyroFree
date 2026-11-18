import { expect } from "@playwright/test";

const origin = "http://127.0.0.1:5187";
const mediaBase = `${origin}/tests/ui/attachment-fixture`;
const escapedText =
  '<img src="x" onerror="window.fixturePreviewInjected=true">\n';
const longText = escapedText + "x".repeat(80_000);

function silentWav() {
  const samples = 2000;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}

function attachmentMessages(caseId, imageBytes) {
  const attachments = [
    {
      name: "fixture-image.png",
      mimeType: "image/png",
      url: `${mediaBase}/image.png`,
      size: imageBytes,
    },
    {
      name: "fixture-audio.wav",
      mimeType: "audio/wav",
      url: `${mediaBase}/audio.wav`,
      size: 4044,
    },
    {
      name: "fixture-video.webm",
      mimeType: "video/webm",
      url: `${mediaBase}/video.webm`,
      size: 1000,
    },
    {
      name: "fixture-document.txt",
      mimeType: "text/plain",
      url: `${mediaBase}/document.txt`,
      size: longText.length,
    },
    {
      name: "fixture-failure.txt",
      mimeType: "text/plain",
      url: `${mediaBase}/failure.txt?case=${caseId}`,
      size: 24,
    },
    {
      name: "fixture-document.pdf",
      mimeType: "application/pdf",
      url: `${mediaBase}/document.pdf`,
      size: 80,
    },
    {
      name: "fixture-unavailable.png",
      mimeType: "image/png",
      url: null,
      size: 10,
    },
    { name: "fixture-missing.txt", mimeType: "text/plain", size: 10 },
  ];
  return {
    messages: attachments.map((attachment, index) => ({
      id: `attachment-message-${index}`,
      authorId: "me",
      author: {
        id: "me",
        name: "Alex Morgan",
        username: "alex_morgan",
        avatarUrl: null,
        badges: [],
        links: [],
        presence: "online",
      },
      content: `Attachment fixture ${index}`,
      // Keep a malformed historical date from taking down the whole chat.
      createdAt: index === 7 ? 1e20 : Date.now() - (10 - index) * 60_000,
      editedAt: null,
      attachments: [{ storageId: `fixture-storage-${index}`, ...attachment }],
      reactions: [],
      replyTo: null,
    })),
    hasMore: false,
    nextCursor: null,
  };
}

async function sawMutation(page, name, args) {
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

export async function checkAttachments(page, context) {
  const errors = [];
  const recordError = (error) => errors.push(error.message);
  page.on("pageerror", recordError);
  const fixtureKeys = [
    "kyro.fixture.queries",
    "kyro.fixture.queryErrors",
    "kyro.fixture.mutationErrors",
  ];
  const previous = await page.evaluate(
    (keys) =>
      Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    fixtureKeys,
  );
  const failedPreviews = new Set();
  const uploaded = [];
  const wav = silentWav();
  // A tiny real video keeps media checks independent of remote fixtures.
  const generatedMedia = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const drawing = canvas.getContext("2d");
    const stream = canvas.captureStream(10);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const stopped = new Promise((resolve) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = resolve;
    });
    recorder.start();
    let frame = 0;
    const timer = window.setInterval(() => {
      drawing.fillStyle = frame++ % 2 ? "#5865f2" : "#36a6c8";
      drawing.fillRect(0, 0, 64, 36);
    }, 40);
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    window.clearInterval(timer);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return {
      png: canvas.toDataURL("image/png").split(",")[1],
      video: Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())),
    };
  });
  const png = Buffer.from(generatedMedia.png, "base64");
  const video = Buffer.from(generatedMedia.video);

  const mediaPattern = `${mediaBase}/**`;
  const serveMedia = async (route) => {
    const url = new URL(route.request().url());
    const filename = url.pathname.split("/").at(-1);
    if (filename === "failure.txt" && !failedPreviews.has(url.href)) {
      failedPreviews.add(url.href);
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Fixture preview failed",
      });
      return;
    }
    const files = {
      "image.png": { body: png, contentType: "image/png" },
      "audio.wav": { body: wav, contentType: "audio/wav" },
      "video.webm": { body: video, contentType: "video/webm" },
      "document.txt": { body: longText, contentType: "text/plain" },
      "failure.txt": {
        body: "Preview recovered safely",
        contentType: "text/plain",
      },
      "document.pdf": {
        body: "%PDF-1.4\nFixture document\n%%EOF",
        contentType: "application/pdf",
      },
    };
    await route.fulfill({ status: 200, ...files[filename] });
  };
  const uploadUrl = `${origin}/tests/ui/upload`;
  const receiveUpload = async (route) => {
    expect(route.request().method()).toBe("POST");
    const buffer = route.request().postDataBuffer();
    expect(buffer?.length).toBeGreaterThan(0);
    const storageId = `fixture-upload-${uploaded.length + 1}`;
    // Registration returns server-derived metadata rather than the client's
    // claimed MIME type; this fixture deliberately uploads octet-stream text.
    const metadata = { size: buffer.length, mimeType: "text/plain" };
    uploaded.push({ storageId, metadata });
    await page.evaluate(
      ({ storageId, metadata }) => {
        window.fixtureUploadedFiles ??= {};
        window.fixtureUploadedFiles[storageId] = metadata;
      },
      { storageId, metadata },
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ storageId }),
    });
  };
  await context.route(mediaPattern, serveMedia);
  await context.route(uploadUrl, receiveUpload);
  const noRouteError = () =>
    expect(
      page.getByText("This page hit an error", { exact: true }),
    ).toHaveCount(0);
  const rowFor = (index) =>
    page.locator(".message-row").filter({
      has: page.getByText(`Attachment fixture ${index}`, { exact: true }),
    });

  try {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 960 });
      for (const [kind, routePath] of [
        ["dm", "/dashboard/dm/dm-maya"],
        ["channel", "/dashboard/s/studio/c/general"],
      ]) {
        const messages = attachmentMessages(`${width}-${kind}`, png.length);
        await page.evaluate((messages) => {
          localStorage.setItem(
            "kyro.fixture.queries",
            JSON.stringify({ "messages:list": messages }),
          );
          localStorage.setItem(
            "kyro.fixture.queryErrors",
            JSON.stringify({
              "files:download": "Could not find public function files:download",
              "files:usage": "Could not find public function files:usage",
              "files:list": "Could not find public function files:list",
            }),
          );
        }, messages);
        await page.goto(`${origin}${routePath}`);
        await expect(
          page.getByRole("textbox", { name: "Message", exact: true }),
        ).toBeVisible();
        await expect(page.locator(".message-row")).toHaveCount(8);
        await noRouteError();
        await rowFor(0).getByText("File information", { exact: true }).click();
        await expect(rowFor(0).locator("time[datetime]")).toHaveCount(1);
        await rowFor(7).getByText("File information", { exact: true }).click();
        await expect(rowFor(7).locator("time[datetime]")).toHaveCount(0);
        for (let index = 0; index < 6; index++) {
          const download = rowFor(index).getByRole("link", {
            name: "Download",
            exact: true,
          });
          await expect(download).toHaveAttribute(
            "href",
            messages.messages[index].attachments[0].url,
          );
          await expect(download).toHaveAttribute(
            "download",
            messages.messages[index].attachments[0].name,
          );
          const bounds = await download.boundingBox();
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        }
        for (const index of [6, 7]) {
          await expect(
            rowFor(index).getByText("Unavailable", { exact: true }),
          ).toBeVisible();
          await expect(
            rowFor(index).getByRole("link", { name: "Download" }),
          ).toHaveCount(0);
          await expect(
            rowFor(index).getByRole("button", { name: /Expand|Preview/ }),
          ).toHaveCount(0);
        }
        await expect(
          page.getByRole("button", { name: "Remove attachment", exact: true }),
        ).toHaveCount(0);

        const image = rowFor(0).getByRole("img", {
          name: "fixture-image.png",
          exact: true,
        });
        await expect
          .poll(() => image.evaluate((element) => element.naturalWidth))
          .toBeGreaterThan(0);
        await rowFor(0)
          .getByRole("button", { name: "Expand fixture-image.png" })
          .click();
        const expanded = page.getByRole("dialog", {
          name: "fixture-image.png",
          exact: true,
        });
        await expect(
          expanded.getByRole("img", { name: "fixture-image.png" }),
        ).toBeVisible();
        await expanded
          .getByRole("button", { name: "Close", exact: true })
          .click();
        await expect(expanded).toHaveCount(0);
        const downloadEvent = page.waitForEvent("download");
        await rowFor(0)
          .getByRole("link", { name: "Download", exact: true })
          .click();
        const download = await downloadEvent;
        expect(download.suggestedFilename()).toBe("fixture-image.png");
        expect(await download.failure()).toBeNull();

        for (const [index, selector] of [
          [1, "audio"],
          [2, "video"],
        ]) {
          const media = rowFor(index).locator(selector);
          await expect(media).toHaveAttribute("controls", "");
          await expect(media).toHaveAttribute(
            "src",
            messages.messages[index].attachments[0].url,
          );
          await expect
            .poll(() => media.evaluate((element) => element.readyState))
            .toBeGreaterThanOrEqual(1);
          await media.evaluate(async (element) => {
            element.muted = true;
            await element.play();
          });
          await expect
            .poll(() => media.evaluate((element) => element.paused))
            .toBe(false);
          await media.evaluate((element) => element.pause());
        }

        const textPreview = rowFor(3).getByRole("button", {
          name: "Preview fixture-document.txt",
        });
        await textPreview.click();
        const contents = rowFor(3).getByLabel(
          "Contents of fixture-document.txt",
        );
        await expect(contents).toContainText("Preview limited to 64 KiB");
        const text = await contents.textContent();
        expect(text.startsWith(escapedText)).toBe(true);
        expect(text.length).toBeLessThanOrEqual(65536 + 100);
        await expect(contents.locator("img, script")).toHaveCount(0);
        expect(
          await page.evaluate(() => Boolean(window.fixturePreviewInjected)),
        ).toBe(false);
        await textPreview.click();
        await expect(contents).toHaveCount(0);
        const failedPreview = rowFor(4).getByRole("button", {
          name: "Preview fixture-failure.txt",
        });
        await failedPreview.click();
        await expect(
          page.getByText(
            "Preview unavailable. Refresh the download link and try again.",
            { exact: true },
          ),
        ).toBeVisible();
        await expect(failedPreview).toBeEnabled();
        await failedPreview.click();
        await expect(
          rowFor(4).getByLabel("Contents of fixture-failure.txt"),
        ).toHaveText("Preview recovered safely");
        await noRouteError();
      }

      await page.goto(`${origin}/dashboard?settings=1`);
      const settings = page.locator(".settings-dialog");
      await settings
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("button", { name: "My Files", exact: true })
        .click();
      await expect(
        settings.getByRole("heading", {
          name: "Files shared in your conversations",
          exact: true,
        }),
      ).toBeVisible();
      await settings
        .getByRole("button", { name: "Open conversations", exact: true })
        .click();
      await expect(page).toHaveURL(`${origin}/dashboard`);
      await noRouteError();
    }

    for (const [containerType, containerId, routePath] of [
      ["conversation", "dm-maya", "/dashboard/dm/dm-maya"],
      ["channel", "general", "/dashboard/s/studio/c/general"],
    ]) {
      await page.goto(`${origin}${routePath}`);
      await page.evaluate(() => {
        window.fixtureMutations = [];
        window.setFixtureMutationErrors({});
      });
      const filename = `authoritative-${containerType}.txt`;
      const body = Buffer.from("Authoritative attachment metadata fixture\n");
      await page.getByLabel("Attach files", { exact: true }).setInputFiles({
        name: filename,
        mimeType: "application/octet-stream",
        buffer: body,
      });
      const pending = page.getByLabel("Pending attachments", { exact: true });
      await expect(pending.getByText("Ready to send", { exact: true })).toBeVisible();
      const currentUpload = uploaded.at(-1);
      await page
        .getByRole("textbox", { name: "Message", exact: true })
        .fill("Sending an attachment fixture");
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(pending).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            ({ containerType, containerId, storageId, filename, size }) =>
              window.fixtureMutations.some(
                (call) =>
                  call.name === "messages:send" &&
                  call.args.containerType === containerType &&
                  call.args.containerId === containerId &&
                  call.args.attachments?.[0]?.storageId === storageId &&
                  call.args.attachments[0].name === filename &&
                  call.args.attachments[0].size === size &&
                  call.args.attachments[0].mimeType === "text/plain",
              ),
            {
              containerType,
              containerId,
              storageId: currentUpload.storageId,
              filename,
              size: body.length,
            },
          ),
        )
        .toBe(true);
      const protocolCalls = await page.evaluate(() =>
        window.fixtureMutations.filter((call) =>
          call.name.startsWith("files:"),
        ),
      );
      expect(
        protocolCalls.some(
          (call) =>
            call.name === "files:generateUploadUrl" &&
            Object.keys(call.args).length === 0,
        ),
      ).toBe(true);
      expect(
        protocolCalls.some(
          (call) =>
            call.name === "files:registerUpload" &&
            call.args.storageId === currentUpload.storageId &&
            call.args.name === filename &&
            !Object.hasOwn(call.args, "uploadId"),
        ),
      ).toBe(true);
      expect(
        protocolCalls.some((call) =>
          ["files:verifyUpload", "files:cancel", "files:remove"].includes(
            call.name,
          ),
        ),
      ).toBe(false);

      await page.getByLabel("Attach files", { exact: true }).setInputFiles({
        name: "cancel-completed.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Cancel this completed upload"),
      });
      await expect(pending.getByText("Ready to send", { exact: true })).toBeVisible();
      const canceledId = uploaded.at(-1).storageId;
      await page
        .getByRole("button", {
          name: "Remove cancel-completed.txt",
          exact: true,
        })
        .click();
      await sawMutation(page, "files:discard", { storageId: canceledId });
      await expect(pending).toHaveCount(0);

      await page.evaluate(() =>
        window.setFixtureMutationErrors({
          "files:registerUpload": "Fixture registration rejected",
        }),
      );
      await page.getByLabel("Attach files", { exact: true }).setInputFiles({
        name: "retry-registration.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Retry a rejected registration"),
      });
      await expect(pending.getByRole("alert")).toContainText(
        "Fixture registration rejected",
      );
      await expect(
        page.getByRole("button", { name: "Send message", exact: true }),
      ).toBeDisabled();
      await sawMutation(page, "files:discard", {
        storageId: uploaded.at(-1).storageId,
      });
      await noRouteError();
      await page.evaluate(() => window.setFixtureMutationErrors({}));
      await pending
        .getByRole("button", {
          name: "Retry retry-registration.txt",
          exact: true,
        })
        .click();
      await expect(pending.getByText("Ready to send", { exact: true })).toBeVisible();
      await expect(pending.getByRole("alert")).toHaveCount(0);
      const retriedId = uploaded.at(-1).storageId;
      await pending
        .getByRole("button", {
          name: "Remove retry-registration.txt",
          exact: true,
        })
        .click();
      await sawMutation(page, "files:discard", { storageId: retriedId });
      await expect(pending).toHaveCount(0);
      await noRouteError();
    }
    expect(errors).toEqual([]);
    console.log(
      "PASS: Legacy attachments download, expand and play on desktop/phones; text previews are bounded and escaped; My Files and upload/send/cancel/retry avoid unavailable APIs",
    );
  } finally {
    page.off("pageerror", recordError);
    await page.evaluate((values) => {
      for (const [key, value] of Object.entries(values)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      window.setFixtureMutationErrors({});
      delete window.fixtureUploadedFiles;
      delete window.fixturePreviewInjected;
    }, previous);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${origin}/dashboard`);
    await context.unroute(mediaPattern, serveMedia);
    await context.unroute(uploadUrl, receiveUpload);
  }
}
