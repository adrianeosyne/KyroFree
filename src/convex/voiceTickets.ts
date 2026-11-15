import { hasPremium } from "../lib/entitlements";
import { v } from "convex/values";
import { mutation } from "./functions";
import { sha256Hex } from "./sha256";
import { serverBenefits, requirePremiumChannel } from "./premiumBenefits";

/** Consumed only by Kyro's Vercel Functions; possession is the one-time proof. */
export const consume = mutation({
  args: {
    ticket: v.string(),
    purpose: v.union(v.literal("join"), v.literal("moderate")),
  },
  handler: async (ctx, { ticket, purpose }) => {
    if (!/^[a-zA-Z0-9_-]{40,80}$/.test(ticket)) {
      throw new Error("Invalid LiveKit ticket.");
    }
    const row = await ctx.db
      .query("livekitTickets")
      .withIndex("by_hash", (q) => q.eq("ticketHash", sha256Hex(ticket)))
      .unique();
    const now = Date.now();
    if (
      !row ||
      row.purpose !== purpose ||
      row.consumedAt !== undefined ||
      row.expiresAt <= now
    ) {
      throw new Error("That LiveKit ticket is invalid or expired.");
    }
    await ctx.db.patch(row._id, { consumedAt: now });
    let audioBitrate = 64000;
    if (row.roomName.startsWith("kyro_channel_")) {
      const channelId = ctx.db.normalizeId("channels", row.roomName.slice(13));
      const channel = channelId ? await ctx.db.get(channelId) : null;
      if (!channel) throw new Error("Voice channel unavailable.");
      await requirePremiumChannel(ctx, channel, row.userId);
      audioBitrate = (await serverBenefits(ctx, channel.serverId)).audioBitrate;
    }
    return {
      audioBitrate,
      screenShare: hasPremium(await ctx.db.get(row.userId))
        ? { width: 2560, height: 1440, frameRate: 60 }
        : { width: 1280, height: 720, frameRate: 30 },
      roomName: row.roomName,
      identity: row.identity,
      displayName: row.displayName,
      metadata: row.metadata,
      canPublishSources: row.canPublishSources,
      canManage: row.canManage,
      action: row.action ?? null,
      targetIdentity: row.targetIdentity ?? null,
      trackSid: row.trackSid ?? null,
    };
  },
});
