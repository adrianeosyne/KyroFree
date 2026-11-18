import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./functions";
import {
  requireActiveUser,
  requireUser,
  canSendDirectMessage,
  isBlockedBetween,
  restrictionLevel,
  notify,
} from "./lib";
import { requireReadAccess } from "./messages";
import { scopeFields, containerType } from "./advancedSchema";
import { text, revision, futureTime, timezone } from "./advancedValidation";
import { PERMISSIONS } from "../lib/permissions";
import type { Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";

async function taskLink(
  ctx: Ctx,
  scope: { containerType?: "channel" | "conversation"; containerId?: string },
) {
  if (scope.containerType === "conversation")
    return `/dashboard/dm/${scope.containerId}?tools=tasks`;
  if (scope.containerType === "channel" && scope.containerId) {
    const channel = await ctx.db.get(scope.containerId as Id<"channels">);
    if (channel)
      return `/dashboard/s/${channel.serverId}/c/${channel._id}?tools=tasks`;
  }
  return "/dashboard/library";
}

export async function requireWriteScope(
  ctx: Ctx,
  userId: Id<"users">,
  scope: { containerType: "channel" | "conversation"; containerId: string },
) {
  if ((await restrictionLevel(ctx, userId)) >= 2)
    throw new Error("Your account cannot contribute right now.");
  const access = await requireReadAccess(
    ctx,
    userId,
    scope.containerType,
    scope.containerId,
  );
  if (access.kind === "channel") {
    const manager = access.permissions.includes(PERMISSIONS.MANAGE_MESSAGES);
    if (
      !access.permissions.includes(PERMISSIONS.SEND_MESSAGES) ||
      (!manager &&
        (access.channel.readOnly ||
          (access.member.communicationDisabledUntil ?? 0) > Date.now() ||
          (access.server.locked &&
            (!access.server.lockedUntil ||
              access.server.lockedUntil > Date.now()))))
    )
      throw new Error("You cannot contribute in this channel right now.");
  } else {
    for (const other of access.conversation.participantIds)
      if (other !== userId) {
        if (await isBlockedBetween(ctx, userId, other))
          throw new Error("A participant has blocked communication.");
        if (access.conversation.type === "dm") {
          const result = await canSendDirectMessage(ctx, userId, other);
          if (!result.ok) throw new Error(result.reason);
        }
      }
  }
  return access;
}
async function documentAccess(
  ctx: Ctx,
  id: Id<"users">,
  documentId: Id<"sharedDocuments">,
  write = false,
) {
  const doc = await ctx.db.get(documentId);
  if (!doc) throw new Error("Document no longer exists.");
  const access = write
    ? await requireWriteScope(ctx, id, doc)
    : await requireReadAccess(ctx, id, doc.containerType, doc.containerId);
  if (write && doc.editors && doc.creatorId !== id && !doc.editors.includes(id))
    throw new Error("This document is read-only for you.");
  return { doc, access };
}
export const documents = query({
  args: { ...scopeFields, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await requireReadAccess(ctx, id, args.containerType, args.containerId);
    const page = await ctx.db
      .query("sharedDocuments")
      .withIndex("by_container", (q) =>
        q
          .eq("containerType", args.containerType)
          .eq("containerId", args.containerId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page.map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        title: doc.title,
        revision: doc.revision,
        creatorId: doc.creatorId,
        editors: doc.editors,
        updatedAt: doc.updatedAt,
      })),
    };
  },
});
export const document = query({
  args: { id: v.id("sharedDocuments") },
  handler: async (ctx, { id: documentId }) => {
    const { id } = await requireUser(ctx);
    const { doc } = await documentAccess(ctx, id, documentId);
    return {
      ...doc,
      canEdit: !doc.editors || doc.creatorId === id || doc.editors.includes(id),
      isOwner: doc.creatorId === id,
    };
  },
});
export const createDocument = mutation({
  args: {
    ...scopeFields,
    title: v.string(),
    content: v.string(),
    ownerOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id: creatorId } = await requireActiveUser(ctx);
    await requireWriteScope(ctx, creatorId, args);
    if (
      (
        await ctx.db
          .query("sharedDocuments")
          .withIndex("by_container", (q) =>
            q
              .eq("containerType", args.containerType)
              .eq("containerId", args.containerId),
          )
          .take(200)
      ).length >= 200
    )
      throw new Error("This conversation can have up to 200 documents.");
    return ctx.db.insert("sharedDocuments", {
      containerType: args.containerType,
      containerId: args.containerId,
      creatorId,
      title: text(args.title, "Title", 120),
      content: text(args.content, "Document", 50000, true),
      revision: 1,
      updatedById: creatorId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      editors: args.ownerOnly ? [] : undefined,
    });
  },
});
export const saveDocument = mutation({
  args: {
    id: v.id("sharedDocuments"),
    title: v.string(),
    content: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const { doc } = await documentAccess(ctx, id, args.id, true);
    revision(doc.revision, args.expectedRevision);
    const title = text(args.title, "Title", 120);
    const content = text(args.content, "Document", 50000, true);
    if (doc.title === title && doc.content === content) return doc.revision;
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", doc._id))
      .order("asc")
      .take(50);
    if (versions.length >= 50) await ctx.db.delete(versions[0]._id);
    await ctx.db.insert("documentVersions", {
      documentId: doc._id,
      title: doc.title,
      content: doc.content,
      revision: doc.revision,
      editorId: doc.updatedById,
      savedAt: Date.now(),
    });
    await ctx.db.patch(doc._id, {
      title,
      content,
      revision: doc.revision + 1,
      updatedById: id,
      updatedAt: Date.now(),
    });
    return doc.revision + 1;
  },
});
export const documentHistory = query({
  args: {
    id: v.id("sharedDocuments"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await documentAccess(ctx, id, args.id);
    return ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const setDocumentAccess = mutation({
  args: {
    id: v.id("sharedDocuments"),
    editors: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const { doc } = await documentAccess(ctx, id, args.id);
    if (doc.creatorId !== id)
      throw new Error("Only the document owner can change its editors.");
    if (
      args.editors &&
      (args.editors.length > 50 ||
        new Set(args.editors).size !== args.editors.length)
    )
      throw new Error("Choose up to 50 unique editors.");
    for (const editor of args.editors ?? [])
      await requireReadAccess(ctx, editor, doc.containerType, doc.containerId);
    await ctx.db.patch(doc._id, {
      editors: args.editors,
      revision: doc.revision + 1,
      updatedAt: Date.now(),
    });
  },
});
export const restoreDocument = mutation({
  args: { versionId: v.id("documentVersions"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version no longer exists.");
    await documentAccess(ctx, id, version.documentId, true);
    return ctx.runMutation(
      makeFunctionReference<"mutation">("collaboration:saveDocument"),
      {
        id: version.documentId,
        title: version.title,
        content: version.content,
        expectedRevision: args.expectedRevision,
      },
    );
  },
});
export const removeDocument = mutation({
  args: { id: v.id("sharedDocuments") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const { doc, access } = await documentAccess(ctx, id, args.id);
    if (
      doc.creatorId !== id &&
      !(
        access.kind === "channel" &&
        access.permissions.includes(PERMISSIONS.MANAGE_MESSAGES)
      )
    )
      throw new Error(
        "Only the owner or a channel moderator can delete this document.",
      );
    for (const version of await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", doc._id))
      .take(50))
      await ctx.db.delete(version._id);
    await ctx.db.delete(doc._id);
  },
});
const taskStatus = v.union(
  v.literal("todo"),
  v.literal("doing"),
  v.literal("done"),
);
const taskScope = {
  containerType: v.optional(containerType),
  containerId: v.optional(v.string()),
};
export const tasks = query({
  args: { ...taskScope, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    if (args.containerType || args.containerId) {
      if (!args.containerType || !args.containerId)
        throw new Error("Choose a conversation.");
      await requireReadAccess(ctx, id, args.containerType, args.containerId);
      return ctx.db
        .query("workTasks")
        .withIndex("by_container", (q) =>
          q
            .eq("containerType", args.containerType)
            .eq("containerId", args.containerId),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }
    return ctx.db
      .query("workTasks")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", id).eq("containerType", undefined),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const createTask = mutation({
  args: {
    ...taskScope,
    title: v.string(),
    description: v.string(),
    assigneeId: v.optional(v.id("users")),
    dueAt: v.optional(v.number()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    if (args.containerType || args.containerId) {
      if (!args.containerType || !args.containerId)
        throw new Error("Choose a conversation.");
      await requireWriteScope(ctx, userId, {
        containerType: args.containerType,
        containerId: args.containerId,
      });
      if (args.assigneeId)
        await requireReadAccess(
          ctx,
          args.assigneeId,
          args.containerType,
          args.containerId,
        );
    } else if (args.assigneeId && args.assigneeId !== userId)
      throw new Error("Personal tasks can only be assigned to you.");
    if (args.dueAt !== undefined) {
      futureTime(args.dueAt, "Deadline", 60_000);
      timezone(args.timezone ?? "UTC");
    }
    const rows = args.containerType
      ? await ctx.db
          .query("workTasks")
          .withIndex("by_container", (q) =>
            q
              .eq("containerType", args.containerType)
              .eq("containerId", args.containerId),
          )
          .take(500)
      : await ctx.db
          .query("workTasks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .take(500);
    if (rows.length >= 500)
      throw new Error("You can create up to 500 tasks in this space.");
    const id = await ctx.db.insert("workTasks", {
      ...args,
      userId,
      title: text(args.title, "Task title", 160),
      description: text(args.description, "Description", 10000, true),
      assigneeId: args.assigneeId ?? userId,
      status: "todo",
      revision: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (args.dueAt) {
      const reminderJobId = await ctx.scheduler.runAt(
        args.dueAt,
        makeFunctionReference<"mutation">("collaboration:taskReminder"),
        { id },
      );
      await ctx.db.patch(id, { reminderJobId });
    }
    if (args.assigneeId && args.assigneeId !== userId)
      await notify(ctx, {
        userId: args.assigneeId,
        actorId: userId,
        type: "system",
        title: "A task was assigned to you",
        body: args.title.trim(),
        link: await taskLink(ctx, args),
        containerKey: args.containerId,
      });
    return id;
  },
});
export const updateTask = mutation({
  args: {
    id: v.id("workTasks"),
    status: taskStatus,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found.");
    if (task.containerType && task.containerId)
      await requireWriteScope(ctx, id, {
        containerType: task.containerType,
        containerId: task.containerId,
      });
    else if (task.userId !== id) throw new Error("Task not found.");
    revision(task.revision, args.expectedRevision);
    await ctx.db.patch(task._id, {
      status: args.status,
      revision: task.revision + 1,
      updatedAt: Date.now(),
    });
  },
});
export const removeTask = mutation({
  args: { id: v.id("workTasks") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found.");
    const access =
      task.containerType && task.containerId
        ? await requireWriteScope(ctx, id, {
            containerType: task.containerType,
            containerId: task.containerId,
          })
        : null;
    if (
      task.userId !== id &&
      !(
        access?.kind === "channel" &&
        access.permissions.includes(PERMISSIONS.MANAGE_MESSAGES)
      )
    )
      throw new Error(
        "Only the creator or a channel moderator can delete this task.",
      );
    if (task.reminderJobId) await ctx.scheduler.cancel(task.reminderJobId);
    await ctx.db.delete(task._id);
  },
});
export const taskReminder = internalMutation({
  args: { id: v.id("workTasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (
      !task ||
      task.status === "done" ||
      !task.dueAt ||
      task.dueAt > Date.now()
    )
      return;
    const targetId = task.assigneeId ?? task.userId;
    const user = await ctx.db.get(targetId);
    if (!user || user.deletedAt) return;
    if (task.containerType && task.containerId) {
      try {
        await requireReadAccess(
          ctx,
          targetId,
          task.containerType,
          task.containerId,
        );
      } catch {
        return;
      }
    }
    const link = await taskLink(ctx, task);
    await notify(ctx, {
      userId: targetId,
      type: "system",
      title: "Task deadline reached",
      body: task.title,
      link,
      containerKey: task.containerId,
    });
  },
});
