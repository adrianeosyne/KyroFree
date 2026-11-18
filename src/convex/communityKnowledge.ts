import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation } from "./functions";
import {
  requireActiveUser,
  requireUser,
  requireServerAccess,
  logAudit,
  restrictionLevel,
} from "./lib";
import { PERMISSIONS } from "../lib/permissions";
import { queueCleanup } from "./advancedLifecycle";
import { text, revision } from "./advancedValidation";
import type { Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";

const kind = v.union(
  v.literal("wiki"),
  v.literal("announcement"),
  v.literal("suggestion"),
);
const status = v.union(
  v.literal("open"),
  v.literal("planned"),
  v.literal("completed"),
  v.literal("declined"),
);
async function access(
  ctx: Ctx,
  userId: Id<"users">,
  serverId: Id<"servers">,
  writing = false,
) {
  const result = await requireServerAccess(ctx, serverId, userId);
  const manager = result.permissions.includes(PERMISSIONS.MANAGE_SERVER);
  if (
    writing &&
    (!result.permissions.includes(PERMISSIONS.SEND_MESSAGES) ||
      (await restrictionLevel(ctx, userId)) >= 2 ||
      (!manager &&
        ((result.member.communicationDisabledUntil ?? 0) > Date.now() ||
          (result.server.locked &&
            (!result.server.lockedUntil ||
              result.server.lockedUntil > Date.now())))))
  )
    throw new Error("You cannot contribute to this community right now.");
  return { ...result, manager };
}
export const list = query({
  args: {
    serverId: v.id("servers"),
    kind,
    category: v.optional(v.string()),
    term: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const result = await access(ctx, id, args.serverId);
    const page = args.term?.trim()
      ? await ctx.db
          .query("communityPages")
          .withSearchIndex("search_title", (q) => {
            let search = q
              .search("title", text(args.term!, "Search", 100))
              .eq("serverId", args.serverId)
              .eq("kind", args.kind);
            if (args.category) search = search.eq("category", args.category);
            return search;
          })
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("communityPages")
          .withIndex("by_server_kind", (q) =>
            q.eq("serverId", args.serverId).eq("kind", args.kind),
          )
          .filter((q) =>
            args.category ? q.eq(q.field("category"), args.category) : true,
          )
          .order("desc")
          .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (row) => ({
          ...row,
          content: row.content.slice(0, 240),
          canEdit:
            result.manager ||
            (row.authorId === id && row.kind !== "announcement"),
          voted: !!(await ctx.db
            .query("suggestionVotes")
            .withIndex("by_page_user", (q) =>
              q.eq("pageId", row._id).eq("userId", id),
            )
            .unique()),
        })),
      ),
    };
  },
});
export const page = query({
  args: { id: v.id("communityPages") },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Page not found.");
    const result = await access(ctx, id, row.serverId);
    return {
      ...row,
      canEdit:
        result.manager || (row.authorId === id && row.kind !== "announcement"),
      canManage: result.manager,
    };
  },
});
export const create = mutation({
  args: {
    serverId: v.id("servers"),
    kind,
    title: v.string(),
    content: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const { id: authorId } = await requireActiveUser(ctx);
    const result = await access(ctx, authorId, args.serverId, true);
    if (args.kind === "announcement" && !result.manager)
      throw new Error("Manage Server is required to publish announcements.");
    const rows = await ctx.db
      .query("communityPages")
      .withIndex("by_server_kind", (q) =>
        q.eq("serverId", args.serverId).eq("kind", args.kind),
      )
      .take(1000);
    if (rows.length >= 1000)
      throw new Error("This board can hold up to 1,000 pages.");
    const recent = await ctx.db
      .query("communityPages")
      .withIndex("by_author", (q) => q.eq("authorId", authorId))
      .order("desc")
      .take(5);
    if (
      recent.length >= 5 &&
      recent.every((r) => r.createdAt > Date.now() - 60_000)
    )
      throw new Error("Wait a minute before publishing another page.");
    return ctx.db.insert("communityPages", {
      ...args,
      title: text(args.title, "Title", 160),
      content: text(args.content, "Content", 50000),
      category: text(args.category, "Category", 60, true),
      authorId,
      revision: 1,
      votes: 0,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
export const save = mutation({
  args: {
    id: v.id("communityPages"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Page not found.");
    const result = await access(ctx, id, row.serverId, true);
    if (!result.manager && (row.authorId !== id || row.kind === "announcement"))
      throw new Error("You cannot edit this page.");
    revision(row.revision, args.expectedRevision);
    const values = {
      title: text(args.title, "Title", 160),
      content: text(args.content, "Content", 50000),
      category: text(args.category, "Category", 60, true),
    };
    const old = await ctx.db
      .query("communityPageVersions")
      .withIndex("by_page", (q) => q.eq("pageId", row._id))
      .order("asc")
      .take(50);
    if (old.length >= 50) await ctx.db.delete(old[0]._id);
    await ctx.db.insert("communityPageVersions", {
      pageId: row._id,
      title: row.title,
      content: row.content,
      category: row.category,
      revision: row.revision,
      editorId: id,
      savedAt: Date.now(),
    });
    await ctx.db.patch(row._id, {
      ...values,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "knowledge.page_updated",
      targetId: row._id,
      details: values.title,
    });
  },
});
export const vote = mutation({
  args: { id: v.id("communityPages") },
  handler: async (ctx, args) => {
    const { id: userId } = await requireActiveUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.kind !== "suggestion")
      throw new Error("Suggestion not found.");
    await access(ctx, userId, row.serverId, true);
    const vote = await ctx.db
      .query("suggestionVotes")
      .withIndex("by_page_user", (q) =>
        q.eq("pageId", row._id).eq("userId", userId),
      )
      .unique();
    if (vote) await ctx.db.delete(vote._id);
    else
      await ctx.db.insert("suggestionVotes", {
        pageId: row._id,
        userId,
        createdAt: Date.now(),
      });
    await ctx.db.patch(row._id, {
      votes: Math.max(0, row.votes + (vote ? -1 : 1)),
    });
  },
});
export const setStatus = mutation({
  args: { id: v.id("communityPages"), status },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.kind !== "suggestion")
      throw new Error("Suggestion not found.");
    if (!(await access(ctx, id, row.serverId, true)).manager)
      throw new Error("Manage Server is required.");
    await ctx.db.patch(row._id, {
      status: args.status,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "knowledge.suggestion_status",
      targetId: row._id,
      details: args.status,
    });
  },
});
export const history = query({
  args: { id: v.id("communityPages"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Page not found.");
    await access(ctx, id, row.serverId);
    return ctx.db
      .query("communityPageVersions")
      .withIndex("by_page", (q) => q.eq("pageId", args.id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
export const restore = mutation({
  args: {
    versionId: v.id("communityPageVersions"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const row = await ctx.db.get(args.versionId);
    if (!row) throw new Error("Version not found.");
    const page = await ctx.db.get(row.pageId);
    if (!page) throw new Error("Page not found.");
    await access(ctx, id, page.serverId, true);
    await ctx.runMutation(
      makeFunctionReference<"mutation">("communityKnowledge:save"),
      {
        id: page._id,
        title: row.title,
        content: row.content,
        category: row.category,
        expectedRevision: args.expectedRevision,
      },
    );
  },
});
export const remove = mutation({
  args: { id: v.id("communityPages") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Page not found.");
    const result = await access(ctx, id, row.serverId, true);
    if (!result.manager && (row.authorId !== id || row.kind === "announcement"))
      throw new Error("You cannot delete this page.");
    await queueCleanup(ctx, { kind: "page", id: row._id });
    await ctx.db.delete(row._id);
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "knowledge.page_deleted",
      targetId: row._id,
      details: row.title,
    });
  },
});
