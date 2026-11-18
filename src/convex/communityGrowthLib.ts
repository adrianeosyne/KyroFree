import {
  requireUser,
  requireActiveUser,
  requireServerAccess,
  restrictionLevel,
  type Ctx,
} from "./lib";
import { PERMISSIONS } from "../lib/permissions";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./functions";
import { makeFunctionReference } from "convex/server";
export async function queueConfigurationCapture(
  ctx: MutationCtx,
  serverId: Id<"servers">,
) {
  if (
    await ctx.db
      .query("communityBackupJobs")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .unique()
  )
    return;
  const jobId = await ctx.scheduler.runAfter(
    0,
    makeFunctionReference<"mutation">("communityBackups:captureChange"),
    { serverId },
  );
  await ctx.db.insert("communityBackupJobs", { serverId, jobId });
}
export const DAY = 86400000;
export async function growthAccess(
  ctx: Ctx,
  serverId: Id<"servers">,
  write = false,
  management = false,
) {
  const { id, user } = write
    ? await requireActiveUser(ctx)
    : await requireUser(ctx);
  const result = await requireServerAccess(ctx, serverId, id);
  const manager = result.permissions.includes(PERMISSIONS.MANAGE_SERVER);
  if (management && !manager)
    throw new Error("Manage Community permission is required.");
  if (
    write &&
    ((await restrictionLevel(ctx, id)) >= 2 ||
      !result.permissions.includes(PERMISSIONS.SEND_MESSAGES) ||
      (result.member.communicationDisabledUntil ?? 0) > Date.now() ||
      (!manager &&
        result.server.locked &&
        (!result.server.lockedUntil || result.server.lockedUntil > Date.now())))
  )
    throw new Error("You cannot contribute to this community right now.");
  return { ...result, id, user, manager };
}
export async function currentMetric(
  ctx: Ctx,
  serverId: Id<"servers">,
  userId: Id<"users">,
  metric: "messages" | "xp" | "invites",
) {
  const activity = await ctx.db
    .query("serverActivity")
    .withIndex("by_server_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  return metric === "messages"
    ? (activity?.totalMessages ?? 0)
    : metric === "xp"
      ? (activity?.xp ?? 0)
      : (activity?.invites ?? 0);
}
async function daily(ctx: MutationCtx, serverId: Id<"servers">, day: number) {
  const row = await ctx.db
    .query("communityDailyStats")
    .withIndex("by_server_day", (q) =>
      q.eq("serverId", serverId).eq("day", day),
    )
    .unique();
  if (row) return row;
  const id = await ctx.db.insert("communityDailyStats", {
    serverId,
    day,
    messages: 0,
    joins: 0,
    leaves: 0,
    activeMembers: 0,
    retainedFromYesterday: 0,
  });
  return (await ctx.db.get(id))!;
}
export async function recordCommunityMessage(
  ctx: MutationCtx,
  message: Doc<"messages">,
) {
  if (message.containerType !== "channel") return;
  const user = await ctx.db.get(message.authorId),
    channelId = ctx.db.normalizeId("channels", message.containerId),
    channel = channelId && (await ctx.db.get(channelId));
  if (
    !channel ||
    !user ||
    user.botApplicationId ||
    user.deletedAt !== undefined
  )
    return;
  const day = Math.floor(Date.now() / DAY) * DAY,
    row = await daily(ctx, channel.serverId, day);
  const state = await ctx.db
    .query("communityActivityState")
    .withIndex("by_server_user", (q) =>
      q.eq("serverId", channel.serverId).eq("userId", user._id),
    )
    .unique();
  const newActive = !state || state.lastActiveDay !== day;
  await ctx.db.patch(row._id, {
    messages: row.messages + 1,
    activeMembers: row.activeMembers + (newActive ? 1 : 0),
    retainedFromYesterday:
      row.retainedFromYesterday +
      (newActive && state?.lastActiveDay === day - DAY ? 1 : 0),
  });
  if (newActive) {
    if (state) await ctx.db.patch(state._id, { lastActiveDay: day });
    else
      await ctx.db.insert("communityActivityState", {
        serverId: channel.serverId,
        userId: user._id,
        lastActiveDay: day,
      });
  }
}
export async function recordCommunityMembership(
  ctx: MutationCtx,
  member: Doc<"serverMembers">,
  joining: boolean,
) {
  const user = await ctx.db.get(member.userId),
    server = await ctx.db.get(member.serverId);
  if (!server || !user || user.botApplicationId || user.deletedAt !== undefined)
    return;
  const row = await daily(
    ctx,
    member.serverId,
    Math.floor(Date.now() / DAY) * DAY,
  );
  await ctx.db.patch(
    row._id,
    joining ? { joins: row.joins + 1 } : { leaves: row.leaves + 1 },
  );
}
