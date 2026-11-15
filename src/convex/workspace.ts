import { v } from "convex/values";
import { query, mutation } from "./functions";
import { requireActiveUser } from "./lib";
import { hasPremium } from "../lib/entitlements";
import { WORKSPACE_DEFAULTS } from "../lib/workspaceTheme";
import { workspaceValidator } from "./workspaceSchema";
import {
  claimUpload,
  requireOwnedUpload,
  deleteClaimedUpload,
} from "./uploadSecurity";
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { id, user } = await requireActiveUser(ctx);
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    return {
      premiumUntil: user.premiumUntil ?? null,
      theme: row?.theme ?? WORKSPACE_DEFAULTS,
      backgroundUrl:
        hasPremium(user) && row?.backgroundStorageId
          ? await ctx.storage.getUrl(row.backgroundStorageId)
          : null,
    };
  },
});
export const save = mutation({
  args: { theme: workspaceValidator },
  handler: async (ctx, { theme }) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!hasPremium(user))
      throw new Error("Full workspace customization requires active Premium.");
    for (const color of [
      theme.background,
      theme.panel,
      theme.accent,
      theme.text,
    ])
      if (!/^#[0-9a-f]{6}$/i.test(color))
        throw new Error("Choose a valid six-digit color.");
    const ranges = {
      radius: [0, 32],
      sidebarWidth: [200, 320],
      panelOpacity: [70, 100],
      backgroundOpacity: [0, 50],
      backgroundBlur: [0, 20],
      spacing: [80, 120],
      borderWidth: [0, 2],
      shadow: [0, 40],
      contrast: [90, 120],
    } as const;
    for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
      const [min, max] = ranges[key];
      if (!Number.isFinite(theme[key]) || theme[key] < min || theme[key] > max)
        throw new Error("That workspace value is outside its allowed range.");
    }
    if (
      !["system", "mono", "rounded"].includes(theme.font) ||
      !["center", "top", "bottom"].includes(theme.backgroundPosition) ||
      !["cover", "contain"].includes(theme.backgroundFit)
    )
      throw new Error("Choose a supported workspace style.");
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    if (row) await ctx.db.patch(row._id, { theme });
    else await ctx.db.insert("workspaces", { userId: id, theme });
  },
});
export const background = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { storageId }) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!hasPremium(user) && storageId)
      throw new Error("Background uploads require active Premium.");
    let row = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    const rowId = row
      ? row._id
      : await ctx.db.insert("workspaces", {
          userId: id,
          theme: WORKSPACE_DEFAULTS,
        });
    row = await ctx.db.get(rowId);
    if (storageId) {
      const asset = await requireOwnedUpload(ctx, id, storageId);
      if (
        !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(
          asset.mimeType,
        ) ||
        asset.size > 5 * 1024 * 1024
      )
        throw new Error("Choose a static background image under 5 MB.");
      await claimUpload(ctx, id, storageId, "workspace_background", rowId);
    }
    if (row?.backgroundStorageId !== storageId)
      await deleteClaimedUpload(
        ctx,
        row?.backgroundStorageId,
        "workspace_background",
        rowId,
      );
    await ctx.db.patch(rowId, { backgroundStorageId: storageId ?? undefined });
  },
});
