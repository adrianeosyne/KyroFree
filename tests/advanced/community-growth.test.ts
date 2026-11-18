/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import type { Id } from "../../src/convex/_generated/dataModel";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const paginationOpts = { numItems: 20, cursor: null };
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
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
      name: "Community",
      isPublic: true,
    }),
    targetId = await other.mutation(api.servers.create, {
      name: "Partner",
      isPublic: true,
    });
  await member.mutation(api.servers.join, { serverId });
  const channelId = (
    await owner.query(api.channels.list, { serverId })
  ).channels.find((c) => c.kind === "text")!.id as Id<"channels">;
  const send = (content: string) =>
    member.mutation(api.messages.send, {
      containerType: "channel",
      containerId: channelId,
      content,
    });
  return { t, ids, owner, member, other, serverId, targetId, channelId, send };
}
describe("community achievements and quests", () => {
  it("measures quests from enrollment and awards exactly once", async () => {
    const f = await fixture();
    await f.send("Before enrollment");
    const goalId = await f.owner.mutation(api.communityGrowth.createGoal, {
      serverId: f.serverId,
      kind: "quest",
      metric: "messages",
      title: "Introduce yourself",
      description: "Contribute twice",
      target: 2,
    });
    await expect(
      f.member.mutation(api.communityGrowth.claimGoal, { goalId }),
    ).rejects.toThrow("Join");
    await f.member.mutation(api.communityGrowth.joinGoal, { goalId });
    await f.send("First contribution");
    await expect(
      f.member.mutation(api.communityGrowth.claimGoal, { goalId }),
    ).rejects.toThrow("not complete");
    await f.send("Second contribution");
    await Promise.all([
      f.member.mutation(api.communityGrowth.claimGoal, { goalId }),
      f.member.mutation(api.communityGrowth.claimGoal, { goalId }),
    ]);
    const goals = await f.member.query(api.communityGrowth.goals, {
      serverId: f.serverId,
      paginationOpts,
    });
    expect(goals.page[0].progress).toBe(2);
    expect(goals.page[0].awardedAt).not.toBeNull();
    const records = await f.t.run((ctx) =>
      ctx.db.query("communityGoalProgress").collect(),
    );
    expect(records).toHaveLength(1);
    expect(
      (await f.t.run((ctx) => ctx.db.query("notifications").collect())).filter(
        (n) => n.title === "Quest completed",
      ),
    ).toHaveLength(1);
  });
  it("uses lifetime contribution achievements and rejects revoked/frozen contributors", async () => {
    const f = await fixture();
    await f.send("Existing contribution");
    const goalId = await f.owner.mutation(api.communityGrowth.createGoal, {
      serverId: f.serverId,
      kind: "achievement",
      metric: "messages",
      title: "First post",
      description: "",
      target: 1,
    });
    await f.member.mutation(api.communityGrowth.claimGoal, { goalId });
    await expect(
      f.other.query(api.communityGrowth.goals, {
        serverId: f.serverId,
        paginationOpts,
      }),
    ).rejects.toThrow();
    await expect(
      f.member.mutation(api.communityGrowth.createGoal, {
        serverId: f.serverId,
        kind: "quest",
        metric: "xp",
        title: "Invalid",
        description: "",
        target: 10,
      }),
    ).rejects.toThrow("Manage");
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.member, { frozenAt: Date.now() }),
    );
    await expect(
      f.member.mutation(api.communityGrowth.claimGoal, { goalId }),
    ).rejects.toThrow();
    await f.owner.mutation(api.communityGrowth.archiveGoal, {
      goalId,
      archived: true,
      expectedRevision: 1,
    });
    expect(
      (
        await f.member.query(api.communityGrowth.goals, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
  });
});

it("recreates deleted configuration resources and protects system roles", async () => {
  const f = await fixture();
  const categoryId = await f.t.run((ctx) =>
    ctx.db.insert("categories", {
      serverId: f.serverId,
      name: "Saved category",
      position: 3,
      createdAt: Date.now(),
    }),
  );
  const roleId = await f.t.run((ctx) =>
    ctx.db.insert("serverRoles", {
      serverId: f.serverId,
      name: "Editors",
      permissions: ["view_channel"],
      isDefault: false,
      position: 3,
    }),
  );
  const channelId = await f.t.run((ctx) =>
    ctx.db.insert("channels", {
      serverId: f.serverId,
      categoryId,
      name: "reference",
      kind: "text",
      position: 8,
      createdAt: Date.now(),
      permissionOverwrites: [{ roleId, allow: ["view_channel"], deny: [] }],
    }),
  );
  const protectedId = await f.t.run((ctx) =>
    ctx.db.insert("serverRoles", {
      serverId: f.serverId,
      name: "Founder",
      isDefault: false,
      permissions: ["manage_server"],
      position: 50,
    }),
  );
  const backupId = await f.owner.mutation(api.communityBackups.create, {
    serverId: f.serverId,
    label: "Resources",
  });
  await f.t.run(async (ctx) => {
    for (const id of [channelId, categoryId, roleId]) await ctx.db.delete(id);
    await ctx.db.patch(protectedId, { color: "#112233", position: 60 });
  });
  const detail = await f.owner.query(api.communityBackups.detail, { backupId });
  await f.owner.mutation(api.communityBackups.restore, {
    backupId,
    expectedFingerprint: detail.currentFingerprint,
    confirmation: "Community",
  });
  await f.t.run(async (ctx) => {
    const channels = await ctx.db.query("channels").collect(),
      categories = await ctx.db.query("categories").collect(),
      roles = await ctx.db.query("serverRoles").collect();
    const recreated = channels.find((c) => c.name === "reference")!;
    expect(recreated._id).not.toBe(channelId);
    expect(categories.find((c) => c._id === recreated.categoryId)?.name).toBe(
      "Saved category",
    );
    expect(
      roles.find((r) => r._id === recreated.permissionOverwrites?.[0].roleId)
        ?.name,
    ).toBe("Editors");
    expect(await ctx.db.get(protectedId)).toMatchObject({
      color: "#112233",
      position: 60,
    });
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("bounds snapshots and excludes exports after manager or member access is revoked", async () => {
  const f = await fixture();
  for (let i = 0; i < 32; i++) {
    await f.owner.mutation(api.servers.update, {
      serverId: f.serverId,
      description: `Revision ${i}`,
    });
    await f.owner.mutation(api.communityBackups.create, {
      serverId: f.serverId,
      label: `Revision ${i}`,
    });
  }
  expect(
    await f.t.run((ctx) => ctx.db.query("communityBackups").collect()),
  ).toHaveLength(30);
  const page = await f.owner.query(api.dataPortability.personalPage, {
    dataset: "communityBackups",
    paginationOpts,
  });
  expect(page.page).toHaveLength(1);
  await f.member.mutation(api.communityGrowth.joinGoal, {
    goalId: await f.owner.mutation(api.communityGrowth.createGoal, {
      serverId: f.serverId,
      kind: "quest",
      title: "Read",
      description: "",
      target: 1,
      metric: "messages",
    }),
  });
  expect(
    (
      await f.member.query(api.dataPortability.personalPage, {
        dataset: "communityGoalProgress",
        paginationOpts,
      })
    ).page,
  ).toHaveLength(1);
  await f.member.mutation(api.servers.leave, { serverId: f.serverId });
  expect(
    (
      await f.member.query(api.dataPortability.personalPage, {
        dataset: "communityGoalProgress",
        paginationOpts,
      })
    ).page,
  ).toHaveLength(0);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("cleans community and user datasets across batches including other members' goal progress", async () => {
  const f = await fixture();
  const goalId = await f.owner.mutation(api.communityGrowth.createGoal, {
    serverId: f.serverId,
    kind: "quest",
    title: "Cleanup",
    description: "",
    target: 1,
    metric: "messages",
  });
  await f.member.mutation(api.communityGrowth.joinGoal, { goalId });
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 55; i++)
      await ctx.db.insert("communityResources", {
        serverId: f.serverId,
        userId: f.ids.member,
        title: `Guide ${i}`,
        url: "https://example.com",
        description: "",
        category: "",
        revision: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
  });
  await f.t.mutation(internal.communityLifecycle.cleanup, {
    kind: "user",
    id: f.ids.owner,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await f.t.run((ctx) => ctx.db.query("communityGoalProgress").collect()),
  ).toHaveLength(0);
  await f.t.mutation(internal.communityLifecycle.cleanup, {
    kind: "server",
    id: f.serverId,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await f.t.run((ctx) => ctx.db.query("communityResources").collect()),
  ).toHaveLength(0);
});
it("isolates resource libraries, rejects unsafe URLs and protects concurrent edits", async () => {
  const f = await fixture(),
    value = {
      serverId: f.serverId,
      title: "Guide",
      description: "Read this",
      url: "https://example.com/guide",
      category: "Guides",
      expectedRevision: 0,
    };
  const resourceId = (await f.owner.mutation(
    api.communityGrowth.saveResource,
    value,
  ))!;
  await expect(
    f.owner.mutation(api.communityGrowth.saveResource, {
      ...value,
      url: "javascript:alert(1)",
    }),
  ).rejects.toThrow("HTTPS");
  await expect(
    f.member.mutation(api.communityGrowth.saveResource, value),
  ).rejects.toThrow("Manage");
  await expect(
    f.other.mutation(api.communityGrowth.saveResource, {
      ...value,
      serverId: f.targetId,
      resourceId,
      expectedRevision: 1,
    }),
  ).rejects.toThrow("not found");
  const edits = await Promise.allSettled(
    ["A", "B"].map((title) =>
      f.owner.mutation(api.communityGrowth.saveResource, {
        ...value,
        title,
        resourceId,
        expectedRevision: 1,
      }),
    ),
  );
  expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (
      await f.member.query(api.communityGrowth.resources, {
        serverId: f.serverId,
        category: "Guides",
        paginationOpts,
      })
    ).page,
  ).toHaveLength(1);
});
it("requires bilateral partnership acceptance and rejects stale and foreign decisions", async () => {
  const f = await fixture(),
    partnershipId = await f.owner.mutation(
      api.communityGrowth.proposePartnership,
      {
        serverId: f.serverId,
        targetId: f.targetId,
        notes: "Co-host community events",
      },
    );
  expect(
    await f.member.query(api.communityGrowth.partnerships, {
      serverId: f.serverId,
    }),
  ).toHaveLength(0);
  await expect(
    f.owner.mutation(api.communityGrowth.decidePartnership, {
      serverId: f.serverId,
      partnershipId,
      decision: "accept",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("cannot");
  await expect(
    f.other.mutation(api.communityGrowth.proposePartnership, {
      serverId: f.targetId,
      targetId: f.serverId,
      notes: "Duplicate",
    }),
  ).rejects.toThrow("already exists");
  await f.other.mutation(api.communityGrowth.decidePartnership, {
    serverId: f.targetId,
    partnershipId,
    decision: "accept",
    expectedRevision: 1,
  });
  expect(
    (
      await f.member.query(api.communityGrowth.partnerships, {
        serverId: f.serverId,
      })
    )[0].status,
  ).toBe("active");
  await expect(
    f.owner.mutation(api.communityGrowth.decidePartnership, {
      serverId: f.serverId,
      partnershipId,
      decision: "end",
      expectedRevision: 1,
    }),
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.communityGrowth.decidePartnership, {
    serverId: f.serverId,
    partnershipId,
    decision: "end",
    expectedRevision: 2,
  });
  expect(
    await f.member.query(api.communityGrowth.partnerships, {
      serverId: f.serverId,
    }),
  ).toHaveLength(0);
});
it("records unique daily activity and next-day retention without counting bots", async () => {
  const f = await fixture();
  await f.send("One");
  await f.send("Two");
  vi.advanceTimersByTime(86400000);
  await f.send("Returned tomorrow");
  const stats = await f.owner.query(api.communityGrowth.analytics, {
    serverId: f.serverId,
  });
  expect(stats.days[0]).toMatchObject({ messages: 2, activeMembers: 1 });
  expect(stats.days[1]).toMatchObject({
    messages: 1,
    activeMembers: 1,
    retainedFromYesterday: 1,
    retentionPercent: 100,
  });
  await expect(
    f.member.query(api.communityGrowth.analytics, { serverId: f.serverId }),
  ).rejects.toThrow("Manage");
});
describe("configuration history and restoration", () => {
  it("captures changes once, ignores message previews and restores configuration without removing messages", async () => {
    const f = await fixture();
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    const initial = await f.owner.query(api.communityBackups.list, {
      serverId: f.serverId,
      paginationOpts,
    });
    expect(initial.page).toHaveLength(1);
    const backupId = await f.owner.mutation(api.communityBackups.create, {
      serverId: f.serverId,
      label: "Before editing",
    });
    await f.send("Keep this message");
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (
        await f.owner.query(api.communityBackups.list, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
    const before = await f.owner.query(api.communityBackups.detail, {
      backupId,
    });
    await f.owner.mutation(api.servers.update, {
      serverId: f.serverId,
      name: "Changed",
    });
    await expect(
      f.owner.mutation(api.communityBackups.restore, {
        backupId,
        expectedFingerprint: before.currentFingerprint,
        confirmation: "Changed",
      }),
    ).rejects.toThrow("changed");
    const latest = await f.owner.query(api.communityBackups.detail, {
      backupId,
    });
    await f.owner.mutation(api.communityBackups.restore, {
      backupId,
      expectedFingerprint: latest.currentFingerprint,
      confirmation: "Changed",
    });
    expect(
      (await f.owner.query(api.servers.get, { serverId: f.serverId })).name,
    ).toBe("Community");
    expect(
      await f.t.run((ctx) => ctx.db.query("messages").collect()),
    ).toHaveLength(1);
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it("validates imports, prevents foreign references and detects tampering", async () => {
    const f = await fixture(),
      backupId = await f.owner.mutation(api.communityBackups.create, {
        serverId: f.serverId,
        label: "Known good",
      });
    const detail = await f.owner.query(api.communityBackups.detail, {
      backupId,
    });
    await expect(
      f.owner.mutation(api.communityBackups.importBackup, {
        serverId: f.serverId,
        content: "一".repeat(160000),
        label: "Oversized UTF-8",
      }),
    ).rejects.toThrow("too large");
    await expect(
      f.member.query(api.communityBackups.detail, { backupId }),
    ).rejects.toThrow("Manage");
    await expect(
      f.other.mutation(api.communityBackups.importBackup, {
        serverId: f.targetId,
        content: JSON.stringify(detail.snapshot),
        label: "Foreign",
      }),
    ).rejects.toThrow("same community");
    await expect(
      f.owner.mutation(api.communityBackups.importBackup, {
        serverId: f.serverId,
        content: JSON.stringify({ ...detail.snapshot, tokenHash: "secret" }),
        label: "Unknown key",
      }),
    ).rejects.toThrow();
    const imported = await f.owner.mutation(api.communityBackups.importBackup, {
      serverId: f.serverId,
      content: JSON.stringify(detail.snapshot),
      label: "Reimported",
    });
    await f.t.run((ctx) =>
      ctx.db.patch(imported, {
        snapshot: {
          ...detail.snapshot,
          community: { ...detail.snapshot.community, name: "Tampered" },
        },
      }),
    );
    await expect(
      f.owner.mutation(api.communityBackups.restore, {
        backupId: imported,
        expectedFingerprint: detail.currentFingerprint,
        confirmation: "Community",
      }),
    ).rejects.toThrow("integrity");
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  });
});
