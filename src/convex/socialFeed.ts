import { v } from "convex/values";
import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { query, mutation, internalMutation } from "./functions";
import {
  requireProfile,
  requireUser,
  isBlockedBetween,
  blockedUserIds,
  hydrateUsers,
  restrictionLevel,
} from "./lib";
import { postPrivacy } from "./socialGamingSchema";
import { text, lifetime } from "./advancedValidation";
import type { Ctx } from "./lib";
import type { Doc, Id } from "./_generated/dataModel";

async function visible(
  ctx: Ctx,
  viewer: Id<"users">,
  post: Doc<"socialPosts">,
) {
  const author = await ctx.db.get(post.authorId);
  if (
    !author ||
    author.deletedAt ||
    author.botApplicationId ||
    (post.expiresAt && post.expiresAt <= Date.now())
  )
    return false;
  if (viewer === post.authorId) return true;
  if (await isBlockedBetween(ctx, viewer, post.authorId)) return false;
  if (post.privacy === "public") return true;
  if (post.privacy === "private") return false;
  if (post.privacy === "followers")
    return !!(await ctx.db
      .query("socialFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", viewer).eq("followingId", post.authorId),
      )
      .unique());
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("connections")
      .withIndex("by_requester", (q) => q.eq("requesterId", viewer))
      .filter((q) =>
        q.and(
          q.eq(q.field("addresseeId"), post.authorId),
          q.eq(q.field("status"), "accepted"),
        ),
      )
      .first(),
    ctx.db
      .query("connections")
      .withIndex("by_requester", (q) => q.eq("requesterId", post.authorId))
      .filter((q) =>
        q.and(
          q.eq(q.field("addresseeId"), viewer),
          q.eq(q.field("status"), "accepted"),
        ),
      )
      .first(),
  ]);
  return !!outgoing || !!incoming;
}
export const following = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const { id } = await requireUser(ctx);
    if (await isBlockedBetween(ctx, id, userId)) return { following: false };
    return {
      following: !!(await ctx.db
        .query("socialFollows")
        .withIndex("by_pair", (q) =>
          q.eq("followerId", id).eq("followingId", userId),
        )
        .unique()),
    };
  },
});
export const follow = mutation({
  args: { userId: v.id("users"), following: v.boolean() },
  handler: async (ctx, args) => {
    const { id: followerId } = await requireProfile(ctx);
    if (followerId === args.userId)
      throw new Error("You cannot follow yourself.");
    const row = await ctx.db
      .query("socialFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", followerId).eq("followingId", args.userId),
      )
      .unique();
    if (!args.following) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    const user = await ctx.db.get(args.userId);
    if (
      !user ||
      user.deletedAt ||
      user.botApplicationId ||
      (await isBlockedBetween(ctx, followerId, args.userId))
    )
      throw new Error("This profile is unavailable.");
    if (row) return;
    if (
      (
        await ctx.db
          .query("socialFollows")
          .withIndex("by_follower", (q) => q.eq("followerId", followerId))
          .take(1000)
      ).length >= 1000
    )
      throw new Error("You can follow up to 1,000 profiles.");
    await ctx.db.insert("socialFollows", {
      followerId,
      followingId: args.userId,
      createdAt: Date.now(),
    });
  },
});
export const followList = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const page = await ctx.db
      .query("socialFollows")
      .withIndex("by_follower", (q) => q.eq("followerId", id))
      .order("desc")
      .paginate(args.paginationOpts);
    const users = await hydrateUsers(
      ctx,
      page.page.map((row) => row.followingId),
      id,
    );
    const blocked = await blockedUserIds(ctx, id);
    return {
      ...page,
      page: page.page
        .map((row) => users.get(row.followingId))
        .filter(
          (user): user is NonNullable<typeof user> =>
            !!user && !blocked.has(user.id as Id<"users">),
        ),
    };
  },
});
export const publish = mutation({
  args: {
    content: v.string(),
    privacy: postPrivacy,
    kind: v.union(v.literal("post"), v.literal("story")),
    lifetimeSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id: authorId } = await requireProfile(ctx);
    if ((await restrictionLevel(ctx, authorId)) >= 2)
      throw new Error("Your account cannot publish right now.");
    const recent = await ctx.db
      .query("socialPosts")
      .withIndex("by_author", (q) => q.eq("authorId", authorId))
      .order("desc")
      .take(5);
    if (
      recent.length >= 5 &&
      recent.every((row) => row.createdAt > Date.now() - 60_000)
    )
      throw new Error("Wait a minute before publishing again.");
    if (
      args.kind === "story" &&
      (args.lifetimeSeconds === undefined || args.lifetimeSeconds > 7 * 86400)
    )
      throw new Error(
        "Choose a story lifetime between one minute and seven days.",
      );
    lifetime(args.lifetimeSeconds);
    if (args.kind === "post" && args.lifetimeSeconds !== undefined)
      throw new Error("Use a story for temporary content.");
    const expiresAt =
      args.kind === "story"
        ? Date.now() + args.lifetimeSeconds! * 1000
        : undefined;
    const id = await ctx.db.insert("socialPosts", {
      authorId,
      content: text(args.content, "Post", 4000),
      privacy: args.privacy,
      kind: args.kind,
      createdAt: Date.now(),
      expiresAt,
    });
    if (expiresAt)
      await ctx.scheduler.runAt(
        expiresAt,
        makeFunctionReference<"mutation">("socialFeed:expire"),
        { id },
      );
    return id;
  },
});
export const feed = query({
  args: {
    kind: v.union(v.literal("post"), v.literal("story")),
    authorId: v.optional(v.id("users")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { id } = await requireUser(ctx);
    const page = args.authorId
      ? await ctx.db
          .query("socialPosts")
          .withIndex("by_author", (q) => q.eq("authorId", args.authorId!))
          .filter((q) => q.eq(q.field("kind"), args.kind))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("socialPosts")
          .withIndex("by_kind", (q) => q.eq("kind", args.kind))
          .order("desc")
          .paginate(args.paginationOpts);
    const allowed = (
      await Promise.all(
        page.page.map(async (row) =>
          (await visible(ctx, id, row)) ? row : null,
        ),
      )
    ).filter((row): row is NonNullable<typeof row> => !!row);
    const authors = await hydrateUsers(
      ctx,
      allowed.map((row) => row.authorId),
      id,
    );
    return {
      ...page,
      page: allowed.map((row) => ({
        ...row,
        author: authors.get(row.authorId) ?? null,
        mine: row.authorId === id,
      })),
    };
  },
});
export const setPrivacy = mutation({
  args: { id: v.id("socialPosts"), privacy: postPrivacy },
  handler: async (ctx, args) => {
    const { id } = await requireProfile(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.authorId !== id) throw new Error("Post not found.");
    await ctx.db.patch(row._id, {
      privacy: args.privacy,
      updatedAt: Date.now(),
    });
  },
});
export const remove = mutation({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, args) => {
    const { id } = await requireProfile(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.authorId !== id) throw new Error("Post not found.");
    await ctx.db.delete(row._id);
  },
});
export const expire = internalMutation({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row?.expiresAt && row.expiresAt <= Date.now()) await ctx.db.delete(id);
  },
});
export const interests = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    return ctx.db
      .query("interestProfiles")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
  },
});
export const saveInterests = mutation({
  args: { interests: v.array(v.string()), discoverable: v.boolean() },
  handler: async (ctx, args) => {
    const { id: userId } = await requireProfile(ctx);
    const interests = [
      ...new Set(
        args.interests.map((item) => text(item, "Interest", 30).toLowerCase()),
      ),
    ];
    if (interests.length > 12) throw new Error("Choose up to 12 interests.");
    for (const row of await ctx.db
      .query("interestMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(12))
      await ctx.db.delete(row._id);
    if (args.discoverable)
      for (const interest of interests)
        await ctx.db.insert("interestMembers", { userId, interest });
    const profile = await ctx.db
      .query("interestProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const values = {
      interests,
      discoverable: args.discoverable,
      updatedAt: Date.now(),
    };
    if (profile) await ctx.db.patch(profile._id, values);
    else await ctx.db.insert("interestProfiles", { userId, ...values });
  },
});
export const discover = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const profile = await ctx.db
      .query("interestProfiles")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    if (!profile?.interests.length) return [];
    const matches = new Map<Id<"users">, string[]>();
    for (const interest of profile.interests)
      for (const row of await ctx.db
        .query("interestMembers")
        .withIndex("by_interest", (q) => q.eq("interest", interest))
        .take(50))
        if (row.userId !== id)
          matches.set(row.userId, [
            ...(matches.get(row.userId) ?? []),
            interest,
          ]);
    const blocked = await blockedUserIds(ctx, id);
    const ids = [...matches.keys()]
      .filter((userId) => !blocked.has(userId))
      .sort((a, b) => matches.get(b)!.length - matches.get(a)!.length)
      .slice(0, 20);
    const users = await hydrateUsers(ctx, ids, id);
    return ids
      .map((userId) => ({
        user: users.get(userId) ?? null,
        sharedInterests: matches.get(userId)!,
      }))
      .filter((row) => row.user && !row.user.botApplicationId);
  },
});
