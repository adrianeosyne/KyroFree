import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./functions";
import {
  configuredFounderId,
  isFounderUser,
  requireActiveUser,
  requireServerAccess,
  isPlatformStaff,
} from "./lib";
import { DAY_MS } from "../lib/premiumProgress";
import { hasPremium } from "../lib/entitlements";
import { premiumBadgeTierValidator } from "./schema";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./functions";
export async function extendPremium(
  ctx: MutationCtx,
  user: Doc<"users">,
  days: number,
) {
  const now = Date.now(),
    active = (user.premiumUntil ?? 0) > now;
  await ctx.db.patch(user._id, {
    premiumUntil: Math.max(now, user.premiumUntil ?? 0) + days * DAY_MS,
    premiumSince: user.premiumSince ?? now,
    premiumStreakSince: active ? (user.premiumStreakSince ?? now) : now,
    premiumBadgeTier: active ? user.premiumBadgeTier : undefined,
  });
}
import { joinKyroHq } from "./servers";
import { serverBenefits, requirePremiumChannel } from "./premiumBenefits";

export async function syncPremiumAccess(
  ctx: Parameters<typeof joinKyroHq>[0],
  userId: Parameters<typeof joinKyroHq>[1],
) {
  await joinKyroHq(ctx, userId);
  const user = await ctx.db.get(userId);
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
      ...(await serverBenefits()),
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
      premiumSince: user.premiumSince ?? null,
      premiumStreakSince: user.premiumStreakSince ?? null,
      premiumBadgeTier: user.premiumBadgeTier ?? null,
      premiumGiftCount: user.premiumGiftCount ?? 0,
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
    if (args.approve && recipient) await extendPremium(ctx, recipient, 30);
    if (args.approve && recipient) await syncPremiumAccess(ctx, recipient._id);
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
    if (args.revoke)
      await ctx.db.patch(target._id, {
        premiumUntil: undefined,
        premiumStreakSince: undefined,
        premiumBadgeTier: undefined,
      });
    else await extendPremium(ctx, target, 30);
    await syncPremiumAccess(ctx, target._id);
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

export const memberStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can manage Premium.");
    const target = await ctx.db.get(userId);
    if (!target || target.deletedAt || target.botApplicationId)
      throw new Error("Choose an active member.");
    return {
      premiumUntil: target.premiumUntil ?? null,
      premiumSince: target.premiumSince ?? null,
      premiumStreakSince: target.premiumStreakSince ?? null,
      premiumBadgeTier: target.premiumBadgeTier ?? null,
    };
  },
});

/** Assign a cosmetic tier without changing the member's real streak. */
export const setBadgeTier = mutation({
  args: {
    userId: v.id("users"),
    tier: v.union(premiumBadgeTierValidator, v.null()),
  },
  handler: async (ctx, { userId, tier }) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can manage Premium badge tiers.");
    const target = await ctx.db.get(userId);
    if (!target || target.deletedAt || target.botApplicationId)
      throw new Error("Choose an active member.");
    if (tier !== null && !hasPremium(target)) {
      await extendPremium(ctx, target, 30);
      await syncPremiumAccess(ctx, target._id);
    }
    await ctx.db.patch(userId, {
      premiumBadgeTier: tier ?? undefined,
      ...(tier !== null ? { hidePremiumBadge: false } : {}),
    });
    await ctx.db.insert("adminActions", {
      createdAt: Date.now(),
      actorId: id,
      action: "premium_badge_tier_set",
      targetType: "user",
      targetId: userId,
      details: tier
        ? `${tier} badge tier assigned.`
        : "Time-based badge tier restored.",
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
    await ctx.db.patch(userId, {
      premiumUntil: undefined,
      premiumStreakSince: undefined,
      premiumBadgeTier: undefined,
    });
    await syncPremiumAccess(ctx, userId);
  },
});

/** Idempotent deployment setup for the official HQ channels. */
export const initializeHq = internalMutation({
  args: {},
  handler: async (ctx) => {
    const founderId = configuredFounderId();
    if (!founderId)
      throw new Error(
        "Configure the founder account before initializing Kyro HQ.",
      );
    await joinKyroHq(ctx, founderId as Id<"users">);
    return { initialized: true };
  },
});
