import { v } from "convex/values";
import { action, internalMutation } from "./functions";
import { retrieveAccount, invalidateSessions } from "@convex-dev/auth/server";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { sha256Hex } from "./sha256";
import { enqueueEmail } from "./emailOutbox";
export const prepare = internalMutation({
  args: { userId: v.id("users"), token: v.string() },
  handler: async (ctx, { userId, token }) => {
    const user = await ctx.db.get(userId),
      security = await ctx.db
        .query("accountSecurity")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    if (!user?.email || user.deletedAt || !security?.twoFactorEnabled) return;
    const recent = await ctx.db
      .query("accountRecoveryRequests")
      .withIndex("by_user", (q) =>
        q.eq("userId", userId).gt("createdAt", Date.now() - 3600000),
      )
      .order("desc")
      .take(5);
    if (
      recent.length >= 5 ||
      recent.some((r) => Date.now() - r.createdAt < 60000)
    )
      return;
    await ctx.db.insert("accountRecoveryRequests", {
      userId,
      createdAt: Date.now(),
    });
    const old = await ctx.db
      .query("accountRecoveryTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);
    const id = await ctx.db.insert("accountRecoveryTokens", {
      userId,
      email: user.email,
      securityId: security._id,
      tokenHash: sha256Hex(token),
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60000,
    });
    await enqueueEmail(ctx, {
      eventKey: `two-factor-recovery:${id}`,
      userId,
      to: user.email,
      template: "two_factor_recovery",
      payload: {
        displayName: user.name ?? "Kyro member",
        token,
        expiresAt: Date.now() + 15 * 60000,
      },
    });
  },
});
const prepareRef = makeFunctionReference<
  "mutation",
  { userId: Id<"users">; token: string },
  null
>("accountRecovery:prepare");
export const request = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    if (email.length > 254 || password.length > 200) return { ok: true };
    const account = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email.trim().toLowerCase(), secret: password },
    }).catch(() => null);
    if (account) {
      const token = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      await ctx.runMutation(prepareRef, { userId: account.user._id, token });
    }
    return { ok: true };
  },
});
export const consume = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const row = await ctx.db
      .query("accountRecoveryTokens")
      .withIndex("by_token", (q) => q.eq("tokenHash", sha256Hex(token)))
      .unique();
    if (!row || row.consumedAt || row.expiresAt <= Date.now()) return null;
    const user = await ctx.db.get(row.userId),
      security = await ctx.db.get(row.securityId);
    if (
      !user ||
      user.deletedAt ||
      user.email !== row.email ||
      !security?.twoFactorEnabled ||
      security.userId !== user._id
    )
      return null;
    await ctx.db.patch(row._id, { consumedAt: Date.now() });
    await ctx.db.delete(security._id);
    await ctx.db.insert("adminActions", {
      actorId: user._id,
      action: "two_factor_email_recovery",
      targetType: "user",
      targetId: user._id,
      createdAt: Date.now(),
      details:
        "Two-factor authentication removed after password and mailbox verification.",
    });
    return user._id;
  },
});
const consumeRef = makeFunctionReference<
  "mutation",
  { token: string },
  Id<"users"> | null
>("accountRecovery:consume");
export const finish = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.runMutation(consumeRef, args);
    if (!userId)
      throw new Error(
        "This recovery link is invalid or expired. Request a new one.",
      );
    await invalidateSessions(ctx, { userId });
    return { ok: true };
  },
});
