import { defineTable } from "convex/server";
import { v } from "convex/values";
export const collaboratorRole = v.union(
  v.literal("viewer"),
  v.literal("maintainer"),
);
export const releaseChannel = v.union(
  v.literal("staging"),
  v.literal("production"),
);
export const releaseTables = {
  appCollaborators: defineTable({
    applicationId: v.id("botApplications"),
    userId: v.id("users"),
    ownerId: v.id("users"),
    role: collaboratorRole,
    accepted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_app_user", ["applicationId", "userId"])
    .index("by_app", ["applicationId"])
    .index("by_user", ["userId"]),
  appReleases: defineTable({
    applicationId: v.id("botApplications"),
    userId: v.id("users"),
    version: v.string(),
    channel: releaseChannel,
    changelog: v.string(),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_app_channel", ["applicationId", "channel"])
    .index("by_app_version", ["applicationId", "channel", "version"])
    .index("by_app", ["applicationId"])
    .index("by_user", ["userId"]),
};
