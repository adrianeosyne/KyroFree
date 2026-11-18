/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
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
    outsider: await ctx.db.insert("users", {
      name: "Outsider",
      username: "outsider",
      createdAt: 1,
    }),
  }));
  const owner = t.withIdentity({ subject: ids.owner });
  const member = t.withIdentity({ subject: ids.member });
  const outsider = t.withIdentity({ subject: ids.outsider });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Collaboration",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  const channel = (
    await owner.query(api.channels.list, { serverId })
  ).channels.find((row) => row.kind === "text")!;
  return {
    t,
    ids,
    owner,
    member,
    outsider,
    serverId,
    scope: { containerType: "channel" as const, containerId: channel.id },
  };
}
const paginationOpts = { numItems: 10, cursor: null };
describe("shared documents and tasks", () => {
  it("persists shared Markdown revisions and prevents lost updates", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.collaboration.createDocument, {
      ...f.scope,
      title: "Guide",
      content: "# First",
    });
    await f.member.mutation(api.collaboration.saveDocument, {
      id,
      title: "Guide",
      content: "# Second",
      expectedRevision: 1,
    });
    await expect(
      f.owner.mutation(api.collaboration.saveDocument, {
        id,
        title: "Guide",
        content: "Stale",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("another device");
    const history = await f.member.query(api.collaboration.documentHistory, {
      id,
      paginationOpts,
    });
    expect(history.page[0].content).toBe("# First");
    await f.owner.mutation(api.collaboration.restoreDocument, {
      versionId: history.page[0]._id,
      expectedRevision: 2,
    });
    expect(
      (await f.owner.query(api.collaboration.document, { id })).content,
    ).toBe("# First");
    await expect(
      f.outsider.query(api.collaboration.document, { id }),
    ).rejects.toThrow();
  });
  it("enforces document editor grants and rechecks membership for reads", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.collaboration.createDocument, {
      ...f.scope,
      title: "Restricted",
      content: "Original",
      ownerOnly: true,
    });
    await expect(
      f.member.mutation(api.collaboration.saveDocument, {
        id,
        title: "Restricted",
        content: "No",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("read-only");
    await expect(
      f.member.mutation(api.collaboration.setDocumentAccess, {
        id,
        editors: [f.ids.member],
      }),
    ).rejects.toThrow("owner");
    await expect(
      f.owner.mutation(api.collaboration.setDocumentAccess, {
        id,
        editors: [f.ids.outsider],
      }),
    ).rejects.toThrow();
    await f.owner.mutation(api.collaboration.setDocumentAccess, {
      id,
      editors: [f.ids.member],
    });
    await f.member.mutation(api.collaboration.saveDocument, {
      id,
      title: "Restricted",
      content: "Allowed",
      expectedRevision: 2,
    });
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    await expect(
      f.member.query(api.collaboration.document, { id }),
    ).rejects.toThrow();
  });
  it("keeps personal tasks private, validates assignments and publishes deadlines", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.collaboration.createTask, {
      title: "Private task",
      description: "Only me",
      dueAt: Date.now() + 120_000,
      timezone: "Asia/Colombo",
    });
    expect(
      (await f.member.query(api.collaboration.tasks, { paginationOpts })).page,
    ).toHaveLength(0);
    await expect(
      f.member.mutation(api.collaboration.updateTask, {
        id,
        status: "done",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("not found");
    await expect(
      f.owner.mutation(api.collaboration.createTask, {
        ...f.scope,
        title: "Bad assignment",
        description: "",
        assigneeId: f.ids.outsider,
      }),
    ).rejects.toThrow();
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await f.t.run((ctx) => ctx.db.query("notifications").collect())).some(
        (row) => row.userId === f.ids.owner && row.body === "Private task",
      ),
    ).toBe(true);
  });
  it("shares Kanban task state and rejects competing revisions", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.collaboration.createTask, {
      ...f.scope,
      title: "Build launch page",
      description: "Review layout",
      assigneeId: f.ids.member,
    });
    const assignment = await f.t.run((ctx) =>
      ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("userId"), f.ids.member))
        .first(),
    );
    expect(assignment).toMatchObject({
      title: "A task was assigned to you",
      body: "Build launch page",
      link: `/dashboard/s/${f.serverId}/c/${f.scope.containerId}?tools=tasks`,
    });
    await f.member.mutation(api.collaboration.updateTask, {
      id,
      status: "doing",
      expectedRevision: 1,
    });
    expect(
      (
        await f.member.query(api.collaboration.tasks, {
          ...f.scope,
          paginationOpts,
        })
      ).page[0].status,
    ).toBe("doing");
    await expect(
      f.owner.mutation(api.collaboration.updateTask, {
        id,
        status: "done",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("another device");
    await expect(
      f.member.mutation(api.collaboration.removeTask, { id }),
    ).rejects.toThrow("creator");
    await f.owner.mutation(api.collaboration.removeTask, { id });
    expect(await f.t.run((ctx) => ctx.db.get(id))).toBeNull();
  });
  it("skips task reminders for removed members and completed tasks", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.collaboration.createTask, {
      ...f.scope,
      title: "Do not notify",
      description: "",
      assigneeId: f.ids.member,
      dueAt: Date.now() + 120_000,
      timezone: "UTC",
    });
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await f.t.run((ctx) => ctx.db.query("notifications").collect())).filter(
        (row) => row.title === "Task deadline reached",
      ),
    ).toHaveLength(0);
    const personal = await f.owner.mutation(api.collaboration.createTask, {
      title: "Already done",
      description: "",
      dueAt: Date.now() + 120_000,
      timezone: "UTC",
    });
    await f.owner.mutation(api.collaboration.updateTask, {
      id: personal,
      status: "done",
      expectedRevision: 1,
    });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (await f.t.run((ctx) => ctx.db.query("notifications").collect())).filter(
        (row) => row.title === "Task deadline reached",
      ),
    ).toHaveLength(0);
    expect(await f.t.run((ctx) => ctx.db.get(id))).toBeTruthy();
  });
});
describe("community knowledge and suggestions", () => {
  it("persists categorized wiki pages, indexed search and restorable history", async () => {
    const f = await fixture();
    const id = await f.member.mutation(api.communityKnowledge.create, {
      serverId: f.serverId,
      kind: "wiki",
      title: "Getting started",
      content: "First guide",
      category: "Guides",
    });
    await f.member.mutation(api.communityKnowledge.save, {
      id,
      title: "Getting started",
      content: "Second guide",
      category: "Guides",
      expectedRevision: 1,
    });
    const pages = await f.owner.query(api.communityKnowledge.list, {
      serverId: f.serverId,
      kind: "wiki",
      term: "Getting",
      category: "Guides",
      paginationOpts,
    });
    expect(pages.page).toHaveLength(1);
    const history = await f.owner.query(api.communityKnowledge.history, {
      id,
      paginationOpts,
    });
    await f.owner.mutation(api.communityKnowledge.restore, {
      versionId: history.page[0]._id,
      expectedRevision: 2,
    });
    expect(
      (await f.member.query(api.communityKnowledge.page, { id })).content,
    ).toBe("First guide");
    await expect(
      f.outsider.query(api.communityKnowledge.page, { id }),
    ).rejects.toThrow();
  });
  it("toggles one vote per member and restricts suggestion status to managers", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.communityKnowledge.create, {
      serverId: f.serverId,
      kind: "suggestion",
      title: "Game night",
      content: "Monthly event",
      category: "Events",
    });
    await f.member.mutation(api.communityKnowledge.vote, { id });
    expect(
      (await f.owner.query(api.communityKnowledge.page, { id })).votes,
    ).toBe(1);
    await f.member.mutation(api.communityKnowledge.vote, { id });
    expect(
      (await f.owner.query(api.communityKnowledge.page, { id })).votes,
    ).toBe(0);
    await expect(
      f.member.mutation(api.communityKnowledge.setStatus, {
        id,
        status: "planned",
      }),
    ).rejects.toThrow("Manage Server");
    await f.owner.mutation(api.communityKnowledge.setStatus, {
      id,
      status: "planned",
    });
    expect(
      (await f.member.query(api.communityKnowledge.page, { id })).status,
    ).toBe("planned");
    await expect(
      f.outsider.mutation(api.communityKnowledge.vote, { id }),
    ).rejects.toThrow();
  });
  it("limits announcement publication and editing to community managers", async () => {
    const f = await fixture();
    const input = {
      serverId: f.serverId,
      kind: "announcement" as const,
      title: "Launch",
      content: "We are live",
      category: "News",
    };
    await expect(
      f.member.mutation(api.communityKnowledge.create, input),
    ).rejects.toThrow("Manage Server");
    const id = await f.owner.mutation(api.communityKnowledge.create, input);
    await expect(
      f.member.mutation(api.communityKnowledge.save, {
        id,
        title: "Hijack",
        content: "No",
        category: "News",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("cannot edit");
    await expect(
      f.member.mutation(api.communityKnowledge.remove, { id }),
    ).rejects.toThrow("cannot delete");
  });
});
