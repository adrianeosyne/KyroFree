import { internalMutation } from "./functions";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
export const initializeHistory = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("users")
      .paginate({ numItems: 100, cursor: cursor ?? null });
    for (const user of page.page) {
      if (user.premiumHistoryMigrated) continue;
      const actions = await ctx.db
        .query("adminActions")
        .withIndex("by_target", (q) => q.eq("targetId", user._id))
        .collect();
      const grants = actions
        .filter((a) =>
          [
            "premium_granted",
            "premium_payment_approved",
            "premium_code_redeemed",
            "premium_code_gifted",
            "premium_revoked",
          ].includes(a.action),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      let first: number | undefined,
        streak: number | undefined,
        until = 0;
      for (const grant of grants) {
        if (grant.action === "premium_revoked") {
          until = 0;
          streak = undefined;
          continue;
        }
        const days = grant.action.startsWith("premium_code_")
          ? Number(grant.details?.match(/^(\d+) days/)?.[1] ?? 30)
          : 30;
        first ??= grant.createdAt;
        if (until <= grant.createdAt) streak = grant.createdAt;
        until = Math.max(until, grant.createdAt) + days * 86400000;
      }
      const requests = await ctx.db
        .query("premiumRequests")
        .withIndex("by_requester", (q) => q.eq("requesterId", user._id))
        .collect();
      const gifts = requests.filter(
        (r) => r.status === "approved" && r.recipientId !== user._id,
      ).length;
      const active = (user.premiumUntil ?? 0) > Date.now();
      await ctx.db.patch(user._id, {
        premiumHistoryMigrated: true,
        premiumSince: user.premiumSince ?? first,
        premiumStreakSince: active
          ? (user.premiumStreakSince ??
            (until > Date.now() ? streak : Date.now()))
          : undefined,
        premiumGiftCount: (user.premiumGiftCount ?? 0) + gifts,
      });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation", { cursor: string }>(
          "communityMigration:initializeHistory",
        ),
        { cursor: page.continueCursor },
      );
    const home = await ctx.db
      .query("servers")
      .withIndex("by_platform_home", (q) => q.eq("isPlatformHome", true))
      .unique();
    if (home && page.isDone) {
      const members = await ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", home._id))
        .collect();
      for (const member of members) {
        const user = await ctx.db.get(member.userId),
          roles = await Promise.all(member.roleIds.map((id) => ctx.db.get(id)));
        if (user)
          await ctx.db.patch(user._id, {
            hqOg: roles.some((r) => r?.name.trim().toLowerCase() === "og"),
          });
      }
    }
    return { processed: page.page.length, complete: page.isDone };
  },
});
