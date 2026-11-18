import { defineTable } from "convex/server";
import { v } from "convex/values";

export const containerType = v.union(
  v.literal("channel"),
  v.literal("conversation"),
);
export const scopeFields = { containerType, containerId: v.string() };
export const advancedTables = {
  retentionPolicies: defineTable({
    userId: v.id("users"),
    notificationDays: v.number(),
    draftDays: v.number(),
    scheduleHistoryDays: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  securityActivity: defineTable({
    userId: v.id("users"),
    action: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId", "createdAt"]),
  messageVersions: defineTable({
    messageId: v.id("messages"),
    content: v.string(),
    savedAt: v.number(),
    editorId: v.id("users"),
  }).index("by_message", ["messageId", "savedAt"]),
  savedCollections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  savedMessages: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    collectionId: v.optional(v.id("savedCollections")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_collection", ["userId", "collectionId", "createdAt"])
    .index("by_user_message", ["userId", "messageId"])
    .index("by_message", ["messageId"]),
  scheduledMessages: defineTable({
    userId: v.id("users"),
    ...scopeFields,
    content: v.string(),
    sendAt: v.number(),
    timezone: v.string(),
    lifetimeSeconds: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    messageId: v.optional(v.id("messages")),
    jobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_status", ["userId", "status"])
    .index("by_container", ["containerType", "containerId"])
    .index("by_finished", ["finishedAt"])
    .index("by_user_finished", ["userId", "finishedAt"]),
  messageReminders: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    remindAt: v.number(),
    timezone: v.string(),
    note: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("cancelled"),
    ),
    jobId: v.optional(v.id("_scheduled_functions")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_message", ["messageId"])
    .index("by_user_status", ["userId", "status"]),
  conversationFolders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  conversationFolderItems: defineTable({
    userId: v.id("users"),
    folderId: v.id("conversationFolders"),
    ...scopeFields,
    createdAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_user_container", ["userId", "containerType", "containerId"])
    .index("by_container", ["containerType", "containerId"]),
  conversationNotes: defineTable({
    userId: v.id("users"),
    ...scopeFields,
    content: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_container", ["userId", "containerType", "containerId"])
    .index("by_user", ["userId"])
    .index("by_container", ["containerType", "containerId"]),
  messageDrafts: defineTable({
    userId: v.id("users"),
    ...scopeFields,
    content: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_container", ["userId", "containerType", "containerId"])
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_container", ["containerType", "containerId"]),
  sharedDocuments: defineTable({
    ...scopeFields,
    creatorId: v.id("users"),
    title: v.string(),
    content: v.string(),
    revision: v.number(),
    updatedById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    editors: v.optional(v.array(v.id("users"))),
  })
    .index("by_container", ["containerType", "containerId", "updatedAt"])
    .index("by_creator", ["creatorId"]),
  documentVersions: defineTable({
    documentId: v.id("sharedDocuments"),
    title: v.string(),
    content: v.string(),
    revision: v.number(),
    editorId: v.id("users"),
    savedAt: v.number(),
  }).index("by_document", ["documentId", "revision"]),
  workTasks: defineTable({
    userId: v.id("users"),
    containerType: v.optional(containerType),
    containerId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    assigneeId: v.optional(v.id("users")),
    startsAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    timezone: v.optional(v.string()),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    reminderJobId: v.optional(v.id("_scheduled_functions")),
    remindedDueAt: v.optional(v.number()),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_scope", ["userId", "containerType", "createdAt"])
    .index("by_container", ["containerType", "containerId", "createdAt"])
    .index("by_assignee", ["assigneeId", "dueAt"]),
  communityPages: defineTable({
    serverId: v.id("servers"),
    kind: v.union(
      v.literal("wiki"),
      v.literal("announcement"),
      v.literal("suggestion"),
    ),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    authorId: v.id("users"),
    revision: v.number(),
    votes: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("planned"),
      v.literal("completed"),
      v.literal("declined"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_server_kind", ["serverId", "kind", "updatedAt"])
    .index("by_author", ["authorId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["serverId", "kind", "category"],
    }),
  communityPageVersions: defineTable({
    pageId: v.id("communityPages"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    revision: v.number(),
    editorId: v.id("users"),
    savedAt: v.number(),
  }).index("by_page", ["pageId", "revision"]),
  suggestionVotes: defineTable({
    pageId: v.id("communityPages"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_page_user", ["pageId", "userId"])
    .index("by_page", ["pageId"])
    .index("by_user", ["userId"]),
};
