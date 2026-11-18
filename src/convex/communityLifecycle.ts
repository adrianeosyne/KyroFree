import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./functions";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
export const cleanup = internalMutation({
  args: {
    kind: v.union(v.literal("server"), v.literal("user"), v.literal("goal")),
    id: v.string(),
    stage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stage = args.stage ?? 0;
    let rows: Doc<TableNames>[] = [],
      stages = 1;
    if (args.kind === "goal")
      rows = await ctx.db
        .query("communityGoalProgress")
        .withIndex("by_goal", (q) =>
          q.eq("goalId", args.id as Id<"communityGoals">),
        )
        .take(50);
    if (args.kind === "server") {
      stages = 10;
      const tables = [
        "communityGoals",
        "communityGoalProgress",
        "communityResources",
        "communityDailyStats",
        "communityActivityState",
        "communityBackups",
        "communityBackupJobs",
        "moderationAppeals",
      ] as const;
      const table = tables[stage];
      if (table)
        rows = await ctx.db
          .query(table)
          .withIndex("by_server", (q) =>
            q.eq("serverId", args.id as Id<"servers">),
          )
          .take(50);
      if (stage === 8)
        rows = await ctx.db
          .query("communityPartnerships")
          .withIndex("by_source", (q) =>
            q.eq("sourceId", args.id as Id<"servers">),
          )
          .take(50);
      if (stage === 9)
        rows = await ctx.db
          .query("communityPartnerships")
          .withIndex("by_target", (q) =>
            q.eq("targetId", args.id as Id<"servers">),
          )
          .take(50);
    }
    if (args.kind === "user") {
      stages = 7;
      const table = (
        [
          "communityGoalProgress",
          "communityGoals",
          "communityResources",
          "communityActivityState",
          "communityBackups",
          "communityPartnerships",
          "moderationAppeals",
        ] as const
      )[stage];
      if (table)
        rows = await ctx.db
          .query(table)
          .withIndex("by_user", (q) => q.eq("userId", args.id as Id<"users">))
          .take(50);
    }
    for (const row of rows) {
      if ("metric" in row && "target" in row)
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<"mutation">("communityLifecycle:cleanup"),
          { kind: "goal", id: row._id },
        );
      if ("jobId" in row && row.jobId) {
        const pending = await ctx.db.system.get(row.jobId);
        if (pending?.state.kind === "pending")
          await ctx.scheduler.cancel(row.jobId);
      }
      await ctx.db.delete(row._id);
    }
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("communityLifecycle:cleanup"),
        { ...args, stage },
      );
    else if (stage + 1 < stages)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("communityLifecycle:cleanup"),
        { ...args, stage: stage + 1 },
      );
  },
});
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 365 * 86400000;
    const days = await ctx.db
        .query("communityDailyStats")
        .withIndex("by_day", (q) => q.lt("day", cutoff))
        .take(100),
      states = await ctx.db
        .query("communityActivityState")
        .withIndex("by_activity", (q) => q.lt("lastActiveDay", cutoff))
        .take(100);
    for (const row of [...days, ...states]) await ctx.db.delete(row._id);
    if (days.length === 100 || states.length === 100)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("communityLifecycle:prune"),
        {},
      );
  },
});
