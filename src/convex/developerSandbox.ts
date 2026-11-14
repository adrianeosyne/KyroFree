import { v } from "convex/values";
import { action, internalQuery, mutation } from "./functions";
import { api, internal } from "./_generated/api";
import { ownerApp, botError, activeBot, limit, auditBot } from "./botLib";
import { ALL_PERMISSIONS } from "../lib/permissions";
import { BOT_EVENTS } from "../lib/botContract";
import { queueBotEvent } from "./botEvents";
export const context = internalQuery({
  args: { applicationId: v.id("botApplications") },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    if (!app.tokenHash)
      botError(401, "NO_TOKEN", "Configure a bot token first.");
    const server = app.sandboxServerId
      ? await ctx.db.get(app.sandboxServerId)
      : null;
    if (!server || server.ownerId !== app.ownerId || server.isPublic)
      botError(409, "NO_SANDBOX", "Create a private test server first.");
    await activeBot(ctx, app.tokenHash);
    return {
      tokenHash: app.tokenHash,
      serverId: server._id,
      ownerId: app.ownerId,
    };
  },
});
export const create = mutation({
  args: { applicationId: v.id("botApplications") },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    if (app.sandboxServerId && (await ctx.db.get(app.sandboxServerId)))
      return app.sandboxServerId;
    if (!(await limit(ctx, `sandbox:${app.ownerId}`, 3, 3600000)))
      botError(429, "RATE_LIMITED", "Wait before creating another sandbox.");
    const now = Date.now(),
      serverId = await ctx.db.insert("servers", {
        name: `${app.name.slice(0, 40)} — Sandbox`,
        ownerId: app.ownerId,
        isPublic: false,
        createdAt: now,
        description: "Private developer test server",
      });
    const ownerRole = await ctx.db.insert("serverRoles", {
      serverId,
      name: "Owner",
      permissions: ALL_PERMISSIONS,
      position: 10,
      isDefault: false,
    });
    await ctx.db.insert("serverRoles", {
      serverId,
      name: "Everyone",
      permissions: ["view_channel", "send_messages"],
      position: 0,
      isDefault: true,
    });
    await ctx.db.insert("serverMembers", {
      serverId,
      userId: app.ownerId,
      roleIds: [ownerRole],
      joinedAt: now,
    });
    await ctx.db.insert("channels", {
      serverId,
      name: "bot-testing",
      kind: "text",
      position: 0,
      createdAt: now,
    });
    await ctx.db.patch(app._id, { sandboxServerId: serverId });
    await auditBot(ctx, app._id, "sandbox.create", app.ownerId, serverId);
    return serverId;
  },
});
export const request = action({
  args: {
    applicationId: v.id("botApplications"),
    method: v.string(),
    path: v.string(),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const context = await ctx.runQuery(internal.developerSandbox.context, {
      applicationId: args.applicationId,
    });
    // Read operations can exercise the real API. Writes are limited to the owner's
    // disposable sandbox; no developer-supplied code is executed here.
    const channels = await ctx.runQuery(api.channels.list, {
      serverId: context.serverId,
    });
    const inResource = (prefix: string) =>
      args.path === prefix || args.path.startsWith(`${prefix}/`);
    const allowed =
      (["me", "gateway", "commands"].includes(args.path) &&
        args.method === "GET") ||
      inResource(`servers/${context.serverId}`) ||
      channels.channels.some((c) => inResource(`channels/${c.id}`));
    if (
      !allowed ||
      !["GET", "POST", "PATCH", "PUT", "DELETE"].includes(args.method) ||
      /uploads|\/bans|\/roles/.test(args.path)
    )
      botError(
        403,
        "SANDBOX_SCOPE",
        "Use an endpoint in your private test server. File and moderation tests use the SDK.",
      );
    const rate = await ctx.runMutation(internal.botApi.authorize, {
      tokenHash: context.tokenHash,
    });
    if (!rate.allowed) botError(429, "RATE_LIMITED", "API rate limit reached.");
    const started = Date.now();
    try {
      const data = await ctx.runMutation(internal.botApi.execute, {
        tokenHash: context.tokenHash,
        method: args.method,
        path: args.path,
        body: args.body,
        query: {},
      });
      await ctx.runMutation(internal.botAnalytics.requestFinished, {
        tokenHash: context.tokenHash,
        method: args.method,
        path: args.path,
        status: 200,
        durationMs: Date.now() - started,
      });
      return { ok: true, data };
    } catch (cause) {
      await ctx.runMutation(internal.botAnalytics.requestFinished, {
        tokenHash: context.tokenHash,
        method: args.method,
        path: args.path,
        status: 400,
        durationMs: Date.now() - started,
      });
      throw cause;
    }
  },
});
export const testEvent = mutation({
  args: { applicationId: v.id("botApplications"), type: v.string() },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    if (
      !app.sandboxServerId ||
      !(BOT_EVENTS as readonly string[]).includes(args.type) ||
      ["server.deleted", "interactionCreate", "interaction.created"].includes(
        args.type,
      )
    )
      botError(
        400,
        "INVALID_TEST",
        "Choose a non-interaction event and create a sandbox first.",
      );
    const server = await ctx.db.get(app.sandboxServerId);
    if (!server || server.ownerId !== app.ownerId)
      botError(403, "SANDBOX_SCOPE", "Sandbox unavailable.");
    if (!(await limit(ctx, `test-event:${app._id}`, 10)))
      botError(429, "RATE_LIMITED", "Wait before testing more events.");
    await queueBotEvent(
      ctx,
      server._id,
      args.type,
      {
        test: true,
        id: server._id,
        description:
          "Developer-generated test envelope. Use a real sandbox operation to test production payloads.",
      },
      undefined,
      app._id,
    );
    await auditBot(ctx, app._id, "event.test", app.ownerId, args.type);
    return { queued: true };
  },
});
