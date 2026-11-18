import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./functions";
import { requireActiveUser, requireUser, notify, blockedUserIds } from "./lib";
import { requireReadAccess, sendMessage } from "./messages";
import { containerType, scopeFields } from "./advancedSchema";
import {
  text,
  futureTime,
  timezone,
  lifetime,
  revision,
} from "./advancedValidation";
import { messageLimit } from "../lib/entitlements";
import { deleteMessageData } from "./cleanup";
import type { Ctx } from "./lib";
import type { Doc, Id } from "./_generated/dataModel";
import { PERMISSIONS } from "../lib/permissions";

export async function readableMessage(
  ctx: Ctx,
  userId: Id<"users">,
  messageId: Id<"messages">,
) {
  const message = await ctx.db.get(messageId);
  if (!message || (message.expiresAt && message.expiresAt <= Date.now()))
    throw new Error("That message is no longer available.");
  const access = await requireReadAccess(
    ctx,
    userId,
    message.containerType,
    message.containerId,
  );
  if ((await blockedUserIds(ctx, userId)).has(message.authorId))
    throw new Error("That message is unavailable.");
  return { message, access };
}
export async function messageLink(
  ctx: Ctx,
  message: Pick<Doc<"messages">, "_id" | "containerType" | "containerId">,
) {
  if (message.containerType === "conversation")
    return `/dashboard/dm/${message.containerId}?message=${message._id}`;
  const channel = await ctx.db.get(message.containerId as Id<"channels">);
  return channel
    ? `/dashboard/s/${channel.serverId}/c/${channel._id}?message=${message._id}`
    : undefined;
}
export const schedule = mutation({
  args: {
    ...scopeFields,
    content: v.string(),
    sendAt: v.number(),
    timezone: v.string(),
    lifetimeSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id: userId, user } = await requireActiveUser(ctx);
    const access = await requireReadAccess(
      ctx,
      userId,
      args.containerType,
      args.containerId,
    );
    if (
      access.kind === "channel" &&
      !access.permissions.includes(PERMISSIONS.SEND_MESSAGES)
    )
      throw new Error("You cannot send messages here.");
    const pending = await ctx.db
      .query("scheduledMessages")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .take(50);
    if (pending.length >= 50)
      throw new Error("You can have up to 50 pending messages.");
    const id = await ctx.db.insert("scheduledMessages", {
      userId,
      ...args,
      content: text(args.content, "Message", messageLimit(user)),
      sendAt: futureTime(args.sendAt, "Send time"),
      timezone: timezone(args.timezone),
      lifetimeSeconds: lifetime(args.lifetimeSeconds),
      status: "pending",
      createdAt: Date.now(),
    });
    const jobId = await ctx.scheduler.runAt(
      args.sendAt,
      makeFunctionReference<"mutation">("advancedMessages:deliverScheduled"),
      { id },
    );
    await ctx.db.patch(id, { jobId });
    return id;
  },
});
export const schedules = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    return ctx.db
      .query("scheduledMessages")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const cancelSchedule = mutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const user = await requireActiveUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== user.id)
      throw new Error("Scheduled message not found.");
    if (row.status !== "pending")
      throw new Error("This message has already finished.");
    if (row.jobId) await ctx.scheduler.cancel(row.jobId);
    await ctx.db.patch(id, {
      status: "cancelled",
      finishedAt: Date.now(),
      content: "",
    });
  },
});
export const deliverScheduled = internalMutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.status !== "pending") return;
    if (row.sendAt > Date.now())
      throw new Error("The scheduled message is not due.");
    // Nested public mutation: a failed send rolls back all of its writes, while
    // this outer transaction records the failure. Explicit author is internal.
    const result = await ctx
      .runMutation(
        makeFunctionReference<"mutation">("advancedMessages:sendScheduled"),
        { id },
      )
      .catch(() => null);
    if (!result?.messageId) {
      await ctx.db.patch(id, {
        status: "failed",
        finishedAt: Date.now(),
        error:
          "Delivery was blocked or permissions changed. Review the conversation and schedule again.",
      });
      await notify(ctx, {
        userId: row.userId,
        type: "system",
        title: "Scheduled message could not be sent",
        link: "/dashboard/library",
      });
      return;
    }
    await ctx.db.patch(id, {
      status: "sent",
      finishedAt: Date.now(),
      messageId: result.messageId,
      content: "",
    });
  },
});
export const sendScheduled = internalMutation({
  args: { id: v.id("scheduledMessages") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.status !== "pending" || row.sendAt > Date.now())
      throw new Error("This schedule is not due.");
    return sendMessage(
      ctx,
      {
        containerType: row.containerType,
        containerId: row.containerId,
        content: row.content,
        lifetimeSeconds: row.lifetimeSeconds,
        clientId: `scheduled:${id}`,
      },
      row.userId,
    );
  },
});
export const expire = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const row = await ctx.db.get(messageId);
    if (row?.expiresAt && row.expiresAt <= Date.now())
      await deleteMessageData(ctx, row);
  },
});
export const versions = query({
  args: {
    messageId: v.id("messages"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { messageId, paginationOpts }) => {
    const { id } = await requireUser(ctx);
    await readableMessage(ctx, id, messageId);
    return ctx.db
      .query("messageVersions")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .order("desc")
      .paginate(paginationOpts);
  },
});
export const restoreVersion = mutation({
  args: { versionId: v.id("messageVersions"), expectedRevision: v.number() },
  handler: async (ctx, { versionId, expectedRevision }) => {
    const { id } = await requireActiveUser(ctx);
    const version = await ctx.db.get(versionId);
    if (!version) throw new Error("Version no longer exists.");
    const { message } = await readableMessage(ctx, id, version.messageId);
    if (message.authorId !== id)
      throw new Error("You can only restore your own messages.");
    if ((message.revision ?? 0) !== expectedRevision)
      throw new Error(
        "The message changed. Reopen its history before restoring.",
      );
    await ctx.runMutation(makeFunctionReference<"mutation">("messages:edit"), {
      messageId: message._id,
      content: version.content,
      expectedRevision,
    });
  },
});
export const forward = mutation({
  args: {
    messageId: v.id("messages"),
    containerType,
    containerId: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const { message } = await readableMessage(ctx, id, args.messageId);
    if (!message.content.trim())
      throw new Error(
        "This message has no text to forward. Attachments remain in their original conversation.",
      );
    if (message.expiresAt)
      throw new Error("Temporary messages cannot be forwarded.");
    const author = await ctx.db.get(message.authorId);
    return sendMessage(
      ctx,
      {
        containerType: args.containerType,
        containerId: args.containerId,
        content: message.content,
        clientId: args.clientId,
      },
      undefined,
      {
        messageId: message._id,
        authorId: message.authorId,
        authorName: author?.name ?? author?.username ?? "Kyro member",
      },
    );
  },
});
export const collections = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    return ctx.db
      .query("savedCollections")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .take(50);
  },
});
export const createCollection = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { id: userId } = await requireActiveUser(ctx);
    const rows = await ctx.db
      .query("savedCollections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(50);
    const title = text(name, "Collection name", 60);
    if (rows.some((r) => r.name.toLowerCase() === title.toLowerCase()))
      throw new Error("A collection already has that name.");
    if (rows.length >= 50)
      throw new Error("You can create up to 50 collections.");
    return ctx.db.insert("savedCollections", {
      userId,
      name: title,
      createdAt: Date.now(),
    });
  },
});
export const removeCollection = mutation({
  args: { id: v.id("savedCollections") },
  handler: async (ctx, { id }) => {
    const user = await requireActiveUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== user.id)
      throw new Error("Collection not found.");
    const saved = await ctx.db
      .query("savedMessages")
      .withIndex("by_user_collection", (q) =>
        q.eq("userId", user.id).eq("collectionId", id),
      )
      .take(1000);
    for (const item of saved)
      await ctx.db.patch(item._id, { collectionId: undefined });
    await ctx.db.delete(id);
  },
});
export const bookmark = mutation({
  args: {
    messageId: v.id("messages"),
    collectionId: v.optional(v.id("savedCollections")),
    remove: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    const existing = await ctx.db
      .query("savedMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId),
      )
      .unique();
    if (args.remove) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    const { message } = await readableMessage(ctx, userId, args.messageId);
    if (message.expiresAt)
      throw new Error("Temporary messages cannot be saved.");
    if (
      args.collectionId &&
      (await ctx.db.get(args.collectionId))?.userId !== userId
    )
      throw new Error("Collection not found.");
    if (existing) {
      await ctx.db.patch(existing._id, { collectionId: args.collectionId });
      return;
    }
    const rows = await ctx.db
      .query("savedMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1000);
    if (rows.length >= 1000)
      throw new Error("Your library can hold up to 1,000 messages.");
    await ctx.db.insert("savedMessages", {
      userId,
      messageId: args.messageId,
      collectionId: args.collectionId,
      createdAt: Date.now(),
    });
  },
});
export const bookmarks = query({
  args: {
    collectionId: v.optional(v.id("savedCollections")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    if (
      args.collectionId &&
      (await ctx.db.get(args.collectionId))?.userId !== id
    )
      throw new Error("Collection not found.");
    const page = args.collectionId
      ? await ctx.db
          .query("savedMessages")
          .withIndex("by_user_collection", (q) =>
            q.eq("userId", id).eq("collectionId", args.collectionId),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("savedMessages")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .order("desc")
          .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (row) => {
          try {
            const { message } = await readableMessage(ctx, id, row.messageId);
            return {
              id: row._id,
              messageId: row.messageId,
              content: message.content,
              link: await messageLink(ctx, message),
              collectionId: row.collectionId,
            };
          } catch {
            return {
              id: row._id,
              messageId: row.messageId,
              content: null,
              link: undefined,
              collectionId: row.collectionId,
            };
          }
        }),
      ),
    };
  },
});
export const remind = mutation({
  args: {
    messageId: v.id("messages"),
    remindAt: v.number(),
    timezone: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    const { message } = await readableMessage(ctx, userId, args.messageId);
    if (message.expiresAt && message.expiresAt <= args.remindAt)
      throw new Error("This message expires before your reminder.");
    const rows = await ctx.db
      .query("messageReminders")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .take(100);
    if (rows.length >= 100)
      throw new Error("You can have up to 100 pending reminders.");
    const id = await ctx.db.insert("messageReminders", {
      ...args,
      userId,
      remindAt: futureTime(args.remindAt, "Reminder time"),
      timezone: timezone(args.timezone),
      note: text(args.note, "Note", 500, true),
      status: "pending",
      createdAt: Date.now(),
    });
    const jobId = await ctx.scheduler.runAt(
      args.remindAt,
      makeFunctionReference<"mutation">("advancedMessages:deliverReminder"),
      { id },
    );
    await ctx.db.patch(id, { jobId });
    return id;
  },
});
export const reminders = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    return ctx.db
      .query("messageReminders")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const cancelReminder = mutation({
  args: { id: v.id("messageReminders") },
  handler: async (ctx, { id }) => {
    const user = await requireActiveUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== user.id) throw new Error("Reminder not found.");
    if (row.status !== "pending") return;
    if (row.jobId) await ctx.scheduler.cancel(row.jobId);
    await ctx.db.patch(id, { status: "cancelled", note: "" });
  },
});
export const deliverReminder = internalMutation({
  args: { id: v.id("messageReminders") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.status !== "pending" || row.remindAt > Date.now()) return;
    try {
      const { message } = await readableMessage(ctx, row.userId, row.messageId);
      await notify(ctx, {
        userId: row.userId,
        type: "system",
        title: "Message reminder",
        body: row.note || undefined,
        link: await messageLink(ctx, message),
        containerKey: message.containerId,
        messageId: message._id,
      });
      await ctx.db.patch(id, { status: "delivered" });
    } catch {
      await ctx.db.patch(id, { status: "cancelled", note: "" });
    }
  },
});

export const privateState = query({
  args: scopeFields,
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await requireReadAccess(ctx, id, args.containerType, args.containerId);
    const [note, draft, folders, membership] = await Promise.all([
      ctx.db
        .query("conversationNotes")
        .withIndex("by_user_container", (q) =>
          q
            .eq("userId", id)
            .eq("containerType", args.containerType)
            .eq("containerId", args.containerId),
        )
        .unique(),
      ctx.db
        .query("messageDrafts")
        .withIndex("by_user_container", (q) =>
          q
            .eq("userId", id)
            .eq("containerType", args.containerType)
            .eq("containerId", args.containerId),
        )
        .unique(),
      ctx.db
        .query("conversationFolders")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .take(25),
      ctx.db
        .query("conversationFolderItems")
        .withIndex("by_user_container", (q) =>
          q
            .eq("userId", id)
            .eq("containerType", args.containerType)
            .eq("containerId", args.containerId),
        )
        .unique(),
    ]);
    return { note, draft, folders, folderId: membership?.folderId ?? null };
  },
});
export const savePrivate = mutation({
  args: {
    ...scopeFields,
    kind: v.union(v.literal("note"), v.literal("draft")),
    content: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    await requireReadAccess(ctx, userId, args.containerType, args.containerId);
    const table = args.kind === "note" ? "conversationNotes" : "messageDrafts";
    const row = await ctx.db
      .query(table)
      .withIndex("by_user_container", (q) =>
        q
          .eq("userId", userId)
          .eq("containerType", args.containerType)
          .eq("containerId", args.containerId),
      )
      .unique();
    revision(row?.revision ?? 0, args.expectedRevision);
    // Preserve whitespace in drafts and Markdown notes.
    if (args.content.length > (args.kind === "note" ? 10000 : 4000))
      throw new Error("This text is too long.");
    const next = {
      content: args.content,
      revision: (row?.revision ?? 0) + 1,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, next);
    else {
      if (
        (
          await ctx.db
            .query(table)
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(200)
        ).length >= 200
      )
        throw new Error(
          "You can keep private state in up to 200 conversations.",
        );
      await ctx.db.insert(table, {
        userId,
        containerType: args.containerType,
        containerId: args.containerId,
        ...next,
      });
    }
    return next.revision;
  },
});
export const createFolder = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { id: userId } = await requireActiveUser(ctx);
    const rows = await ctx.db
      .query("conversationFolders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(25);
    const title = text(name, "Folder name", 60);
    if (
      rows.length >= 25 ||
      rows.some((r) => r.name.toLowerCase() === title.toLowerCase())
    )
      throw new Error(
        "Folder already exists or the 25-folder limit was reached.",
      );
    return ctx.db.insert("conversationFolders", {
      userId,
      name: title,
      createdAt: Date.now(),
    });
  },
});
export const setFolder = mutation({
  args: { ...scopeFields, folderId: v.optional(v.id("conversationFolders")) },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    await requireReadAccess(ctx, userId, args.containerType, args.containerId);
    if (args.folderId && (await ctx.db.get(args.folderId))?.userId !== userId)
      throw new Error("Folder not found.");
    const row = await ctx.db
      .query("conversationFolderItems")
      .withIndex("by_user_container", (q) =>
        q
          .eq("userId", userId)
          .eq("containerType", args.containerType)
          .eq("containerId", args.containerId),
      )
      .unique();
    if (!args.folderId) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    if (row) await ctx.db.patch(row._id, { folderId: args.folderId });
    else {
      if (
        (
          await ctx.db
            .query("conversationFolderItems")
            .withIndex("by_folder", (q) => q.eq("folderId", args.folderId!))
            .take(200)
        ).length >= 200
      )
        throw new Error("A folder can contain up to 200 conversations.");
      await ctx.db.insert("conversationFolderItems", {
        ...args,
        userId,
        folderId: args.folderId,
        createdAt: Date.now(),
      });
    }
  },
});
export const folders = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const rows = await ctx.db
      .query("conversationFolders")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .take(25);
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        items: (
          await Promise.all(
            (
              await ctx.db
                .query("conversationFolderItems")
                .withIndex("by_folder", (q) => q.eq("folderId", row._id))
                .take(200)
            ).map(async (item) => {
              try {
                const access = await requireReadAccess(
                  ctx,
                  id,
                  item.containerType,
                  item.containerId,
                );
                return {
                  ...item,
                  name:
                    access.kind === "channel"
                      ? `#${access.channel.name}`
                      : (access.conversation.name ?? "Conversation"),
                  link:
                    access.kind === "channel"
                      ? `/dashboard/s/${access.server._id}/c/${item.containerId}`
                      : `/dashboard/dm/${item.containerId}`,
                };
              } catch {
                return null;
              }
            }),
          )
        ).filter((item): item is NonNullable<typeof item> => !!item),
      })),
    );
  },
});
export const removeFolder = mutation({
  args: { id: v.id("conversationFolders") },
  handler: async (ctx, { id }) => {
    const user = await requireActiveUser(ctx);
    if ((await ctx.db.get(id))?.userId !== user.id)
      throw new Error("Folder not found.");
    for (const row of await ctx.db
      .query("conversationFolderItems")
      .withIndex("by_folder", (q) => q.eq("folderId", id))
      .take(200))
      await ctx.db.delete(row._id);
    await ctx.db.delete(id);
  },
});
export const locate = query({
  args: { ...scopeFields, messageId: v.string() },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await requireReadAccess(ctx, id, args.containerType, args.containerId);
    const messageId = ctx.db.normalizeId("messages", args.messageId);
    if (!messageId) return null;
    try {
      const { message } = await readableMessage(ctx, id, messageId);
      if (
        message.containerType !== args.containerType ||
        message.containerId !== args.containerId
      )
        return null;
      return { createdAt: message.createdAt };
    } catch {
      return null;
    }
  },
});
