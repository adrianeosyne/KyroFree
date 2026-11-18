import { v } from "convex/values";
import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { query, mutation } from "./functions";
import {
  requireUser,
  requireActiveUser,
  requireServerAccess,
  logAudit,
  notify,
  type Ctx,
} from "./lib";
import { text, revision } from "./advancedValidation";
import { PERMISSIONS } from "../lib/permissions";
import type { Id } from "./_generated/dataModel";
const appealActions = new Set(["warning", "timeout", "kick", "ban"]);
async function reviewer(ctx: Ctx, serverId: Id<"servers">, write = false) {
  const { id } = write ? await requireActiveUser(ctx) : await requireUser(ctx),
    access = await requireServerAccess(ctx, serverId, id);
  if (
    !access.permissions.includes(PERMISSIONS.MANAGE_SERVER) &&
    !access.permissions.includes(PERMISSIONS.BAN_MEMBERS)
  )
    throw new Error("Moderation appeal review permission is required.");
  return { ...access, id };
}
export const cases = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const page = await ctx.db
      .query("moderationCases")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const row of page.page) {
      if (!appealActions.has(row.action)) continue;
      const server = await ctx.db.get(row.serverId);
      if (!server) continue;
      const appeal = await ctx.db
        .query("moderationAppeals")
        .withIndex("by_case", (q) => q.eq("caseId", row._id))
        .unique();
      rows.push({
        _id: row._id,
        action: row.action,
        reason: row.reason,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        resolvedAt: row.resolvedAt,
        communityName: server.name,
        appeal,
        canAppeal: !appeal && row.resolvedAt === undefined,
      });
    }
    return { ...page, page: rows };
  },
});
export const submit = mutation({
  args: { caseId: v.id("moderationCases"), statement: v.string() },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx),
      row = await ctx.db.get(args.caseId);
    if (
      !row ||
      row.userId !== id ||
      user.botApplicationId ||
      !appealActions.has(row.action) ||
      row.resolvedAt !== undefined ||
      !(await ctx.db.get(row.serverId))
    )
      throw new Error("This moderation case is unavailable for appeal.");
    const statement = text(args.statement, "Appeal statement", 4000);
    if (statement.length < 20)
      throw new Error("Explain the appeal in at least 20 characters.");
    if (
      await ctx.db
        .query("moderationAppeals")
        .withIndex("by_case", (q) => q.eq("caseId", row._id))
        .unique()
    )
      throw new Error("An appeal already exists for this case.");
    if (
      (
        await ctx.db
          .query("moderationAppeals")
          .withIndex("by_user_status", (q) =>
            q.eq("userId", id).eq("status", "pending"),
          )
          .take(10)
      ).length >= 10
    )
      throw new Error("You can have up to ten pending appeals.");
    const appealId = await ctx.db.insert("moderationAppeals", {
      caseId: row._id,
      serverId: row.serverId,
      userId: id,
      statement,
      status: "pending",
      revision: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "moderation.appeal_submit",
      targetId: appealId,
    });
    return appealId;
  },
});
export const queue = query({
  args: { serverId: v.id("servers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await reviewer(ctx, args.serverId);
    const page = await ctx.db
      .query("moderationAppeals")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const row of page.page) {
      const user = await ctx.db.get(row.userId),
        original = await ctx.db.get(row.caseId);
      if (!user || user.deletedAt !== undefined || !original) continue;
      rows.push({
        ...row,
        memberName: user.name ?? user.username ?? "Member",
        action: original.action,
        reason: original.reason,
      });
    }
    return { ...page, page: rows };
  },
});
export const decide = mutation({
  args: {
    appealId: v.id("moderationAppeals"),
    accepted: v.boolean(),
    response: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const appeal = await ctx.db.get(args.appealId);
    if (!appeal) throw new Error("Appeal not found.");
    const access = await reviewer(ctx, appeal.serverId, true),
      original = await ctx.db.get(appeal.caseId);
    if (
      !original ||
      original.serverId !== appeal.serverId ||
      original.userId !== appeal.userId ||
      appeal.status !== "pending"
    )
      throw new Error("This appeal is no longer pending.");
    if (access.id === appeal.userId)
      throw new Error("You cannot review your own appeal.");
    revision(appeal.revision, args.expectedRevision);
    const response = text(args.response, "Review response", 4000);
    if (response.length < 10)
      throw new Error("Explain the decision in at least ten characters.");
    if (args.accepted) {
      if (
        access.server.ownerId !== access.id &&
        original.moderatorId !== access.id
      ) {
        const originalMember = await ctx.db
          .query("serverMembers")
          .withIndex("by_server_user", (q) =>
            q
              .eq("serverId", appeal.serverId)
              .eq("userId", original.moderatorId),
          )
          .unique();
        const actorRoles = await Promise.all(
            access.member.roleIds.map((id) => ctx.db.get(id)),
          ),
          originalRoles = await Promise.all(
            (originalMember?.roleIds ?? []).map((id) => ctx.db.get(id)),
          );
        if (
          original.moderatorId === access.server.ownerId ||
          Math.max(0, ...originalRoles.map((r) => r?.position ?? 0)) >=
            Math.max(0, ...actorRoles.map((r) => r?.position ?? 0))
        )
          throw new Error(
            "A higher-ranking moderator must review this action.",
          );
      }
      if (original.resolvedAt === undefined && original.action === "ban") {
        const latest = await ctx.db
          .query("moderationCases")
          .withIndex("by_server_user", (q) =>
            q.eq("serverId", appeal.serverId).eq("userId", appeal.userId),
          )
          .order("desc")
          .filter((q) =>
            q.or(
              q.eq(q.field("action"), "ban"),
              q.eq(q.field("action"), "unban"),
            ),
          )
          .first();
        if (latest?._id === original._id)
          await ctx.runMutation(
            makeFunctionReference<"mutation">("servers:unban"),
            { serverId: appeal.serverId, userId: appeal.userId },
          );
      }
      if (
        original.resolvedAt === undefined &&
        original.action === "timeout" &&
        (original.expiresAt ?? 0) > Date.now()
      ) {
        const member = await ctx.db
          .query("serverMembers")
          .withIndex("by_server_user", (q) =>
            q.eq("serverId", appeal.serverId).eq("userId", appeal.userId),
          )
          .unique();
        const latest = await ctx.db
          .query("moderationCases")
          .withIndex("by_server_user", (q) =>
            q.eq("serverId", appeal.serverId).eq("userId", appeal.userId),
          )
          .order("desc")
          .filter((q) =>
            q.or(
              q.eq(q.field("action"), "timeout"),
              q.eq(q.field("action"), "timeout_cleared"),
            ),
          )
          .first();
        if (
          latest?._id === original._id &&
          member?.communicationDisabledUntil === original.expiresAt
        ) {
          if (!access.permissions.includes(PERMISSIONS.TIMEOUT_MEMBERS))
            throw new Error(
              "Timeout Members permission is required to overturn a timeout.",
            );
          await ctx.runMutation(
            makeFunctionReference<"mutation">("moderation:clearTimeout"),
            {
              serverId: appeal.serverId,
              userId: appeal.userId,
              reason: "Moderation appeal accepted.",
            },
          );
        }
      }
      await ctx.runMutation(
        makeFunctionReference<"mutation">("moderation:resolve"),
        { caseId: original._id },
      );
    }
    await ctx.db.patch(appeal._id, {
      status: args.accepted ? "accepted" : "declined",
      response,
      reviewerId: access.id,
      revision: appeal.revision + 1,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId: appeal.serverId,
      actorId: access.id,
      action: "moderation.appeal_decide",
      targetId: appeal._id,
      details: args.accepted ? "accepted" : "declined",
    });
    await notify(ctx, {
      userId: appeal.userId,
      actorId: access.id,
      type: "moderation",
      title: "Moderation appeal reviewed",
      body: response.slice(0, 300),
      link: "/dashboard/appeals",
    });
  },
});
