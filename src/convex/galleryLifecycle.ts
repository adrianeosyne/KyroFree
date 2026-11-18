import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./functions";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { deleteClaimedUpload } from "./uploadSecurity";
export const cleanup = internalMutation({
  args: {
    kind: v.union(v.literal("user"), v.literal("collection")),
    id: v.string(),
    stage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stage = args.stage ?? 0;
    let rows: Doc<TableNames>[] = [];
    if (args.kind === "collection") {
      if (stage === 0)
        rows = await ctx.db
          .query("socialCollectionItems")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", args.id as Id<"socialCollections">),
          )
          .take(50);
      else
        rows = await ctx.db
          .query("socialCollectionMembers")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", args.id as Id<"socialCollections">),
          )
          .take(50);
    } else {
      const table = (
        [
          "portfolioProjects",
          "socialCollections",
          "socialCollectionMembers",
          "socialCollectionItems",
        ] as const
      )[stage];
      if (table)
        rows = await ctx.db
          .query(table)
          .withIndex("by_user", (q) => q.eq("userId", args.id as Id<"users">))
          .take(50);
    }
    for (const row of rows) {
      if ("privacy" in row && "name" in row)
        await ctx.scheduler.runAfter(
          0,
          makeFunctionReference<"mutation">("galleryLifecycle:cleanup"),
          { kind: "collection", id: row._id },
        );
      if (
        "kind" in row &&
        row.kind === "sticker" &&
        "storageId" in row &&
        row.storageId
      )
        await deleteClaimedUpload(
          ctx,
          row.storageId,
          "social_sticker",
          row._id,
        );
      await ctx.db.delete(row._id);
    }
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("galleryLifecycle:cleanup"),
        { ...args, stage },
      );
    else if (stage + 1 < (args.kind === "collection" ? 2 : 4))
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("galleryLifecycle:cleanup"),
        { ...args, stage: stage + 1 },
      );
  },
});
