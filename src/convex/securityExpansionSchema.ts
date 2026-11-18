import { defineTable } from "convex/server";
import { v } from "convex/values";
export const securityExpansionTables = {
  moderationAppeals: defineTable({
    serverId: v.id("servers"),
    caseId: v.id("moderationCases"),
    userId: v.id("users"),
    statement: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
    ),
    response: v.optional(v.string()),
    reviewerId: v.optional(v.id("users")),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_case", ["caseId"])
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_server", ["serverId"]),
};
