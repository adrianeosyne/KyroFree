import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./functions";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import { isFounderUser, requireActiveUser } from "./lib";
import { sha256Hex } from "./sha256";
import { extendPremium, syncPremiumAccess } from "./premium";
import { PREMIUM_DURATIONS, DAY_MS } from "../lib/premiumProgress";

async function createCodes(
  ctx: MutationCtx,
  days: number,
  count: number,
  expiresInDays?: number,
) {
  const { id, user } = await requireActiveUser(ctx);
  if (!isFounderUser(user))
    throw new Error("Only adrianeosyne can generate Premium codes.");
  if (!PREMIUM_DURATIONS.some((d) => d.days === days))
    throw new Error("Choose 1, 3 or 6 months, or 1 year.");
  if (!Number.isInteger(count) || count < 1 || count > 20)
    throw new Error("Generate between 1 and 20 codes at a time.");
  if (expiresInDays !== undefined && ![7, 30, 90].includes(expiresInDays))
    throw new Error(
      "Choose no expiry or a redemption window of 7, 30 or 90 days.",
    );
  const now = Date.now();
  const expiresAt =
    expiresInDays === undefined ? undefined : now + expiresInDays * DAY_MS;
  const codes: string[] = [];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let index = 0; index < count; index++) {
    let created = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      const value = Array.from(bytes, (b) => alphabet[b & 31]).join("");
      const code = `KYRO-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
      const hash = sha256Hex(code);
      if (
        await ctx.db
          .query("premiumCodes")
          .withIndex("by_hash", (q) => q.eq("hash", hash))
          .unique()
      )
        continue;
      const codeId = await ctx.db.insert("premiumCodes", {
        hash,
        suffix: value.slice(-4),
        days,
        creatorId: id,
        createdAt: now,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      });
      await ctx.db.insert("adminActions", {
        createdAt: now,
        actorId: id,
        action: "premium_code_created",
        targetType: "premium_code",
        targetId: codeId,
        details: `${days} days · ending ${value.slice(-4)}${expiresAt ? ` · redeem by ${new Date(expiresAt).toISOString()}` : ""}`,
      });
      codes.push(code);
      created = true;
      break;
    }
    if (!created) throw new Error("Could not generate codes. Try again.");
  }
  return { codes, days, expiresAt: expiresAt ?? null };
}
export const generate = mutation({
  args: { days: v.number(), expiresInDays: v.optional(v.number()) },
  handler: async (ctx, { days, expiresInDays }) => {
    const result = await createCodes(ctx, days, 1, expiresInDays);
    return { code: result.codes[0], days, expiresAt: result.expiresAt };
  },
});
export const generateBatch = mutation({
  args: {
    days: v.number(),
    count: v.number(),
    expiresInDays: v.optional(v.number()),
  },
  handler: (ctx, { days, count, expiresInDays }) =>
    createCodes(ctx, days, count, expiresInDays),
});
function publicCode(row: Doc<"premiumCodes">) {
  const {
    _id,
    _creationTime,
    suffix,
    days,
    creatorId,
    createdAt,
    expiresAt,
    redeemedBy,
    recipientId,
    redeemedAt,
    revokedAt,
  } = row;
  return {
    _id,
    _creationTime,
    suffix,
    days,
    creatorId,
    createdAt,
    expiresAt,
    redeemedBy,
    recipientId,
    redeemedAt,
    revokedAt,
  };
}
export const history = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("all"),
        v.literal("available"),
        v.literal("redeemed"),
        v.literal("revoked"),
        v.literal("expired"),
      ),
    ),
    suffix: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, status, suffix }) => {
    const { user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can manage Premium codes.");
    const ending = suffix?.trim().toUpperCase() ?? "";
    if (ending.length > 4 || (ending && !/^[A-Z2-9]+$/.test(ending)))
      throw new Error(
        "Search using up to four characters from the code ending.",
      );
    let rows = ctx.db
      .query("premiumCodes")
      .withIndex("by_created")
      .order("desc");
    if (ending)
      rows = rows.filter((q) =>
        q.and(
          q.gte(q.field("suffix"), ending),
          q.lt(q.field("suffix"), ending + "\uffff"),
        ),
      );
    const now = Date.now();
    if (status === "redeemed")
      rows = rows.filter((q) => q.neq(q.field("redeemedAt"), undefined));
    if (status === "revoked")
      rows = rows.filter((q) =>
        q.and(
          q.eq(q.field("redeemedAt"), undefined),
          q.neq(q.field("revokedAt"), undefined),
        ),
      );
    if (status === "expired")
      rows = rows.filter((q) =>
        q.and(
          q.eq(q.field("redeemedAt"), undefined),
          q.eq(q.field("revokedAt"), undefined),
          q.neq(q.field("expiresAt"), undefined),
          q.lte(q.field("expiresAt"), now),
        ),
      );
    if (status === "available")
      rows = rows.filter((q) =>
        q.and(
          q.eq(q.field("redeemedAt"), undefined),
          q.eq(q.field("revokedAt"), undefined),
          q.or(
            q.eq(q.field("expiresAt"), undefined),
            q.gt(q.field("expiresAt"), now),
          ),
        ),
      );
    const page = await rows.paginate({
      ...paginationOpts,
      numItems: Math.min(paginationOpts.numItems, 50),
      maximumRowsRead: 500,
    });
    return { ...page, page: page.page.map(publicCode) };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can manage Premium codes.");
    const rows = await ctx.db
      .query("premiumCodes")
      .withIndex("by_created")
      .order("desc")
      .take(100);
    return rows.map(publicCode);
  },
});
export const revoke = mutation({
  args: { id: v.id("premiumCodes") },
  handler: async (ctx, args) => {
    const { id, user } = await requireActiveUser(ctx);
    if (!isFounderUser(user))
      throw new Error("Only adrianeosyne can revoke Premium codes.");
    const code = await ctx.db.get(args.id);
    if (
      !code ||
      code.redeemedAt !== undefined ||
      code.revokedAt !== undefined ||
      (code.expiresAt !== undefined && code.expiresAt <= Date.now())
    )
      throw new Error("This code is no longer available.");
    await ctx.db.patch(code._id, { revokedAt: Date.now() });
    await ctx.db.insert("adminActions", {
      createdAt: Date.now(),
      actorId: id,
      action: "premium_code_revoked",
      targetType: "premium_code",
      targetId: code._id,
      details: `Code ending ${code.suffix} revoked.`,
    });
  },
});
export const redeem = mutation({
  args: { code: v.string(), recipientId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx),
      now = Date.now();
    const attempt = await ctx.db
      .query("premiumCodeAttempts")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .unique();
    if (attempt && now - attempt.windowStart < 60000 && attempt.count >= 5)
      return {
        ok: false as const,
        error: "Too many attempts. Try again in a minute.",
      };
    if (attempt)
      await ctx.db.patch(attempt._id, {
        windowStart:
          now - attempt.windowStart < 60000 ? attempt.windowStart : now,
        count: now - attempt.windowStart < 60000 ? attempt.count + 1 : 1,
      });
    else
      await ctx.db.insert("premiumCodeAttempts", {
        userId: id,
        windowStart: now,
        count: 1,
      });
    const code = args.code.trim().toUpperCase();
    if (!/^KYRO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code))
      return {
        ok: false as const,
        error: "Enter a code in the format KYRO-XXXX-XXXX-XXXX.",
      };
    const row = await ctx.db
      .query("premiumCodes")
      .withIndex("by_hash", (q) => q.eq("hash", sha256Hex(code)))
      .unique();
    if (!row || row.redeemedAt !== undefined || row.revokedAt !== undefined)
      return {
        ok: false as const,
        error: "This code is invalid or has already been used.",
      };
    if (row.expiresAt !== undefined && row.expiresAt <= now)
      return {
        ok: false as const,
        error: "This code has expired. Contact adrianeosyne for help.",
      };
    const recipientId = args.recipientId ?? id;
    const recipient = await ctx.db.get(recipientId);
    if (!recipient || recipient.deletedAt || recipient.botApplicationId)
      return { ok: false as const, error: "Choose an active Kyro member." };
    await extendPremium(ctx, recipient, row.days);
    await ctx.db.patch(row._id, {
      redeemedBy: id,
      recipientId,
      redeemedAt: now,
    });
    if (recipientId !== id) {
      const giver = await ctx.db.get(id);
      await ctx.db.patch(id, {
        premiumGiftCount: (giver?.premiumGiftCount ?? 0) + 1,
      });
    }
    await syncPremiumAccess(ctx, recipientId);
    await ctx.db.insert("adminActions", {
      createdAt: now,
      actorId: id,
      action:
        recipientId === id ? "premium_code_redeemed" : "premium_code_gifted",
      targetType: "user",
      targetId: recipientId,
      details: `${row.days} days · code ending ${row.suffix}`,
    });
    return {
      ok: true as const,
      days: row.days,
      premiumUntil:
        Math.max(now, recipient.premiumUntil ?? 0) + row.days * 86400000,
    };
  },
});
