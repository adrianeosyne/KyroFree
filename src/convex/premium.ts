import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./functions";
import { configuredFounderId, isFounderUser, requireActiveUser, requireServerAccess, isPlatformStaff } from "./lib";
import { PREMIUM_MONTH_MS } from "../lib/entitlements";
import { joinKyroHq } from "./servers";
import { serverBenefits, requirePremiumChannel } from "./premiumBenefits";

async function syncContribution(
  ctx: Parameters<typeof joinKyroHq>[0],
  userId: Parameters<typeof joinKyroHq>[1],
) {
  await joinKyroHq(ctx, userId);
  const user = await ctx.db.get(userId);
  const contribution = await ctx.db
    .query("serverSupercharges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (contribution)
    await ctx.db.patch(contribution._id, { until: user?.premiumUntil ?? 0 });
  if (user?.premiumUntil && user.premiumUntil > Date.now())
    await ctx.scheduler.runAt(
      user.premiumUntil,
      makeFunctionReference<
        "mutation",
        { userId: Id<"users">; expectedUntil: number }
      >("premium:expire"),
      { userId, expectedUntil: user.premiumUntil },
    );
}

export const communityBenefits = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { id, user } = await requireActiveUser(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) throw new Error("Channel unavailable.");
    const access = await requireServerAccess(ctx, channel.serverId, id);
    return {
      ...(await serverBenefits(ctx, channel.serverId)),
      isHq: access.server.isPlatformHome === true,
      canPostMedia:
        !access.server.isPlatformHome ||
        channel.name === "media" ||
        (user.premiumUntil ?? 0) > Date.now() ||
        isPlatformStaff(user),
      canPoll:
        !access.server.isPlatformHome ||
        (user.premiumUntil ?? 0) > Date.now() ||
        user.verified === true ||
        isPlatformStaff(user),
    };
  },
});

export const enterLounge = mutation({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireActiveUser(ctx);
    await joinKyroHq(ctx, id);
    const home = await ctx.db
      .query("servers")
      .withIndex("by_platform_home", (q) => q.eq("isPlatformHome", true))
      .unique();
    if (!home) throw new Error("Kyro HQ is not configured yet.");
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", home._id))
      .filter((q) => q.eq(q.field("premiumOnly"), true))
      .first();
    if (!channel) throw new Error("The lounge is not available yet.");
    await requirePremiumChannel(ctx, channel, id);
    return { serverId: home._id, channelId: channel._id };
  },
});

export const badgeVisibility = mutation({
  args: { hidden: v.boolean() },
  handler: async (ctx, { hidden }) => {
    const { id } = await requireActiveUser(ctx);
    await ctx.db.patch(id, { hidePremiumBadge: hidden });
  },
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireActiveUser(ctx);
    return {
      premiumUntil: user.premiumUntil ?? null,
      hidePremiumBadge: user.hidePremiumBadge === true,
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
    if (args.approve && recipient) await syncContribution(ctx, recipient._id);
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
    await syncContribution(ctx, target._id);
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

/** Scheduled invalidation makes active queries update when a month ends. */
export const expire = internalMutation({
  args: { userId: v.id("users"), expectedUntil: v.number() },
  handler: async (ctx, { userId, expectedUntil }) => {
    const user = await ctx.db.get(userId);
    if (
      !user ||
      user.premiumUntil !== expectedUntil ||
      expectedUntil > Date.now()
    )
      return;
    await ctx.db.patch(userId, { premiumUntil: undefined });
    await syncContribution(ctx, userId);
  },
});

/** Idempotent deployment setup for the official HQ channels. */
export const initializeHq = internalMutation({
  args: {}, handler: async ctx => {
    const founderId = configuredFounderId();
    if (!founderId) throw new Error("Configure the founder account before initializing Kyro HQ.");
    await joinKyroHq(ctx, founderId as Id<"users">);
    return { initialized: true };
  },
});
