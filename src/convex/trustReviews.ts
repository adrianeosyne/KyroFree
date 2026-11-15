import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./functions";
import type { Id } from "./_generated/dataModel";
import {
  requireActiveUser,
  isPlatformTrialStaff,
  isPlatformAdmin,
} from "./lib";
import { hasPremium } from "../lib/entitlements";

export async function queueBotReview(
  ctx: MutationCtx,
  applicationId: Id<"botApplications">,
  userId: Id<"users">,
) {
  const old = await ctx.db
    .query("trustRequests")
    .withIndex("by_application", (q) =>
      q.eq("applicationId", applicationId).eq("status", "pending"),
    )
    .collect();
  for (const row of old) await ctx.db.patch(row._id, { status: "withdrawn" });
  const user = await ctx.db.get(userId);
  const app = await ctx.db.get(applicationId);
  await ctx.db.insert("trustRequests", {
    userId,
    kind: "bot",
    applicationId,
    evidence: app?.description ?? "",
    priority: hasPremium(user),
    status: "pending",
    createdAt: Date.now(),
  });
}
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireActiveUser(ctx);
    return {
      verified: user.verified === true,
      requests: await ctx.db
        .query("trustRequests")
        .withIndex("by_user", (q) => q.eq("userId", id))
        .order("desc")
        .take(30),
    };
  },
});
export const requestCreator = mutation({
  args: { evidence: v.string() },
  handler: async (ctx, { evidence }) => {
    const { id, user } = await requireActiveUser(ctx);
    if (user.verified)
      throw new Error("Your creator account is already verified.");
    if (evidence.trim().length < 20 || evidence.length > 1000)
      throw new Error(
        "Provide 20–1,000 characters describing your original work and public ownership evidence.",
      );
    const rows = await ctx.db
      .query("trustRequests")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .take(50);
    if (rows.some((r) => r.kind === "creator" && r.status === "pending"))
      throw new Error("Your creator request is already awaiting review.");
    if (
      rows.filter(
        (r) => r.kind === "creator" && r.createdAt > Date.now() - 86400000,
      ).length >= 3
    )
      throw new Error(
        "Please wait a day before submitting another creator request.",
      );
    await ctx.db.insert("trustRequests", {
      userId: id,
      kind: "creator",
      evidence: evidence.trim(),
      priority: hasPremium(user),
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
export const queue = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireActiveUser(ctx);
    if (!isPlatformTrialStaff(user)) throw new Error("Staff access required.");
    const rows = await ctx.db
      .query("trustRequests")
      .withIndex("by_queue", (q) => q.eq("status", "pending"))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...rows,
      page: await Promise.all(
        rows.page.map(async (row) => {
          const applicant = await ctx.db.get(row.userId);
          const app = row.applicationId
            ? await ctx.db.get(row.applicationId)
            : null;
          return {
            ...row,
            name: applicant?.name ?? "Deleted member",
            username: applicant?.username ?? "member",
            bot: app
              ? {
                  name: app.name,
                  description: app.description,
                  category: app.category,
                  permissions: app.permissions,
                }
              : null,
          };
        }),
      ),
    };
  },
});
export const review = mutation({
  args: {
    requestId: v.id("trustRequests"),
    approve: v.boolean(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isPlatformAdmin(user))
      throw new Error("Platform admin permission required.");
    const row = await ctx.db.get(args.requestId);
    if (!row || row.status !== "pending")
      throw new Error("This request has already been reviewed or withdrawn.");
    if (row.userId === id)
      throw new Error("Another admin must review your request.");
    if (args.note.trim().length < 10 || args.note.length > 500)
      throw new Error("Add review feedback of 10–500 characters.");
    const target = await ctx.db.get(row.userId);
    if (!target || target.deletedAt) throw new Error("Member unavailable.");
    if (row.kind === "creator" && args.approve)
      await ctx.db.patch(row.userId, { verified: true });
    if (row.kind === "bot" && row.applicationId) {
      const app = await ctx.db.get(row.applicationId);
      if (!app || app.deletedAt || app.suspended || app.ownerId !== row.userId)
        throw new Error("Bot unavailable for publication.");
      await ctx.db.patch(app._id, {
        discoverable: args.approve,
        directoryStatus: args.approve ? "approved" : "rejected",
        directoryReviewNote: args.note.trim(),
      });
    }
    await ctx.db.patch(row._id, {
      status: args.approve ? "approved" : "rejected",
      reviewerId: id,
      reviewedAt: Date.now(),
      note: args.note.trim(),
    });
    await ctx.db.insert("adminActions", {
      actorId: id,
      action: `${row.kind}_review_${args.approve ? "approved" : "rejected"}`,
      targetType: "user",
      targetId: row.userId,
      details: args.note.trim(),
      createdAt: Date.now(),
    });
  },
});
