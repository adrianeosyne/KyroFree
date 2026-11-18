import { defineTable } from "convex/server";
import { v } from "convex/values";
export const attentionFields = {
  timezone: v.string(),
  profiles: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      mentions: v.boolean(),
      calls: v.boolean(),
    }),
  ),
  activeProfile: v.string(),
  quietEnabled: v.boolean(),
  quietStart: v.number(),
  quietEnd: v.number(),
  quietDays: v.array(v.number()),
  themeEnabled: v.boolean(),
  lightStart: v.number(),
  darkStart: v.number(),
};
export const attentionTables = {
  attentionSettings: defineTable({
    userId: v.id("users"),
    ...attentionFields,
    revision: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};
