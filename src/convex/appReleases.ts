import { paginationOptsValidator, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./functions";
import {
  requireUser,
  requireActiveUser,
  isBlockedBetween,
  activeSiteBan,
  notify,
} from "./lib";
import { ownerApp, auditBot } from "./botLib";
import { collaboratorRole, releaseChannel } from "./releaseSchema";
import { text } from "./advancedValidation";
import type { Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";
import { hasPremium } from "../lib/entitlements";

async function access(
  ctx: Ctx,
  applicationId: Id<"botApplications">,
  writing = false,
) {
  const { id } = writing
    ? await requireActiveUser(ctx)
    : await requireUser(ctx);
  const app = await ctx.db.get(applicationId);
  if (!app || app.deletedAt) throw new Error("Application not found.");
  const owner = await ctx.db.get(app.ownerId);
  if (
    !owner ||
    owner.deletedAt ||
    (writing &&
      (owner.frozenAt !== undefined || (await activeSiteBan(ctx, owner._id))))
  )
    throw new Error("Application owner is unavailable.");
  const member = await ctx.db
    .query("appCollaborators")
    .withIndex("by_app_user", (q) =>
      q.eq("applicationId", applicationId).eq("userId", id),
    )
    .unique();
  const isOwner = app.ownerId === id;
  if (
    !isOwner &&
    (!member?.accepted ||
      member.ownerId !== app.ownerId ||
      (await isBlockedBetween(ctx, id, app.ownerId)))
  )
    throw new Error("Application access is unavailable.");
  if (writing && !isOwner && member?.role !== "maintainer")
    throw new Error("Maintainer access is required.");
  return {
    app,
    id,
    isOwner,
    canStage: isOwner || member?.role === "maintainer",
  };
}
export const workspaces = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireUser(ctx);
    const owned = await ctx.db
      .query("botApplications")
      .withIndex("by_owner", (q) => q.eq("ownerId", id))
      .take(50);
    const grants = await ctx.db
      .query("appCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", id))
      .take(100);
    const result = owned
      .filter((app) => !app.deletedAt)
      .map((app) => ({
        id: app._id,
        name: app.name,
        role: "owner",
        pending: false,
      }));
    for (const grant of grants) {
      const app = await ctx.db.get(grant.applicationId);
      if (
        !app ||
        app.deletedAt ||
        app.ownerId !== grant.ownerId ||
        app.ownerId === id ||
        (await isBlockedBetween(ctx, id, app.ownerId))
      )
        continue;
      result.push({
        id: app._id,
        name: app.name,
        role: grant.role,
        pending: !grant.accepted,
      });
    }
    return result;
  },
});
export const collaborators = query({
  args: { applicationId: v.id("botApplications") },
  handler: async (ctx, args) => {
    const { app, isOwner, canStage } = await access(ctx, args.applicationId);
    const grants = await ctx.db
      .query("appCollaborators")
      .withIndex("by_app", (q) => q.eq("applicationId", app._id))
      .take(20);
    const members = [];
    for (const grant of grants.filter((g) => g.ownerId === app.ownerId)) {
      const user = await ctx.db.get(grant.userId);
      if (user && !user.deletedAt)
        members.push({
          id: grant.userId,
          name: user.name ?? user.username ?? "Member",
          role: grant.role,
          accepted: grant.accepted,
        });
    }
    return {
      isOwner,
      canStage,
      activeReleaseId: app.activeReleaseId ?? null,
      stagingApplicationId: app.stagingApplicationId ?? null,
      members,
    };
  },
});
export const invite = mutation({
  args: {
    applicationId: v.id("botApplications"),
    username: v.string(),
    role: collaboratorRole,
  },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    const username = text(args.username, "Username", 40)
      .replace(/^@/, "")
      .toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (
      !user ||
      user.deletedAt ||
      user.botApplicationId ||
      user._id === app.ownerId ||
      (await activeSiteBan(ctx, user._id)) ||
      (await isBlockedBetween(ctx, user._id, app.ownerId))
    )
      throw new Error("Choose an available human collaborator.");
    const old = await ctx.db
      .query("appCollaborators")
      .withIndex("by_app_user", (q) =>
        q.eq("applicationId", app._id).eq("userId", user._id),
      )
      .unique();
    const grants = await ctx.db
      .query("appCollaborators")
      .withIndex("by_app", (q) => q.eq("applicationId", app._id))
      .take(20);
    if (!old && grants.length >= 20)
      throw new Error("An application can have up to 20 collaborators.");
    const memberships = await ctx.db
      .query("appCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);
    if (!old && memberships.length >= 100)
      throw new Error("This member has reached the collaboration limit.");
    // Permission changes require renewed acceptance.
    const value = {
      ownerId: app.ownerId,
      role: args.role,
      accepted: false,
      createdAt: Date.now(),
    };
    if (old) await ctx.db.patch(old._id, value);
    else
      await ctx.db.insert("appCollaborators", {
        applicationId: app._id,
        userId: user._id,
        ...value,
      });
    await auditBot(
      ctx,
      app._id,
      "collaborator.invite",
      app.ownerId,
      `${user._id}:${args.role}`,
    );
    await notify(ctx, {
      userId: user._id,
      actorId: app.ownerId,
      type: "system",
      title: "Application collaboration invitation",
      body: `${app.name} invited you as a ${args.role}.`,
      link: "/dashboard/developer-releases",
    });
  },
});
export const respond = mutation({
  args: { applicationId: v.id("botApplications"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const { id } = await requireActiveUser(ctx);
    const app = await ctx.db.get(args.applicationId);
    const grant = await ctx.db
      .query("appCollaborators")
      .withIndex("by_app_user", (q) =>
        q.eq("applicationId", args.applicationId).eq("userId", id),
      )
      .unique();
    if (
      !app ||
      app.deletedAt ||
      !grant ||
      grant.ownerId !== app.ownerId ||
      (await isBlockedBetween(ctx, id, app.ownerId))
    )
      throw new Error("Invitation not found.");
    if (args.accept) await ctx.db.patch(grant._id, { accepted: true });
    else await ctx.db.delete(grant._id);
    await auditBot(
      ctx,
      app._id,
      args.accept ? "collaborator.accept" : "collaborator.leave",
      id,
    );
  },
});
export const removeCollaborator = mutation({
  args: { applicationId: v.id("botApplications"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    const grant = await ctx.db
      .query("appCollaborators")
      .withIndex("by_app_user", (q) =>
        q.eq("applicationId", app._id).eq("userId", args.userId),
      )
      .unique();
    if (grant) await ctx.db.delete(grant._id);
    await auditBot(
      ctx,
      app._id,
      "collaborator.remove",
      app.ownerId,
      args.userId,
    );
  },
});
export const list = query({
  args: {
    applicationId: v.id("botApplications"),
    channel: releaseChannel,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await access(ctx, args.applicationId);
    return ctx.db
      .query("appReleases")
      .withIndex("by_app_channel", (q) =>
        q.eq("applicationId", args.applicationId).eq("channel", args.channel),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(25, args.paginationOpts.numItems),
      });
  },
});
function source(value?: string) {
  if (!value?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Use an HTTPS release source URL.");
  }
  if (
    value.length > 2000 ||
    url.protocol !== "https:" ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTPS release source URL.");
  return url.href;
}
export const publish = mutation({
  args: {
    applicationId: v.id("botApplications"),
    version: v.string(),
    channel: releaseChannel,
    changelog: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { app, id, isOwner } = await access(ctx, args.applicationId, true);
    if (app.suspended)
      throw new Error("Suspended applications cannot publish releases.");
    if (args.channel === "production" && !isOwner)
      throw new Error("Only the owner can publish a production release.");
    const version = text(args.version, "Version", 80);
    if (
      !/^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(
        version,
      )
    )
      throw new Error("Use a version such as 1.2.0 or 1.2.0-beta.1.");
    if (
      await ctx.db
        .query("appReleases")
        .withIndex("by_app_version", (q) =>
          q
            .eq("applicationId", app._id)
            .eq("channel", args.channel)
            .eq("version", version),
        )
        .unique()
    )
      throw new Error("This version already exists in this channel.");
    const recent = await ctx.db
      .query("appReleases")
      .withIndex("by_app", (q) => q.eq("applicationId", app._id))
      .order("desc")
      .take(10);
    if (
      recent.length === 10 &&
      recent.every((r) => r.createdAt > Date.now() - 3600_000)
    )
      throw new Error("Publish at most ten releases per hour.");
    const releaseId = await ctx.db.insert("appReleases", {
      applicationId: app._id,
      userId: id,
      version,
      channel: args.channel,
      changelog: text(args.changelog, "Changelog", 10000),
      sourceUrl: source(args.sourceUrl),
      createdAt: Date.now(),
    });
    await auditBot(
      ctx,
      app._id,
      "release.publish",
      id,
      `${args.channel}:${version}`,
    );
    return releaseId;
  },
});
export const activate = mutation({
  args: {
    releaseId: v.id("appReleases"),
    expectedActive: v.union(v.id("appReleases"), v.null()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.releaseId);
    if (!row || row.channel !== "production")
      throw new Error("Choose a production release.");
    const app = await ownerApp(ctx, row.applicationId);
    if (app.suspended || app.stagingParentId)
      throw new Error("This application cannot activate a production release.");
    if ((app.activeReleaseId ?? null) !== args.expectedActive)
      throw new Error(
        "The active version changed. Load the latest release state.",
      );
    if (app.activeReleaseId === row._id) return;
    await ctx.db.patch(app._id, {
      activeReleaseId: row._id,
      updatedAt: Date.now(),
    });
    await auditBot(ctx, app._id, "release.activate", app.ownerId, row.version);
    await ctx.scheduler.runAfter(
      0,
      makeFunctionReference<"mutation">("appReleases:notifyInstallations"),
      { releaseId: row._id, cursor: null },
    );
  },
});
export const notifyInstallations = internalMutation({
  args: {
    releaseId: v.id("appReleases"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const release = await ctx.db.get(args.releaseId);
    const app = release && (await ctx.db.get(release.applicationId));
    if (
      !release ||
      !app ||
      app.deletedAt ||
      app.activeReleaseId !== release._id
    )
      return;
    const page = await ctx.db
      .query("botInstallations")
      .withIndex("by_app", (q) => q.eq("applicationId", app._id))
      .paginate({ numItems: 25, cursor: args.cursor });
    for (const installation of page.page) {
      if (installation.disabled || !(await ctx.db.get(installation.serverId)))
        continue;
      const member = await ctx.db
        .query("serverMembers")
        .withIndex("by_server_user", (q) =>
          q
            .eq("serverId", installation.serverId)
            .eq("userId", installation.installedBy),
        )
        .unique();
      if (!member) continue;
      await notify(ctx, {
        userId: installation.installedBy,
        actorId: app.ownerId,
        type: "system",
        title: `${app.name} ${release.version}`,
        body: release.changelog.slice(0, 300),
        link: `/dashboard/bots/${app._id}`,
      });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation">("appReleases:notifyInstallations"),
        { ...args, cursor: page.continueCursor },
      );
  },
});
export const createStaging = mutation({
  args: {
    applicationId: v.id("botApplications"),
    name: v.string(),
    username: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"botApplications">> => {
    const app = await ownerApp(ctx, args.applicationId);
    const owner = await ctx.db.get(app.ownerId);
    if (app.stagingParentId)
      throw new Error("Create staging from a production application.");
    const existing =
      app.stagingApplicationId && (await ctx.db.get(app.stagingApplicationId));
    if (existing && !existing.deletedAt)
      throw new Error("This application already has a staging environment.");
    const owned = await ctx.db
      .query("botApplications")
      .withIndex("by_owner", (q) => q.eq("ownerId", app.ownerId))
      .take(50);
    if (
      owned.filter((a) => !a.deletedAt).length >= (hasPremium(owner) ? 10 : 2)
    )
      throw new Error("Staging uses one of your available application slots.");
    const id = (await ctx.runMutation(
      makeFunctionReference<"mutation">("developerManagement:duplicate"),
      args,
    )) as Id<"botApplications">;
    await ctx.db.patch(id, { stagingParentId: app._id, discoverable: false });
    const serverId = (await ctx.runMutation(
      makeFunctionReference<"mutation">("developerSandbox:create"),
      { applicationId: id },
    )) as Id<"servers">;
    await ctx.runMutation(
      makeFunctionReference<"mutation">("botApplications:install"),
      { applicationId: id, serverId, permissions: app.permissions },
    );
    await ctx.db.patch(app._id, { stagingApplicationId: id });
    await auditBot(ctx, app._id, "staging.create", app.ownerId, id);
    return id;
  },
});
