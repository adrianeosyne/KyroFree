import { contextualUploadLimit } from "./premiumBenefits";
import { v } from "convex/values";
import { mutation } from "./functions";
import { requireProfile } from "./lib";
import {
  deleteStorageObjectIfPresent,
  isAllowedUploadType,
  uploadByStorageId,
  deleteUnclaimedUpload,
} from "./uploadSecurity";

/**
 * Files go straight to Convex object storage (S3-compatible under the hood)
 * via a short-lived signed upload URL — no file bytes through the database.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Register the object immediately after the signed upload completes. The
 * server reads size/content type from Convex storage; client metadata is never
 * trusted for quotas or rendering decisions.
 */
export const registerUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    channelId: v.optional(v.id("channels")),
  },
  handler: async (ctx, { storageId, name, channelId }) => {
    const { id, user } = await requireProfile(ctx);
    const limit = await contextualUploadLimit(ctx, user, channelId);
    const existing = await uploadByStorageId(ctx, storageId);
    if (existing) {
      if (existing.ownerId !== id) {
        throw new Error("That upload belongs to another account.");
      }
      return {
        storageId,
        name: existing.name,
        size: existing.size,
        mimeType: existing.mimeType,
      };
    }

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) throw new Error("That upload no longer exists.");
    const mimeType = metadata.contentType ?? "application/octet-stream";
    if (metadata.size > limit || !isAllowedUploadType(mimeType)) {
      await deleteStorageObjectIfPresent(ctx, storageId);
      throw new Error(
        metadata.size > limit
          ? "That file exceeds your current upload limit."
          : "That file type is not allowed.",
      );
    }
    const cleanName = name.trim().slice(0, 120) || "upload";
    await ctx.db.insert("uploads", {
      storageId,
      ownerId: id,
      name: cleanName,
      size: metadata.size,
      mimeType,
      createdAt: Date.now(),
    });
    return { storageId, name: cleanName, size: metadata.size, mimeType };
  },
});

export const discard = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const { id } = await requireProfile(ctx);
    await deleteUnclaimedUpload(ctx, id, storageId);
  },
});
