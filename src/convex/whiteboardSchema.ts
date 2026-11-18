import { defineTable } from "convex/server";
import { v } from "convex/values";
import { containerType } from "./advancedSchema";
export const boardObject = {
  kind: v.union(v.literal("stroke"), v.literal("rectangle"), v.literal("note")),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  color: v.string(),
  text: v.string(),
  points: v.array(v.object({ x: v.number(), y: v.number() })),
};
export const whiteboardTables = {
  whiteboards: defineTable({
    userId: v.id("users"),
    containerType,
    containerId: v.string(),
    serverId: v.optional(v.id("servers")),
    title: v.string(),
    revision: v.number(),
    editors: v.optional(v.array(v.id("users"))),
    updatedById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_container", ["containerType", "containerId"])
    .index("by_server", ["serverId"]),
  whiteboardObjects: defineTable({
    boardId: v.id("whiteboards"),
    userId: v.id("users"),
    key: v.string(),
    ...boardObject,
    revision: v.number(),
    updatedById: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_key", ["boardId", "key"])
    .index("by_user", ["userId"]),
};
