import { z } from "zod";
import type { MutationCtx } from "./functions";
import type { Doc } from "./_generated/dataModel";
import {
  botChannel,
  botError,
  botServer,
  botTarget,
  tableId,
  auditBot,
} from "./botLib";
import { authorizeFile, fileUrl } from "./fileAccess";
import { deleteClaimedUpload, deleteUnclaimedUpload } from "./uploadSecurity";
import { logAudit } from "./lib";
export function parseRequest<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    botError(
      400,
      "INVALID_REQUEST",
      r.error.issues[0]?.message ?? "Invalid request.",
    );
  return r.data;
}
const pagination = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(10000).optional(),
  })
  .strict();
export async function botApiExtra(
  ctx: MutationCtx,
  app: Doc<"botApplications">,
  method: string,
  p: string[],
  body: unknown,
  query: unknown,
): Promise<{ handled: boolean; data?: unknown }> {
  const done = (data: unknown) => ({ handled: true, data });
  if (p[0] === "users" && p.length === 2 && method === "GET") {
    const q = parseRequest(z.object({ serverId: z.string() }).strict(), query);
    const serverId = tableId(ctx, "servers", q.serverId),
      userId = tableId(ctx, "users", p[1]);
    await botServer(ctx, app, serverId, "view_channel");
    const member = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (x) =>
        x.eq("serverId", serverId).eq("userId", userId),
      )
      .unique();
    if (!member) botError(404, "NOT_FOUND", "User is not in this server.");
    const user = await ctx.db.get(userId);
    return done({
      id: userId,
      name: user?.name ?? "Deleted user",
      username: user?.username ?? null,
      bot: Boolean(user?.botApplicationId),
      bio: user?.bio ?? "",
    });
  }
  if (p[0] === "files" && p.length === 2) {
    const storageId = tableId(ctx, "_storage", p[1]);
    const file = await authorizeFile(ctx, app.botUserId, storageId);
    if (!file) botError(404, "NOT_FOUND", "File metadata unavailable.");
    if (file.channelId)
      await botChannel(
        ctx,
        app,
        file.channelId,
        method === "DELETE" ? "upload_attachments" : undefined,
      );
    if (method === "GET")
      return done({
        id: storageId,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        ownerId: file.ownerId,
        createdAt: file.createdAt,
        url: fileUrl(
          storageId,
          app.botUserId,
          file.claimType === "message" ? file.claimId : "",
        ),
      });
    if (method === "DELETE") {
      if (file.ownerId !== app.botUserId)
        botError(403, "NOT_OWNER", "Bots may delete only their own files.");
      if (file.claimType === "message" && file.claimId) {
        const messageId = tableId(ctx, "messages", file.claimId),
          message = await ctx.db.get(messageId);
        if (!message || message.authorId !== app.botUserId)
          botError(
            403,
            "NOT_AUTHOR",
            "Remove the file from its owning resource first.",
          );
        await botChannel(
          ctx,
          app,
          tableId(ctx, "channels", message.containerId),
          "send_messages",
        );
        await deleteClaimedUpload(ctx, storageId, "message", messageId);
        await ctx.db.patch(messageId, {
          attachments: message.attachments?.filter(
            (a) => a.storageId !== storageId,
          ),
          editedAt: Date.now(),
        });
      } else if (!file.claimType)
        await deleteUnclaimedUpload(ctx, app.botUserId, storageId);
      else
        botError(
          409,
          "FILE_IN_USE",
          "Remove the file from its owning resource first.",
        );
      await auditBot(ctx, app._id, "file.delete", undefined, storageId);
      return done({ deleted: true });
    }
  }
  if (
    p[0] === "channels" &&
    p.length === 5 &&
    p[2] === "messages" &&
    p[4] === "reactions" &&
    method === "DELETE"
  ) {
    const channelId = tableId(ctx, "channels", p[1]),
      messageId = tableId(ctx, "messages", p[3]);
    await botChannel(ctx, app, channelId, "add_reactions");
    const message = await ctx.db.get(messageId);
    if (message?.containerId !== channelId)
      botError(404, "NOT_FOUND", "Message unavailable.");
    const { emoji } = parseRequest(
      z.object({ emoji: z.string().min(1).max(64) }).strict(),
      body,
    );
    for (const row of await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", messageId).eq("userId", app.botUserId),
      )
      .collect())
      if (row.emoji === emoji) await ctx.db.delete(row._id);
    return done({ removed: true });
  }
  if (p[0] !== "servers" || p.length < 3) return { handled: false };
  const serverId = tableId(ctx, "servers", p[1]);
  if (p[2] === "members" && p.length === 3 && method === "GET") {
    await botServer(ctx, app, serverId, "view_channel");
    const q = parseRequest(pagination, query);
    const page = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (x) => x.eq("serverId", serverId))
      .paginate({ numItems: q.limit, cursor: q.cursor ?? null });
    return done({
      members: await Promise.all(
        page.page.map(async (m) => {
          const user = await ctx.db.get(m.userId);
          return {
            id: m.userId,
            username: user?.username ?? null,
            name: user?.name ?? "Deleted user",
            bot: Boolean(user?.botApplicationId),
            nickname: m.nickname ?? null,
            roleIds: m.roleIds,
            joinedAt: m.joinedAt,
            communicationDisabledUntil: m.communicationDisabledUntil ?? null,
          };
        }),
      ),
      nextCursor: page.isDone ? null : page.continueCursor,
    });
  }
  if (p[2] === "settings" && p.length === 3 && method === "GET") {
    const { server } = await botServer(ctx, app, serverId, "manage_server");
    return done({
      id: serverId,
      name: server.name,
      description: server.description ?? "",
      rules: server.rules ?? "",
      verificationLevel: server.verificationLevel ?? "none",
      locked: Boolean(server.locked),
    });
  }
  if (
    ["audit-logs", "moderation", "bans"].includes(p[2]) &&
    p.length === 3 &&
    method === "GET"
  ) {
    await botServer(
      ctx,
      app,
      serverId,
      p[2] === "bans" ? "ban_members" : "view_audit_log",
    );
    const q = parseRequest(pagination, query);
    if (p[2] === "bans") {
      const page = await ctx.db
        .query("bans")
        .withIndex("by_server", (x) => x.eq("serverId", serverId))
        .paginate({ numItems: q.limit, cursor: q.cursor ?? null });
      return done({
        bans: page.page.map((b) => ({
          userId: b.userId,
          reason: b.reason ?? "",
          createdAt: b.createdAt,
        })),
        nextCursor: page.isDone ? null : page.continueCursor,
      });
    }
    if (p[2] === "audit-logs") {
      const page = await ctx.db
        .query("auditLogs")
        .withIndex("by_server", (x) => x.eq("serverId", serverId))
        .order("desc")
        .paginate({ numItems: q.limit, cursor: q.cursor ?? null });
      return done({
        logs: page.page.map((l) => ({
          id: l._id,
          actorId: l.actorId,
          action: l.action,
          targetId: l.targetId ?? null,
          details: l.details ?? "",
          createdAt: l.createdAt,
        })),
        nextCursor: page.isDone ? null : page.continueCursor,
      });
    }
    const page = await ctx.db
      .query("moderationCases")
      .withIndex("by_server", (x) => x.eq("serverId", serverId))
      .order("desc")
      .paginate({ numItems: q.limit, cursor: q.cursor ?? null });
    return done({
      cases: page.page.map((c) => ({
        id: c._id,
        userId: c.userId,
        action: c.action,
        reason: c.reason,
        createdAt: c.createdAt,
        expiresAt: c.expiresAt ?? null,
      })),
      nextCursor: page.isDone ? null : page.continueCursor,
    });
  }
  if (p[2] === "bans" && p.length === 4 && method === "DELETE") {
    await botServer(ctx, app, serverId, "ban_members");
    const userId = tableId(ctx, "users", p[3]);
    if (userId === app.botUserId)
      botError(403, "FORBIDDEN", "Bots cannot unban themselves.");
    const ban = await ctx.db
      .query("bans")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", serverId).eq("userId", userId),
      )
      .unique();
    if (ban) await ctx.db.delete(ban._id);
    await ctx.db.insert("moderationCases", {
      serverId,
      userId,
      moderatorId: app.botUserId,
      action: "unban",
      reason: "Bot API unban",
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId,
      actorId: app.botUserId,
      action: "member.unban",
      targetType: "user",
      targetId: userId,
    });
    await auditBot(ctx, app._id, "member.unban", undefined, userId);
    return done({ unbanned: true });
  }
  if (
    p[2] === "members" &&
    p.length === 5 &&
    p[4] === "timeout" &&
    (method === "PUT" || method === "DELETE")
  ) {
    const userId = tableId(ctx, "users", p[3]);
    const target = await botTarget(
      ctx,
      app,
      serverId,
      userId,
      "timeout_members",
    );
    const data =
      method === "PUT"
        ? parseRequest(
            z
              .object({
                durationMinutes: z.number().int().min(1).max(10080),
                reason: z.string().trim().min(3).max(500),
              })
              .strict(),
            body,
          )
        : { durationMinutes: 0, reason: "Timeout cleared by bot" };
    const expiresAt = data.durationMinutes
      ? Date.now() + data.durationMinutes * 60000
      : undefined;
    await ctx.db.patch(target.target._id, {
      communicationDisabledUntil: expiresAt,
      communicationDisabledReason: expiresAt ? data.reason : undefined,
      communicationDisabledById: expiresAt ? app.botUserId : undefined,
    });
    await ctx.db.insert("moderationCases", {
      serverId,
      userId,
      moderatorId: app.botUserId,
      action: expiresAt ? "timeout" : "timeout_cleared",
      reason: data.reason,
      expiresAt,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId,
      actorId: app.botUserId,
      action: "member.timeout",
      targetType: "user",
      targetId: userId,
      details: data.reason,
    });
    await auditBot(ctx, app._id, "member.timeout", undefined, userId);
    return done({ userId, communicationDisabledUntil: expiresAt ?? null });
  }
  return { handled: false };
}
