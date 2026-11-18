import { hmac } from "@oslojs/crypto/hmac";
import { SHA256 } from "@oslojs/crypto/sha2";
import type { Ctx } from "./lib";
import {
  activeSiteBan,
  requireConversationAccess,
  requireServerAccess,
  isBlockedBetween,
} from "./lib";
import { channelPermissions, hasPermission } from "../lib/permissions";
import type { Id } from "./_generated/dataModel";
import { activeBot, botChannel, ownerApp } from "./botLib";
import { uploadByStorageId } from "./uploadSecurity";
import { collectionAccess } from "./socialVisibility";

function signature(payload: string) {
  const key = process.env.KYRO_FILE_SIGNING_SECRET;
  if (!key || key.length < 32) return null;
  return Array.from(
    hmac(
      SHA256,
      new TextEncoder().encode(key),
      new TextEncoder().encode(payload),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function fileUrl(
  storageId: string,
  userId: string,
  messageId = "",
  expiresAt = Math.ceil(Date.now() / 60000) * 60000 + 15 * 60000,
) {
  const payload = `${storageId}:${userId}:${messageId}:${expiresAt}`;
  const sig = signature(payload);
  if (!sig) return null;
  const base = process.env.CONVEX_SITE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/files/download?id=${encodeURIComponent(storageId)}&viewer=${encodeURIComponent(userId)}&message=${encodeURIComponent(messageId)}&expires=${expiresAt}&signature=${sig}`;
}
export function validFileSignature(
  storageId: string,
  viewer: string,
  message: string,
  expires: number,
  sig: string,
) {
  if (
    !Number.isFinite(expires) ||
    expires <= Date.now() ||
    expires > Date.now() + 16 * 60000
  )
    return false;
  const expected = signature(`${storageId}:${viewer}:${message}:${expires}`);
  if (!expected || sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++)
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
export async function authorizeFile(
  ctx: Ctx,
  viewerId: Id<"users">,
  storageId: Id<"_storage">,
  messageId?: Id<"messages">,
) {
  const user = await ctx.db.get(viewerId);
  if (!user || user.deletedAt || (await activeSiteBan(ctx, viewerId)))
    throw new Error("File unavailable.");
  const upload = await uploadByStorageId(ctx, storageId);
  if (upload?.status && upload.status !== "verified")
    throw new Error("File is not verified.");
  if (user.botApplicationId) {
    const app = await ctx.db.get(user.botApplicationId);
    if (!app) throw new Error("Bot unavailable.");
    await activeBot(ctx, app.tokenHash ?? "");
  }
  const targetId =
    messageId ??
    (upload?.claimType === "message" && upload.claimId
      ? ctx.db.normalizeId("messages", upload.claimId)
      : null);
  if (targetId) {
    const message = await ctx.db.get(targetId);
    if (
      !message ||
      (message.expiresAt !== undefined && message.expiresAt <= Date.now()) ||
      !message.attachments?.some((a) => a.storageId === storageId)
    )
      throw new Error("Attachment unavailable.");
    if (message.containerType === "conversation") {
      if (user.botApplicationId)
        throw new Error("Bots cannot access private conversations.");
      await requireConversationAccess(
        ctx,
        message.containerId as Id<"conversations">,
        viewerId,
        { enforceBlocks: false },
      );
    } else {
      const channelId = ctx.db.normalizeId("channels", message.containerId);
      const channel = channelId ? await ctx.db.get(channelId) : null;
      if (!channel) throw new Error("Channel unavailable.");
      if (user.botApplicationId)
        await botChannel(
          ctx,
          (await ctx.db.get(user.botApplicationId))!,
          channel._id,
          "read_message_history",
        );
      else {
        const access = await requireServerAccess(
          ctx,
          channel.serverId,
          viewerId,
        );
        const role = await ctx.db
          .query("serverRoles")
          .withIndex("by_server_default", (q) =>
            q.eq("serverId", channel.serverId).eq("isDefault", true),
          )
          .first();
        if (
          channel.serverId &&
          access.server.ownerId !== viewerId &&
          !hasPermission(
            channelPermissions(
              access.permissions,
              access.member.roleIds,
              role?._id ?? null,
              channel.permissionOverwrites,
            ),
            "view_channel",
          )
        )
          throw new Error("Attachment unavailable.");
      }
    }
    return upload;
  }
  if (!upload) throw new Error("File unavailable.");
  if (upload.claimType === "social_sticker" && upload.claimId) {
    const itemId = ctx.db.normalizeId("socialCollectionItems", upload.claimId),
      item = itemId && (await ctx.db.get(itemId));
    if (!item || item.storageId !== storageId)
      throw new Error("Sticker unavailable.");
    await collectionAccess(ctx, viewerId, item.collectionId);
    const creator = await ctx.db.get(item.userId);
    if (
      !creator ||
      creator.deletedAt !== undefined ||
      (await isBlockedBetween(ctx, viewerId, item.userId))
    )
      throw new Error("Sticker unavailable.");
    return upload;
  }
  if (upload.ownerId !== viewerId) {
    if (!upload.applicationId) throw new Error("File unavailable.");
    const app = await ctx.db.get(upload.applicationId);
    if (
      !app ||
      app.deletedAt ||
      (user.botApplicationId
        ? user.botApplicationId !== app._id || upload.ownerId !== app.ownerId
        : app.ownerId !== viewerId)
    )
      throw new Error("File unavailable.");
  }
  if (upload.applicationId && !user.botApplicationId)
    await ownerApp(ctx, upload.applicationId);
  return upload;
}
