import { defineTable } from "convex/server";
import { v } from "convex/values";
import { postPrivacy } from "./socialGamingSchema";
export const socialGalleryTables = {
  portfolioProjects: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    url: v.string(),
    skills: v.array(v.string()),
    privacy: postPrivacy,
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  socialCollections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
    privacy: postPrivacy,
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  socialCollectionMembers: defineTable({
    collectionId: v.id("socialCollections"),
    userId: v.id("users"),
    role: v.union(v.literal("viewer"), v.literal("editor")),
    accepted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_collection", ["collectionId"])
    .index("by_collection_user", ["collectionId", "userId"])
    .index("by_user", ["userId"]),
  socialCollectionItems: defineTable({
    collectionId: v.id("socialCollections"),
    userId: v.id("users"),
    kind: v.union(v.literal("link"), v.literal("post"), v.literal("sticker")),
    title: v.string(),
    description: v.string(),
    url: v.optional(v.string()),
    postId: v.optional(v.id("socialPosts")),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  })
    .index("by_collection", ["collectionId"])
    .index("by_user", ["userId"]),
};
