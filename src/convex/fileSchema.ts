import { defineTable } from "convex/server";
import { v } from "convex/values";
export const fileTables = {
  uploadTickets: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    size: v.number(),
    sha256: v.string(),
    applicationId: v.optional(v.id("botApplications")),
    channelId: v.optional(v.id("channels")),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("verifying"),
      v.literal("complete"),
      v.literal("rejected"),
    ),
  })
    .index("by_owner_expiry", ["ownerId", "expiresAt"])
    .index("by_expiry", ["expiresAt"]),
};
