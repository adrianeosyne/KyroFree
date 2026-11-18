import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./functions";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
export const cleanupOwnedApps = internalMutation({
  args: { userId: v.id("users"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user && user.deletedAt === undefined) return;
    const page = await ctx.db
      .query("botApplications")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .paginate({ numItems: 25, cursor: args.cursor });
    for (const app of page.page) {
      await ctx.db.patch(app._id, {
        deletedAt: app.deletedAt ?? Date.now(),
        enabled: false,
        discoverable: false,
        tokenHash: undefined,
      });
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
        { kind: "app", id: app._id },
      );
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">(
          "expansionLifecycle:cleanupOwnedApps",
        ),
        { ...args, cursor: page.continueCursor },
      );
  },
});
/** Removed members release clan and unstarted tournament seats in bounded batches. */
export const cleanupMember = internalMutation({
  args: {
    serverId: v.id("servers"),
    userId: v.id("users"),
    stage: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.userId),
      )
      .unique();
    if (membership) return;
    const tables = [
      "clanMemberships",
      "tournamentRegistrations",
      "gamingClans",
    ] as const;
    const table = tables[args.stage];
    if (!table) return;
    const page = await ctx.db
      .query(table)
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .paginate({ numItems: 25, cursor: args.cursor });
    for (const row of page.page) {
      if ("clanId" in row) {
        const clan = await ctx.db.get(row.clanId);
        if (clan && clan.serverId !== args.serverId) continue;
        if (clan && row.accepted && clan.userId !== args.userId)
          await ctx.db.patch(clan._id, {
            memberCount: Math.max(1, clan.memberCount - 1),
          });
        await ctx.db.delete(row._id);
      } else if ("tournamentId" in row) {
        const tournament = await ctx.db.get(row.tournamentId);
        if (
          tournament &&
          (tournament.serverId !== args.serverId ||
            tournament.status !== "registration")
        )
          continue;
        if (tournament)
          await ctx.db.patch(tournament._id, {
            entrantCount: Math.max(0, tournament.entrantCount - 1),
            revision: tournament.revision + 1,
          });
        await ctx.db.delete(row._id);
      } else if (row.serverId === args.serverId) {
        await ctx.db.delete(row._id);
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
          { kind: "clan", id: row._id },
        );
      }
    }
    const worker = makeFunctionReference<"mutation">(
      "expansionLifecycle:cleanupMember",
    );
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, worker, {
        ...args,
        cursor: page.continueCursor,
      });
    else if (args.stage < 2)
      await ctx.scheduler.runAfter(0, worker, {
        ...args,
        stage: args.stage + 1,
        cursor: null,
      });
  },
});
export const cleanup = internalMutation({
  args: {
    kind: v.union(
      v.literal("user"),
      v.literal("server"),
      v.literal("clan"),
      v.literal("tournament"),
      v.literal("app"),
    ),
    id: v.string(),
    stage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stage = args.stage ?? 0;
    if (args.kind === "user" && stage === 0)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">(
          "expansionLifecycle:cleanupOwnedApps",
        ),
        { userId: args.id as Id<"users">, cursor: null },
      );
    let rows: Doc<TableNames>[] = [];
    let stages = 1;
    if (args.kind === "clan")
      rows = await ctx.db
        .query("clanMemberships")
        .withIndex("by_clan", (q) =>
          q.eq("clanId", args.id as Id<"gamingClans">),
        )
        .take(50);
    if (args.kind === "tournament")
      rows = await ctx.db
        .query("tournamentRegistrations")
        .withIndex("by_tournament", (q) =>
          q.eq("tournamentId", args.id as Id<"gamingTournaments">),
        )
        .take(50);
    if (args.kind === "server") {
      stages = 3;
      const table = (
        ["gamingClans", "gamingTournaments", "competitionStats"] as const
      )[stage];
      if (table)
        rows = await ctx.db
          .query(table)
          .withIndex("by_server", (q) =>
            q.eq("serverId", args.id as Id<"servers">),
          )
          .take(50);
    }
    if (args.kind === "app") {
      stages = 2;
      const table = (["appCollaborators", "appReleases"] as const)[stage];
      if (table)
        rows = await ctx.db
          .query(table)
          .withIndex("by_app", (q) =>
            q.eq("applicationId", args.id as Id<"botApplications">),
          )
          .take(50);
    }
    if (args.kind === "user") {
      stages = 7;
      const table = (
        [
          "clanMemberships",
          "gamingClans",
          "tournamentRegistrations",
          "gamingTournaments",
          "competitionStats",
          "appCollaborators",
          "appReleases",
        ] as const
      )[stage];
      if (table)
        rows = await ctx.db
          .query(table)
          .withIndex("by_user", (q) => q.eq("userId", args.id as Id<"users">))
          .take(50);
    }
    for (const row of rows) {
      if ("changelog" in row && "applicationId" in row) {
        const app = await ctx.db.get(row.applicationId);
        if (app?.activeReleaseId === row._id)
          await ctx.db.patch(app._id, { activeReleaseId: undefined });
      }
      if ("clanId" in row && "accepted" in row && row.accepted) {
        const clan = await ctx.db.get(row.clanId);
        if (clan)
          await ctx.db.patch(clan._id, {
            memberCount: Math.max(1, clan.memberCount - 1),
          });
      }
      if ("tournamentId" in row && args.kind === "user") {
        const tournament = await ctx.db.get(row.tournamentId);
        if (tournament && tournament.status === "registration")
          await ctx.db.patch(tournament._id, {
            entrantCount: Math.max(0, tournament.entrantCount - 1),
            revision: tournament.revision + 1,
          });
      }
      if ("tag" in row && "approvalRequired" in row)
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
          { kind: "clan", id: row._id },
        );
      if ("matches" in row && "entrants" in row)
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
          { kind: "tournament", id: row._id },
        );
      await ctx.db.delete(row._id);
    }
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
        { ...args, stage },
      );
    else if (stage + 1 < stages)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("expansionLifecycle:cleanup"),
        { ...args, stage: stage + 1 },
      );
  },
});
