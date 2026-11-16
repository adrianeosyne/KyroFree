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
import {
  DAY_MS,
  MAX_PREMIUM_DAYS,
  validPremiumDuration,
} from "../lib/premiumProgress";
import { premiumDuration } from "../lib/premiumGifts";
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
  await clearExpiryReminder(ctx, user);
  await ctx.db.patch(user._id, {
    premiumUntil: Math.max(now, user.premiumUntil ?? 0) + days * DAY_MS,
    premiumSince: user.premiumSince ?? now,
    premiumStreakSince: active ? (user.premiumStreakSince ?? now) : now,
    premiumBadgeTier: active ? user.premiumBadgeTier : undefined,
    premiumReminderFor: undefined,
  });
}
import { joinKyroHq } from "./servers";
import { serverBenefits, requirePremiumChannel } from "./premiumBenefits";

export async function recordPremiumGift(
  ctx: MutationCtx,
  senderId: Id<"users">,
  recipientId: Id<"users">,
  days: number,
  premiumUntil: number,
  senderName?: string,
  senderUsername?: string,
) {
  if (senderId === recipientId) return;
  const sender = await ctx.db.get(senderId);
  if (sender)
    await ctx.db.patch(senderId, {
      premiumGiftCount: (sender.premiumGiftCount ?? 0) + 1,
    });
  const name = senderName ?? sender?.name ?? "A Kyro member";
  await ctx.db.insert("notifications", {
    userId: recipientId,
    type: "premium_gift",
    actorId: senderId,
    title: "You received Premium!",
    body: `${name} sent you ${premiumDuration(days)} of Premium.`,
    giftDays: days,
    giftPremiumUntil: premiumUntil,
    giftSenderName: name,
    giftSenderUsername: senderUsername ?? sender?.username,
    link: "/dashboard?settings=premium",
    read: false,
    createdAt: Date.now(),
  });
}

export async function syncPremiumAccess(
  ctx: Parameters<typeof joinKyroHq>[0],
  userId: Parameters<typeof joinKyroHq>[1],
) {
  await joinKyroHq(ctx, userId);
  const user = await ctx.db.get(userId);
  if (user?.premiumUntil && user.premiumUntil > Date.now()) {
    const warningAt = user.premiumUntil - DAY_MS;
    if (warningAt <= Date.now())
      await sendExpiryReminder(ctx, userId, user.premiumUntil);
    else
      await ctx.scheduler.runAt(
        warningAt,
        makeFunctionReference<
          "mutation",
          { userId: Id<"users">; expectedUntil: number }
        >("premium:remindExpiry"),
        { userId, expectedUntil: user.premiumUntil },
      );
    await ctx.scheduler.runAt(
      user.premiumUntil,
      makeFunctionReference<
        "mutation",
        { userId: Id<"users">; expectedUntil: number }
      >("premium:expire"),
      { userId, expectedUntil: user.premiumUntil },
    );
  }
}

async function sendExpiryReminder(
  ctx: MutationCtx,
  userId: Id<"users">,
  expectedUntil: number,
) {
  const user = await ctx.db.get(userId);
  const now = Date.now();
  if (
    !user ||
    user.deletedAt ||
    user.botApplicationId ||
    user.premiumUntil !== expectedUntil ||
    user.premiumReminderFor === expectedUntil ||
    expectedUntil <= now ||
    expectedUntil - now > DAY_MS
  )
    return false;
  await ctx.db.insert("notifications", {
    userId,
    type: "system",
    title: "Premium expires in one day or less",
    body: `Your Premium ends ${new Date(expectedUntil).toISOString()}. Renew before then to keep your Premium badge and perks.`,
    link: "/dashboard?settings=premium",
    containerKey: `premium-expiry:${expectedUntil}`,
    read: false,
    createdAt: now,
  });
  await ctx.db.patch(userId, { premiumReminderFor: expectedUntil });
  return true;
}

async function removePremium(ctx: MutationCtx, user: Doc<"users">) {
  await clearExpiryReminder(ctx, user);
  await ctx.db.patch(user._id, {
    premiumUntil: undefined,
    premiumStreakSince: undefined,
    premiumBadgeTier: undefined,
    premiumReminderFor: undefined,
    ...(user.primaryBadge === "premium" ? { primaryBadge: undefined } : {}),
  });
  await syncPremiumAccess(ctx, user._id);
}

async function clearExpiryReminder(ctx: MutationCtx, user: Doc<"users">) {
  if (user.premiumReminderFor === undefined) return;
  const warnings = await ctx.db
    .query("notifications")
    .withIndex("by_user_container_unread", (q) =>
      q
        .eq("userId", user._id)
        .eq("containerKey", `premium-expiry:${user.premiumReminderFor}`)
        .eq("read", false),
    )
    .collect();
  for (const warning of warnings)
    await ctx.db.patch(warning._id, { read: true });
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
    days: v.optional(v.number()),
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
    const days = args.days ?? 30;
    if (!validPremiumDuration(days))
      throw new Error(
        `Choose a duration from 1 to ${MAX_PREMIUM_DAYS} whole days.`,
      );
    if (args.approve && recipient) await extendPremium(ctx, recipient, days);
    if (args.approve && recipient) await syncPremiumAccess(ctx, recipient._id);
    if (args.approve && recipient && request.requesterId !== recipient._id) {
      await recordPremiumGift(
        ctx,
        request.requesterId,
        recipient._id,
        days,
        Math.max(Date.now(), recipient.premiumUntil ?? 0) + days * DAY_MS,
      );
    }
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
      details: `Manual ${days}-day Premium request reviewed.`,
    });
  },
});
export const grant = mutation({
  args: {
    userId: v.id("users"),
    revoke: v.optional(v.boolean()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can grant Premium.");
    const target = await ctx.db.get(args.userId);
    if (!target || target.deletedAt || target.botApplicationId)
      throw new Error("Choose an active member.");
    const days = args.days ?? 30;
    if (!validPremiumDuration(days))
      throw new Error(
        `Choose a duration from 1 to ${MAX_PREMIUM_DAYS} whole days.`,
      );
    if (args.revoke) await removePremium(ctx, target);
    else {
      await extendPremium(ctx, target, days);
      await syncPremiumAccess(ctx, target._id);
    }
    await ctx.db.insert("adminActions", {
      createdAt: Date.now(),
      actorId: id,
      action: args.revoke ? "premium_revoked" : "premium_granted",
      targetType: "user",
      targetId: target._id,
      details: args.revoke
        ? "Premium revoked."
        : `${days} days of Premium granted.`,
    });
  },
});

/** Founder edits history independently; timing edits use total and elapsed days. */
export const updateSubscription = mutation({
  args: {
    userId: v.id("users"),
    premiumSince: v.optional(v.number()),
    durationDays: v.optional(v.number()),
    streakDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can manage Premium.");
    const target = await ctx.db.get(args.userId);
    if (!target || target.deletedAt || target.botApplicationId)
      throw new Error("Choose an active member.");
    const now = Date.now();
    if (
      args.premiumSince === undefined &&
      args.durationDays === undefined &&
      args.streakDays === undefined
    )
      throw new Error(
        "Change the Premium since date, duration or days in a row.",
      );
    if (
      args.premiumSince !== undefined &&
      (!Number.isFinite(args.premiumSince) ||
        args.premiumSince < 0 ||
        args.premiumSince > now)
    )
      throw new Error(
        "Premium since must be a valid date that is not in the future.",
      );
    if (
      args.durationDays !== undefined &&
      !validPremiumDuration(args.durationDays)
    )
      throw new Error(
        `Choose a duration from 1 to ${MAX_PREMIUM_DAYS} whole days.`,
      );
    if (
      args.streakDays !== undefined &&
      (!Number.isInteger(args.streakDays) ||
        args.streakDays < 0 ||
        args.streakDays > MAX_PREMIUM_DAYS)
    )
      throw new Error(
        `Days in a row must be a whole number from 0 to ${MAX_PREMIUM_DAYS}.`,
      );
    const timingChanged =
      args.durationDays !== undefined || args.streakDays !== undefined;
    const active = hasPremium(target, now);
    const oldStart = active ? (target.premiumStreakSince ?? now) : now;
    const durationDays =
      args.durationDays ??
      (active ? (target.premiumUntil! - oldStart) / DAY_MS : 30);
    const streakSince =
      args.streakDays === undefined ? oldStart : now - args.streakDays * DAY_MS;
    const until = timingChanged
      ? streakSince + durationDays * DAY_MS
      : target.premiumUntil;
    if (timingChanged && until !== target.premiumUntil)
      await clearExpiryReminder(ctx, target);
    await ctx.db.patch(target._id, {
      ...(args.premiumSince !== undefined
        ? { premiumSince: args.premiumSince }
        : timingChanged && target.premiumSince === undefined
          ? { premiumSince: streakSince }
          : {}),
      ...(timingChanged
        ? {
            premiumUntil: until,
            premiumStreakSince: streakSince,
            premiumBadgeTier: active ? target.premiumBadgeTier : undefined,
            premiumReminderFor:
              until === target.premiumUntil
                ? target.premiumReminderFor
                : undefined,
          }
        : {}),
    });
    if (timingChanged) {
      if (until! <= now)
        await removePremium(ctx, (await ctx.db.get(target._id))!);
      else await syncPremiumAccess(ctx, target._id);
    }
    await ctx.db.insert("adminActions", {
      createdAt: now,
      actorId: id,
      action: "premium_subscription_updated",
      targetType: "user",
      targetId: target._id,
      details: `Premium since ${new Date(args.premiumSince ?? target.premiumSince ?? streakSince).toISOString()}${timingChanged ? ` · ${durationDays} total days · ends ${new Date(until!).toISOString()}` : " · expiry unchanged"}.`,
    });
    return {
      premiumUntil: timingChanged && until! <= now ? null : (until ?? null),
    };
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
    if (!user || user.premiumUntil !== expectedUntil || user.deletedAt) return;
    if (expectedUntil > Date.now()) {
      await ctx.scheduler.runAt(
        expectedUntil + 1,
        makeFunctionReference<
          "mutation",
          { userId: Id<"users">; expectedUntil: number }
        >("premium:expire"),
        { userId, expectedUntil },
      );
      return;
    }
    await removePremium(ctx, user);
  },
});

export const remindExpiry = internalMutation({
  args: { userId: v.id("users"), expectedUntil: v.number() },
  handler: async (ctx, { userId, expectedUntil }) => {
    const user = await ctx.db.get(userId);
    if (
      !user ||
      user.deletedAt ||
      user.premiumUntil !== expectedUntil ||
      user.premiumReminderFor === expectedUntil
    )
      return false;
    if (Date.now() < expectedUntil - DAY_MS) {
      await ctx.scheduler.runAt(
        expectedUntil - DAY_MS + 1,
        makeFunctionReference<
          "mutation",
          { userId: Id<"users">; expectedUntil: number }
        >("premium:remindExpiry"),
        { userId, expectedUntil },
      );
      return false;
    }
    return sendExpiryReminder(ctx, userId, expectedUntil);
  },
});

/** Covers existing subscriptions and recovers missed scheduled jobs in bounded batches. */
export const reconcileExpirations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("users")
      .withIndex("by_premium_until", (q) =>
        q.gt("premiumUntil", 0).lte("premiumUntil", now + DAY_MS),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("deletedAt"), undefined),
          q.eq(q.field("botApplicationId"), undefined),
          q.or(
            q.lte(q.field("premiumUntil"), now),
            q.neq(q.field("premiumReminderFor"), q.field("premiumUntil")),
          ),
        ),
      )
      .take(100);
    for (const user of due) {
      if (user.premiumUntil! <= now) await removePremium(ctx, user);
      else await sendExpiryReminder(ctx, user._id, user.premiumUntil!);
    }
    return { processed: due.length };
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
