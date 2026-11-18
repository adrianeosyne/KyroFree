import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation } from "./functions";
import { requireUser, requireActiveUser, type Ctx } from "./lib";
import { requireReadAccess } from "./messages";
import { requireWriteScope } from "./collaboration";
import { scopeFields } from "./advancedSchema";
import { boardObject } from "./whiteboardSchema";
import { text, revision } from "./advancedValidation";
import type { Id } from "./_generated/dataModel";
export async function boardAccess(
  ctx: Ctx,
  userId: Id<"users">,
  boardId: Id<"whiteboards">,
  write = false,
) {
  const board = await ctx.db.get(boardId);
  if (!board) throw new Error("Whiteboard unavailable.");
  if (write) await requireWriteScope(ctx, userId, board);
  else
    await requireReadAccess(
      ctx,
      userId,
      board.containerType,
      board.containerId,
    );
  const canEdit =
    board.userId === userId ||
    board.editors === undefined ||
    board.editors.includes(userId);
  if (write && !canEdit)
    throw new Error("This whiteboard is read-only for you.");
  return { board, canEdit, mine: board.userId === userId };
}
export const list = query({
  args: { ...scopeFields },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await requireReadAccess(ctx, id, args.containerType, args.containerId);
    const rows = await ctx.db
      .query("whiteboards")
      .withIndex("by_container", (q) =>
        q
          .eq("containerType", args.containerType)
          .eq("containerId", args.containerId),
      )
      .take(20);
    return rows.map((board) => ({ ...board, mine: board.userId === id }));
  },
});
export const info = query({
  args: { boardId: v.id("whiteboards") },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx),
      access = await boardAccess(ctx, id, args.boardId);
    return {
      ...access.board,
      mine: access.mine,
      canEdit: access.canEdit,
      updatedByName:
        (await ctx.db.get(access.board.updatedById))?.name ?? "Member",
    };
  },
});
export const objects = query({
  args: {
    boardId: v.id("whiteboards"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    await boardAccess(ctx, id, args.boardId);
    return await ctx.db
      .query("whiteboardObjects")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(100, args.paginationOpts.numItems),
      });
  },
});
export const create = mutation({
  args: { ...scopeFields, title: v.string() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx),
      access = await requireWriteScope(ctx, id, args);
    if (
      (
        await ctx.db
          .query("whiteboards")
          .withIndex("by_container", (q) =>
            q
              .eq("containerType", args.containerType)
              .eq("containerId", args.containerId),
          )
          .take(20)
      ).length >= 20
    )
      throw new Error(
        "This conversation can contain up to twenty whiteboards.",
      );
    return await ctx.db.insert("whiteboards", {
      ...args,
      title: text(args.title, "Whiteboard title", 120),
      userId: id,
      serverId: access.kind === "channel" ? access.server._id : undefined,
      revision: 1,
      updatedById: id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
export const saveObject = mutation({
  args: {
    boardId: v.id("whiteboards"),
    key: v.string(),
    ...boardObject,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    await boardAccess(ctx, id, args.boardId, true);
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(args.key) ||
      !/^#[0-9a-f]{6}$/i.test(args.color)
    )
      throw new Error("Invalid whiteboard object.");
    for (const value of [
      args.x,
      args.y,
      args.width,
      args.height,
      ...args.points.flatMap((p) => [p.x, p.y]),
    ])
      if (!Number.isFinite(value) || value < 0 || value > 1000)
        throw new Error(
          "Whiteboard coordinates must be between zero and one thousand.",
        );
    if (
      args.points.length > 300 ||
      (args.kind === "stroke" && args.points.length < 2) ||
      (args.kind !== "stroke" && args.points.length)
    )
      throw new Error("Choose a valid bounded drawing.");
    const existing = await ctx.db
      .query("whiteboardObjects")
      .withIndex("by_board_key", (q) =>
        q.eq("boardId", args.boardId).eq("key", args.key),
      )
      .unique();
    revision(existing?.revision ?? 0, args.expectedRevision);
    if (
      !existing &&
      (
        await ctx.db
          .query("whiteboardObjects")
          .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
          .take(500)
      ).length >= 500
    )
      throw new Error("A whiteboard can contain up to five hundred objects.");
    const { expectedRevision, ...fields } = args;
    const value = {
      ...fields,
      text: text(args.text, "Whiteboard text", 1000, args.kind !== "note"),
      revision: expectedRevision + 1,
      updatedById: id,
      updatedAt: Date.now(),
    };
    const objectId = existing
      ? existing._id
      : await ctx.db.insert("whiteboardObjects", { ...value, userId: id });
    if (existing) await ctx.db.patch(existing._id, value);
    await ctx.db.patch(args.boardId, {
      updatedById: id,
      updatedAt: Date.now(),
    });
    return objectId;
  },
});
export const removeObject = mutation({
  args: { objectId: v.id("whiteboardObjects"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx),
      object = await ctx.db.get(args.objectId);
    if (!object) return;
    await boardAccess(ctx, id, object.boardId, true);
    revision(object.revision, args.expectedRevision);
    await ctx.db.delete(object._id);
    await ctx.db.patch(object.boardId, {
      updatedById: id,
      updatedAt: Date.now(),
    });
  },
});
export const setEditors = mutation({
  args: {
    boardId: v.id("whiteboards"),
    editors: v.union(v.array(v.id("users")), v.null()),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx),
      access = await boardAccess(ctx, id, args.boardId, true);
    if (!access.mine)
      throw new Error("Only the whiteboard owner can set editors.");
    revision(access.board.revision, args.expectedRevision);
    if (args.editors && args.editors.length > 50)
      throw new Error("Choose up to fifty editors.");
    for (const editor of args.editors ?? [])
      await requireReadAccess(
        ctx,
        editor,
        access.board.containerType,
        access.board.containerId,
      );
    await ctx.db.patch(args.boardId, {
      editors: args.editors === null ? undefined : [...new Set(args.editors)],
      revision: access.board.revision + 1,
      updatedById: id,
      updatedAt: Date.now(),
    });
  },
});
export const remove = mutation({
  args: { boardId: v.id("whiteboards"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx),
      access = await boardAccess(ctx, id, args.boardId, true);
    if (!access.mine)
      throw new Error("Only the whiteboard owner can delete it.");
    revision(access.board.revision, args.expectedRevision);
    await ctx.db.delete(args.boardId);
    await ctx.scheduler.runAfter(
      0,
      makeFunctionReference<"mutation">("whiteboardLifecycle:cleanup"),
      { kind: "board", id: args.boardId },
    );
  },
});
