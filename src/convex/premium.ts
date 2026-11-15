import { v } from "convex/values";
import { mutation, query } from "./functions";
import { isFounderUser, requireActiveUser } from "./lib";
import { PREMIUM_MONTH_MS } from "../lib/entitlements";

export const status = query({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireActiveUser(ctx);
    return {
      premiumUntil: user.premiumUntil ?? null,
      instructions:
        process.env.KYRO_PREMIUM_PAYMENT_INSTRUCTIONS ??
        "Contact adrianeosyne in Kyro for manual payment instructions before paying.",
      requests: await ctx.db
        .query("premiumRequests")
        .withIndex("by_requester", (q) => q.eq("requesterId", id))
        .order("desc")
        .take(20),
    };
  },
});
export const request = mutation({
  args: { reference: v.string(), recipientId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const reference = args.reference.trim();
    if (reference.length < 4 || reference.length > 300)
      throw new Error(
        "Enter a payment reference between 4 and 300 characters.",
      );
    const recipientId = args.recipientId ?? id;
    const recipient = await ctx.db.get(recipientId);
    if (!recipient || recipient.deletedAt || recipient.botApplicationId)
      throw new Error("Choose an active Kyro member.");
    const requests = await ctx.db
      .query("premiumRequests")
      .withIndex("by_requester", (q) => q.eq("requesterId", id))
      .order("desc")
      .take(30);
    if (requests.filter((r) => r.status === "pending").length >= 3)
      throw new Error(
        "You already have three requests awaiting founder review.",
      );
    await ctx.db.insert("premiumRequests", {
      requesterId: id,
      recipientId,
      reference,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
export const queue = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can manage Premium.");
    const rows = await ctx.db
      .query("premiumRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(200);
    return await Promise.all(
      rows.map(async (r) => ({
        ...r,
        requester: (await ctx.db.get(r.requesterId))?.name ?? r.requesterId,
        recipient: (await ctx.db.get(r.recipientId))?.name ?? r.recipientId,
      })),
    );
  },
});
export const review = mutation({
  args: {
    requestId: v.id("premiumRequests"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can grant Premium.");
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "pending")
      throw new Error("This request has already been reviewed.");
    const recipient = await ctx.db.get(request.recipientId);
    if (args.approve && (!recipient || recipient.deletedAt))
      throw new Error("This recipient is no longer available.");
    if (args.approve && recipient)
      await ctx.db.patch(recipient._id, {
        premiumUntil:
          Math.max(Date.now(), recipient.premiumUntil ?? 0) + PREMIUM_MONTH_MS,
      });
    await ctx.db.patch(request._id, {
      status: args.approve ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewerId: id,
      note: args.note?.trim().slice(0, 300),
    });
    await ctx.db.insert("adminActions", {
      createdAt: Date.now(),
      actorId: id,
      action: args.approve
        ? "premium_payment_approved"
        : "premium_payment_rejected",
      targetType: "user",
      targetId: request.recipientId,
      details: "Manual monthly Premium request reviewed.",
    });
  },
});
export const grant = mutation({
  args: { userId: v.id("users"), revoke: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can grant Premium.");
    const target = await ctx.db.get(args.userId);
    if (!target || target.deletedAt || target.botApplicationId)
      throw new Error("Choose an active member.");
    if (target._id === user._id) throw new Error("Choose another member.");
    await ctx.db.patch(target._id, {
      premiumUntil: args.revoke
        ? undefined
        : Math.max(Date.now(), target.premiumUntil ?? 0) + PREMIUM_MONTH_MS,
    });
    await ctx.db.insert("adminActions", {
      createdAt: Date.now(),
      actorId: id,
      action: args.revoke ? "premium_revoked" : "premium_granted",
      targetType: "user",
      targetId: target._id,
      details: args.revoke ? "Premium revoked." : "30 days of Premium granted.",
    });
  },
});
