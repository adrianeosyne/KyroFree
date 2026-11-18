/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import type { Id } from "../../src/convex/_generated/dataModel";
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
  }));
  const owner = t.withIdentity({ subject: ids.owner });
  const member = t.withIdentity({ subject: ids.member });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Lifecycle",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  const channelId = (
    await owner.query(api.channels.list, { serverId })
  ).channels.find((row) => row.kind === "text")!.id as Id<"channels">;
  const scope = { containerType: "channel" as const, containerId: channelId };
  return { t, ids, owner, member, serverId, channelId, scope };
}
it("deletes container drafts, notes, folders, tasks, document versions and pending sends", async () => {
  const f = await fixture();
  const document = await f.member.mutation(api.collaboration.createDocument, {
    ...f.scope,
    title: "Shared",
    content: "First",
  });
  await f.member.mutation(api.collaboration.saveDocument, {
    id: document,
    title: "Shared",
    content: "Second",
    expectedRevision: 1,
  });
  await f.member.mutation(api.collaboration.createTask, {
    ...f.scope,
    title: "Deadline",
    description: "",
    dueAt: Date.now() + 120000,
  });
  const send = await f.member.mutation(api.advancedMessages.schedule, {
    ...f.scope,
    content: "Never send",
    sendAt: Date.now() + 60000,
    timezone: "UTC",
  });
  await f.member.mutation(api.advancedMessages.savePrivate, {
    ...f.scope,
    kind: "draft",
    content: "Private draft",
    expectedRevision: 0,
  });
  await f.member.mutation(api.advancedMessages.savePrivate, {
    ...f.scope,
    kind: "note",
    content: "Private note",
    expectedRevision: 0,
  });
  const folder = await f.member.mutation(api.advancedMessages.createFolder, {
    name: "Folder",
  });
  await f.member.mutation(api.advancedMessages.setFolder, {
    ...f.scope,
    folderId: folder,
  });
  await f.owner.mutation(api.channels.remove, { channelId: f.channelId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const table of [
    "messageDrafts",
    "conversationNotes",
    "conversationFolderItems",
    "sharedDocuments",
    "documentVersions",
    "workTasks",
  ] as const)
    expect(await f.t.run((ctx) => ctx.db.query(table).collect())).toHaveLength(
      0,
    );
  expect(await f.t.run((ctx) => ctx.db.get(send))).toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(folder))).not.toBeNull();
});
it("continues server cleanup across batches and removes dependent votes and party members", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 75; i++) {
      const pageId = await ctx.db.insert("communityPages", {
        serverId: f.serverId,
        kind: "suggestion",
        title: `Idea ${i}`,
        content: "",
        category: "",
        authorId: f.ids.member,
        revision: 1,
        votes: 1,
        status: "open",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("suggestionVotes", {
        pageId,
        userId: f.ids.owner,
        createdAt: Date.now(),
      });
    }
  });
  await f.owner.mutation(api.gaming.createParty, {
    serverId: f.serverId,
    game: "Minecraft",
    title: "Build",
    description: "",
    region: "Asia",
    language: "English",
    capacity: 4,
    startsAt: Date.now() + 60000,
    timezone: "UTC",
  });
  await f.owner.mutation(api.servers.remove, {
    serverId: f.serverId,
    confirm: "Lifecycle",
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const table of [
    "communityPages",
    "suggestionVotes",
    "partyPosts",
    "partyMembers",
  ] as const)
    expect(await f.t.run((ctx) => ctx.db.query(table).collect())).toHaveLength(
      0,
    );
});
it("cleans a deleted account's contributions and repairs remaining party and vote counts", async () => {
  const f = await fixture();
  const party = await f.owner.mutation(api.gaming.createParty, {
    serverId: f.serverId,
    game: "Minecraft",
    title: "Build",
    description: "",
    region: "Asia",
    language: "English",
    capacity: 4,
    startsAt: Date.now() + 60000,
    timezone: "UTC",
  });
  await f.member.mutation(api.gaming.joinParty, { id: party, join: true });
  const page = await f.owner.mutation(api.communityKnowledge.create, {
    serverId: f.serverId,
    kind: "suggestion",
    title: "Idea",
    content: "Text",
    category: "General",
  });
  await f.member.mutation(api.communityKnowledge.vote, { id: page });
  await f.member.mutation(api.socialFeed.publish, {
    content: "Remove me",
    kind: "post",
    privacy: "public",
  });
  await f.member.mutation(api.socialFeed.follow, {
    userId: f.ids.owner,
    following: true,
  });
  await f.owner.mutation(api.socialFeed.follow, {
    userId: f.ids.member,
    following: true,
  });
  await f.member.mutation(api.advancedMessages.savePrivate, {
    ...f.scope,
    kind: "draft",
    content: "Private",
    expectedRevision: 0,
  });
  const message = (
    await f.member.mutation(api.messages.send, { ...f.scope, content: "First" })
  ).messageId!;
  await f.member.mutation(api.messages.edit, {
    messageId: message,
    content: "Second",
  });
  await f.owner.mutation(api.advancedMessages.bookmark, { messageId: message });
  await f.member.mutation(api.users.deleteAccount, { confirm: "DELETE" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run((ctx) => ctx.db.get(f.ids.member))).toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(party)))?.memberCount).toBe(1);
  expect((await f.t.run((ctx) => ctx.db.get(page)))?.votes).toBe(0);
  for (const table of [
    "socialPosts",
    "socialFollows",
    "messageDrafts",
    "messageVersions",
    "savedMessages",
  ] as const)
    expect(await f.t.run((ctx) => ctx.db.query(table).collect())).toHaveLength(
      0,
    );
});
it("exports advanced data by owner with cursor pagination and removes scheduler identifiers", async () => {
  const f = await fixture();
  await f.member.mutation(api.advancedMessages.schedule, {
    ...f.scope,
    content: "Private future",
    sendAt: Date.now() + 60000,
    timezone: "UTC",
  });
  const args = {
    dataset: "scheduledMessages" as const,
    paginationOpts: { cursor: null, numItems: 10 },
  };
  const exported = await f.member.query(api.dataPortability.personalPage, args);
  expect(exported.page).toHaveLength(1);
  expect(exported.page[0].content).toBe("Private future");
  expect(exported.page[0]).not.toHaveProperty("jobId");
  expect(
    (await f.owner.query(api.dataPortability.personalPage, args)).page,
  ).toHaveLength(0);
  await expect(
    f.t.query(api.dataPortability.personalPage, args),
  ).rejects.toThrow();
});
