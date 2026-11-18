import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./functions";
import { requireActiveUser, isPlatformStaff } from "./lib";
import { claimUpload, requireOwnedUpload } from "./uploadSecurity";
import { hasPremium } from "../lib/entitlements";

export const catalog = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    const items = await ctx.db
      .query("communityDecorations")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(1000);
    return await Promise.all(
      items.map(async (item) => ({
        ...item,
        url: await ctx.storage.getUrl(item.storageId),
      })),
    );
  },
});
export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const page = await ctx.db
      .query("communityDecorations")
      .withIndex("by_owner", (q) => q.eq("ownerId", id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (item) => ({
          ...item,
          url: await ctx.storage.getUrl(item.storageId),
        })),
      ),
    };
  },
});
export const get = query({
  args: { id: v.id("communityDecorations") },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const item = await ctx.db.get(args.id);
    return item?.status === "approved"
      ? { ...item, url: await ctx.storage.getUrl(item.storageId) }
      : null;
  },
});
export const submit = mutation({
  args: {
    storageId: v.id("_storage"),
    kind: v.union(v.literal("avatar"), v.literal("profile")),
    name: v.string(),
    description: v.string(),
    animated: v.boolean(),
    originalWork: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!args.originalWork)
      throw new Error("Confirm that you created and own this decoration.");
    const name = args.name.trim();
    if (name.length < 3 || name.length > 60 || args.description.length > 300)
      throw new Error(
        "Use a name of 3–60 characters and a description under 300 characters.",
      );
    const upload = await requireOwnedUpload(ctx, id, args.storageId);
    if (
      !["image/png", "image/webp", "image/gif", "image/avif"].includes(
        upload.mimeType,
      )
    )
      throw new Error(
        "Use PNG, WebP, GIF or AVIF. SVG and video decorations are not supported.",
      );
    if (upload.size > (hasPremium(user) ? 5 : 2) * 1024 * 1024)
      throw new Error("Decorations are limited to 2 MB, or 5 MB with Premium.");
    const existing = await ctx.db
      .query("communityDecorations")
      .withIndex("by_owner", (q) => q.eq("ownerId", id))
      .collect();
    if (existing.filter((x) => x.status === "pending").length >= 10)
      throw new Error("You can have ten submissions waiting for review.");
    const itemId = await ctx.db.insert("communityDecorations", {
      ownerId: id,
      storageId: args.storageId,
      kind: args.kind,
      name,
      description: args.description.trim(),
      animated: args.animated,
      status: "pending",
      createdAt: Date.now(),
    });
    await claimUpload(ctx, id, args.storageId, "decoration", itemId);
    return itemId;
  },
});
export const queue = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("withdrawn"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireActiveUser(ctx);
    if (!isPlatformStaff(user)) throw new Error("Staff access required.");
    const source = args.status
      ? ctx.db
          .query("communityDecorations")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
      : ctx.db.query("communityDecorations");
    const page = await source.order("desc").paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (item) => ({
          ...item,
          url: await ctx.storage.getUrl(item.storageId),
          creator: (await ctx.db.get(item.ownerId))?.name ?? "Member",
        })),
      ),
    };
  },
});
export const gallery = query({
  args: {
    paginationOpts: paginationOptsValidator,
    kind: v.union(v.literal("avatar"), v.literal("profile")),
    term: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const page = args.term?.trim()
      ? await ctx.db
          .query("communityDecorations")
          .withSearchIndex("search_name", (q) =>
            q
              .search("name", args.term!.trim().slice(0, 60))
              .eq("status", "approved")
              .eq("kind", args.kind),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("communityDecorations")
          .withIndex("by_status_kind", (q) =>
            q.eq("status", "approved").eq("kind", args.kind),
          )
          .order("desc")
          .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (item) => ({
          ...item,
          url: await ctx.storage.getUrl(item.storageId),
        })),
      ),
    };
  },
});
export const review = mutation({
  args: {
    id: v.id("communityDecorations"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isPlatformStaff(user)) throw new Error("Staff access required.");
    const item = await ctx.db.get(args.id);
    if (!item || item.status === "withdrawn")
      throw new Error("This decoration is unavailable.");
    if (item.ownerId === id)
      throw new Error("Another staff member must review your own decoration.");
    await ctx.db.patch(item._id, {
      status: args.approve ? "approved" : "rejected",
      reviewedAt: Date.now(),
      reviewerId: id,
      note: args.note?.trim().slice(0, 300),
    });
  },
});
export const withdraw = mutation({
  args: { id: v.id("communityDecorations") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.ownerId !== id)
      throw new Error("You can only withdraw your own decoration.");
    await ctx.db.patch(item._id, { status: "withdrawn" });
  },
});
export const equip = mutation({
  args: { id: v.id("communityDecorations") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.status !== "approved")
      throw new Error("Only approved community decorations can be equipped.");
    await ctx.db.patch(
      id,
      item.kind === "avatar"
        ? { avatarDecoration: `community:${item._id}` }
        : { profileDecoration: `community:${item._id}` },
    );
  },
});
