import { defineTable } from "convex/server";
import { v } from "convex/values";
export const developerTables = {
  botAuthorizations: defineTable({
    applicationId: v.id("botApplications"),
    userId: v.id("users"),
    serverId: v.id("servers"),
    permissions: v.array(v.string()),
    state: v.string(),
    redirectUri: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_expiry", ["expiresAt"]),
  botGatewaySessions: defineTable({
    applicationId: v.id("botApplications"),
    tokenVersion: v.number(),
    label: v.string(),
    createdAt: v.number(),
    lastHeartbeatAt: v.number(),
    expiresAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_app", ["applicationId", "createdAt"])
    .index("by_expiry", ["expiresAt"]),
  botUsageDaily: defineTable({
    applicationId: v.id("botApplications"),
    day: v.number(),
    requests: v.number(),
    errors: v.number(),
    commands: v.number(),
    connections: v.number(),
    delivered: v.number(),
    failed: v.number(),
    uploadedBytes: v.number(),
  }).index("by_app_day", ["applicationId", "day"]),
  botRequestLogs: defineTable({
    applicationId: v.id("botApplications"),
    method: v.string(),
    path: v.string(),
    status: v.number(),
    durationMs: v.number(),
    createdAt: v.number(),
  })
    .index("by_app", ["applicationId", "createdAt"])
    .index("by_created", ["createdAt"]),
};
