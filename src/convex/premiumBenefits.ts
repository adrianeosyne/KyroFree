import type { Doc, Id } from "./_generated/dataModel";
import { isPlatformStaff, requireServerAccess, type Ctx } from "./lib";
import { hasPremium, uploadLimit } from "../lib/entitlements";

/** Base server limits. Premium remains a per-account entitlement. */
export async function serverBenefits() {
  return {
    active: false,
    emojiSlots: 100,
    uploadBytes: 10 * 1024 * 1024,
    audioBitrate: 64000,
  };
}

export async function contextualUploadLimit(
  ctx: Ctx,
  user: Doc<"users">,
  channelId?: Id<"channels">,
) {
  if (!channelId) return uploadLimit(user);
  const channel = await ctx.db.get(channelId);
  if (!channel) throw new Error("That channel no longer exists.");
  await requireServerAccess(ctx, channel.serverId, user._id);
  await requirePremiumChannel(ctx, channel, user._id);
  return Math.max(uploadLimit(user), (await serverBenefits()).uploadBytes);
}

export async function canUsePremiumLounge(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return (
    !!user && !user.deletedAt && (hasPremium(user) || isPlatformStaff(user))
  );
}

/** A manually assigned role cannot bypass the current paid entitlement. */
export async function requirePremiumChannel(
  ctx: Ctx,
  channel: Doc<"channels">,
  userId: Id<"users">,
) {
  if (!channel.premiumOnly) return;
  const server = await ctx.db.get(channel.serverId);
  if (server?.isPlatformHome && !(await canUsePremiumLounge(ctx, userId)))
    throw new Error(
      "The Premium lounge requires active Premium or Kyro staff access.",
    );
}
