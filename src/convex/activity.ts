import { query } from "./functions";
import { requireActiveUser, hydrateUsers } from "./lib";
import { playerLevel } from "./activityLib";
export const topPlayers = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireActiveUser(ctx);
    const rows = await ctx.db
      .query("playerLevels")
      .withIndex("by_xp", (q) => q.eq("active", true))
      .order("desc")
      .take(50);
    const users = await hydrateUsers(
      ctx,
      rows.map((r) => r.userId),
      id,
    );
    return rows
      .map((r, i) => ({
        rank: i + 1,
        user: users.get(r.userId) ?? null,
        xp: r.xp,
        level: playerLevel(r.xp),
      }))
      .filter((r) => r.user !== null);
  },
});
