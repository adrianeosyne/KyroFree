import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  action,
} from "./functions";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./functions";
import { requireActiveUser } from "./lib";
import { limit, ownerApp, auditBot } from "./botLib";
import {
  MAX_UPLOAD_BYTES,
  uploadByStorageId,
  deleteUnclaimedUpload,
  deleteClaimedUpload,
} from "./uploadSecurity";
import { allowedFilename, cleanFilename } from "../lib/filePolicy";
import { authorizeFile, fileUrl } from "./fileAccess";
import { recordUsage } from "./botAnalytics";

export function storageQuota() {
  const value = Number(process.env.KYRO_STORAGE_QUOTA_BYTES);
  return Number.isSafeInteger(value) && value > 0 ? value : 250 * 1024 * 1024;
}
export async function reserveUpload(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  data: {
    name: string;
    size: number;
    sha256: string;
    applicationId?: Id<"botApplications">;
    channelId?: Id<"channels">;
  },
) {
  if (
    !Number.isSafeInteger(data.size) ||
    data.size <= 0 ||
    data.size > MAX_UPLOAD_BYTES ||
    !/^[a-f0-9]{64}$/.test(data.sha256) ||
    !allowedFilename(data.name, process.env.KYRO_UPLOAD_EXTENSIONS)
  )
    throw new Error(
      "Choose a supported file of at most 10 MiB with a SHA-256 digest.",
    );
  if (!(await limit(ctx, `uploads:${ownerId}`, 20)))
    throw new Error("Upload rate limit reached. Wait a minute.");
  const files = await ctx.db
    .query("uploads")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(2000);
  const pending = await ctx.db
    .query("uploadTickets")
    .withIndex("by_owner_expiry", (q) =>
      q.eq("ownerId", ownerId).gt("expiresAt", Date.now()),
    )
    .collect();
  const used =
    files.reduce((sum, f) => sum + f.size, 0) +
    pending
      .filter((t) => t.status === "pending" && !t.storageId)
      .reduce((sum, t) => sum + t.size, 0);
  if (files.length >= 2000 || used + data.size > storageQuota())
    throw new Error(
      "Your storage quota is full. Remove unused files before uploading.",
    );
  const uploadId = await ctx.db.insert("uploadTickets", {
    ...data,
    name: cleanFilename(data.name),
    ownerId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60000,
    status: "pending",
  });
  return {
    uploadId,
    uploadUrl: await ctx.storage.generateUploadUrl(),
    maximumBytes: MAX_UPLOAD_BYTES,
    expiresAt: Date.now() + 15 * 60000,
  };
}
export const generateUploadUrl = mutation({
  args: {
    name: v.string(),
    size: v.number(),
    sha256: v.string(),
    applicationId: v.optional(v.id("botApplications")),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    if (args.applicationId) await ownerApp(ctx, args.applicationId);
    return reserveUpload(ctx, id, args);
  },
});
export async function registerReservedUpload(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  storageId: Id<"_storage">,
  uploadId: Id<"uploadTickets">,
) {
  const old = await uploadByStorageId(ctx, storageId);
  if (old && old.ownerId !== ownerId)
    throw new Error("That upload belongs to another account.");
  const ticket = await ctx.db.get(uploadId);
  if (
    !ticket ||
    ticket.ownerId !== ownerId ||
    ticket.expiresAt < Date.now() ||
    ticket.status === "rejected" ||
    (ticket.storageId && ticket.storageId !== storageId)
  )
    throw new Error("Upload reservation is invalid or expired.");
  if (old) {
    if (ticket.storageId !== storageId)
      throw new Error("Upload is already registered.");
    return { storageId, uploadId, status: old.status ?? "verified" };
  }
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (
    !metadata ||
    metadata.size !== ticket.size ||
    metadata._creationTime < ticket.createdAt - 1000
  )
    throw new Error("The object does not match this upload reservation.");
  await ctx.db.insert("uploads", {
    storageId,
    ownerId,
    name: ticket.name,
    size: metadata.size,
    mimeType: metadata.contentType ?? "application/octet-stream",
    status: "pending",
    sha256: ticket.sha256,
    applicationId: ticket.applicationId,
    channelId: ticket.channelId,
    createdAt: Date.now(),
  });
  await ctx.db.patch(uploadId, { storageId, status: "verifying" });
  return { storageId, uploadId, status: "pending" };
}
export const registerUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    uploadId: v.id("uploadTickets"),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    return registerReservedUpload(ctx, id, args.storageId, args.uploadId);
  },
});
export const verificationJob = internalQuery({
  args: { uploadId: v.id("uploadTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.uploadId);
    if (
      !ticket ||
      !ticket.storageId ||
      ticket.expiresAt < Date.now() ||
      !["verifying", "complete"].includes(ticket.status)
    )
      throw new Error("Upload reservation is unavailable.");
    return ticket;
  },
});
export const ownedVerificationJob = internalQuery({
  args: { uploadId: v.id("uploadTickets") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const ticket = await ctx.db.get(args.uploadId);
    if (!ticket || ticket.ownerId !== id)
      throw new Error("Upload unavailable.");
    return ticket;
  },
});
export const finishVerification = internalMutation({
  args: {
    uploadId: v.id("uploadTickets"),
    mimeType: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.uploadId);
    if (!ticket?.storageId) throw new Error("Upload unavailable.");
    const upload = await uploadByStorageId(ctx, ticket.storageId);
    if (!upload || upload.ownerId !== ticket.ownerId)
      throw new Error("Upload unavailable.");
    if (ticket.status === "complete")
      return {
        storageId: upload.storageId,
        name: upload.name,
        size: upload.size,
        mimeType: upload.mimeType,
      };
    if (ticket.status !== "verifying" || ticket.expiresAt < Date.now())
      throw new Error("Reservation expired.");
    await ctx.db.patch(ticket._id, {
      status: args.error ? "rejected" : "complete",
    });
    await ctx.db.patch(upload._id, {
      status: args.error ? "quarantined" : "verified",
      mimeType: args.mimeType ?? upload.mimeType,
    });
    if (ticket.applicationId)
      await auditBot(
        ctx,
        ticket.applicationId,
        args.error ? "asset.quarantine" : "asset.upload",
        ticket.ownerId,
        upload.name,
      );
    if (ticket.applicationId && !args.error)
      await recordUsage(
        ctx,
        ticket.applicationId,
        "uploadedBytes",
        upload.size,
      );
    return {
      storageId: upload.storageId,
      name: upload.name,
      size: upload.size,
      mimeType: args.mimeType ?? upload.mimeType,
    };
  },
});
export const verifyUpload = action({
  args: { uploadId: v.id("uploadTickets") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    storageId: Id<"_storage">;
    name: string;
    size: number;
    mimeType: string;
  }> => {
    await ctx.runQuery(internal.files.ownedVerificationJob, args);
    return ctx.runAction(internal.fileVerification.verify, args);
  },
});
export const download = query({
  args: {
    storageId: v.id("_storage"),
    messageId: v.optional(v.id("messages")),
    refresh: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const file = await authorizeFile(ctx, id, args.storageId, args.messageId);
    return {
      url: fileUrl(args.storageId, id, args.messageId ?? ""),
      name: file?.name ?? "attachment",
      size: file?.size,
      mimeType: file?.mimeType,
      expiresAt: Math.ceil(Date.now() / 60000) * 60000 + 15 * 60000,
    };
  },
});
export const downloadTarget = internalQuery({
  args: {
    storageId: v.id("_storage"),
    viewerId: v.id("users"),
    messageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const file = await authorizeFile(
      ctx,
      args.viewerId,
      args.storageId,
      args.messageId,
    );
    return {
      url: await ctx.storage.getUrl(args.storageId),
      name: file?.name ?? "attachment",
      mimeType: file?.mimeType ?? "application/octet-stream",
      size: file?.size,
    };
  },
});
export const list = query({
  args: {
    applicationId: v.optional(v.id("botApplications")),
    search: v.optional(v.string()),
    refresh: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    if (args.applicationId) await ownerApp(ctx, args.applicationId);
    const page = args.applicationId
      ? await ctx.db
          .query("uploads")
          .withIndex("by_application", (q) =>
            q.eq("applicationId", args.applicationId),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("uploads")
          .withIndex("by_owner", (q) => q.eq("ownerId", id))
          .order("desc")
          .paginate(args.paginationOpts);
    return {
      ...page,
      page: page.page
        .filter(
          (f) =>
            !args.search ||
            f.name
              .toLowerCase()
              .includes(args.search.toLowerCase().slice(0, 100)),
        )
        .map((file) => ({
          id: file._id,
          storageId: file.storageId,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
          status: file.status ?? "verified",
          claimed: Boolean(file.claimType),
          url:
            file.status === "quarantined"
              ? null
              : fileUrl(
                  file.storageId,
                  id,
                  file.claimType === "message" ? file.claimId : "",
                ),
        })),
    };
  },
});
export const usage = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireActiveUser(ctx);
    const files = await ctx.db
      .query("uploads")
      .withIndex("by_owner", (q) => q.eq("ownerId", id))
      .take(2000);
    return {
      bytes: files.reduce((sum, f) => sum + f.size, 0),
      files: files.length,
      quotaBytes: storageQuota(),
      maximumBytes: MAX_UPLOAD_BYTES,
    };
  },
});
export const remove = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const upload = await uploadByStorageId(ctx, args.storageId);
    if (!upload || upload.ownerId !== id) throw new Error("File unavailable.");
    if (upload.claimType)
      throw new Error("Remove the file from its message or resource first.");
    // An unverified object's ownership has not been established; it cannot
    // authorize deleting storage bytes potentially uploaded by another person.
    if (upload.status === "quarantined" || upload.status === "pending")
      await ctx.db.delete(upload._id);
    else await deleteUnclaimedUpload(ctx, id, args.storageId);
    if (upload.applicationId)
      await auditBot(
        ctx,
        upload.applicationId,
        "asset.delete",
        id,
        upload.name,
      );
  },
});
export const cancel = mutation({
  args: { uploadId: v.id("uploadTickets") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const ticket = await ctx.db.get(args.uploadId);
    if (!ticket || ticket.ownerId !== id)
      throw new Error("Reservation unavailable.");
    if (ticket.status !== "complete")
      await ctx.db.patch(ticket._id, {
        status: "rejected",
        expiresAt: Date.now(),
      });
  },
});
export const removeAttachment = mutation({
  args: { storageId: v.id("_storage"), messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    await authorizeFile(ctx, id, args.storageId, args.messageId);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.authorId !== id)
      throw new Error("Only the message author can remove this attachment.");
    const attachments =
      message.attachments?.filter((a) => a.storageId !== args.storageId) ?? [];
    await deleteClaimedUpload(ctx, args.storageId, "message", args.messageId);
    await ctx.db.patch(args.messageId, {
      attachments,
      editedAt: Date.now(),
      ...(!attachments.length &&
      !message.content.trim() &&
      !message.embeds?.length
        ? { content: "Attachment removed" }
        : {}),
    });
  },
});
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const ticket of await ctx.db
      .query("uploadTickets")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", Date.now() - 86400000))
      .take(200)) {
      if (ticket.storageId && ticket.status !== "complete") {
        const upload = await uploadByStorageId(ctx, ticket.storageId);
        if (
          upload &&
          !upload.claimType &&
          upload.ownerId === ticket.ownerId &&
          upload.status !== "verified"
        )
          await ctx.db.delete(upload._id);
      }
      await ctx.db.delete(ticket._id);
    }
  },
});
