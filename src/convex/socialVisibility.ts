import { isBlockedBetween, type Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";
export async function socialVisible(
  ctx: Ctx,
  viewer: Id<"users">,
  ownerId: Id<"users">,
  privacy: "public" | "followers" | "friends" | "private",
  expiresAt?: number,
) {
  const owner = await ctx.db.get(ownerId);
  if (
    !owner ||
    owner.deletedAt !== undefined ||
    owner.botApplicationId ||
    (expiresAt !== undefined && expiresAt <= Date.now())
  )
    return false;
  if (viewer === ownerId) return true;
  if (await isBlockedBetween(ctx, viewer, ownerId)) return false;
  if (privacy === "public") return true;
  if (privacy === "private") return false;
  if (privacy === "followers")
    return !!(await ctx.db
      .query("socialFollows")
      .withIndex("by_pair", (q) =>
        q.eq("followerId", viewer).eq("followingId", ownerId),
      )
      .unique());
  const outgoing = await ctx.db
    .query("connections")
    .withIndex("by_requester", (q) => q.eq("requesterId", viewer))
    .filter((q) =>
      q.and(
        q.eq(q.field("addresseeId"), ownerId),
        q.eq(q.field("status"), "accepted"),
      ),
    )
    .first();
  if (outgoing) return true;
  return !!(await ctx.db
    .query("connections")
    .withIndex("by_requester", (q) => q.eq("requesterId", ownerId))
    .filter((q) =>
      q.and(
        q.eq(q.field("addresseeId"), viewer),
        q.eq(q.field("status"), "accepted"),
      ),
    )
    .first());
}
export async function collectionAccess(
  ctx: Ctx,
  viewer: Id<"users">,
  collectionId: Id<"socialCollections">,
  write = false,
) {
  const collection = await ctx.db.get(collectionId);
  if (!collection) throw new Error("Collection unavailable.");
  const owner = await ctx.db.get(collection.userId);
  if (
    !owner ||
    owner.deletedAt !== undefined ||
    (await isBlockedBetween(ctx, viewer, owner._id))
  )
    throw new Error("Collection unavailable.");
  const mine = collection.userId === viewer;
  const membership = mine
    ? null
    : await ctx.db
        .query("socialCollectionMembers")
        .withIndex("by_collection_user", (q) =>
          q.eq("collectionId", collectionId).eq("userId", viewer),
        )
        .unique();
  const canEdit =
    mine || !!(membership?.accepted && membership.role === "editor");
  if (
    write
      ? !canEdit
      : !mine &&
        !membership?.accepted &&
        !(await socialVisible(ctx, viewer, owner._id, collection.privacy))
  )
    throw new Error(
      write
        ? "Collection editor access is required."
        : "Collection unavailable.",
    );
  return { collection, mine, canEdit, membership };
}
