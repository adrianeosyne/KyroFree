import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./functions";
import { requireServerAccess, isBlockedBetween, logAudit, notify } from "./lib";
import { text, revision, futureTime } from "./advancedValidation";
import { goalMetric } from "./communityGrowthSchema";
import { PERMISSIONS } from "../lib/permissions";
import { DAY, growthAccess, currentMetric } from "./communityGrowthLib";
export const goals = query({
  args: { serverId: v.id("servers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id, manager } = await growthAccess(ctx, args.serverId);
    const page = await ctx.db
      .query("communityGoals")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const goal of page.page) {
      const enrollment = await ctx.db
        .query("communityGoalProgress")
        .withIndex("by_goal_user", (q) =>
          q.eq("goalId", goal._id).eq("userId", id),
        )
        .unique();
      if (goal.archived && !manager && enrollment?.awardedAt === undefined)
        continue;
      const total = await currentMetric(ctx, goal.serverId, id, goal.metric);
      const progress =
        goal.kind === "quest"
          ? enrollment
            ? Math.max(0, total - enrollment.baseline)
            : 0
          : total;
      rows.push({
        ...goal,
        progress: Math.min(goal.target, progress),
        joined: !!enrollment,
        awardedAt: enrollment?.awardedAt ?? null,
        canManage: manager,
        closed:
          goal.archived ||
          (goal.closesAt !== undefined && goal.closesAt <= Date.now()),
      });
    }
    return { ...page, page: rows };
  },
});
export const createGoal = mutation({
  args: {
    serverId: v.id("servers"),
    kind: v.union(v.literal("achievement"), v.literal("quest")),
    title: v.string(),
    description: v.string(),
    metric: goalMetric,
    target: v.number(),
    closesAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id } = await growthAccess(ctx, args.serverId, true, true);
    if (
      !Number.isSafeInteger(args.target) ||
      args.target < 1 ||
      args.target > 1000000
    )
      throw new Error("Choose a target between 1 and 1,000,000.");
    if (args.closesAt !== undefined)
      futureTime(args.closesAt, "Quest deadline", 60000);
    if (
      (
        await ctx.db
          .query("communityGoals")
          .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
          .take(100)
      ).length >= 100
    )
      throw new Error("Keep up to 100 community goals.");
    const goalId = await ctx.db.insert("communityGoals", {
      ...args,
      title: text(args.title, "Goal title", 100),
      description: text(args.description, "Description", 2000, true),
      userId: id,
      archived: false,
      revision: 1,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId: args.serverId,
      actorId: id,
      action: "community.goal_create",
      targetId: goalId,
    });
    return goalId;
  },
});
export const archiveGoal = mutation({
  args: {
    goalId: v.id("communityGoals"),
    archived: v.boolean(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found.");
    const { id } = await growthAccess(ctx, goal.serverId, true, true);
    revision(goal.revision, args.expectedRevision);
    await ctx.db.patch(goal._id, {
      archived: args.archived,
      revision: goal.revision + 1,
    });
    await logAudit(ctx, {
      serverId: goal.serverId,
      actorId: id,
      action: "community.goal_archive",
      targetId: goal._id,
      details: String(args.archived),
    });
  },
});
export const joinGoal = mutation({
  args: { goalId: v.id("communityGoals") },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found.");
    const { id, user } = await growthAccess(ctx, goal.serverId, true);
    if (
      user.botApplicationId ||
      goal.kind !== "quest" ||
      goal.archived ||
      (goal.closesAt !== undefined && goal.closesAt <= Date.now())
    )
      throw new Error("This quest is unavailable.");
    if (
      await ctx.db
        .query("communityGoalProgress")
        .withIndex("by_goal_user", (q) =>
          q.eq("goalId", goal._id).eq("userId", id),
        )
        .unique()
    )
      return;
    const baseline = await currentMetric(ctx, goal.serverId, id, goal.metric);
    await ctx.db.insert("communityGoalProgress", {
      serverId: goal.serverId,
      goalId: goal._id,
      userId: id,
      baseline,
      joinedAt: Date.now(),
    });
  },
});
export const claimGoal = mutation({
  args: { goalId: v.id("communityGoals") },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal) throw new Error("Goal not found.");
    const { id, user } = await growthAccess(ctx, goal.serverId, true);
    if (
      user.botApplicationId ||
      goal.archived ||
      (goal.closesAt !== undefined && goal.closesAt <= Date.now())
    )
      throw new Error("This goal is unavailable.");
    const enrollment = await ctx.db
      .query("communityGoalProgress")
      .withIndex("by_goal_user", (q) =>
        q.eq("goalId", goal._id).eq("userId", id),
      )
      .unique();
    if (enrollment?.awardedAt !== undefined) return;
    if (goal.kind === "quest" && !enrollment)
      throw new Error("Join the quest before collecting progress.");
    const total = await currentMetric(ctx, goal.serverId, id, goal.metric);
    if (
      total - (goal.kind === "quest" ? enrollment!.baseline : 0) <
      goal.target
    )
      throw new Error("The goal is not complete yet.");
    if (enrollment)
      await ctx.db.patch(enrollment._id, { awardedAt: Date.now() });
    else
      await ctx.db.insert("communityGoalProgress", {
        serverId: goal.serverId,
        goalId: goal._id,
        userId: id,
        baseline: 0,
        joinedAt: Date.now(),
        awardedAt: Date.now(),
      });
    await notify(ctx, {
      userId: id,
      type: "system",
      title: goal.kind === "quest" ? "Quest completed" : "Achievement earned",
      body: goal.title,
      link: `/dashboard/s/${goal.serverId}/growth`,
    });
  },
});
function httpsUrl(value: string) {
  const result = text(value, "Resource URL", 2000);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    throw new Error("Choose a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Choose a valid HTTPS URL.");
  return url.href;
}
export const resources = query({
  args: {
    serverId: v.id("servers"),
    term: v.optional(v.string()),
    category: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { manager } = await growthAccess(ctx, args.serverId);
    const opts = {
      ...args.paginationOpts,
      numItems: Math.min(20, args.paginationOpts.numItems),
    };
    const page = args.term?.trim()
      ? await ctx.db
          .query("communityResources")
          .withSearchIndex("search_title", (q) => {
            let s = q
              .search("title", text(args.term!, "Search", 100))
              .eq("serverId", args.serverId);
            if (args.category?.trim())
              s = s.eq("category", text(args.category, "Category", 60));
            return s;
          })
          .paginate(opts)
      : await ctx.db
          .query("communityResources")
          .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
          .filter((q) =>
            args.category?.trim()
              ? q.eq(q.field("category"), args.category.trim())
              : true,
          )
          .order("desc")
          .paginate(opts);
    return {
      ...page,
      page: page.page.map((row) => ({ ...row, canManage: manager })),
    };
  },
});
export const saveResource = mutation({
  args: {
    serverId: v.id("servers"),
    resourceId: v.optional(v.id("communityResources")),
    expectedRevision: v.number(),
    title: v.string(),
    description: v.string(),
    url: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const { id } = await growthAccess(ctx, args.serverId, true, true);
    const current = args.resourceId ? await ctx.db.get(args.resourceId) : null;
    if (args.resourceId && (!current || current.serverId !== args.serverId))
      throw new Error("Resource not found.");
    revision(current?.revision ?? 0, args.expectedRevision);
    const value = {
      title: text(args.title, "Title", 120),
      description: text(args.description, "Description", 4000, true),
      url: httpsUrl(args.url),
      category: text(args.category, "Category", 60, true),
      revision: args.expectedRevision + 1,
      updatedAt: Date.now(),
    };
    let resourceId = args.resourceId;
    if (current) await ctx.db.patch(current._id, value);
    else {
      if (
        (
          await ctx.db
            .query("communityResources")
            .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
            .take(500)
        ).length >= 500
      )
        throw new Error("Keep up to 500 resources.");
      resourceId = await ctx.db.insert("communityResources", {
        ...value,
        serverId: args.serverId,
        userId: id,
        createdAt: Date.now(),
      });
    }
    await logAudit(ctx, {
      serverId: args.serverId,
      actorId: id,
      action: "community.resource_save",
      targetId: resourceId,
    });
    return resourceId;
  },
});
export const removeResource = mutation({
  args: {
    resourceId: v.id("communityResources"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.resourceId);
    if (!row) return;
    const { id } = await growthAccess(ctx, row.serverId, true, true);
    revision(row.revision, args.expectedRevision);
    await ctx.db.delete(row._id);
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "community.resource_remove",
      targetId: row._id,
    });
  },
});
export const partnerships = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const { manager, id } = await growthAccess(ctx, args.serverId);
    const outgoing = await ctx.db
      .query("communityPartnerships")
      .withIndex("by_source", (q) => q.eq("sourceId", args.serverId))
      .take(100);
    const incoming = await ctx.db
      .query("communityPartnerships")
      .withIndex("by_target", (q) => q.eq("targetId", args.serverId))
      .take(100);
    const rows = [];
    for (const row of [...outgoing, ...incoming]) {
      if (!manager && row.status !== "active") continue;
      const partner = await ctx.db.get(
        row.sourceId === args.serverId ? row.targetId : row.sourceId,
      );
      if (
        !partner ||
        (row.status === "active" && !partner.isPublic) ||
        (await isBlockedBetween(ctx, id, partner.ownerId))
      )
        continue;
      rows.push({
        ...row,
        partnerName: partner.name,
        partnerId: partner._id,
        canManage: manager,
        incoming: row.targetId === args.serverId,
      });
    }
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
export const proposePartnership = mutation({
  args: {
    serverId: v.id("servers"),
    targetId: v.id("servers"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, server } = await growthAccess(ctx, args.serverId, true, true);
    const target = await ctx.db.get(args.targetId);
    if (
      !target ||
      !target.isPublic ||
      !server.isPublic ||
      target._id === server._id ||
      (await isBlockedBetween(ctx, id, target.ownerId))
    )
      throw new Error("Choose a different public community.");
    const targetOwner = await ctx.db.get(target.ownerId);
    if (!targetOwner || targetOwner.deletedAt !== undefined)
      throw new Error("That community is unavailable.");
    const forward = await ctx.db
      .query("communityPartnerships")
      .withIndex("by_pair", (q) =>
        q.eq("sourceId", args.serverId).eq("targetId", args.targetId),
      )
      .take(100);
    const reverse = await ctx.db
      .query("communityPartnerships")
      .withIndex("by_pair", (q) =>
        q.eq("sourceId", args.targetId).eq("targetId", args.serverId),
      )
      .take(100);
    if (
      [...forward, ...reverse].some(
        (r) => r.status === "pending" || r.status === "active",
      )
    )
      throw new Error("A pending or active partnership already exists.");
    for (const serverId of [args.serverId, args.targetId]) {
      const out = await ctx.db
        .query("communityPartnerships")
        .withIndex("by_source", (q) => q.eq("sourceId", serverId))
        .take(100);
      const inc = await ctx.db
        .query("communityPartnerships")
        .withIndex("by_target", (q) => q.eq("targetId", serverId))
        .take(100);
      if (out.length + inc.length >= 100)
        throw new Error(
          "This community has reached its partnership history limit.",
        );
    }
    const partnershipId = await ctx.db.insert("communityPartnerships", {
      sourceId: args.serverId,
      targetId: args.targetId,
      userId: id,
      notes: text(args.notes, "Partnership proposal", 2000),
      status: "pending",
      revision: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await notify(ctx, {
      userId: target.ownerId,
      actorId: id,
      type: "system",
      title: "Community partnership request",
      body: server.name,
      link: `/dashboard/s/${target._id}/growth`,
    });
    await logAudit(ctx, {
      serverId: args.serverId,
      actorId: id,
      action: "community.partnership_propose",
      targetId: partnershipId,
    });
    return partnershipId;
  },
});
export const decidePartnership = mutation({
  args: {
    serverId: v.id("servers"),
    partnershipId: v.id("communityPartnerships"),
    decision: v.union(
      v.literal("accept"),
      v.literal("decline"),
      v.literal("end"),
    ),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await growthAccess(ctx, args.serverId, true, true);
    const row = await ctx.db.get(args.partnershipId);
    if (
      !row ||
      (row.sourceId !== args.serverId && row.targetId !== args.serverId)
    )
      throw new Error("Partnership not found.");
    revision(row.revision, args.expectedRevision);
    if (
      args.decision === "end"
        ? row.status !== "pending" && row.status !== "active"
        : row.targetId !== args.serverId || row.status !== "pending"
    )
      throw new Error("This partnership cannot be changed that way.");
    if (args.decision === "accept") {
      const source = await ctx.db.get(row.sourceId),
        target = await ctx.db.get(row.targetId);
      if (
        !source?.isPublic ||
        !target?.isPublic ||
        (await isBlockedBetween(ctx, source.ownerId, target.ownerId))
      )
        throw new Error("Both communities must remain public and available.");
      const senderAccess = await requireServerAccess(
        ctx,
        source._id,
        row.userId,
      );
      const sender = await ctx.db.get(row.userId);
      if (
        !senderAccess.permissions.includes(PERMISSIONS.MANAGE_SERVER) ||
        !sender ||
        sender.deletedAt !== undefined ||
        sender.frozenAt !== undefined
      )
        throw new Error(
          "The proposer no longer has permission to represent this community.",
        );
    }
    const status =
      args.decision === "accept"
        ? "active"
        : args.decision === "decline"
          ? "declined"
          : "ended";
    await ctx.db.patch(row._id, {
      status,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    for (const serverId of [row.sourceId, row.targetId])
      await logAudit(ctx, {
        serverId,
        actorId: id,
        action: "community.partnership_decide",
        targetId: row._id,
        details: status,
      });
  },
});
export const analytics = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await growthAccess(ctx, args.serverId, false, true);
    const rows = await ctx.db
      .query("communityDailyStats")
      .withIndex("by_server_day", (q) =>
        q
          .eq("serverId", args.serverId)
          .gte("day", Math.floor(Date.now() / DAY) * DAY - 30 * DAY),
      )
      .order("asc")
      .take(31);
    const first = await ctx.db
      .query("communityDailyStats")
      .withIndex("by_server_day", (q) => q.eq("serverId", args.serverId))
      .first();
    return {
      capturedSince: first?.day ?? null,
      days: rows.map((row) => {
        const previous = rows.find((r) => r.day === row.day - DAY);
        return {
          ...row,
          previousActiveMembers: previous?.activeMembers ?? 0,
          retentionPercent: previous?.activeMembers
            ? Math.round(
                (100 * row.retainedFromYesterday) / previous.activeMembers,
              )
            : null,
        };
      }),
    };
  },
});
