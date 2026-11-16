import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./functions";
export const weekStart = (now = Date.now()) =>
  Math.floor((now - 4 * 86400000) / (7 * 86400000)) * 7 * 86400000 +
  4 * 86400000;
export const playerLevel = (xp: number) =>
  Math.floor(Math.sqrt(Math.max(0, xp) / 100));
export async function memberActivity(
  ctx: MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
) {
  const row = await ctx.db
    .query("serverActivity")
    .withIndex("by_server_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (row) return row;
  const id = await ctx.db.insert("serverActivity", {
    serverId,
    userId,
    active: true,
    xp: 0,
    totalMessages: 0,
    weeklyMessages: 0,
    weekStart: weekStart(),
    invites: 0,
    lastXpAt: 0,
  });
  return (await ctx.db.get(id))!;
}
export async function recordMessage(
  ctx: MutationCtx,
  message: Doc<"messages">,
) {
  if (message.containerType !== "channel") return;
  const user = await ctx.db.get(message.authorId);
  if (!user || user.deletedAt || user.botApplicationId) return;
  const channelId = ctx.db.normalizeId("channels", message.containerId),
    channel = channelId ? await ctx.db.get(channelId) : null;
  if (!channel) return;
  const now = Date.now(),
    week = weekStart(now),
    row = await memberActivity(ctx, channel.serverId, user._id);
  const eligible = row.lastXpAt === 0 || now - row.lastXpAt >= 60000;
  await ctx.db.patch(row._id, {
    active: true,
    totalMessages: row.totalMessages + 1,
    weeklyMessages: (row.weekStart === week ? row.weeklyMessages : 0) + 1,
    weekStart: week,
    xp: row.xp + (eligible ? 10 : 0),
    lastXpAt: eligible ? now : row.lastXpAt,
  });
  const global = await ctx.db
    .query("playerLevels")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  if (global) {
    const eligible = global.lastXpAt === 0 || now - global.lastXpAt >= 60000;
    await ctx.db.patch(global._id, {
      active: true,
      xp: global.xp + (eligible ? 10 : 0),
      lastXpAt: eligible ? now : global.lastXpAt,
    });
  } else
    await ctx.db.insert("playerLevels", {
      userId: user._id,
      active: true,
      xp: 10,
      lastXpAt: now,
    });
}
export async function creditInvite(
  ctx: MutationCtx,
  serverId: Id<"servers">,
  inviteeId: Id<"users">,
  inviterId: Id<"users">,
) {
  if (inviteeId === inviterId) return;
  const prior = await ctx.db
    .query("serverInviteCredits")
    .withIndex("by_server_invitee", (q) =>
      q.eq("serverId", serverId).eq("inviteeId", inviteeId),
    )
    .unique();
  if (prior) return;
  const inviter = await ctx.db.get(inviterId),
    invitee = await ctx.db.get(inviteeId);
  if (
    !inviter ||
    inviter.deletedAt ||
    inviter.botApplicationId ||
    !invitee ||
    invitee.botApplicationId
  )
    return;
  await ctx.db.insert("serverInviteCredits", {
    serverId,
    inviteeId,
    inviterId,
    createdAt: Date.now(),
  });
  const row = await memberActivity(ctx, serverId, inviterId);
  const member = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_user", (q) =>
      q.eq("serverId", serverId).eq("userId", inviterId),
    )
    .unique();
  await ctx.db.patch(row._id, { invites: row.invites + 1, active: !!member });
}
