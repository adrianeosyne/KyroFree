import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./functions";
import { requireUser, requireServerAccess, isBlockedBetween } from "./lib";
import { requireReadAccess } from "./messages";
import type { Doc, TableNames } from "./_generated/dataModel";

import { exportDatasets } from "../lib/dataExport";
const dataset = v.union(...exportDatasets.map((value) => v.literal(value)));

/** Owner-scoped, bounded export. Never includes credentials or scheduler IDs. */
export const personalPage = query({
  args: { dataset, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const opts = {
      ...args.paginationOpts,
      numItems: Math.min(10, args.paginationOpts.numItems),
    };
    let result: {
      page: Doc<TableNames>[];
      isDone: boolean;
      continueCursor: string;
    };
    switch (args.dataset) {
      case "following":
        result = await ctx.db
          .query("socialFollows")
          .withIndex("by_follower", (q) => q.eq("followerId", id))
          .paginate(opts);
        break;
      case "followers":
        result = await ctx.db
          .query("socialFollows")
          .withIndex("by_following", (q) => q.eq("followingId", id))
          .paginate(opts);
        break;
      case "sharedDocuments":
        result = await ctx.db
          .query("sharedDocuments")
          .withIndex("by_creator", (q) => q.eq("creatorId", id))
          .paginate(opts);
        break;
      case "communityPages":
        result = await ctx.db
          .query("communityPages")
          .withIndex("by_author", (q) => q.eq("authorId", id))
          .paginate(opts);
        break;
      case "socialPosts":
        result = await ctx.db
          .query("socialPosts")
          .withIndex("by_author", (q) => q.eq("authorId", id))
          .paginate(opts);
        break;
      case "partyPosts":
        result = await ctx.db
          .query("partyPosts")
          .withIndex("by_host", (q) => q.eq("hostId", id))
          .paginate(opts);
        break;
      case "conversationFolderItems":
        result = await ctx.db
          .query("conversationFolderItems")
          .withIndex("by_user_container", (q) => q.eq("userId", id))
          .paginate(opts);
        break;
      default:
        result = await ctx.db
          .query(args.dataset)
          .withIndex("by_user", (q) => q.eq("userId", id))
          .paginate(opts);
    }
    const page = [];
    for (const row of result.page) {
      if (["gamingClans", "gamingTournaments", "competitionStats"].includes(args.dataset) && "serverId" in row) {
        try { await requireServerAccess(ctx, row.serverId!, id); } catch { continue; }
      }
      if (args.dataset === "clanMemberships" && "clanId" in row) {
        const clan = await ctx.db.get(row.clanId);
        if (!clan) continue;
        try { await requireServerAccess(ctx, clan.serverId, id); } catch { continue; }
      }
      if (args.dataset === "tournamentRegistrations" && "tournamentId" in row) {
        const tournament = await ctx.db.get(row.tournamentId);
        if (!tournament) continue;
        try { await requireServerAccess(ctx, tournament.serverId, id); } catch { continue; }
      }
      if ((args.dataset === "appReleases" || args.dataset === "appCollaborators") && "applicationId" in row) {
        const app = row.applicationId && await ctx.db.get(row.applicationId);
        if (!app || app.deletedAt || await isBlockedBetween(ctx, id, app.ownerId)) continue;
        if (args.dataset === "appReleases" && app.ownerId !== id) {
          const grant = await ctx.db.query("appCollaborators").withIndex("by_app_user", q => q.eq("applicationId", app._id).eq("userId", id)).unique();
          if (!grant?.accepted || grant.ownerId !== app.ownerId) continue;
        }
      }
      if (
        "expiresAt" in row &&
        row.expiresAt !== undefined &&
        row.expiresAt <= Date.now()
      )
        continue;
      if (
        (args.dataset === "sharedDocuments" || args.dataset === "workTasks") &&
        "containerType" in row &&
        row.containerType &&
        "containerId" in row &&
        row.containerId
      ) {
        try {
          await requireReadAccess(ctx, id, row.containerType, row.containerId);
        } catch {
          continue;
        }
      }
      if (
        (args.dataset === "communityPages" || args.dataset === "partyPosts") &&
        "serverId" in row
      ) {
        const serverId = row.serverId;
        if (!serverId) continue;
        const membership = await ctx.db
          .query("serverMembers")
          .withIndex("by_server_user", (q) =>
            q.eq("serverId", serverId).eq("userId", id),
          )
          .unique();
        if (!membership) continue;
      }
      const clean = Object.fromEntries(
        Object.entries(row).filter(
          ([key]) => key !== "jobId" && key !== "reminderJobId",
        ),
      );
      page.push(clean);
    }
    return { ...result, page };
  },
});
