import { v } from "convex/values";
import { z } from "zod";
import { mutation, query } from "./functions";
import {
  ownerApp,
  botError,
  auditBot,
  humanManager,
  validPermissions,
  activeBot,
} from "./botLib";
import {
  requireActiveUser,
  USERNAME_PATTERN,
  isReservedUsername,
  activeSiteBan,
} from "./lib";
import { storageQuota } from "./files";
const https = z
  .string()
  .max(2000)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password && !u.hash;
    } catch {
      return false;
    }
  }, "Use a valid HTTPS URL.");
const metadata = z
  .object({
    website: z.union([https, z.literal("")]),
    supportUrl: z.union([https, z.literal("")]),
    privacyUrl: z.union([https, z.literal("")]),
    termsUrl: z.union([https, z.literal("")]),
    contactEmail: z.union([z.email().max(254), z.literal("")]),
    redirectUris: z.array(https).max(10),
  })
  .strict();
export const saveMetadata = mutation({
  args: { applicationId: v.id("botApplications"), metadata: v.any() },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    const parsed = metadata.safeParse(args.metadata);
    if (!parsed.success)
      botError(
        400,
        "INVALID_METADATA",
        parsed.error.issues[0]?.message ?? "Invalid application information.",
      );
    await ctx.db.patch(app._id, { ...parsed.data, updatedAt: Date.now() });
    await auditBot(ctx, app._id, "application.metadata", app.ownerId);
  },
});
export const duplicate = mutation({
  args: {
    applicationId: v.id("botApplications"),
    name: v.string(),
    username: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    const username = args.username.trim().toLowerCase();
    if (
      args.name.trim().length < 2 ||
      args.name.length > 64 ||
      !USERNAME_PATTERN.test(username) ||
      isReservedUsername(username) ||
      !/^[a-f0-9]{64}$/.test(args.tokenHash)
    )
      botError(
        400,
        "INVALID_APPLICATION",
        "Check the new application name, username and credential.",
      );
    if (
      (
        await ctx.db
          .query("botApplications")
          .withIndex("by_owner", (q) => q.eq("ownerId", app.ownerId))
          .collect()
      ).filter((a) => !a.deletedAt).length >= 20
    )
      botError(409, "APPLICATION_LIMIT", "An account may own 20 applications.");
    if (
      await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first()
    )
      botError(409, "USERNAME_TAKEN", "Username is already taken.");
    if (
      await ctx.db
        .query("botApplications")
        .withIndex("by_token", (q) => q.eq("tokenHash", args.tokenHash))
        .first()
    )
      botError(409, "TOKEN_REUSED", "Generate a new token.");
    const now = Date.now(),
      botUserId = await ctx.db.insert("users", {
        name: args.name.trim(),
        username,
        bio: app.description,
        dmPolicy: "nobody",
        allowFriendRequests: false,
        suggestible: false,
        status: "offline",
        createdAt: now,
      });
    const id = await ctx.db.insert("botApplications", {
      ownerId: app.ownerId,
      botUserId,
      name: args.name.trim(),
      description: app.description,
      website: app.website,
      supportUrl: app.supportUrl,
      privacyUrl: app.privacyUrl,
      termsUrl: app.termsUrl,
      contactEmail: app.contactEmail,
      enabled: true,
      discoverable: false,
      category: app.category,
      verified: false,
      featured: false,
      suspended: false,
      tokenHash: args.tokenHash,
      tokenUpdatedAt: now,
      permissions: app.permissions,
      events: app.events,
      deliveryMode: "poll",
      apiRequests: 0,
      commandsExecuted: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(botUserId, { botApplicationId: id });
    for (const c of await ctx.db
      .query("botCommands")
      .withIndex("by_app", (q) => q.eq("applicationId", app._id))
      .collect())
      if (!c.serverId) {
        const fields = {
          name: c.name,
          description: c.description,
          type: c.type,
          subcommands: c.subcommands,
          options: c.options,
          permissions: c.permissions,
        };
        await ctx.db.insert("botCommands", {
          ...fields,
          applicationId: id,
          updatedAt: now,
        });
      }
    await auditBot(ctx, id, "application.duplicate", app.ownerId, app._id);
    return id;
  },
});
export const requestTransfer = mutation({
  args: {
    applicationId: v.id("botApplications"),
    username: v.string(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    if (args.confirmation !== app.name)
      botError(400, "CONFIRMATION_REQUIRED", "Type the application name.");
    if (app.stagingParentId || app.stagingApplicationId)
      botError(409, "STAGING_LINKED", "Delete the linked staging application before transferring ownership.");
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.trim().toLowerCase()),
      )
      .unique();
    if (
      !user ||
      user.deletedAt ||
      user.botApplicationId ||
      user._id === app.ownerId ||
      (await activeSiteBan(ctx, user._id))
    )
      botError(
        400,
        "INVALID_RECIPIENT",
        "Choose another active human account.",
      );
    await ctx.db.patch(app._id, { transferTo: user._id });
    await auditBot(ctx, app._id, "ownership.offer", app.ownerId, user._id);
  },
});
export const transfers = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireActiveUser(ctx);
    return (
      await ctx.db
        .query("botApplications")
        .withIndex("by_transfer", (q) => q.eq("transferTo", id))
        .take(20)
    )
      .filter((a) => !a.deletedAt)
      .map((a) => ({ id: a._id, name: a.name, ownerId: a.ownerId }));
  },
});
export const acceptTransfer = mutation({
  args: { applicationId: v.id("botApplications"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    if (!app || app.deletedAt || app.transferTo !== id)
      botError(404, "NOT_FOUND", "Transfer unavailable.");
    if (args.accept) {
      if (app.stagingParentId || app.stagingApplicationId)
        botError(409, "STAGING_LINKED", "Delete the linked staging application before transferring ownership.");
      if (
        (
          await ctx.db
            .query("botApplications")
            .withIndex("by_owner", (q) => q.eq("ownerId", id))
            .collect()
        ).filter((a) => !a.deletedAt).length >= 20
      )
        botError(
          409,
          "APPLICATION_LIMIT",
          "Account application limit reached.",
        );
      const assets = await ctx.db
        .query("uploads")
        .withIndex("by_application", (q) => q.eq("applicationId", app._id))
        .collect();
      const owned = await ctx.db
        .query("uploads")
        .withIndex("by_owner", (q) => q.eq("ownerId", id))
        .take(2000);
      if (
        owned.reduce((s, a) => s + a.size, 0) +
          assets
            .filter((a) => a.ownerId === app.ownerId)
            .reduce((s, a) => s + a.size, 0) >
        storageQuota()
      )
        botError(409, "STORAGE_QUOTA", "Recipient storage quota is full.");
      for (const asset of assets)
        if (asset.ownerId === app.ownerId)
          await ctx.db.patch(asset._id, { ownerId: id });
      await ctx.db.patch(app._id, {
        ownerId: id,
        transferTo: undefined,
        tokenHash: undefined,
        tokenUpdatedAt: Date.now(),
        webhookUrl: undefined,
        deliveryMode: "poll",
        redirectUris: [],
      });
    } else await ctx.db.patch(app._id, { transferTo: undefined });
    await auditBot(
      ctx,
      app._id,
      args.accept ? "ownership.accept" : "ownership.decline",
      id,
    );
  },
});
export const beginAuthorization = mutation({
  args: {
    applicationId: v.id("botApplications"),
    serverId: v.id("servers"),
    permissions: v.array(v.string()),
    state: v.string(),
    redirectUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const permissions = validPermissions(args.permissions),
      manager = await humanManager(ctx, args.serverId, permissions),
      app = await ctx.db.get(args.applicationId);
    if (!app || app.deletedAt) botError(404, "NOT_FOUND", "Bot unavailable.");
    await activeBot(ctx, app.tokenHash ?? "");
    if (
      args.state.length < 16 ||
      args.state.length > 200 ||
      (args.redirectUri && !app.redirectUris?.includes(args.redirectUri))
    )
      botError(
        400,
        "INVALID_AUTHORIZATION",
        "Use a secure state and a registered redirect URI.",
      );
    return ctx.db.insert("botAuthorizations", {
      applicationId: app._id,
      userId: manager.id,
      serverId: args.serverId,
      permissions,
      state: args.state,
      redirectUri: args.redirectUri,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60000,
    });
  },
});
export const authorizationResult = query({
  args: { authorizationId: v.id("botAuthorizations") },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const authorization = await ctx.db.get(args.authorizationId);
    if (
      !authorization ||
      authorization.userId !== id ||
      !authorization.usedAt ||
      authorization.expiresAt < Date.now()
    )
      botError(400, "INVALID_AUTHORIZATION", "Authorization unavailable.");
    const app = await ctx.db.get(authorization.applicationId);
    if (
      !authorization.redirectUri ||
      !app?.redirectUris?.includes(authorization.redirectUri)
    )
      return null;
    const url = new URL(authorization.redirectUri);
    url.searchParams.set("state", authorization.state);
    url.searchParams.set("application_id", authorization.applicationId);
    url.searchParams.set("server_id", authorization.serverId);
    url.searchParams.set("authorized", "true");
    return url.href;
  },
});
export const installationState = mutation({
  args: {
    applicationId: v.id("botApplications"),
    serverId: v.id("servers"),
    disabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const manager = await humanManager(ctx, args.serverId);
    const row = await ctx.db
      .query("botInstallations")
      .withIndex("by_app_server", (q) =>
        q.eq("applicationId", args.applicationId).eq("serverId", args.serverId),
      )
      .unique();
    if (!row) botError(404, "NOT_FOUND", "Installation unavailable.");
    await ctx.db.patch(row._id, { disabled: args.disabled });
    await auditBot(
      ctx,
      args.applicationId,
      args.disabled ? "installation.disable" : "installation.enable",
      manager.id,
      args.serverId,
    );
  },
});
export const installationActivity = query({
  args: { applicationId: v.id("botApplications"), serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await humanManager(ctx, args.serverId);
    const install = await ctx.db
      .query("botInstallations")
      .withIndex("by_app_server", (q) =>
        q.eq("applicationId", args.applicationId).eq("serverId", args.serverId),
      )
      .unique();
    if (!install) botError(404, "NOT_FOUND", "Installation unavailable.");
    const events = await ctx.db
      .query("botEvents")
      .withIndex("by_app_created", (q) =>
        q.eq("applicationId", args.applicationId),
      )
      .order("desc")
      .take(100);
    const logs = await ctx.db
      .query("botAuditLogs")
      .withIndex("by_app", (q) => q.eq("applicationId", args.applicationId))
      .order("desc")
      .take(200);
    return {
      events: events
        .filter((e) => e.serverId === args.serverId)
        .slice(0, 20)
        .map((e) => ({
          id: e._id,
          type: e.type,
          status: e.status,
          createdAt: e.createdAt,
        })),
      logs: logs
        .filter((l) => l.details === args.serverId)
        .slice(0, 20)
        .map((l) => ({ id: l._id, action: l.action, createdAt: l.createdAt })),
    };
  },
});
