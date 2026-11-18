import { v } from "convex/values";
import { query, mutation } from "./functions";
import { requireActiveUser, requireUser } from "./lib";
import { attentionFields } from "./attentionSchema";
import { text, timezone, revision } from "./advancedValidation";
import { defaultAttention } from "../lib/attention";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const row = await ctx.db
      .query("attentionSettings")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    if (!row) return { ...defaultAttention, revision: 0 };
    return {
      timezone: row.timezone,
      profiles: row.profiles,
      activeProfile: row.activeProfile,
      quietEnabled: row.quietEnabled,
      quietStart: row.quietStart,
      quietEnd: row.quietEnd,
      quietDays: row.quietDays,
      themeEnabled: row.themeEnabled,
      lightStart: row.lightStart,
      darkStart: row.darkStart,
      revision: row.revision,
    };
  },
});
export const save = mutation({
  args: { ...attentionFields, expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const current = await ctx.db
      .query("attentionSettings")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    revision(current?.revision ?? 0, args.expectedRevision);
    timezone(args.timezone);
    for (const minute of [
      args.quietStart,
      args.quietEnd,
      args.lightStart,
      args.darkStart,
    ])
      if (!Number.isInteger(minute) || minute < 0 || minute >= 1440)
        throw new Error("Choose a valid time.");
    if (args.quietEnabled && args.quietStart === args.quietEnd)
      throw new Error("Quiet hours must have different start and end times.");
    if (args.themeEnabled && args.lightStart === args.darkStart)
      throw new Error("Light and dark themes must start at different times.");
    if (
      args.quietDays.length > 7 ||
      new Set(args.quietDays).size !== args.quietDays.length ||
      args.quietDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      throw new Error("Choose valid weekdays.");
    if (args.quietEnabled && !args.quietDays.length)
      throw new Error("Choose at least one quiet-hours day.");
    if (
      !args.profiles.length ||
      args.profiles.length > 10 ||
      new Set(args.profiles.map((p) => p.id)).size !== args.profiles.length
    )
      throw new Error("Keep between one and ten uniquely named profiles.");
    const profiles = args.profiles.map((p) => ({
      ...p,
      id: text(p.id, "Profile ID", 80),
      name: text(p.name, "Profile name", 60),
    }));
    if (new Set(profiles.map((p) => p.id)).size !== profiles.length)
      throw new Error("Profile IDs must be unique.");
    if (!profiles.some((p) => p.id === args.activeProfile))
      throw new Error("Choose an existing profile.");
    const { expectedRevision: expected, ...policy } = args;
    const value = {
      ...policy,
      profiles,
      revision: expected + 1,
      updatedAt: Date.now(),
    };
    if (current) await ctx.db.patch(current._id, value);
    else await ctx.db.insert("attentionSettings", { ...value, userId: id });
  },
});
