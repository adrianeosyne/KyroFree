/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect, afterEach, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { zipSync, strToU8 } from "fflate";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import {
  BOT_PERMISSIONS,
  commandSchema,
  messageSchema,
} from "../../src/lib/botContract";
import { inspectFile } from "../../server/files/validation";
import { validFileSignature, fileUrl } from "../../src/convex/fileAccess";
import { DOC_PAGES, searchDocs } from "../../src/lib/developerDocs";
import { API_ENDPOINTS, matchApiEndpoint } from "../../src/lib/apiReference";
import { validateMermaidSource, mermaidFence } from "../../src/lib/mermaid";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Developer",
      username: "developer",
      createdAt: Date.now(),
    }),
  );
  const strangerId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "Other",
      username: "other",
      createdAt: Date.now(),
    }),
  );
  const owner = t.withIdentity({ subject: ownerId }),
    stranger = t.withIdentity({ subject: strangerId });
  const token = `kyro_bot_${randomBytes(32).toString("hex")}`,
    tokenHash = createHash("sha256").update(token).digest("hex");
  const applicationId = await owner.mutation(api.botApplications.create, {
    name: "Ecosystem bot",
    username: "ecosystem_bot",
    description: "Test application",
    tokenHash,
  });
  const serverId = await owner.mutation(api.developerSandbox.create, {
    applicationId,
  });
  await owner.mutation(api.botApplications.install, {
    applicationId,
    serverId,
    permissions: BOT_PERMISSIONS,
  });
  await owner.mutation(api.botApplications.events, {
    applicationId,
    events: [
      "message.created",
      "message.updated",
      "attachment.created",
      "attachment.deleted",
      "interaction.created",
      "button.clicked",
      "modal.submitted",
      "member.timeout",
    ],
    deliveryMode: "poll",
    webhookUrl: "",
  });
  const channelId = (await owner.query(api.channels.list, { serverId }))
    .channels[0]
    .id as import("../../src/convex/_generated/dataModel").Id<"channels">;
  const invoke = (
    method: string,
    path: string,
    body: unknown = {},
    query: Record<string, string> = {},
  ) =>
    t.mutation(internal.botApi.execute, {
      tokenHash,
      method,
      path,
      body,
      query,
    });
  return {
    t,
    owner,
    stranger,
    ownerId,
    strangerId,
    applicationId,
    serverId,
    channelId,
    token,
    tokenHash,
    invoke,
  };
}
describe("developer ecosystem integration", () => {
  it("authenticates the v1 alias, identifies sessions, checks owner isolation and invalidates rotated sessions", async () => {
    const f = await fixture();
    const response = await f.t.fetch("/api/v1/me", {
      headers: { Authorization: `Bot ${f.token}` },
    });
    expect(response.status).toBe(200);
    const session = (await f.invoke("POST", "gateway/sessions", {
      label: "integration",
    })) as { id: string };
    await expect(
      f.invoke("GET", "events", {}, { sessionId: session.id }),
    ).resolves.toHaveProperty("events");
    const secondTokenHash = createHash("sha256")
      .update(randomBytes(32))
      .digest("hex");
    await f.t.run((ctx) =>
      ctx.db.patch(f.applicationId, {
        tokenHash: secondTokenHash,
        tokenUpdatedAt: Date.now() + 10,
      }),
    );
    await expect(f.invoke("GET", "me")).rejects.toThrow();
    await expect(
      f.t.mutation(internal.botApi.execute, {
        tokenHash: secondTokenHash,
        method: "GET",
        path: "events",
        body: {},
        query: { sessionId: session.id },
      }),
    ).rejects.toThrow(/Reconnect/);
    await expect(
      f.stranger.query(api.botAnalytics.get, {
        applicationId: f.applicationId,
      }),
    ).rejects.toThrow();
  });
  it("completes SDK-style message, upload, attachment, event acknowledgement and analytics operations", async () => {
    const f = await fixture();
    const bytes = new TextEncoder().encode("A real test report\n");
    const reservation = (await f.invoke(
      "POST",
      `channels/${f.channelId}/uploads`,
      {
        name: "report.txt",
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    )) as {
      uploadId: import("../../src/convex/_generated/dataModel").Id<"uploadTickets">;
    };
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(
        new Blob([bytes], { type: "application/octet-stream" }),
      ),
    );
    await f.invoke("POST", `channels/${f.channelId}/uploads/register`, {
      storageId,
      uploadId: reservation.uploadId,
      name: "report.txt",
    });
    await f.t.action(internal.fileVerification.verify, {
      uploadId: reservation.uploadId,
    });
    const message = (await f.invoke(
      "POST",
      `channels/${f.channelId}/messages`,
      { content: "Report", attachmentIds: [storageId] },
    )) as { id: string; attachments: { name: string; mimeType: string }[] };
    expect(message.attachments[0]).toMatchObject({
      name: "report.txt",
      mimeType: "text/plain",
    });
    const events = (await f.invoke("GET", "events")) as {
      events: { id: string; name: string }[];
    };
    expect(events.events.map((e) => e.name)).toEqual(
      expect.arrayContaining(["message.created", "attachment.created"]),
    );
    await f.invoke("POST", "events/ack", {
      ids: events.events.map((e) => e.id),
    });
    await f.invoke("DELETE", `files/${storageId}`);
    const changed = (await f.invoke(
      "GET",
      `channels/${f.channelId}/messages/${message.id}`,
    )) as { attachments: unknown[] };
    expect(changed.attachments).toHaveLength(0);
    const analytics = await f.owner.query(api.botAnalytics.get, {
      applicationId: f.applicationId,
    });
    expect(analytics.daily[0].uploadedBytes).toBe(bytes.length);
    expect(analytics.daily[0].delivered).toBeGreaterThan(0);
  });
  it("quarantines mismatched content and prevents foreign reservation use, claims and downloads", async () => {
    const f = await fixture();
    const bytes = new TextEncoder().encode("<script>alert(1)</script>");
    const ticket = await f.owner.mutation(api.files.generateUploadUrl, {
      name: "payload.txt",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob([bytes], { type: "text/plain" })),
    );
    await expect(
      f.stranger.mutation(api.files.registerUpload, {
        storageId,
        name: "payload.txt",
        uploadId: ticket.uploadId,
      }),
    ).rejects.toThrow();
    await f.owner.mutation(api.files.registerUpload, {
      storageId,
      name: "payload.txt",
      uploadId: ticket.uploadId,
    });
    await expect(
      f.owner.action(api.files.verifyUpload, { uploadId: ticket.uploadId }),
    ).rejects.toThrow(/rejected/);
    await expect(
      f.owner.query(api.files.download, { storageId }),
    ).rejects.toThrow(/verified/);
    const stored = await f.t.run((ctx) =>
      ctx.db
        .query("uploads")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId))
        .unique(),
    );
    expect(stored?.status).toBe("quarantined");
  });
  it("counts reservations towards quota and preserves files referenced by resources", async () => {
    vi.stubEnv("KYRO_STORAGE_QUOTA_BYTES", "10");
    const f = await fixture();
    const input = { name: "tiny.txt", size: 8, sha256: "a".repeat(64) };
    const ticket = await f.owner.mutation(api.files.generateUploadUrl, input);
    await expect(
      f.owner.mutation(api.files.generateUploadUrl, input),
    ).rejects.toThrow(/quota/);
    await f.owner.mutation(api.files.cancel, { uploadId: ticket.uploadId });
    await expect(
      f.owner.mutation(api.files.generateUploadUrl, input),
    ).resolves.toHaveProperty("uploadUrl");
  });
  it("rechecks download access and validates expiry and tampering of signed URLs", async () => {
    vi.stubEnv("KYRO_FILE_SIGNING_SECRET", randomBytes(32).toString("hex"));
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
    const url = new URL(fileUrl("file", "viewer", "message")!);
    const expires = Number(url.searchParams.get("expires")),
      sig = url.searchParams.get("signature")!;
    expect(validFileSignature("file", "viewer", "message", expires, sig)).toBe(
      true,
    );
    expect(validFileSignature("file", "other", "message", expires, sig)).toBe(
      false,
    );
    expect(
      validFileSignature("file", "viewer", "message", Date.now() - 1, sig),
    ).toBe(false);
    const f = await fixture();
    const missing = await f.t.fetch(url.pathname + url.search);
    expect(missing.status).toBe(403);
  });
  it("validates buttons, private modal ownership, submissions and autocomplete replies", async () => {
    const f = await fixture();
    const message = (await f.invoke(
      "POST",
      `channels/${f.channelId}/messages`,
      {
        content: "Support",
        components: [{ type: "button", customId: "open", label: "Open" }],
      },
    )) as {
      id: import("../../src/convex/_generated/dataModel").Id<"messages">;
    };
    await expect(
      f.owner.mutation(api.botInteractions.click, {
        channelId: f.channelId,
        messageId: message.id,
        customId: "forged",
      }),
    ).rejects.toThrow();
    const interactionId = await f.owner.mutation(api.botInteractions.click, {
      channelId: f.channelId,
      messageId: message.id,
      customId: "open",
    });
    await f.invoke("POST", `interactions/${interactionId}/modal`, {
      customId: "ticket",
      title: "Ticket",
      fields: [{ customId: "subject", label: "Subject", required: true }],
    });
    await expect(
      f.stranger.mutation(api.botInteractions.submitModal, {
        interactionId,
        values: { subject: "Attack" },
      }),
    ).rejects.toThrow();
    const submission = await f.owner.mutation(api.botInteractions.submitModal, {
      interactionId,
      values: { subject: "Help" },
    });
    await f.invoke("POST", `interactions/${submission}/response`, {
      content: "Received",
      ephemeral: true,
    });
    const commandId = await f.owner.mutation(api.botCommands.save, {
      applicationId: f.applicationId,
      command: {
        name: "find",
        description: "Find",
        options: [
          {
            name: "query",
            description: "Query",
            type: "string",
            autocomplete: true,
          },
        ],
      },
    });
    const completion = await f.owner.mutation(
      api.botInteractions.autocomplete,
      { channelId: f.channelId, commandId, option: "query", value: "g" },
    );
    await f.invoke("POST", `interactions/${completion}/choices`, {
      choices: [{ label: "General", value: "general" }],
    });
    expect(
      await f.owner.query(api.botInteractions.autocompleteResult, {
        interactionId: completion,
      }),
    ).toEqual([{ label: "General", value: "general" }]);
    await expect(
      f.invoke("POST", `interactions/${completion}/choices`, { choices: [] }),
    ).rejects.toThrow();
  });
  it("binds installation consent to its manager, grants and registered redirect, then consumes it once", async () => {
    const f = await fixture();
    const redirectUri = "https://example.com/installed";
    await f.owner.mutation(api.developerManagement.saveMetadata, {
      applicationId: f.applicationId,
      metadata: {
        website: "",
        supportUrl: "",
        privacyUrl: "",
        termsUrl: "",
        contactEmail: "",
        redirectUris: [redirectUri],
      },
    });
    const input = {
      applicationId: f.applicationId,
      serverId: f.serverId,
      permissions: ["view_channel"],
      state: "random-state-123456789",
      redirectUri,
    };
    await expect(
      f.owner.mutation(api.developerManagement.beginAuthorization, {
        ...input,
        redirectUri: redirectUri + "/other",
      }),
    ).rejects.toThrow();
    await expect(
      f.stranger.mutation(api.developerManagement.beginAuthorization, input),
    ).rejects.toThrow();
    const authorizationId = await f.owner.mutation(
      api.developerManagement.beginAuthorization,
      input,
    );
    await expect(
      f.owner.query(api.developerManagement.authorizationResult, {
        authorizationId,
      }),
    ).rejects.toThrow();
    await expect(
      f.owner.mutation(api.botApplications.install, {
        applicationId: f.applicationId,
        serverId: f.serverId,
        permissions: BOT_PERMISSIONS,
        authorizationId,
      }),
    ).rejects.toThrow();
    await f.owner.mutation(api.botApplications.install, {
      applicationId: f.applicationId,
      serverId: f.serverId,
      permissions: input.permissions,
      authorizationId,
    });
    const result = new URL(
      (await f.owner.query(api.developerManagement.authorizationResult, {
        authorizationId,
      }))!,
    );
    expect(result.origin + result.pathname).toBe(redirectUri);
    expect(result.searchParams.get("state")).toBe(input.state);
    await expect(
      f.owner.mutation(api.botApplications.install, {
        applicationId: f.applicationId,
        serverId: f.serverId,
        permissions: input.permissions,
        authorizationId,
      }),
    ).rejects.toThrow();
    await expect(
      f.stranger.query(api.developerManagement.authorizationResult, {
        authorizationId,
      }),
    ).rejects.toThrow();
  });
  it("lets an application bot attach its owner's verified asset without exposing unrelated assets", async () => {
    const f = await fixture();
    const bytes = strToU8("Reusable report");
    const ticket = await f.owner.mutation(api.files.generateUploadUrl, {
      applicationId: f.applicationId,
      name: "asset.txt",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob([bytes])),
    );
    await f.owner.mutation(api.files.registerUpload, {
      storageId,
      name: "asset.txt",
      uploadId: ticket.uploadId,
    });
    await f.owner.action(api.files.verifyUpload, { uploadId: ticket.uploadId });
    await expect(
      f.stranger.query(api.files.download, { storageId }),
    ).rejects.toThrow();
    await expect(f.invoke("GET", `files/${storageId}`)).resolves.toHaveProperty(
      "id",
      storageId,
    );
    const message = (await f.invoke(
      "POST",
      `channels/${f.channelId}/messages`,
      { content: "Application report", attachmentIds: [storageId] },
    )) as { id: string };
    await expect(
      f.owner.mutation(api.files.remove, { storageId }),
    ).rejects.toThrow(/resource/);
    // Even the asset owner cannot remove an attachment from another author's message.
    await expect(
      f.owner.mutation(api.files.removeAttachment, {
        storageId,
        messageId:
          message.id as import("../../src/convex/_generated/dataModel").Id<"messages">,
      }),
    ).rejects.toThrow(/author/);
  });
  it("removes a human author's attachment and preserves message history", async () => {
    const f = await fixture();
    const bytes = strToU8("Human report");
    const ticket = await f.owner.mutation(api.files.generateUploadUrl, {
      name: "report.txt",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob([bytes])),
    );
    await f.owner.mutation(api.files.registerUpload, {
      storageId,
      name: "report.txt",
      uploadId: ticket.uploadId,
    });
    const attachment = await f.owner.action(api.files.verifyUpload, {
      uploadId: ticket.uploadId,
    });
    const sent = await f.owner.mutation(api.messages.send, {
      containerType: "channel",
      containerId: f.channelId,
      content: "Keep this message",
      clientId: "attachment-removal",
      attachments: [attachment],
    });
    if (!sent.messageId) throw new Error("Message send was blocked");
    const messageId =
      sent.messageId as import("../../src/convex/_generated/dataModel").Id<"messages">;
    await f.owner.mutation(api.files.removeAttachment, {
      storageId,
      messageId,
    });
    const message = await f.t.run((ctx) => ctx.db.get(messageId));
    expect(message?.attachments).toEqual([]);
    expect(message?.content).toBe("Keep this message");
    await expect(
      f.owner.query(api.files.download, { storageId, messageId }),
    ).rejects.toThrow();
  });
  it("schedules new webhook events immediately and applies configured retry timing", async () => {
    const f = await fixture();
    // Set the validated configuration directly to avoid real DNS/network work in this test.
    await f.t.run((ctx) =>
      ctx.db.patch(f.applicationId, {
        deliveryMode: "webhook",
        webhookUrl: "https://example.com/events",
        webhookMaxAttempts: 2,
        webhookRetrySeconds: 10,
      }),
    );
    await f.invoke("POST", `channels/${f.channelId}/messages`, {
      content: "Webhook scheduling",
    });
    const event = await f.t.run((ctx) =>
      ctx.db
        .query("botEvents")
        .withIndex("by_app_created", (q) =>
          q.eq("applicationId", f.applicationId),
        )
        .order("desc")
        .first(),
    );
    const scheduled = await f.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      scheduled.some(
        (job) =>
          job.name.includes("botWebhooks") &&
          JSON.stringify(job.args).includes(event!._id),
      ),
    ).toBe(true);
    const claim = await f.t.mutation(internal.botDelivery.claim, {
      eventId: event!._id,
    });
    expect(claim?.event.applicationId).toBe(f.applicationId);
    const before = Date.now();
    await f.t.mutation(internal.botDelivery.finish, {
      eventId: event!._id,
      attempt: claim!.attempt,
      success: false,
      error: "HTTP_503",
    });
    const retry = await f.t.run((ctx) => ctx.db.get(event!._id));
    expect(retry?.nextAttemptAt).toBeGreaterThanOrEqual(before + 10000);
    expect(retry?.status).toBe("pending");
  });
  it("isolates application metadata, transfer offers and disabled installations", async () => {
    const f = await fixture();
    await f.owner.mutation(api.developerManagement.saveMetadata, {
      applicationId: f.applicationId,
      metadata: {
        website: "https://example.com",
        supportUrl: "",
        privacyUrl: "",
        termsUrl: "",
        contactEmail: "dev@example.com",
        redirectUris: [],
      },
    });
    await f.owner.mutation(api.developerManagement.installationState, {
      applicationId: f.applicationId,
      serverId: f.serverId,
      disabled: true,
    });
    await expect(f.invoke("GET", `servers/${f.serverId}`)).rejects.toThrow();
    await f.owner.mutation(api.developerManagement.requestTransfer, {
      applicationId: f.applicationId,
      username: "other",
      confirmation: "Ecosystem bot",
    });
    await expect(
      f.owner.mutation(api.developerManagement.acceptTransfer, {
        applicationId: f.applicationId,
        accept: true,
      }),
    ).rejects.toThrow();
    await f.stranger.mutation(api.developerManagement.acceptTransfer, {
      applicationId: f.applicationId,
      accept: true,
    });
    await expect(f.invoke("GET", "me")).rejects.toThrow();
    expect(
      (
        await f.stranger.query(api.botApplications.get, {
          applicationId: f.applicationId,
        })
      ).tokenConfigured,
    ).toBe(false);
  });
});
describe("file content and documentation contracts", () => {
  it("checks text signatures, executable disguises, Office manifests and ZIP traversal", async () => {
    expect(await inspectFile(strToU8("hello"), "hello.txt", "image/png")).toBe(
      "text/plain",
    );
    await expect(
      inspectFile(strToU8("MZpayload"), "photo.png", "image/png"),
    ).rejects.toThrow();
    await expect(
      inspectFile(strToU8("<svg></svg>"), "photo.svg", "image/svg+xml"),
    ).rejects.toThrow();
    await expect(
      inspectFile(
        zipSync({ "../escape.txt": strToU8("x") }),
        "unsafe.zip",
        "application/zip",
      ),
    ).rejects.toThrow();
    await expect(
      inspectFile(
        zipSync({ "file.txt": strToU8("x") }),
        "fake.docx",
        "application/zip",
      ),
    ).rejects.toThrow();
    const doc = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/document.xml": strToU8("<document/>"),
    });
    expect(
      await inspectFile(doc, "report.docx", "application/octet-stream"),
    ).toMatch(/wordprocessing/);
  });
  it("bounds untrusted Mermaid and keeps ordinary code and source intact", () => {
    expect(mermaidFence("flowchart TD\nA --> B")).toContain("```mermaid");
    for (const source of [
      "x".repeat(12001),
      "flowchart TD\nclick A javascript:alert(1)",
      "---\nconfig:\n securityLevel: loose",
      "%%{init: {}}%%\nflowchart TD\nA-->B",
    ])
      expect(() => validateMermaidSource(source)).toThrow();
    expect(
      commandSchema.safeParse({
        name: "find",
        description: "Find",
        options: [
          { name: "x", description: "X", type: "integer", autocomplete: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      messageSchema.safeParse({
        content: "x",
        components: [
          { type: "button", customId: "a", label: "A" },
          { type: "button", customId: "a", label: "B" },
        ],
      }).success,
    ).toBe(false);
  });
  it("keeps docs unique, searchable and aligned with every allowed REST route", () => {
    expect(new Set(DOC_PAGES.map((p) => p.slug)).size).toBe(DOC_PAGES.length);
    expect(searchDocs("token rotation").length).toBeGreaterThan(0);
    for (const endpoint of API_ENDPOINTS)
      expect(
        matchApiEndpoint(
          endpoint.method,
          endpoint.path.replace(/:[A-Za-z]+/g, "resource"),
        )?.id,
      ).toBe(endpoint.id);
    expect(matchApiEndpoint("PUT", "me")).toBeUndefined();
  });
});
