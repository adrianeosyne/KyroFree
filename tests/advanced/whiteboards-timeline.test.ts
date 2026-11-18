/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const paginationOpts = { numItems: 100, cursor: null };
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
  const t = convexTest(schema, modules),
    ids = await t.run(async (ctx) => ({
      owner: await ctx.db.insert("users", { name: "Owner", username: "owner" }),
      member: await ctx.db.insert("users", {
        name: "Member",
        username: "member",
      }),
      other: await ctx.db.insert("users", { name: "Other", username: "other" }),
    }));
  const owner = t.withIdentity({ subject: ids.owner }),
    member = t.withIdentity({ subject: ids.member }),
    other = t.withIdentity({ subject: ids.other });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Workspace",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  const channelId = (
    await owner.query(api.channels.list, { serverId })
  ).channels.find((c) => c.kind === "text")!.id;
  const scope = { containerType: "channel" as const, containerId: channelId },
    boardId = await owner.mutation(api.whiteboards.create, {
      ...scope,
      title: "Shared canvas",
    });
  const shape = {
    boardId,
    key: "shape",
    kind: "rectangle" as const,
    x: 20,
    y: 30,
    width: 100,
    height: 100,
    text: "",
    color: "#123456",
    points: [],
    expectedRevision: 0,
  };
  return { t, ids, owner, member, other, serverId, scope, boardId, shape };
}
it("allows concurrent edits on independent objects and protects revisions of the same object", async () => {
  const f = await fixture();
  await Promise.all([
    f.owner.mutation(api.whiteboards.saveObject, f.shape),
    f.member.mutation(api.whiteboards.saveObject, {
      ...f.shape,
      key: "independent",
    }),
  ]);
  expect(
    (
      await f.member.query(api.whiteboards.objects, {
        boardId: f.boardId,
        paginationOpts,
      })
    ).page,
  ).toHaveLength(2);
  const results = await Promise.allSettled(
    [f.member, f.owner].map((actor, i) =>
      actor.mutation(api.whiteboards.saveObject, {
        ...f.shape,
        x: 50 + i,
        expectedRevision: 1,
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    f.owner.mutation(api.whiteboards.saveObject, {
      ...f.shape,
      key: "unsafe",
      x: -1,
    }),
  ).rejects.toThrow("coordinates");
  await expect(
    f.owner.mutation(api.whiteboards.saveObject, {
      ...f.shape,
      key: "unsafe",
      color: "url(javascript:alert(1))",
    }),
  ).rejects.toThrow("Invalid");
});
it("enforces whiteboard editor grants, account freeze, membership revocation and export access", async () => {
  const f = await fixture();
  await expect(
    f.other.query(api.whiteboards.info, { boardId: f.boardId }),
  ).rejects.toThrow();
  await f.owner.mutation(api.whiteboards.setEditors, {
    boardId: f.boardId,
    editors: [],
    expectedRevision: 1,
  });
  await expect(
    f.member.mutation(api.whiteboards.saveObject, f.shape),
  ).rejects.toThrow("read-only");
  await f.owner.mutation(api.whiteboards.setEditors, {
    boardId: f.boardId,
    editors: [f.ids.member],
    expectedRevision: 2,
  });
  await f.member.mutation(api.whiteboards.saveObject, f.shape);
  expect(
    (
      await f.member.query(api.dataPortability.personalPage, {
        dataset: "whiteboardObjects",
        paginationOpts,
      })
    ).page,
  ).toHaveLength(1);
  await f.t.run((ctx) => ctx.db.patch(f.ids.member, { frozenAt: Date.now() }));
  await expect(
    f.member.mutation(api.whiteboards.saveObject, {
      ...f.shape,
      key: "frozen",
    }),
  ).rejects.toThrow("frozen");
  await f.t.run((ctx) => ctx.db.patch(f.ids.member, { frozenAt: undefined }));
  await f.member.mutation(api.servers.leave, { serverId: f.serverId });
  expect(
    (
      await f.member.query(api.dataPortability.personalPage, {
        dataset: "whiteboardObjects",
        paginationOpts,
      })
    ).page,
  ).toHaveLength(0);
});
it("cleans deleted whiteboards and other users' drawings in bounded batches", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 55; i++) {
      const { expectedRevision, ...fields } = f.shape;
      void expectedRevision;
      await ctx.db.insert("whiteboardObjects", {
        ...fields,
        key: `draw${i}`,
        userId: f.ids.member,
        revision: 1,
        updatedAt: Date.now(),
        updatedById: f.ids.member,
      });
    }
  });
  await f.owner.mutation(api.whiteboards.remove, {
    boardId: f.boardId,
    expectedRevision: 1,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await f.t.run((ctx) => ctx.db.query("whiteboardObjects").collect()),
  ).toHaveLength(0);
});
it("validates planned dates, protects schedule revisions and delivers each deadline reminder once", async () => {
  const f = await fixture(),
    dueAt = Date.now() + 600000,
    id = await f.owner.mutation(api.collaboration.createTask, {
      ...f.scope,
      title: "Plan",
      description: "",
      startsAt: Date.now(),
      dueAt,
      timezone: "UTC",
    });
  await expect(
    f.owner.mutation(api.collaboration.scheduleTask, {
      id,
      startsAt: dueAt + 1,
      dueAt,
      timezone: "UTC",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("start");
  const before = await f.t.run((ctx) => ctx.db.get(id));
  const nextDue = dueAt + 600000;
  await f.member.mutation(api.collaboration.scheduleTask, {
    id,
    startsAt: Date.now(),
    dueAt: nextDue,
    timezone: "Asia/Colombo",
    expectedRevision: 1,
  });
  expect(
    (await f.t.run((ctx) => ctx.db.system.get(before!.reminderJobId!)))?.state
      .kind,
  ).toBe("canceled");
  await expect(
    f.owner.mutation(api.collaboration.scheduleTask, {
      id,
      startsAt: null,
      dueAt: null,
      timezone: "UTC",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("changed");
  vi.setSystemTime(nextDue + 1);
  await Promise.all([
    f.t.mutation(internal.collaboration.taskReminder, { id }),
    f.t.mutation(internal.collaboration.taskReminder, { id }),
  ]);
  expect(
    (await f.t.run((ctx) => ctx.db.query("notifications").collect())).filter(
      (n) => n.title === "Task deadline reached",
    ),
  ).toHaveLength(1);
  await f.member.mutation(api.servers.leave, { serverId: f.serverId });
  await expect(
    f.member.mutation(api.collaboration.scheduleTask, {
      id,
      startsAt: null,
      dueAt: null,
      timezone: "UTC",
      expectedRevision: 2,
    }),
  ).rejects.toThrow();
});
