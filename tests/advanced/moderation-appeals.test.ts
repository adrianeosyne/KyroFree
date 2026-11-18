/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import type { Id } from "../../src/convex/_generated/dataModel";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const paginationOpts = { numItems: 20, cursor: null };
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { name: "Owner", username: "owner" }),
    member: await ctx.db.insert("users", {
      name: "Member",
      username: "member",
    }),
    reviewer: await ctx.db.insert("users", {
      name: "Reviewer",
      username: "reviewer",
    }),
    other: await ctx.db.insert("users", { name: "Other", username: "other" }),
  }));
  const owner = t.withIdentity({ subject: ids.owner }),
    member = t.withIdentity({ subject: ids.member }),
    reviewer = t.withIdentity({ subject: ids.reviewer }),
    other = t.withIdentity({ subject: ids.other });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Appeal community",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  await reviewer.mutation(api.servers.join, { serverId });
  const roleId = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("serverRoles", {
      serverId,
      name: "Reviewer",
      permissions: ["manage_server", "ban_members", "timeout_members"],
      position: 10,
      isDefault: false,
    });
    const m = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", serverId).eq("userId", ids.reviewer),
      )
      .unique();
    await ctx.db.patch(m!._id, { roleIds: [...m!.roleIds, roleId] });
    return roleId;
  });
  const ban = async () => {
    await owner.mutation(api.servers.ban, {
      serverId,
      userId: ids.member,
      reason: "Original action",
    });
    return (
      await member.query(api.moderationAppeals.cases, { paginationOpts })
    ).page.find((c) => c.action === "ban")!._id;
  };
  const submit = (caseId: Id<"moderationCases">) =>
    member.mutation(api.moderationAppeals.submit, {
      caseId,
      statement: "Please review the evidence for this decision.",
    });
  return {
    t,
    ids,
    serverId,
    owner,
    member,
    reviewer,
    other,
    roleId,
    ban,
    submit,
  };
}
describe("moderation appeals", () => {
  it("lets banned applicants appeal their own cases while hiding private notes", async () => {
    const f = await fixture(),
      caseId = await f.ban();
    await f.t.run((ctx) =>
      ctx.db.insert("moderationCases", {
        serverId: f.serverId,
        userId: f.ids.member,
        moderatorId: f.ids.owner,
        action: "note",
        reason: "Private staff note",
        createdAt: Date.now(),
      }),
    );
    expect(
      (await f.member.query(api.moderationAppeals.cases, { paginationOpts }))
        .page,
    ).toHaveLength(1);
    expect(
      (await f.other.query(api.moderationAppeals.cases, { paginationOpts }))
        .page,
    ).toHaveLength(0);
    await expect(
      f.other.mutation(api.moderationAppeals.submit, {
        caseId,
        statement: "Try someone else's moderation case.",
      }),
    ).rejects.toThrow("unavailable");
    const appealId = await f.submit(caseId);
    await expect(f.submit(caseId)).rejects.toThrow("already exists");
    await expect(
      f.member.query(api.moderationAppeals.queue, {
        serverId: f.serverId,
        paginationOpts,
      }),
    ).rejects.toThrow();
    expect(
      (
        await f.owner.query(api.moderationAppeals.queue, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page[0]._id,
    ).toBe(appealId);
    await f.owner.mutation(api.moderationAppeals.decide, {
      appealId,
      accepted: true,
      response: "The decision has been overturned.",
      expectedRevision: 1,
    });
    expect(await f.t.run((ctx) => ctx.db.query("bans").collect())).toHaveLength(
      0,
    );
    expect(
      (await f.member.query(api.moderationAppeals.cases, { paginationOpts }))
        .page[0].appeal?.status,
    ).toBe("accepted");
    expect(
      (
        await f.member.query(api.dataPortability.personalPage, {
          dataset: "moderationAppeals",
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
  });
  it("enforces reviewer hierarchy, freeze, revoked permissions and concurrent decisions", async () => {
    const f = await fixture(),
      appealId = await f.submit(await f.ban());
    const decision = {
      appealId,
      accepted: true,
      response: "The evidence supports acceptance.",
      expectedRevision: 1,
    };
    await expect(
      f.reviewer.mutation(api.moderationAppeals.decide, decision),
    ).rejects.toThrow("higher-ranking");
    await f.t.run((ctx) => ctx.db.patch(f.ids.owner, { frozenAt: Date.now() }));
    await expect(
      f.owner.mutation(api.moderationAppeals.decide, decision),
    ).rejects.toThrow("frozen");
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.ids.owner, { frozenAt: undefined });
      await ctx.db.patch(f.roleId, { permissions: [] });
    });
    await expect(
      f.reviewer.mutation(api.moderationAppeals.decide, {
        ...decision,
        accepted: false,
      }),
    ).rejects.toThrow("permission");
    const results = await Promise.allSettled(
      [true, false].map((accepted) =>
        f.owner.mutation(api.moderationAppeals.decide, {
          ...decision,
          accepted,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("keeps a newer ban when accepting an older ban appeal", async () => {
    const f = await fixture(),
      originalId = await f.ban(),
      appealId = await f.submit(originalId);
    await f.owner.mutation(api.servers.unban, {
      serverId: f.serverId,
      userId: f.ids.member,
    });
    await f.member.mutation(api.servers.join, { serverId: f.serverId });
    await f.owner.mutation(api.servers.ban, {
      serverId: f.serverId,
      userId: f.ids.member,
      reason: "A newer action",
    });
    await f.owner.mutation(api.moderationAppeals.decide, {
      appealId,
      accepted: true,
      response: "Only the original action is overturned.",
      expectedRevision: 1,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.query("bans").collect()))[0].reason,
    ).toBe("A newer action");
    expect(
      (await f.t.run((ctx) => ctx.db.get(originalId)))?.resolvedAt,
    ).toBeDefined();
  });
  it("does not clear a newer timeout or allow self-review", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
    const f = await fixture();
    const caseId = await f.owner.mutation(api.moderation.create, {
      serverId: f.serverId,
      userId: f.ids.member,
      action: "timeout",
      reason: "Old timeout",
      durationMinutes: 5,
    });
    const appealId = await f.submit(caseId);
    await f.owner.mutation(api.moderation.create, {
      serverId: f.serverId,
      userId: f.ids.member,
      action: "timeout",
      reason: "New timeout",
      durationMinutes: 5,
    });
    const before = await f.t.run((ctx) =>
      ctx.db
        .query("serverMembers")
        .withIndex("by_server_user", (q) =>
          q.eq("serverId", f.serverId).eq("userId", f.ids.member),
        )
        .unique(),
    );
    await f.owner.mutation(api.moderationAppeals.decide, {
      appealId,
      accepted: true,
      response: "Only the earlier timeout is resolved.",
      expectedRevision: 1,
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(before!._id)))
        ?.communicationDisabledUntil,
    ).toBe(before!.communicationDisabledUntil);
    const selfCase = await f.t.run((ctx) =>
      ctx.db.insert("moderationCases", {
        serverId: f.serverId,
        userId: f.ids.owner,
        moderatorId: f.ids.reviewer,
        action: "warning",
        reason: "Self",
        createdAt: Date.now(),
      }),
    );
    const selfAppeal = await f.owner.mutation(api.moderationAppeals.submit, {
      caseId: selfCase,
      statement: "Please review this warning on my account.",
    });
    await expect(
      f.owner.mutation(api.moderationAppeals.decide, {
        appealId: selfAppeal,
        accepted: false,
        response: "Own decision denied.",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("own appeal");
  });
});
