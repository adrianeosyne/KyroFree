import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation } from "./functions";
import {
  requireUser,
  requireProfile,
  isBlockedBetween,
  canSendDirectMessage,
  restrictionLevel,
  notify,
} from "./lib";
import type { Id } from "./_generated/dataModel";
import { postPrivacy } from "./socialGamingSchema";
import { socialVisible, collectionAccess } from "./socialVisibility";
import { text, revision } from "./advancedValidation";
import {
  claimUpload,
  requireOwnedUpload,
  deleteClaimedUpload,
} from "./uploadSecurity";
import { fileUrl } from "./fileAccess";
import type { Ctx } from "./lib";
function https(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid HTTPS URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.href.length > 2000
  )
    throw new Error("Enter a valid HTTPS URL without credentials.");
  return url.href;
}
async function contributor(ctx: Ctx) {
  const auth = await requireProfile(ctx);
  if (auth.user.botApplicationId || (await restrictionLevel(ctx, auth.id)) >= 2)
    throw new Error("Your account cannot contribute right now.");
  return auth;
}
export const projects = query({
  args: { userId: v.id("users"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const page = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const row of page.page)
      if (await socialVisible(ctx, id, row.userId, row.privacy))
        rows.push({ ...row, mine: row.userId === id });
    return { ...page, page: rows };
  },
});
export const saveProject = mutation({
  args: {
    projectId: v.optional(v.id("portfolioProjects")),
    title: v.string(),
    description: v.string(),
    url: v.string(),
    skills: v.array(v.string()),
    privacy: postPrivacy,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx);
    const existing = args.projectId ? await ctx.db.get(args.projectId) : null;
    if (args.projectId && (!existing || existing.userId !== id))
      throw new Error("Project unavailable.");
    revision(existing?.revision ?? 0, args.expectedRevision);
    if (
      !existing &&
      (
        await ctx.db
          .query("portfolioProjects")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .take(50)
      ).length >= 50
    )
      throw new Error("Your portfolio can contain up to fifty projects.");
    if (args.skills.length > 12)
      throw new Error("Choose up to twelve project skills.");
    const fields = {
      title: text(args.title, "Project title", 120),
      description: text(args.description, "Project description", 4000, true),
      url: https(args.url),
      skills: [...new Set(args.skills.map((s) => text(s, "Skill", 40)))],
      privacy: args.privacy,
      revision: args.expectedRevision + 1,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("portfolioProjects", {
      ...fields,
      userId: id,
      createdAt: Date.now(),
    });
  },
});
export const removeProject = mutation({
  args: { projectId: v.id("portfolioProjects"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx),
      project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== id)
      throw new Error("Project unavailable.");
    revision(project.revision, args.expectedRevision);
    await ctx.db.delete(project._id);
  },
});
export const collections = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx),
      target = args.userId ?? id;
    const own = await ctx.db
      .query("socialCollections")
      .withIndex("by_user", (q) => q.eq("userId", target))
      .take(50);
    const invited =
      target === id
        ? await ctx.db
            .query("socialCollectionMembers")
            .withIndex("by_user", (q) => q.eq("userId", id))
            .take(100)
        : [];
    const rows = [];
    for (const row of own) {
      try {
        const access = await collectionAccess(ctx, id, row._id);
        rows.push({
          ...row,
          mine: access.mine,
          canEdit: access.canEdit,
          pending: false,
          role: access.mine ? "owner" : "viewer",
        });
      } catch {
        /* Private collections stay private. */
      }
    }
    for (const member of invited) {
      const row = await ctx.db.get(member.collectionId),
        owner = row && (await ctx.db.get(row.userId));
      if (
        !row ||
        !owner ||
        owner.deletedAt !== undefined ||
        (await isBlockedBetween(ctx, id, owner._id))
      )
        continue;
      rows.push({
        ...row,
        mine: false,
        canEdit: member.accepted && member.role === "editor",
        pending: !member.accepted,
        role: member.role,
      });
    }
    return rows;
  },
});
export const saveCollection = mutation({
  args: {
    collectionId: v.optional(v.id("socialCollections")),
    name: v.string(),
    description: v.string(),
    privacy: postPrivacy,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx);
    const existing = args.collectionId
      ? (await collectionAccess(ctx, id, args.collectionId, true)).collection
      : null;
    if (existing && existing.userId !== id)
      throw new Error("Only the collection owner can change its settings.");
    revision(existing?.revision ?? 0, args.expectedRevision);
    if (
      !existing &&
      (
        await ctx.db
          .query("socialCollections")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .take(50)
      ).length >= 50
    )
      throw new Error("You can own up to fifty collections.");
    const fields = {
      name: text(args.name, "Collection name", 100),
      description: text(args.description, "Collection description", 2000, true),
      privacy: args.privacy,
      revision: args.expectedRevision + 1,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("socialCollections", {
      ...fields,
      userId: id,
      createdAt: Date.now(),
    });
  },
});
export const collection = query({
  args: {
    collectionId: v.id("socialCollections"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx),
      access = await collectionAccess(ctx, id, args.collectionId);
    const page = await ctx.db
      .query("socialCollectionItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(20, args.paginationOpts.numItems),
      });
    const rows = [];
    for (const item of page.page) {
      const creator = await ctx.db.get(item.userId);
      if (
        !creator ||
        creator.deletedAt !== undefined ||
        (await isBlockedBetween(ctx, id, creator._id))
      )
        continue;
      const post = item.postId ? await ctx.db.get(item.postId) : null;
      if (
        item.postId &&
        (!post ||
          !(await socialVisible(
            ctx,
            id,
            post.authorId,
            post.privacy,
            post.expiresAt,
          )))
      )
        continue;
      rows.push({
        ...item,
        postContent: post?.content ?? null,
        downloadUrl: item.storageId ? fileUrl(item.storageId, id) : null,
        canRemove: access.canEdit && (access.mine || item.userId === id),
      });
    }
    return {
      ...page,
      page: rows,
      name: access.collection.name,
      mine: access.mine,
      canEdit: access.canEdit,
    };
  },
});
export const info = query({
  args: { collectionId: v.id("socialCollections") },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx),
      access = await collectionAccess(ctx, id, args.collectionId);
    return { ...access.collection, mine: access.mine, canEdit: access.canEdit };
  },
});
export const addItem = mutation({
  args: {
    collectionId: v.id("socialCollections"),
    kind: v.union(v.literal("link"), v.literal("post"), v.literal("sticker")),
    title: v.string(),
    description: v.string(),
    url: v.optional(v.string()),
    postId: v.optional(v.id("socialPosts")),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx);
    await collectionAccess(ctx, id, args.collectionId, true);
    if (
      (
        await ctx.db
          .query("socialCollectionItems")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", args.collectionId),
          )
          .take(200)
      ).length >= 200
    )
      throw new Error("A collection can contain up to two hundred items.");
    let url: string | undefined,
      postId: Id<"socialPosts"> | undefined,
      storageId: Id<"_storage"> | undefined;
    if (args.kind === "link") {
      if (!args.url || args.postId || args.storageId)
        throw new Error("Choose a link URL.");
      url = https(args.url);
    }
    if (args.kind === "post") {
      const post = args.postId && (await ctx.db.get(args.postId));
      if (
        !post ||
        args.url ||
        args.storageId ||
        !(await socialVisible(
          ctx,
          id,
          post.authorId,
          post.privacy,
          post.expiresAt,
        ))
      )
        throw new Error("Choose a visible social post.");
      postId = post._id;
    }
    if (args.kind === "sticker") {
      if (!args.storageId || args.postId || args.url)
        throw new Error("Upload a sticker image.");
      const upload = await requireOwnedUpload(ctx, id, args.storageId, {
        imageOnly: true,
      });
      if (
        upload.size > 1024 * 1024 ||
        ![
          "image/png",
          "image/apng",
          "image/jpeg",
          "image/webp",
          "image/gif",
        ].includes(upload.mimeType.split(";", 1)[0].toLowerCase())
      )
        throw new Error("Choose a PNG, JPEG, WebP or GIF sticker up to 1 MiB.");
      storageId = args.storageId;
    }
    const itemId = await ctx.db.insert("socialCollectionItems", {
      collectionId: args.collectionId,
      userId: id,
      kind: args.kind,
      title: text(args.title, "Item title", 120),
      description: text(args.description, "Item description", 2000, true),
      url,
      postId,
      storageId,
      createdAt: Date.now(),
    });
    if (storageId)
      await claimUpload(ctx, id, storageId, "social_sticker", itemId, {
        imageOnly: true,
      });
    return itemId;
  },
});
export const removeItem = mutation({
  args: { itemId: v.id("socialCollectionItems") },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx),
      item = await ctx.db.get(args.itemId);
    if (!item) return;
    const access = await collectionAccess(ctx, id, item.collectionId, true);
    if (!access.mine && item.userId !== id)
      throw new Error(
        "Only the author or collection owner can remove an item.",
      );
    if (item.storageId)
      await deleteClaimedUpload(
        ctx,
        item.storageId,
        "social_sticker",
        item._id,
      );
    await ctx.db.delete(item._id);
  },
});
export const members = query({
  args: { collectionId: v.id("socialCollections") },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx),
      access = await collectionAccess(ctx, id, args.collectionId);
    if (!access.mine)
      throw new Error("Only the owner can manage collection members.");
    const members = await ctx.db
      .query("socialCollectionMembers")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .take(20);
    return await Promise.all(
      members.map(async (row) => ({
        ...row,
        name: (await ctx.db.get(row.userId))?.name ?? "Member",
      })),
    );
  },
});
export const invite = mutation({
  args: {
    collectionId: v.id("socialCollections"),
    userId: v.id("users"),
    role: v.union(v.literal("viewer"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx),
      access = await collectionAccess(ctx, id, args.collectionId, true);
    if (!access.mine || id === args.userId)
      throw new Error("Only the owner can invite another member.");
    const target = await ctx.db.get(args.userId),
      contact = await canSendDirectMessage(ctx, id, args.userId);
    if (
      !target ||
      target.deletedAt !== undefined ||
      target.botApplicationId ||
      !contact.ok ||
      (await isBlockedBetween(ctx, id, args.userId))
    )
      throw new Error("This member cannot receive a collection invitation.");
    const existing = await ctx.db
      .query("socialCollectionMembers")
      .withIndex("by_collection_user", (q) =>
        q.eq("collectionId", args.collectionId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        accepted: existing.role === args.role && existing.accepted,
      });
      return existing._id;
    }
    if (
      (
        await ctx.db
          .query("socialCollectionMembers")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", args.collectionId),
          )
          .take(20)
      ).length >= 20 ||
      (
        await ctx.db
          .query("socialCollectionMembers")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .take(100)
      ).length >= 100
    )
      throw new Error("Collection invitation limit reached.");
    const memberId = await ctx.db.insert("socialCollectionMembers", {
      ...args,
      accepted: false,
      createdAt: Date.now(),
    });
    await notify(ctx, {
      userId: args.userId,
      actorId: id,
      type: "mention",
      title: "Shared collection invitation",
      body: access.collection.name,
      link: "/dashboard/social?section=collections",
    });
    return memberId;
  },
});
export const respond = mutation({
  args: { collectionId: v.id("socialCollections"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx),
      row = await ctx.db
        .query("socialCollectionMembers")
        .withIndex("by_collection_user", (q) =>
          q.eq("collectionId", args.collectionId).eq("userId", id),
        )
        .unique();
    if (!row) throw new Error("Invitation unavailable.");
    if (!args.accept) {
      await ctx.db.delete(row._id);
      return;
    }
    const collection = await ctx.db.get(args.collectionId),
      owner = collection && (await ctx.db.get(collection.userId));
    if (
      !owner ||
      owner.deletedAt !== undefined ||
      owner.frozenAt !== undefined ||
      (await isBlockedBetween(ctx, id, owner._id))
    )
      throw new Error("Invitation unavailable.");
    await ctx.db.patch(row._id, { accepted: true });
  },
});
export const revoke = mutation({
  args: { memberId: v.id("socialCollectionMembers") },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx),
      row = await ctx.db.get(args.memberId);
    if (!row) return;
    const access = await collectionAccess(ctx, id, row.collectionId, true);
    if (!access.mine) throw new Error("Only the owner can revoke access.");
    await ctx.db.delete(row._id);
  },
});
export const removeCollection = mutation({
  args: {
    collectionId: v.id("socialCollections"),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const { id } = await contributor(ctx),
      access = await collectionAccess(ctx, id, args.collectionId, true);
    if (!access.mine)
      throw new Error("Only the owner can delete a collection.");
    revision(access.collection.revision, args.expectedRevision);
    await ctx.db.delete(args.collectionId);
    await ctx.scheduler.runAfter(
      0,
      makeFunctionReference<"mutation">("galleryLifecycle:cleanup"),
      { kind: "collection", id: args.collectionId },
    );
  },
});
