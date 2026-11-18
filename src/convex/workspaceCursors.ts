import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalQuery, internalMutation } from "./functions";
import { requireActiveUser } from "./lib";
import { hasPremium } from "../lib/entitlements";
import { WORKSPACE_DEFAULTS } from "../lib/workspaceTheme";
import { WORKSPACE_CURSOR_BYTES } from "../lib/workspaceStyles";
import { cursorPngSize } from "../lib/cursorPng";
import {
  requireOwnedUpload,
  claimUpload,
  deleteClaimedUpload,
} from "./uploadSecurity";

export const check = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!hasPremium(user))
      throw new Error("Custom cursor uploads require active Premium.");
    const asset = await requireOwnedUpload(ctx, id, storageId);
    if (asset.mimeType !== "image/png" || asset.size > WORKSPACE_CURSOR_BYTES)
      throw new Error("Choose a static PNG cursor up to 128 KB.");
    return true;
  },
});
export const commit = internalMutation({
  args: {
    storageId: v.union(v.id("_storage"), v.null()),
    hotspotX: v.number(),
    hotspotY: v.number(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (args.storageId && !hasPremium(user))
      throw new Error("Custom cursor uploads require active Premium.");
    let row = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    const rowId =
      row?._id ??
      (await ctx.db.insert("workspaces", {
        userId: id,
        theme: WORKSPACE_DEFAULTS,
      }));
    row = await ctx.db.get(rowId);
    if (args.storageId) {
      if (
        ![args.width, args.height, args.hotspotX, args.hotspotY].every(
          Number.isInteger,
        ) ||
        args.width < 1 ||
        args.height < 1 ||
        args.width > 64 ||
        args.height > 64 ||
        args.hotspotX < 0 ||
        args.hotspotY < 0 ||
        args.hotspotX >= args.width ||
        args.hotspotY >= args.height
      )
        throw new Error("Choose a click point inside your cursor image.");
      const asset = await requireOwnedUpload(ctx, id, args.storageId);
      if (asset.mimeType !== "image/png" || asset.size > WORKSPACE_CURSOR_BYTES)
        throw new Error("Choose a PNG cursor up to 128 KB.");
      await claimUpload(ctx, id, args.storageId, "workspace_cursor", rowId);
    }
    if (row?.cursorStorageId !== args.storageId)
      await deleteClaimedUpload(
        ctx,
        row?.cursorStorageId,
        "workspace_cursor",
        rowId,
      );
    const theme = { ...WORKSPACE_DEFAULTS, ...row?.theme };
    await ctx.db.patch(rowId, {
      cursorStorageId: args.storageId ?? undefined,
      cursorHotspotX: args.storageId ? args.hotspotX : undefined,
      cursorHotspotY: args.storageId ? args.hotspotY : undefined,
      theme: {
        ...theme,
        cursor: args.storageId
          ? "uploaded"
          : theme.cursor === "uploaded"
            ? "kyro"
            : theme.cursor,
      },
    });
  },
});
const checkRef = makeFunctionReference<
  "query",
  { storageId: Id<"_storage"> },
  boolean
>("workspaceCursors:check");
const commitRef = makeFunctionReference<
  "mutation",
  {
    storageId: Id<"_storage"> | null;
    hotspotX: number;
    hotspotY: number;
    width: number;
    height: number;
  },
  null
>("workspaceCursors:commit");
export const set = action({
  args: {
    storageId: v.union(v.id("_storage"), v.null()),
    hotspotX: v.optional(v.number()),
    hotspotY: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.storageId)
      return await ctx.runMutation(commitRef, {
        storageId: null,
        hotspotX: 0,
        hotspotY: 0,
        width: 1,
        height: 1,
      });
    await ctx.runQuery(checkRef, { storageId: args.storageId });
    const file = await ctx.storage.get(args.storageId);
    if (!file) throw new Error("That cursor upload no longer exists.");
    const { width, height } = cursorPngSize(
      new Uint8Array(await file.arrayBuffer()),
    );
    return await ctx.runMutation(commitRef, {
      storageId: args.storageId,
      width,
      height,
      hotspotX: args.hotspotX ?? Math.min(4, width - 1),
      hotspotY: args.hotspotY ?? Math.min(3, height - 1),
    });
  },
});
