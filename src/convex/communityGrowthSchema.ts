import { defineTable } from "convex/server";
import { v } from "convex/values";
export const goalMetric = v.union(
  v.literal("messages"),
  v.literal("invites"),
  v.literal("xp"),
);
export const communityGrowthTables = {
  communityBackupJobs: defineTable({
    serverId: v.id("servers"),
    jobId: v.id("_scheduled_functions"),
  }).index("by_server", ["serverId"]),
  communityGoals: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    kind: v.union(v.literal("achievement"), v.literal("quest")),
    title: v.string(),
    description: v.string(),
    metric: goalMetric,
    target: v.number(),
    closesAt: v.optional(v.number()),
    archived: v.boolean(),
    revision: v.number(),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),
  communityGoalProgress: defineTable({
    serverId: v.id("servers"),
    goalId: v.id("communityGoals"),
    userId: v.id("users"),
    baseline: v.number(),
    joinedAt: v.number(),
    awardedAt: v.optional(v.number()),
  })
    .index("by_goal_user", ["goalId", "userId"])
    .index("by_goal", ["goalId"])
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),
  communityResources: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    url: v.string(),
    category: v.string(),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["serverId", "category"],
    }),
  communityPartnerships: defineTable({
    sourceId: v.id("servers"),
    targetId: v.id("servers"),
    userId: v.id("users"),
    notes: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("declined"),
      v.literal("ended"),
    ),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source", ["sourceId"])
    .index("by_target", ["targetId"])
    .index("by_pair", ["sourceId", "targetId"])
    .index("by_user", ["userId"]),
  communityDailyStats: defineTable({
    serverId: v.id("servers"),
    day: v.number(),
    messages: v.number(),
    joins: v.number(),
    leaves: v.number(),
    activeMembers: v.number(),
    retainedFromYesterday: v.number(),
  })
    .index("by_day", ["day"])
    .index("by_server_day", ["serverId", "day"])
    .index("by_server", ["serverId"]),
  communityActivityState: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    lastActiveDay: v.number(),
  })
    .index("by_activity", ["lastActiveDay"])
    .index("by_server_user", ["serverId", "userId"])
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),
  communityBackups: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    label: v.string(),
    snapshot: v.any(),
    fingerprint: v.string(),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),
};
