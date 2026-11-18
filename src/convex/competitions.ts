import { v } from "convex/values";
import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { query, mutation } from "./functions";
import {
  requireUser,
  requireActiveUser,
  requireServerAccess,
  restrictionLevel,
  isBlockedBetween,
  logAudit,
  notify,
} from "./lib";
import { text, futureTime, timezone, revision } from "./advancedValidation";
import { PERMISSIONS } from "../lib/permissions";
import { makeBracket, advanceBracket } from "../lib/tournament";
import type { Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";
async function access(ctx: Ctx, serverId: Id<"servers">, write = false) {
  const { id } = write ? await requireActiveUser(ctx) : await requireUser(ctx);
  const result = await requireServerAccess(ctx, serverId, id);
  const manager = result.permissions.includes(PERMISSIONS.MANAGE_SERVER);
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
  return { ...result, id, manager };
}
export const clans = query({
  args: { serverId: v.id("servers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id, manager } = await access(ctx, args.serverId);
    const page = await ctx.db
      .query("gamingClans")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const clan of page.page) {
      if (await isBlockedBetween(ctx, id, clan.userId)) continue;
      const member = await ctx.db
        .query("clanMemberships")
        .withIndex("by_clan_user", (q) =>
          q.eq("clanId", clan._id).eq("userId", id),
        )
        .unique();
      rows.push({
        ...clan,
        joined: member?.accepted ?? false,
        pending: !!member && !member.accepted,
        isLeader: clan.userId === id,
        canManage: manager || clan.userId === id,
      });
    }
    return { ...page, page: rows };
  },
});
export const createClan = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    tag: v.string(),
    game: v.string(),
    description: v.string(),
    approvalRequired: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { id } = await access(ctx, args.serverId, true);
    const owned = await ctx.db
      .query("gamingClans")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .take(10);
    if (owned.length >= 10) throw new Error("You can lead up to ten clans.");
    const tag = text(args.tag, "Clan tag", 12).toUpperCase();
    if (!/^[A-Z0-9_-]{2,12}$/.test(tag))
      throw new Error(
        "Use a 2–12 character tag with letters, numbers, underscores or hyphens.",
      );
    if (
      await ctx.db
        .query("gamingClans")
        .withIndex("by_server_tag", (q) =>
          q.eq("serverId", args.serverId).eq("tag", tag),
        )
        .unique()
    )
      throw new Error("That clan tag is already used in this community.");
    const clanId = await ctx.db.insert("gamingClans", {
      ...args,
      name: text(args.name, "Clan name", 80),
      game: text(args.game, "Game", 80),
      description: text(args.description, "Description", 4000, true),
      tag,
      userId: id,
      memberCount: 1,
      createdAt: Date.now(),
    });
    await ctx.db.insert("clanMemberships", {
      clanId,
      userId: id,
      accepted: true,
      createdAt: Date.now(),
    });
    return clanId;
  },
});
export const joinClan = mutation({
  args: { clanId: v.id("gamingClans"), join: v.boolean() },
  handler: async (ctx, args) => {
    const clan = await ctx.db.get(args.clanId);
    if (!clan) throw new Error("Clan not found.");
    const { id } = await access(ctx, clan.serverId, true);
    if (await isBlockedBetween(ctx, id, clan.userId))
      throw new Error("Clan is unavailable.");
    if (clan.userId === id)
      throw new Error("The leader must disband the clan rather than leave it.");
    const member = await ctx.db
      .query("clanMemberships")
      .withIndex("by_clan_user", (q) =>
        q.eq("clanId", clan._id).eq("userId", id),
      )
      .unique();
    if (!args.join) {
      if (member) {
        await ctx.db.delete(member._id);
        if (member.accepted)
          await ctx.db.patch(clan._id, {
            memberCount: Math.max(1, clan.memberCount - 1),
          });
      }
      return;
    }
    if (member) return;
    if (clan.memberCount >= 100) throw new Error("This clan is full.");
    if (
      (
        await ctx.db
          .query("clanMemberships")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .take(20)
      ).length >= 20
    )
      throw new Error("You can join or request up to 20 clans.");
    if (
      (
        await ctx.db
          .query("clanMemberships")
          .withIndex("by_clan", (q) => q.eq("clanId", clan._id))
          .take(200)
      ).length >= 200
    )
      throw new Error("This clan has too many pending requests.");
    await ctx.db.insert("clanMemberships", {
      clanId: clan._id,
      userId: id,
      accepted: !clan.approvalRequired,
      createdAt: Date.now(),
    });
    if (!clan.approvalRequired)
      await ctx.db.patch(clan._id, { memberCount: clan.memberCount + 1 });
  },
});
export const clanMembers = query({
  args: { clanId: v.id("gamingClans") },
  handler: async (ctx, args) => {
    const clan = await ctx.db.get(args.clanId);
    if (!clan) throw new Error("Clan not found.");
    const { id, manager } = await access(ctx, clan.serverId);
    if (await isBlockedBetween(ctx, id, clan.userId))
      throw new Error("Clan is unavailable.");
    const rows = await ctx.db
      .query("clanMemberships")
      .withIndex("by_clan", (q) => q.eq("clanId", clan._id))
      .take(200);
    const members = [];
    for (const row of rows) {
      if (!row.accepted && !manager && clan.userId !== id && row.userId !== id)
        continue;
      const user = await ctx.db.get(row.userId);
      if (
        !user ||
        user.deletedAt ||
        (await isBlockedBetween(ctx, id, row.userId))
      )
        continue;
      try {
        await requireServerAccess(ctx, clan.serverId, row.userId);
      } catch {
        continue;
      }
      members.push({
        id: row.userId,
        name: user.name ?? user.username ?? "Member",
        accepted: row.accepted,
      });
    }
    return members;
  },
});
export const reviewClanMember = mutation({
  args: {
    clanId: v.id("gamingClans"),
    userId: v.id("users"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const clan = await ctx.db.get(args.clanId);
    if (!clan) throw new Error("Clan not found.");
    const { id, manager } = await access(ctx, clan.serverId, true);
    if (!manager && clan.userId !== id)
      throw new Error("Clan leader or community manager access is required.");
    if (clan.userId === args.userId)
      throw new Error("The clan leader cannot be removed.");
    const member = await ctx.db
      .query("clanMemberships")
      .withIndex("by_clan_user", (q) =>
        q.eq("clanId", clan._id).eq("userId", args.userId),
      )
      .unique();
    if (!member) throw new Error("Membership request not found.");
    if (args.accept) {
      if (member.accepted) return;
      await requireServerAccess(ctx, clan.serverId, args.userId);
      const user = await ctx.db.get(args.userId);
      if (
        !user ||
        user.deletedAt ||
        user.frozenAt !== undefined ||
        (await isBlockedBetween(ctx, args.userId, clan.userId))
      )
        throw new Error("This member is unavailable.");
      if (clan.memberCount >= 100) throw new Error("This clan is full.");
      await ctx.db.patch(member._id, { accepted: true });
      await ctx.db.patch(clan._id, { memberCount: clan.memberCount + 1 });
      await notify(ctx, {
        userId: args.userId,
        actorId: id,
        type: "system",
        title: "Clan request accepted",
        body: clan.name,
        link: `/dashboard/s/${clan.serverId}/competitions`,
      });
    } else {
      await ctx.db.delete(member._id);
      if (member.accepted)
        await ctx.db.patch(clan._id, {
          memberCount: Math.max(1, clan.memberCount - 1),
        });
    }
    await logAudit(ctx, {
      serverId: clan.serverId,
      actorId: id,
      action: "clan.membership_review",
      targetId: args.userId,
      details: `${clan.tag}:${args.accept}`,
    });
  },
});
export const disbandClan = mutation({
  args: { clanId: v.id("gamingClans") },
  handler: async (ctx, args) => {
    const clan = await ctx.db.get(args.clanId);
    if (!clan) return;
    const { id, manager } = await access(ctx, clan.serverId, true);
    if (!manager && id !== clan.userId)
      throw new Error("Clan leader or community manager access is required.");
    await ctx.db.delete(clan._id);
    await ctx.scheduler.runAfter(
      0,
      makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
      { kind: "clan", id: clan._id },
    );
  },
});
export const tournaments = query({
  args: { serverId: v.id("servers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id, manager } = await access(ctx, args.serverId);
    const page = await ctx.db
      .query("gamingTournaments")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const row of page.page) {
      if (await isBlockedBetween(ctx, id, row.userId)) continue;
      const registration = await ctx.db
        .query("tournamentRegistrations")
        .withIndex("by_tournament_user", (q) =>
          q.eq("tournamentId", row._id).eq("userId", id),
        )
        .unique();
      rows.push({
        ...row,
        matches: undefined,
        entrants: undefined,
        joined: !!registration,
        canManage: manager || row.userId === id,
      });
    }
    return { ...page, page: rows };
  },
});
export const createTournament = mutation({
  args: {
    serverId: v.id("servers"),
    title: v.string(),
    game: v.string(),
    description: v.string(),
    capacity: v.number(),
    startsAt: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const { id } = await access(ctx, args.serverId, true);
    if (
      !Number.isInteger(args.capacity) ||
      args.capacity < 2 ||
      args.capacity > 64
    )
      throw new Error("Choose a capacity between 2 and 64.");
    futureTime(args.startsAt, "Tournament start", 60_000);
    timezone(args.timezone);
    const own = await ctx.db
      .query("gamingTournaments")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .take(100);
    if (
      own.filter((t) => t.status === "registration" || t.status === "active")
        .length >= 20
    )
      throw new Error("You can host up to 20 open tournaments.");
    return ctx.db.insert("gamingTournaments", {
      ...args,
      title: text(args.title, "Title", 120),
      game: text(args.game, "Game", 80),
      description: text(args.description, "Description", 4000, true),
      userId: id,
      status: "registration",
      entrantCount: 0,
      entrants: [],
      matches: [],
      revision: 1,
      createdAt: Date.now(),
    });
  },
});
export const register = mutation({
  args: { tournamentId: v.id("gamingTournaments"), join: v.boolean() },
  handler: async (ctx, args) => {
    const tournament = await ctx.db.get(args.tournamentId);
    if (!tournament) throw new Error("Tournament not found.");
    const { id } = await access(ctx, tournament.serverId, true);
    if (await isBlockedBetween(ctx, id, tournament.userId))
      throw new Error("Tournament is unavailable.");
    if (
      tournament.status !== "registration" ||
      Date.now() >= tournament.startsAt
    )
      throw new Error("Registration has closed.");
    const row = await ctx.db
      .query("tournamentRegistrations")
      .withIndex("by_tournament_user", (q) =>
        q.eq("tournamentId", tournament._id).eq("userId", id),
      )
      .unique();
    if (args.join) {
      if (row) return;
      if (tournament.entrantCount >= tournament.capacity)
        throw new Error("This tournament is full.");
      await ctx.db.insert("tournamentRegistrations", {
        tournamentId: tournament._id,
        userId: id,
        createdAt: Date.now(),
      });
    } else {
      if (!row) return;
      await ctx.db.delete(row._id);
    }
    await ctx.db.patch(tournament._id, {
      entrantCount: tournament.entrantCount + (args.join ? 1 : -1),
      revision: tournament.revision + 1,
    });
  },
});
export const tournament = query({
  args: { tournamentId: v.id("gamingTournaments") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tournamentId);
    if (!row) throw new Error("Tournament not found.");
    const { id, manager } = await access(ctx, row.serverId);
    if (await isBlockedBetween(ctx, id, row.userId))
      throw new Error("Tournament is unavailable.");
    const regs = await ctx.db
      .query("tournamentRegistrations")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", row._id))
      .take(64);
    const names: Record<string, string> = {};
    for (const userId of new Set([
      ...row.entrants,
      ...regs.map((r) => r.userId),
    ])) {
      const user = await ctx.db.get(userId);
      names[userId] =
        user && !user.deletedAt && !(await isBlockedBetween(ctx, id, userId))
          ? (user.name ?? user.username ?? "Member")
          : "Unavailable member";
    }
    return {
      ...row,
      names,
      registrations: regs.map((r) => r.userId),
      canManage: manager || row.userId === id,
    };
  },
});
export const start = mutation({
  args: {
    tournamentId: v.id("gamingTournaments"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tournamentId);
    if (!row) throw new Error("Tournament not found.");
    const { id, manager } = await access(ctx, row.serverId, true);
    if (!manager && id !== row.userId)
      throw new Error(
        "Tournament host or community manager access is required.",
      );
    revision(row.revision, args.expectedRevision);
    if (row.status !== "registration")
      throw new Error("This tournament has already started or closed.");
    if (Date.now() < row.startsAt)
      throw new Error("Wait until the scheduled start time.");
    const regs = await ctx.db
      .query("tournamentRegistrations")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", row._id))
      .take(64);
    const entrants: Id<"users">[] = [];
    for (const reg of regs) {
      try {
        await requireServerAccess(ctx, row.serverId, reg.userId);
        const user = await ctx.db.get(reg.userId);
        if (
          !user ||
          user.deletedAt ||
          user.frozenAt !== undefined ||
          (await isBlockedBetween(ctx, reg.userId, row.userId))
        )
          continue;
        entrants.push(reg.userId);
      } catch {
        /* Removed members are excluded at start. */
      }
    }
    const matches = makeBracket(entrants);
    await ctx.db.patch(row._id, {
      entrants,
      matches,
      entrantCount: entrants.length,
      status: "active",
      revision: row.revision + 1,
    });
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "tournament.start",
      targetId: row._id,
      details: row.title,
    });
  },
});
export const result = mutation({
  args: {
    tournamentId: v.id("gamingTournaments"),
    round: v.number(),
    slot: v.number(),
    scoreA: v.number(),
    scoreB: v.number(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tournamentId);
    if (!row) throw new Error("Tournament not found.");
    const { id, manager } = await access(ctx, row.serverId, true);
    if (!manager && id !== row.userId)
      throw new Error(
        "Tournament host or community manager access is required.",
      );
    revision(row.revision, args.expectedRevision);
    if (row.status !== "active")
      throw new Error("This tournament is not active.");
    if (
      [args.scoreA, args.scoreB].some(
        (n) => !Number.isInteger(n) || n < 0 || n > 100000,
      ) ||
      args.scoreA === args.scoreB
    )
      throw new Error(
        "Choose non-negative whole scores and a decisive result.",
      );
    const index = row.matches.findIndex(
      (m) => m.round === args.round && m.slot === args.slot,
    );
    const match = row.matches[index];
    if (!match || match.state !== "ready" || !match.a || !match.b)
      throw new Error("This match is not ready for a result.");
    const matches = row.matches.map((m, i) =>
      i === index
        ? {
            ...m,
            state: "complete" as const,
            winner: args.scoreA > args.scoreB ? m.a : m.b,
            scoreA: args.scoreA,
            scoreB: args.scoreB,
          }
        : m,
    );
    const advanced = advanceBracket(matches);
    const final = advanced[advanced.length - 1];
    const completed = final.state === "complete";
    const winnerId = completed ? (final.winner as Id<"users">) : undefined;
    await ctx.db.patch(row._id, {
      matches: advanced,
      status: completed ? "completed" : "active",
      winnerId,
      revision: row.revision + 1,
    });
    if (completed)
      for (const entrant of row.entrants) {
        const user = await ctx.db.get(entrant);
        if (!user || user.deletedAt) continue;
        const stats = await ctx.db
          .query("competitionStats")
          .withIndex("by_server_user_game", (q) =>
            q
              .eq("serverId", row.serverId)
              .eq("userId", entrant)
              .eq("game", row.game),
          )
          .unique();
        const values = {
          tournaments: (stats?.tournaments ?? 0) + 1,
          wins: (stats?.wins ?? 0) + (entrant === winnerId ? 1 : 0),
          updatedAt: Date.now(),
        };
        if (stats) await ctx.db.patch(stats._id, values);
        else
          await ctx.db.insert("competitionStats", {
            serverId: row.serverId,
            userId: entrant,
            game: row.game,
            ...values,
          });
      }
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "tournament.result",
      targetId: row._id,
      details: `Round ${args.round}, match ${args.slot + 1}: ${args.scoreA}-${args.scoreB}`,
    });
  },
});
export const cancel = mutation({
  args: {
    tournamentId: v.id("gamingTournaments"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tournamentId);
    if (!row) throw new Error("Tournament not found.");
    const { id, manager } = await access(ctx, row.serverId, true);
    if (!manager && id !== row.userId)
      throw new Error(
        "Tournament host or community manager access is required.",
      );
    revision(row.revision, args.expectedRevision);
    if (row.status !== "registration" && row.status !== "active")
      throw new Error("This tournament has already closed.");
    await ctx.db.patch(row._id, {
      status: "cancelled",
      revision: row.revision + 1,
    });
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "tournament.cancel",
      targetId: row._id,
      details: row.title,
    });
  },
});
export const leaderboard = query({
  args: {
    serverId: v.id("servers"),
    game: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await access(ctx, args.serverId);
    const page = await ctx.db
      .query("competitionStats")
      .withIndex("by_server_game_wins", (q) =>
        q.eq("serverId", args.serverId).eq("game", text(args.game, "Game", 80)),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(25, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const row of page.page) {
      const user = await ctx.db.get(row.userId);
      const member = await ctx.db
        .query("serverMembers")
        .withIndex("by_server_user", (q) =>
          q.eq("serverId", args.serverId).eq("userId", row.userId),
        )
        .unique();
      if (
        !user ||
        user.deletedAt ||
        !member ||
        (await isBlockedBetween(ctx, id, row.userId))
      )
        continue;
      rows.push({ ...row, name: user.name ?? user.username ?? "Member" });
    }
    return { ...page, page: rows };
  },
});
