import { getAuthUserId, retrieveAccount } from "@convex-dev/auth/server";
import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./functions";
import { requireActiveUser, requireUser } from "./lib";
import { internal } from "./_generated/api";

const retention = v.union(
  v.literal(0),
  v.literal(7),
  v.literal(30),
  v.literal(90),
  v.literal(365),
);
export const status = query({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireUser(ctx);
    const policy = await ctx.db
      .query("retentionPolicies")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    return {
      frozen: user.frozenAt !== undefined,
      frozenAt: user.frozenAt ?? null,
      policy,
    };
  },
});
export const setFreeze = action({
  args: { frozen: v.boolean(), password: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to manage account freeze.");
    if (!args.password || args.password.length > 200)
      throw new Error("Enter your current password.");
    const context = await ctx.runQuery(
      internal.users.changePassword.passwordContext,
      { userId },
    );
    if (!context?.email || !context.hasPassword)
      throw new Error(
        "A password account is required to manage account freeze.",
      );
    const verified = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: context.email, secret: args.password },
    }).catch(() => null);
    if (!verified || verified.user._id !== userId)
      throw new Error("Your current password is incorrect.");
    await ctx.runMutation(internal.privacyControls.applyFreeze, {
      userId,
      frozen: args.frozen,
    });
  },
});
export const applyFreeze = internalMutation({
  args: { userId: v.id("users"), frozen: v.boolean() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt !== undefined)
      throw new Error("Account unavailable.");
    if ((user.frozenAt !== undefined) === args.frozen) return;
    await ctx.db.patch(user._id, {
      frozenAt: args.frozen ? Date.now() : undefined,
    });
    await ctx.db.insert("securityActivity", {
      userId: args.userId,
      action: args.frozen ? "account.frozen" : "account.unfrozen",
      createdAt: Date.now(),
    });
  },
});
export const saveRetention = mutation({
  args: {
    notificationDays: retention,
    draftDays: retention,
    scheduleHistoryDays: retention,
  },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    const current = await ctx.db
      .query("retentionPolicies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (current)
      await ctx.db.patch(current._id, { ...args, updatedAt: Date.now() });
    else
      await ctx.db.insert("retentionPolicies", {
        userId,
        ...args,
        updatedAt: Date.now(),
      });
    await ctx.db.insert("securityActivity", {
      userId,
      action: "privacy.retention_updated",
      createdAt: Date.now(),
    });
  },
});
export const activity = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    return ctx.db
      .query("securityActivity")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const applyRetention = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const policies = await ctx.db
      .query("retentionPolicies")
      .paginate({ cursor: args.cursor ?? null, numItems: 10 });
    let deleted = 0;
    for (const policy of policies.page) {
      if (policy.notificationDays)
        for (const row of await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) =>
            q
              .eq("userId", policy.userId)
              .lt("createdAt", Date.now() - policy.notificationDays * 86400000),
          )
          .take(100)) {
          await ctx.db.delete(row._id);
          deleted++;
        }
      if (policy.draftDays)
        for (const row of await ctx.db
          .query("messageDrafts")
          .withIndex("by_user_updated", (q) =>
            q
              .eq("userId", policy.userId)
              .lt("updatedAt", Date.now() - policy.draftDays * 86400000),
          )
          .take(100)) {
          await ctx.db.delete(row._id);
          deleted++;
        }
      if (policy.scheduleHistoryDays)
        for (const row of await ctx.db
          .query("scheduledMessages")
          .withIndex("by_user_finished", (q) =>
            q
              .eq("userId", policy.userId)
              .gt("finishedAt", 0)
              .lt(
                "finishedAt",
                Date.now() - policy.scheduleHistoryDays * 86400000,
              ),
          )
          .take(100)) {
          await ctx.db.delete(row._id);
          deleted++;
        }
    }
    if (!policies.isDone)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("privacyControls:applyRetention"),
        { cursor: policies.continueCursor },
      );
    return { deleted };
  },
});
