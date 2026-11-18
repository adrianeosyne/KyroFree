import { defineTable } from "convex/server";
import { v } from "convex/values";
export const postPrivacy = v.union(
  v.literal("public"),
  v.literal("followers"),
  v.literal("friends"),
  v.literal("private"),
);
export const socialGamingTables = {
  socialFollows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_pair", ["followerId", "followingId"])
    .index("by_follower", ["followerId", "createdAt"])
    .index("by_following", ["followingId", "createdAt"]),
  interestProfiles: defineTable({
    userId: v.id("users"),
    interests: v.array(v.string()),
    discoverable: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  interestMembers: defineTable({ userId: v.id("users"), interest: v.string() })
    .index("by_interest", ["interest"])
    .index("by_user", ["userId"]),
  socialPosts: defineTable({
    authorId: v.id("users"),
    content: v.string(),
    privacy: postPrivacy,
    kind: v.union(v.literal("post"), v.literal("story")),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_kind", ["kind", "createdAt"])
    .index("by_author", ["authorId", "createdAt"])
    .index("by_expiry", ["expiresAt"]),
  gameActivities: defineTable({
    userId: v.id("users"),
    game: v.string(),
    details: v.string(),
    inviteUrl: v.optional(v.string()),
    visible: v.boolean(),
    startedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_expiry", ["expiresAt"]),
  partyPosts: defineTable({
    serverId: v.id("servers"),
    hostId: v.id("users"),
    game: v.string(),
    title: v.string(),
    description: v.string(),
    region: v.string(),
    language: v.string(),
    capacity: v.number(),
    memberCount: v.number(),
    startsAt: v.number(),
    timezone: v.string(),
    inviteUrl: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId", "createdAt"])
    .index("by_host", ["hostId"])
    .index("by_status_start", ["status", "startsAt"]),
  partyMembers: defineTable({
    partyId: v.id("partyPosts"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_party_user", ["partyId", "userId"])
    .index("by_party", ["partyId"])
    .index("by_user", ["userId"]),
};
