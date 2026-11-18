import { recordMessage, memberActivity } from "./activityLib";
import { Triggers } from "convex-helpers/server/triggers";
import { makeFunctionReference } from "convex/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { botChannel, botServer, messageDto } from "./botLib";
import type { Ctx } from "./lib";
import { EVENT_NAMES, subscribedEvent } from "../lib/botContract";
import { fileUrl } from "./fileAccess";
import {
  syncMetricEntry,
  syncUserMetrics,
  syncMemberMetrics,
} from "./metricsLib";

export async function queueBotEvent(
  ctx: MutationCtx,
  serverId: Id<"servers">,
  type: string,
  data: unknown,
  channelId?: Id<"channels">,
  onlyApplication?: Id<"botApplications">,
) {
  const installs = await ctx.db
    .query("botInstallations")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .collect();
  for (const install of installs) {
    if (onlyApplication && install.applicationId !== onlyApplication) continue;
    const app = await ctx.db.get(install.applicationId);
    if (
      !app ||
      !app.enabled ||
      app.suspended ||
      app.deletedAt ||
      !subscribedEvent(app.events, type)
    )
      continue;
    try {
      if (channelId)
        await botChannel(
          ctx,
          app,
          channelId,
          type.startsWith("message") || type.startsWith("attachment")
            ? "read_message_history"
            : undefined,
        );
      else await botServer(ctx, app, serverId, "view_channel");
    } catch {
      continue;
    }
    const now = Date.now();
    const eventId = await ctx.db.insert("botEvents", {
      applicationId: app._id,
      deliveryMode: app.deliveryMode,
      serverId,
      channelId,
      type,
      payload: JSON.stringify(data),
      createdAt: now,
      expiresAt: now + 7 * 86400000,
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
    });
    if (app.deliveryMode === "webhook")
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"action">("botWebhooks:deliverEvent"),
        { eventId },
      );
  }
}
/** Recheck visibility at delivery time; queued data must not survive access revocation. */
export async function eventVisible(
  ctx: Ctx,
  app: Doc<"botApplications">,
  event: Doc<"botEvents">,
) {
  if (
    !app.enabled ||
    app.suspended ||
    app.deletedAt ||
    !app.tokenHash ||
    !subscribedEvent(app.events, event.type)
  )
    return false;
  if (event.type === "server.deleted") return true;
  try {
    if (event.channelId)
      await botChannel(
        ctx,
        app,
        event.channelId,
        event.type.startsWith("message") || event.type.startsWith("attachment")
          ? "read_message_history"
          : undefined,
      );
    else await botServer(ctx, app, event.serverId, "view_channel");
    return true;
  } catch {
    return false;
  }
}
export function eventDto(event: Doc<"botEvents">, viewerId?: Id<"users">) {
  const data = JSON.parse(event.payload);
  if (viewerId && Array.isArray(data?.attachments))
    data.attachments = data.attachments.map((a: { storageId?: string }) => ({
      ...a,
      url: a.storageId ? fileUrl(a.storageId, viewerId, data.id) : null,
    }));
  return {
    id: event._id,
    applicationId: event.applicationId,
    type: event.type,
    name: EVENT_NAMES[event.type] ?? event.type,
    version: 1,
    serverId: event.serverId,
    channelId: event.channelId ?? null,
    timestamp: event.createdAt,
    data: data as unknown,
  };
}

// All application mutations use this wrapper, including existing messaging,
// membership and moderation paths. Events commit atomically with their source.
export const botTriggers = new Triggers<DataModel>();
botTriggers.register("users", async (ctx, change) => {
  await syncUserMetrics(ctx, change.newDoc, change.id);
});
botTriggers.register("servers", async (ctx, change) => {
  await syncMetricEntry(
    ctx,
    `servers:${change.id}`,
    change.newDoc ? { servers: 1 } : {},
  );
});
botTriggers.register("messages", async (ctx, change) => {
  if (change.operation === "insert") await recordMessage(ctx, change.newDoc);
  await syncMetricEntry(
    ctx,
    `messages:${change.id}`,
    change.newDoc ? { messages: 1 } : {},
  );
});
botTriggers.register("serverMembers", async (ctx, change) => {
  const member = change.newDoc ?? change.oldDoc;
  const activity = await memberActivity(ctx, member.serverId, member.userId);
  await ctx.db.patch(activity._id, { active: change.operation !== "delete" });
  const server = await ctx.db.get(member.serverId);
  if (server?.isPlatformHome) {
    const roles = await Promise.all(
      (change.newDoc?.roleIds ?? []).map((id) => ctx.db.get(id)),
    );
    const user = await ctx.db.get(member.userId);
    const og = roles.some((r) => r?.name.trim().toLowerCase() === "og");
    if (user && user.hqOg !== og) await ctx.db.patch(user._id, { hqOg: og });
  }
  await syncMemberMetrics(ctx, change.newDoc, change.id);
});
botTriggers.register("messages", async (ctx, change) => {
  const message = change.newDoc ?? change.oldDoc;
  if (message.containerType !== "channel") return;
  if (
    change.operation === "update" &&
    change.oldDoc.content === change.newDoc.content &&
    JSON.stringify(change.oldDoc.embeds) ===
      JSON.stringify(change.newDoc.embeds) &&
    JSON.stringify(change.oldDoc.attachments) ===
      JSON.stringify(change.newDoc.attachments) &&
    JSON.stringify(change.oldDoc.components) ===
      JSON.stringify(change.newDoc.components)
  )
    return;
  const channelId = ctx.db.normalizeId("channels", message.containerId);
  if (!channelId) return;
  const channel = await ctx.db.get(channelId);
  if (!channel) return;
  const type =
    change.operation === "insert"
      ? "messageCreate"
      : change.operation === "update"
        ? "messageUpdate"
        : "messageDelete";
  await queueBotEvent(
    ctx,
    channel.serverId,
    type,
    change.operation === "delete"
      ? { id: message._id, channelId }
      : await messageDto(ctx, message),
    channelId,
  );
});
botTriggers.register("serverMembers", async (ctx, change) => {
  const member = change.newDoc ?? change.oldDoc;
  if (
    change.operation === "update" &&
    change.oldDoc.communicationDisabledUntil !==
      change.newDoc.communicationDisabledUntil
  )
    await queueBotEvent(ctx, member.serverId, "member.timeout", {
      id: member.userId,
      communicationDisabledUntil: member.communicationDisabledUntil ?? null,
    });
  const user = await ctx.db.get(member.userId);
  await queueBotEvent(
    ctx,
    member.serverId,
    change.operation === "insert"
      ? "memberJoin"
      : change.operation === "delete"
        ? "memberLeave"
        : "memberUpdate",
    {
      id: member.userId,
      username: user?.username ?? null,
      name: user?.name ?? "Deleted user",
      bot: Boolean(user?.botApplicationId),
      roleIds: member.roleIds,
      nickname: member.nickname ?? null,
      joinedAt: member.joinedAt,
    },
  );
  if (change.operation === "delete" && user?.botApplicationId) {
    const install = await ctx.db
      .query("botInstallations")
      .withIndex("by_app_server", (q) =>
        q
          .eq("applicationId", user.botApplicationId!)
          .eq("serverId", member.serverId),
      )
      .unique();
    if (install) {
      await ctx.db.delete(install._id);
      if (await ctx.db.get(install.roleId)) await ctx.db.delete(install.roleId);
    }
  }
});
botTriggers.register("servers", async (ctx, change) => {
  if (change.operation === "delete") return;
  const server = change.newDoc;
  await queueBotEvent(
    ctx,
    server._id,
    change.operation === "insert" ? "serverCreate" : "serverUpdate",
    {
      id: server._id,
      name: server.name,
      description: server.description ?? "",
      ownerId: server.ownerId,
    },
  );
});
botTriggers.register("channels", async (ctx, change) => {
  const channel = change.newDoc ?? change.oldDoc;
  if (change.operation !== "delete")
    await queueBotEvent(
      ctx,
      channel.serverId,
      change.operation === "insert" ? "channelCreate" : "channel.updated",
      {
        id: channel._id,
        name: channel.name,
        kind: channel.kind ?? "text",
        serverId: channel.serverId,
      },
      channel._id,
    );
  else {
    // Channel deletion carries only an ID. This avoids disclosing a formerly hidden name.
    await queueBotEvent(ctx, channel.serverId, "channelDelete", {
      id: channel._id,
      serverId: channel.serverId,
    });
  }
});
botTriggers.register("serverRoles", async (ctx, change) => {
  if (change.operation === "delete") {
    await queueBotEvent(ctx, change.oldDoc.serverId, "role.deleted", {
      id: change.id,
      serverId: change.oldDoc.serverId,
    });
    return;
  }
  const role = change.newDoc;
  await queueBotEvent(
    ctx,
    role.serverId,
    change.operation === "insert" ? "roleCreate" : "roleUpdate",
    {
      id: role._id,
      name: role.name,
      permissions: role.permissions,
      color: role.color ?? null,
      position: role.position,
    },
  );
});
botTriggers.register("reactions", async (ctx, change) => {
  if (change.operation === "update") return;
  const reaction = change.newDoc ?? change.oldDoc,
    message = await ctx.db.get(reaction.messageId);
  if (!message || message.containerType !== "channel") return;
  const channelId = ctx.db.normalizeId("channels", message.containerId),
    channel = channelId ? await ctx.db.get(channelId) : null;
  if (channel)
    await queueBotEvent(
      ctx,
      channel.serverId,
      change.operation === "insert"
        ? "message.reaction_added"
        : "message.reaction_removed",
      {
        messageId: message._id,
        channelId: channel._id,
        userId: reaction.userId,
        emoji: reaction.emoji,
      },
      channel._id,
    );
});
botTriggers.register("bans", async (ctx, change) => {
  if (change.operation === "update") return;
  const ban = change.newDoc ?? change.oldDoc;
  await queueBotEvent(
    ctx,
    ban.serverId,
    change.operation === "insert" ? "member.banned" : "member.unbanned",
    { id: ban.userId, serverId: ban.serverId },
  );
});
botTriggers.register("uploads", async (ctx, change) => {
  const upload = change.newDoc ?? change.oldDoc;
  if (
    !upload.channelId ||
    (change.operation !== "delete" &&
      (upload.claimType !== "message" ||
        change.oldDoc?.claimId === upload.claimId))
  )
    return;
  const channel = await ctx.db.get(upload.channelId);
  if (!channel) return;
  await queueBotEvent(
    ctx,
    channel.serverId,
    change.operation === "delete" ? "attachment.deleted" : "attachment.created",
    {
      id: upload.storageId,
      name: upload.name,
      size: upload.size,
      mimeType: upload.mimeType,
      messageId: upload.claimId ?? null,
    },
    channel._id,
  );
});

botTriggers.register("serverRoles", async (ctx, change) => {
  const role = change.newDoc ?? change.oldDoc;
  if (
    change.operation === "insert" ||
    change.oldDoc?.name === change.newDoc?.name
  )
    return;
  const server = await ctx.db.get(role.serverId);
  if (!server?.isPlatformHome) return;
  const members = await ctx.db
    .query("serverMembers")
    .withIndex("by_server", (q) => q.eq("serverId", server._id))
    .collect();
  for (const member of members.filter((m) => m.roleIds.includes(role._id))) {
    const roles = await Promise.all(member.roleIds.map((id) => ctx.db.get(id))),
      user = await ctx.db.get(member.userId);
    const og = roles.some((r) => r?.name.trim().toLowerCase() === "og");
    if (user && user.hqOg !== og) await ctx.db.patch(user._id, { hqOg: og });
  }
});
