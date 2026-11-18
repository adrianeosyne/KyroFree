import {
  FONT_THEMES,
  CURSOR_THEMES,
  WORKSPACE_IMAGE_TYPES,
  WORKSPACE_BACKGROUND_BYTES,
} from "../lib/workspaceStyles";
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
      theme: { ...WORKSPACE_DEFAULTS, ...row?.theme },
      backgroundPosterUrl:
        hasPremium(user) && row?.backgroundPosterStorageId
          ? await ctx.storage.getUrl(row.backgroundPosterStorageId)
          : null,
      backgroundMayAnimate:
        row?.backgroundMayAnimate ??
        (!!row?.backgroundStorageId &&
          (await ctx.db.system.get("_storage", row.backgroundStorageId))
            ?.contentType !== "image/jpeg"),
      cursorUrl:
        hasPremium(user) && row?.cursorStorageId
          ? await ctx.storage.getUrl(row.cursorStorageId)
          : null,
      cursorHotspotX: row?.cursorHotspotX ?? 4,
      cursorHotspotY: row?.cursorHotspotY ?? 3,
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
      !FONT_THEMES.some((font) => font.id === theme.font) ||
      !["center", "top", "bottom"].includes(theme.backgroundPosition) ||
      !["cover", "contain"].includes(theme.backgroundFit) ||
      (theme.cursor !== undefined &&
        theme.cursor !== "uploaded" &&
        !CURSOR_THEMES.some((cursor) => cursor.id === theme.cursor))
    )
      throw new Error("Choose a supported workspace style.");
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    if (theme.cursor === "uploaded" && !row?.cursorStorageId)
      throw new Error("Upload a cursor before selecting it.");
    const normalized = { ...WORKSPACE_DEFAULTS, ...theme };
    if (row) await ctx.db.patch(row._id, { theme: normalized });
    else await ctx.db.insert("workspaces", { userId: id, theme: normalized });
  },
});
export const background = mutation({
  args: {
    storageId: v.union(v.id("_storage"), v.null()),
    posterStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { storageId, posterStorageId }) => {
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
        !(WORKSPACE_IMAGE_TYPES as readonly string[]).includes(
          asset.mimeType,
        ) ||
        asset.size > WORKSPACE_BACKGROUND_BYTES
      )
        throw new Error(
          "Choose a static or animated PNG, APNG, JPEG, WebP, AVIF or GIF image up to 5 MB.",
        );
      await claimUpload(ctx, id, storageId, "workspace_background", rowId);
      if (posterStorageId) {
        const poster = await requireOwnedUpload(ctx, id, posterStorageId);
        if (
          poster.mimeType !== "image/jpeg" ||
          poster.size > WORKSPACE_BACKGROUND_BYTES
        )
          throw new Error(
            "The background still preview must be a JPEG up to 5 MB.",
          );
        await claimUpload(
          ctx,
          id,
          posterStorageId,
          "workspace_background_poster",
          rowId,
        );
      }
      await ctx.db.patch(rowId, {
        backgroundMayAnimate: asset.mimeType !== "image/jpeg",
      });
    }
    if (row?.backgroundStorageId !== storageId)
      await deleteClaimedUpload(
        ctx,
        row?.backgroundStorageId,
        "workspace_background",
        rowId,
      );
    const nextPoster = storageId ? posterStorageId : undefined;
    if (row?.backgroundPosterStorageId !== nextPoster)
      await deleteClaimedUpload(
        ctx,
        row?.backgroundPosterStorageId,
        "workspace_background_poster",
        rowId,
      );
    await ctx.db.patch(rowId, {
      backgroundStorageId: storageId ?? undefined,
      backgroundPosterStorageId: nextPoster,
      ...(!storageId ? { backgroundMayAnimate: false } : {}),
    });
  },
});
