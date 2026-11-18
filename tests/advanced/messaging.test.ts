/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import { zonedInstant, zonedInput } from "../../src/lib/zonedTime";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", {
      name: "Owner",
      username: "owner",
      createdAt: 1,
    }),
    member: await ctx.db.insert("users", {
      name: "Member",
      username: "member",
      createdAt: 1,
    }),
    stranger: await ctx.db.insert("users", {
      name: "Stranger",
      username: "stranger",
      createdAt: 1,
    }),
  }));
  const owner = t.withIdentity({ subject: ids.owner });
  const member = t.withIdentity({ subject: ids.member });
  const stranger = t.withIdentity({ subject: ids.stranger });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Messaging tests",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  const channels = await owner.query(api.channels.list, { serverId });
  const channelId = channels.channels.find((row) => row.kind === "text")!.id;
  const scope = { containerType: "channel" as const, containerId: channelId };
  const send = async (content = "Original text") =>
    (await owner.mutation(api.messages.send, { ...scope, content })).messageId!;
  return { t, ids, owner, member, stranger, serverId, channelId, scope, send };
}
const page = { numItems: 10, cursor: null };
describe("advanced persistent messaging", () => {
  it("sends once through the scheduler with timezone metadata and clears the stored copy", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.advancedMessages.schedule, {
      ...f.scope,
      content: "Later",
      sendAt: Date.now() + 60_000,
      timezone: "Asia/Colombo",
    });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    const row = await f.t.run((ctx) => ctx.db.get(id));
    expect(row?.status).toBe("sent");
    expect(row?.content).toBe("");
    expect(row?.timezone).toBe("Asia/Colombo");
    await f.t.mutation(internal.advancedMessages.deliverScheduled, { id });
    const messages = await f.owner.query(api.messages.list, f.scope);
    expect(
      messages.messages.filter((row) => row.content === "Later"),
    ).toHaveLength(1);
  });
  it("records failure instead of bypassing membership revoked after scheduling", async () => {
    const f = await fixture();
    const id = await f.member.mutation(api.advancedMessages.schedule, {
      ...f.scope,
      content: "Should not send",
      sendAt: Date.now() + 60_000,
      timezone: "UTC",
    });
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
    expect(
      (await f.owner.query(api.messages.list, f.scope)).messages,
    ).toHaveLength(0);
  });
  it("rechecks locked channels and AutoMod, without partial message writes", async () => {
    const f = await fixture();
    const id = await f.member.mutation(api.advancedMessages.schedule, {
      ...f.scope,
      content: "Should not send",
      sendAt: Date.now() + 60_000,
      timezone: "UTC",
    });
    await f.t.run((ctx) =>
      ctx.db.patch(
        f.channelId as import("../../src/convex/_generated/dataModel").Id<"channels">,
        { readOnly: true },
      ),
    );
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.status).toBe("failed");
    expect(
      (await f.owner.query(api.messages.list, f.scope)).messages,
    ).toHaveLength(0);
  });
  it("isolates schedules by owner and supports cancellation and pagination", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.advancedMessages.schedule, {
      ...f.scope,
      content: "Cancelled",
      sendAt: Date.now() + 60_000,
      timezone: "UTC",
    });
    await expect(
      f.member.mutation(api.advancedMessages.cancelSchedule, { id }),
    ).rejects.toThrow("not found");
    expect(
      (
        await f.member.query(api.advancedMessages.schedules, {
          paginationOpts: page,
        })
      ).page,
    ).toHaveLength(0);
    await f.owner.mutation(api.advancedMessages.cancelSchedule, { id });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.status).toBe("cancelled");
  });
  it("validates scheduling instants, timezones and expiration", async () => {
    const f = await fixture();
    const base = {
      ...f.scope,
      content: "Test",
      sendAt: Date.now() + 60_000,
      timezone: "UTC",
    };
    await expect(
      f.owner.mutation(api.advancedMessages.schedule, {
        ...base,
        sendAt: Date.now(),
      }),
    ).rejects.toThrow("Send time");
    await expect(
      f.owner.mutation(api.advancedMessages.schedule, {
        ...base,
        timezone: "Bogus/Timezone",
      }),
    ).rejects.toThrow("timezone");
    await expect(
      f.owner.mutation(api.messages.send, {
        ...f.scope,
        content: "Test",
        lifetimeSeconds: 1,
      }),
    ).rejects.toThrow("expiry");
    await expect(
      f.stranger.mutation(api.advancedMessages.schedule, base),
    ).rejects.toThrow();
  });
  it("keeps version history, restores only as author and rejects stale restore attempts", async () => {
    const f = await fixture();
    const id = await f.send();
    await f.owner.mutation(api.messages.edit, {
      messageId: id,
      content: "Edited text",
    });
    const versions = await f.member.query(api.advancedMessages.versions, {
      messageId: id,
      paginationOpts: page,
    });
    expect(versions.page[0].content).toBe("Original text");
    await expect(
      f.member.mutation(api.advancedMessages.restoreVersion, {
        versionId: versions.page[0]._id,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("own messages");
    await expect(
      f.owner.mutation(api.advancedMessages.restoreVersion, {
        versionId: versions.page[0]._id,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("changed");
    await f.owner.mutation(api.advancedMessages.restoreVersion, {
      versionId: versions.page[0]._id,
      expectedRevision: (await f.owner.query(api.messages.list, f.scope))
        .messages[0].revision,
    });
    expect(
      (await f.owner.query(api.messages.list, f.scope)).messages[0].content,
    ).toBe("Original text");
    await expect(
      f.stranger.query(api.advancedMessages.versions, {
        messageId: id,
        paginationOpts: page,
      }),
    ).rejects.toThrow();
  });
  it("rejects a stale restore after multiple edits in the same millisecond", async () => {
    const f = await fixture();
    const id = await f.send();
    await f.owner.mutation(api.messages.edit, {
      messageId: id,
      content: "Second",
    });
    const version = (
      await f.owner.query(api.advancedMessages.versions, {
        messageId: id,
        paginationOpts: page,
      })
    ).page[0];
    await f.owner.mutation(api.messages.edit, {
      messageId: id,
      content: "Third",
    });
    await expect(
      f.owner.mutation(api.advancedMessages.restoreVersion, {
        versionId: version._id,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("changed");
    expect(
      (await f.owner.query(api.messages.list, f.scope)).messages[0].content,
    ).toBe("Third");
  });
  it("saves private collections and hides bookmarked content after access is removed", async () => {
    const f = await fixture();
    const messageId = await f.send();
    const collectionId = await f.member.mutation(
      api.advancedMessages.createCollection,
      { name: "Research" },
    );
    await f.member.mutation(api.advancedMessages.bookmark, {
      messageId,
      collectionId,
    });
    await f.member.mutation(api.advancedMessages.bookmark, {
      messageId,
      collectionId,
    });
    expect(
      (
        await f.member.query(api.advancedMessages.bookmarks, {
          collectionId,
          paginationOpts: page,
        })
      ).page,
    ).toHaveLength(1);
    expect(
      (
        await f.owner.query(api.advancedMessages.bookmarks, {
          paginationOpts: page,
        })
      ).page,
    ).toHaveLength(0);
    await expect(
      f.owner.mutation(api.advancedMessages.bookmark, {
        messageId,
        collectionId,
      }),
    ).rejects.toThrow("Collection not found");
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    const saved = await f.member.query(api.advancedMessages.bookmarks, {
      collectionId,
      paginationOpts: page,
    });
    expect(saved.page[0].content).toBeNull();
    expect(saved.page[0].link).toBeUndefined();
  });
  it("forwards verified text attribution and rechecks both source and destination permissions", async () => {
    const f = await fixture();
    const messageId = await f.send();
    const conversationId = await f.member.mutation(
      api.conversations.createDirect,
      { userId: f.ids.owner },
    );
    const forwarded = await f.member.mutation(api.advancedMessages.forward, {
      messageId,
      containerType: "conversation",
      containerId: conversationId,
      clientId: "test-forward",
    });
    const row = await f.t.run((ctx) => ctx.db.get(forwarded.messageId!));
    expect(row?.authorId).toBe(f.ids.member);
    expect(row?.forwardedFrom?.authorId).toBe(f.ids.owner);
    expect(row?.forwardedFrom?.authorName).toBe("Owner");
    await expect(
      f.stranger.mutation(api.advancedMessages.forward, {
        messageId,
        ...f.scope,
        clientId: "stranger-forward",
      }),
    ).rejects.toThrow();
  });
  it("hides notification previews at expiry and after access removal before cleanup", async () => {
    const f = await fixture();
    const messageId = (
      await f.owner.mutation(api.messages.send, {
        ...f.scope,
        content: "Private temporary preview",
        lifetimeSeconds: 60,
      })
    ).messageId!;
    await f.t.run((ctx) =>
      ctx.db.insert("notifications", {
        userId: f.ids.member,
        type: "mention",
        title: "Temporary mention",
        body: "Private temporary preview",
        read: false,
        createdAt: Date.now(),
        messageId,
      }),
    );
    const before = await f.member.query(api.notifications.list, {});
    expect(before).toHaveLength(1);
    expect(before[0].expiresAt).toBe(
      (await f.t.run((ctx) => ctx.db.get(messageId)))?.expiresAt,
    );
    vi.setSystemTime(Date.now() + 61_000);
    expect(await f.t.run((ctx) => ctx.db.get(messageId))).not.toBeNull();
    expect(await f.member.query(api.notifications.list, {})).toHaveLength(0);
    const permanentId = await f.send("Permanent preview");
    await f.t.run((ctx) =>
      ctx.db.insert("notifications", {
        userId: f.ids.member,
        type: "mention",
        title: "Permanent mention",
        body: "Permanent preview",
        read: false,
        createdAt: Date.now(),
        messageId: permanentId,
      }),
    );
    expect(await f.member.query(api.notifications.list, {})).toHaveLength(1);
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    expect(await f.member.query(api.notifications.list, {})).toHaveLength(0);
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it("deletes expired text, edits, reminders, attachments and notification previews", async () => {
    const f = await fixture();
    const result = await f.owner.mutation(api.messages.send, {
      ...f.scope,
      content: "Temporary",
      lifetimeSeconds: 60,
    });
    const messageId = result.messageId!;
    await f.owner.mutation(api.messages.edit, {
      messageId,
      content: "Temporary edited",
    });
    await expect(
      f.member.mutation(api.advancedMessages.bookmark, { messageId }),
    ).rejects.toThrow("Temporary");
    await expect(
      f.member.mutation(api.advancedMessages.forward, {
        messageId,
        ...f.scope,
        clientId: "expiry-forward",
      }),
    ).rejects.toThrow("Temporary");
    await f.t.run((ctx) =>
      ctx.db.insert("notifications", {
        userId: f.ids.member,
        type: "mention",
        title: "Temporary",
        messageId,
        containerKey: f.channelId,
        createdAt: Date.now(),
        read: false,
      }),
    );
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await f.t.run((ctx) => ctx.db.get(messageId))).toBeNull();
    expect(
      await f.t.run((ctx) => ctx.db.query("messageVersions").collect()),
    ).toHaveLength(0);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("notifications")
          .withIndex("by_message", (q) => q.eq("messageId", messageId))
          .collect(),
      ),
    ).toHaveLength(0);
  });
  it("denies expired attachments and threads before the cleanup job runs", async () => {
    const f = await fixture();
    const storageId = await f.t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob(["hello"], { type: "text/plain" }),
      );
      await ctx.db.insert("uploads", {
        storageId: id,
        ownerId: f.ids.owner,
        name: "hello.txt",
        mimeType: "text/plain",
        size: 5,
        createdAt: Date.now(),
      });
      return id;
    });
    const messageId = (
      await f.owner.mutation(api.messages.send, {
        ...f.scope,
        content: "Temporary attachment",
        lifetimeSeconds: 60,
        attachments: [
          { storageId, name: "hello.txt", mimeType: "text/plain", size: 5 },
        ],
      })
    ).messageId!;
    const threadId = await f.member.mutation(api.threads.openForMessage, {
      messageId,
    });
    await f.member.mutation(api.messages.send, {
      ...f.scope,
      content: "Reply survives",
      replyToId: messageId,
    });
    vi.setSystemTime(
      (await f.t.run((ctx) => ctx.db.get(messageId)))!.expiresAt! + 1,
    );
    await expect(
      f.member.query(api.files.download, { storageId, messageId }),
    ).rejects.toThrow("unavailable");
    await expect(f.member.query(api.threads.get, { threadId })).rejects.toThrow(
      "no longer exists",
    );
    const listed = await f.member.query(api.messages.list, f.scope);
    expect(listed.messages).toHaveLength(1);
    expect(listed.messages[0].replyTo).toBeNull();
  });
  it("delivers private reminders and cancels them after revoked access", async () => {
    const f = await fixture();
    const messageId = await f.send();
    const id = await f.member.mutation(api.advancedMessages.remind, {
      messageId,
      remindAt: Date.now() + 60_000,
      timezone: "UTC",
      note: "Follow up",
    });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.status).toBe("delivered");
    const notifications = await f.t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(
      notifications.some(
        (row) => row.userId === f.ids.member && row.body === "Follow up",
      ),
    ).toBe(true);
    const next = await f.member.mutation(api.advancedMessages.remind, {
      messageId,
      remindAt: Date.now() + 60_000,
      timezone: "UTC",
      note: "Private",
    });
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await f.t.run((ctx) => ctx.db.get(next)))?.status).toBe(
      "cancelled",
    );
  });
  it("synchronizes private draft/note revisions without overwriting competing edits", async () => {
    const f = await fixture();
    await f.owner.mutation(api.advancedMessages.savePrivate, {
      ...f.scope,
      kind: "draft",
      content: "Unsaved idea",
      expectedRevision: 0,
    });
    const state = await f.owner.query(
      api.advancedMessages.privateState,
      f.scope,
    );
    expect(state.draft?.content).toBe("Unsaved idea");
    expect(
      (await f.member.query(api.advancedMessages.privateState, f.scope)).draft,
    ).toBeNull();
    await expect(
      f.owner.mutation(api.advancedMessages.savePrivate, {
        ...f.scope,
        kind: "draft",
        content: "Stale",
        expectedRevision: 0,
      }),
    ).rejects.toThrow("another device");
    await f.owner.mutation(api.advancedMessages.savePrivate, {
      ...f.scope,
      kind: "note",
      content: "Private note",
      expectedRevision: 0,
    });
    expect(
      (await f.member.query(api.advancedMessages.privateState, f.scope)).note,
    ).toBeNull();
  });
  it("keeps folders private and never reveals an inaccessible conversation", async () => {
    const f = await fixture();
    const folderId = await f.member.mutation(
      api.advancedMessages.createFolder,
      { name: "Work" },
    );
    await f.member.mutation(api.advancedMessages.setFolder, {
      ...f.scope,
      folderId,
    });
    expect(
      (await f.member.query(api.advancedMessages.folders, {}))[0].items,
    ).toHaveLength(1);
    expect(await f.owner.query(api.advancedMessages.folders, {})).toHaveLength(
      0,
    );
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    expect(
      (await f.member.query(api.advancedMessages.folders, {}))[0].items,
    ).toHaveLength(0);
  });
});
describe("timezone conversion", () => {
  it("converts Sri Lanka local time and other UTC offsets", () => {
    expect(zonedInstant("2026-11-18T15:30", "Asia/Colombo")).toBe(
      Date.UTC(2026, 10, 18, 10),
    );
    expect(zonedInput(Date.UTC(2026, 10, 18, 10), "Asia/Colombo")).toBe(
      "2026-11-18T15:30",
    );
  });
  it("rejects daylight-saving gaps, overlaps and invalid zones", () => {
    expect(() => zonedInstant("2026-03-08T02:30", "America/New_York")).toThrow(
      "clock change",
    );
    expect(() => zonedInstant("2026-11-01T01:30", "America/New_York")).toThrow(
      "clock change",
    );
    expect(() => zonedInstant("2026-11-18T10:00", "No/Zone")).toThrow();
  });
});
