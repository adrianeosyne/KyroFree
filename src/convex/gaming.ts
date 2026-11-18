import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./functions";
import {
  requireProfile,
  requireUser,
  requireServerAccess,
  isBlockedBetween,
  visiblePresence,
  hydrateUsers,
  restrictionLevel,
} from "./lib";
import { text, futureTime, timezone } from "./advancedValidation";
import { PERMISSIONS } from "../lib/permissions";
import type { Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";

function invite(value?: string) {
  if (!value?.trim()) return undefined;
  if (value.length > 1000) throw new Error("Invitation link is too long.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Use a valid HTTPS game invitation link.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use a valid HTTPS game invitation link.");
  return url.href;
}
async function communityAccess(
  ctx: Ctx,
  userId: Id<"users">,
  serverId: Id<"servers">,
  write = false,
) {
  const access = await requireServerAccess(ctx, serverId, userId);
  if (
    write &&
    ((await restrictionLevel(ctx, userId)) >= 2 ||
      !access.permissions.includes(PERMISSIONS.SEND_MESSAGES) ||
      (access.member.communicationDisabledUntil ?? 0) > Date.now() ||
      (access.server.locked &&
        (!access.server.lockedUntil ||
          access.server.lockedUntil > Date.now()) &&
        !access.permissions.includes(PERMISSIONS.MANAGE_SERVER)))
  )
    throw new Error("You cannot organize a party in this community right now.");
  return access;
}
export const activity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { id } = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (
      !user ||
      user.deletedAt ||
      (id !== userId &&
        ((await isBlockedBetween(ctx, id, userId)) ||
          visiblePresence(user, false) === "offline"))
    )
      return null;
    const activity = await ctx.db
      .query("gameActivities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return activity &&
      activity.expiresAt > Date.now() &&
      (activity.visible || id === userId)
      ? activity
      : null;
  },
});
export const setActivity = mutation({
  args: {
    game: v.string(),
    details: v.string(),
    visible: v.boolean(),
    inviteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id: userId } = await requireProfile(ctx);
    const game = text(args.game, "Game name", 80);
    const current = await ctx.db
      .query("gameActivities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const values = {
      game,
      details: text(args.details, "Game status", 160, true),
      visible: args.visible,
      inviteUrl: invite(args.inviteUrl),
      startedAt: current?.game === game ? current.startedAt : Date.now(),
      expiresAt: Date.now() + 4 * 3600_000,
    };
    const id = current
      ? (await ctx.db.patch(current._id, values), current._id)
      : await ctx.db.insert("gameActivities", { userId, ...values });
    await ctx.scheduler.runAt(
      values.expiresAt,
      makeFunctionReference<"mutation">("gaming:expireActivity"),
      { id },
    );
    return id;
  },
});
export const clearActivity = mutation({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireProfile(ctx);
    const row = await ctx.db
      .query("gameActivities")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});
export const expireActivity = internalMutation({
  args: { id: v.id("gameActivities") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row && row.expiresAt <= Date.now()) await ctx.db.delete(row._id);
  },
});
export const parties = query({
  args: {
    serverId: v.id("servers"),
    game: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const access = await communityAccess(ctx, id, args.serverId);
    const page = await ctx.db
      .query("partyPosts")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .filter((q) => (args.game ? q.eq(q.field("game"), args.game) : true))
      .order("desc")
      .paginate(args.paginationOpts);
    const allowed = (
      await Promise.all(
        page.page.map(async (row) =>
          (await isBlockedBetween(ctx, id, row.hostId)) ? null : row,
        ),
      )
    ).filter((row): row is NonNullable<typeof row> => !!row);
    const hosts = await hydrateUsers(
      ctx,
      allowed.map((row) => row.hostId),
      id,
    );
    return {
      ...page,
      page: await Promise.all(
        allowed.map(async (row) => ({
          ...row,
          host: hosts.get(row.hostId) ?? null,
          mine: row.hostId === id,
          canManage:
            row.hostId === id ||
            access.permissions.includes(PERMISSIONS.MANAGE_SERVER),
          joined: !!(await ctx.db
            .query("partyMembers")
            .withIndex("by_party_user", (q) =>
              q.eq("partyId", row._id).eq("userId", id),
            )
            .unique()),
        })),
      ),
    };
  },
});
export const createParty = mutation({
  args: {
    serverId: v.id("servers"),
    game: v.string(),
    title: v.string(),
    description: v.string(),
    region: v.string(),
    language: v.string(),
    capacity: v.number(),
    startsAt: v.number(),
    timezone: v.string(),
    inviteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id: hostId } = await requireProfile(ctx);
    await communityAccess(ctx, hostId, args.serverId, true);
    if (
      !Number.isSafeInteger(args.capacity) ||
      args.capacity < 2 ||
      args.capacity > 50
    )
      throw new Error("Choose a party size between 2 and 50.");
    const own = await ctx.db
      .query("partyPosts")
      .withIndex("by_host", (q) => q.eq("hostId", hostId))
      .filter((q) => q.eq(q.field("status"), "open"))
      .take(20);
    if (own.length >= 20)
      throw new Error("You can host up to 20 open parties.");
    const id = await ctx.db.insert("partyPosts", {
      ...args,
      hostId,
      game: text(args.game, "Game", 80),
      title: text(args.title, "Party title", 120),
      description: text(args.description, "Description", 4000, true),
      region: text(args.region, "Region", 40),
      language: text(args.language, "Language", 40),
      capacity: args.capacity,
      memberCount: 1,
      startsAt: futureTime(args.startsAt, "Party time"),
      timezone: timezone(args.timezone),
      inviteUrl: invite(args.inviteUrl),
      status: "open",
      createdAt: Date.now(),
    });
    await ctx.db.insert("partyMembers", {
      partyId: id,
      userId: hostId,
      joinedAt: Date.now(),
    });
    await ctx.scheduler.runAt(
      args.startsAt + 3600_000,
      makeFunctionReference<"mutation">("gaming:closeParty"),
      { id },
    );
    return id;
  },
});
export const joinParty = mutation({
  args: { id: v.id("partyPosts"), join: v.boolean() },
  handler: async (ctx, args) => {
    const { id: userId } = await requireProfile(ctx);
    const party = await ctx.db.get(args.id);
    if (!party) throw new Error("Party not found.");
    await communityAccess(ctx, userId, party.serverId, true);
    if (await isBlockedBetween(ctx, userId, party.hostId))
      throw new Error("This party is unavailable.");
    const member = await ctx.db
      .query("partyMembers")
      .withIndex("by_party_user", (q) =>
        q.eq("partyId", party._id).eq("userId", userId),
      )
      .unique();
    if (party.hostId === userId)
      throw new Error("Hosts can cancel their party instead of leaving.");
    if (!args.join) {
      if (member) {
        await ctx.db.delete(member._id);
        await ctx.db.patch(party._id, {
          memberCount: Math.max(1, party.memberCount - 1),
        });
      }
      return;
    }
    if (member) return;
    if (party.status !== "open" || party.startsAt + 3600_000 < Date.now())
      throw new Error("Registration for this party is closed.");
    if (party.memberCount >= party.capacity)
      throw new Error("This party is full.");
    await ctx.db.insert("partyMembers", {
      partyId: party._id,
      userId,
      joinedAt: Date.now(),
    });
    await ctx.db.patch(party._id, { memberCount: party.memberCount + 1 });
  },
});
export const partyMembers = query({
  args: { id: v.id("partyPosts") },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const party = await ctx.db.get(args.id);
    if (!party) throw new Error("Party not found.");
    await communityAccess(ctx, id, party.serverId);
    if (await isBlockedBetween(ctx, id, party.hostId))
      throw new Error("This party is unavailable.");
    const members = await ctx.db
      .query("partyMembers")
      .withIndex("by_party", (q) => q.eq("partyId", party._id))
      .take(50);
    const users = await hydrateUsers(
      ctx,
      members.map((row) => row.userId),
      id,
    );
    return members
      .map((row) => users.get(row.userId))
      .filter((user): user is NonNullable<typeof user> => !!user);
  },
});
export const cancelParty = mutation({
  args: { id: v.id("partyPosts") },
  handler: async (ctx, args) => {
    const { id } = await requireProfile(ctx);
    const party = await ctx.db.get(args.id);
    if (!party) throw new Error("Party not found.");
    const access = await communityAccess(ctx, id, party.serverId, true);
    if (
      party.hostId !== id &&
      !access.permissions.includes(PERMISSIONS.MANAGE_SERVER)
    )
      throw new Error(
        "Only the host or community manager can cancel this party.",
      );
    await ctx.db.patch(party._id, {
      status: "cancelled",
      inviteUrl: undefined,
    });
  },
});
export const closeParty = internalMutation({
  args: { id: v.id("partyPosts") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row?.status === "open" && row.startsAt + 3600_000 <= Date.now())
      await ctx.db.patch(row._id, { status: "closed" });
  },
});
