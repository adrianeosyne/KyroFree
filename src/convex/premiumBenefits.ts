import type { Doc, Id } from "./_generated/dataModel";
import { isPlatformStaff, requireServerAccess, type Ctx } from "./lib";
import { hasPremium, uploadLimit } from "../lib/entitlements";

/** A contribution benefits one community only while its supporter is active. */
export async function serverBenefits(ctx: Ctx, serverId: Id<"servers">) {
  const contributions = await ctx.db
    .query("serverSupercharges")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .collect();
  let active = false;
  for (const contribution of contributions) {
    if (contribution.until <= Date.now()) continue;
    const user = await ctx.db.get(contribution.userId);
    if (user && !user.deletedAt && hasPremium(user)) {
      active = true;
      break;
    }
  }
  return {
    active,
    emojiSlots: active ? 200 : 100,
    uploadBytes: (active ? 50 : 10) * 1024 * 1024,
    audioBitrate: active ? 128000 : 64000,
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
  return Math.max(
    uploadLimit(user),
    (await serverBenefits(ctx, channel.serverId)).uploadBytes,
  );
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
