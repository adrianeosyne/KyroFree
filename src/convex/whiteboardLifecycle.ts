import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./functions";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
export const cleanup = internalMutation({
  args: {
    kind: v.union(
      v.literal("user"),
      v.literal("server"),
      v.literal("container"),
      v.literal("board"),
    ),
    id: v.string(),
    containerType: v.optional(
      v.union(v.literal("channel"), v.literal("conversation")),
    ),
    stage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stage = args.stage ?? 0;
    let rows: Doc<TableNames>[] = [];
    if (args.kind === "board")
      rows = await ctx.db
        .query("whiteboardObjects")
        .withIndex("by_board", (q) =>
          q.eq("boardId", args.id as Id<"whiteboards">),
        )
        .take(50);
    if (args.kind === "server")
      rows = await ctx.db
        .query("whiteboards")
        .withIndex("by_server", (q) =>
          q.eq("serverId", args.id as Id<"servers">),
        )
        .take(50);
    if (args.kind === "container")
      rows = await ctx.db
        .query("whiteboards")
        .withIndex("by_container", (q) =>
          q.eq("containerType", args.containerType!).eq("containerId", args.id),
        )
        .take(50);
    if (args.kind === "user")
      rows = await ctx.db
        .query(stage === 0 ? "whiteboards" : "whiteboardObjects")
        .withIndex("by_user", (q) => q.eq("userId", args.id as Id<"users">))
        .take(50);
    for (const row of rows) {
      if ("containerType" in row)
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<"mutation">("whiteboardLifecycle:cleanup"),
          { kind: "board", id: row._id },
        );
      await ctx.db.delete(row._id);
    }
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("whiteboardLifecycle:cleanup"),
        { ...args, stage },
      );
    else if (args.kind === "user" && stage === 0)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("whiteboardLifecycle:cleanup"),
        { ...args, stage: 1 },
      );
  },
});
