import { v } from "convex/values";
import { makeFunctionReference, paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "./functions";
import { growthAccess } from "./communityGrowthLib";
import { text } from "./advancedValidation";
import { sha256Hex } from "./sha256";
import { logAudit } from "./lib";
import {
  communityBackupSchema,
  parseCommunityBackup,
  type CommunityBackup,
} from "../lib/communityBackup";
import type { Doc, Id } from "./_generated/dataModel";
import type { Ctx } from "./lib";
import type { MutationCtx } from "./functions";
function protectedRole(role: Doc<"serverRoles">) {
  return (
    !!role.botApplicationId ||
    !!role.premiumRole ||
    ["owner", "founder"].includes(role.name.trim().toLowerCase())
  );
}
async function configuration(
  ctx: Ctx,
  serverId: Id<"servers">,
): Promise<CommunityBackup> {
  const server = await ctx.db.get(serverId);
  if (!server) throw new Error("Community not found.");
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .take(101);
  const channels = await ctx.db
    .query("channels")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .take(201);
  const roles = await ctx.db
    .query("serverRoles")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .take(201);
  const automod = await ctx.db
    .query("serverAutomod")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .unique();
  const lobby = await ctx.db
    .query("serverLobbies")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .unique();
  const backup: CommunityBackup = {
    format: "kyro-community-backup",
    version: 1,
    serverId,
    community: {
      name: server.name,
      description: server.description ?? "",
      rules: server.rules ?? "",
      welcomeMessage: server.welcomeMessage ?? "",
      isPublic: server.isPublic,
      tags: server.tags ?? [],
      tag: server.tag ?? null,
      links: server.links ?? [],
      verificationLevel: server.verificationLevel ?? "none",
      minAccountAgeMs: server.minAccountAgeMs ?? 0,
      applyToJoin: server.applyToJoin ?? false,
      applicationQuestions: server.applicationQuestions ?? [],
      themeAccent: server.themeAccent ?? null,
      themeTint: server.themeTint ?? null,
      rulesChannelKey: server.rulesChannelId ?? null,
    },
    categories: categories.map((c) => ({
      key: c._id,
      name: c.name,
      position: c.position,
    })),
    roles: roles.map((r) => ({
      key: r._id,
      name: r.name,
      color: r.color ?? null,
      position: r.position,
      permissions: r.permissions,
      isDefault: r.isDefault,
      hoist: r.hoist ?? false,
      mentionable: r.mentionable ?? false,
      protected: protectedRole(r),
    })),
    channels: channels.map((c) => ({
      key: c._id,
      categoryKey: c.categoryId ?? null,
      name: c.name,
      topic: c.topic ?? "",
      kind: c.kind ?? "text",
      position: c.position,
      slowMode: c.slowMode ?? 0,
      readOnly: c.readOnly ?? false,
      premiumOnly: c.premiumOnly ?? false,
      permissionOverwrites: (c.permissionOverwrites ?? []).map((o) => ({
        roleKey: o.roleId,
        allow: o.allow,
        deny: o.deny,
      })),
    })),
    automod: automod
      ? {
          enabled: automod.enabled,
          blockedWords: automod.blockedWords,
          blockInvites: automod.blockInvites,
          blockLinks: automod.blockLinks,
          maxMentions: automod.maxMentions,
          blockCaps: automod.blockCaps,
          blockSpam: automod.blockSpam,
          exemptRoleKeys: automod.exemptRoleIds,
          exemptChannelKeys: automod.exemptChannelIds,
        }
      : null,
    lobby: lobby
      ? {
          enabled: lobby.enabled,
          title: lobby.title,
          intro: lobby.intro,
          layout: lobby.layout,
          background: lobby.background,
          panel: lobby.panel,
          accent: lobby.accent,
          sections: lobby.sections,
          buttons: lobby.buttons,
        }
      : null,
  };
  return communityBackupSchema.parse(backup);
}
async function capture(
  ctx: MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
  label: string,
) {
  const snapshot = await configuration(ctx, serverId),
    fingerprint = sha256Hex(JSON.stringify(snapshot));
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 450000)
    throw new Error("Configuration exceeds the backup size limit.");
  const latest = await ctx.db
    .query("communityBackups")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .order("desc")
    .first();
  if (latest?.fingerprint === fingerprint) return latest._id;
  const backupId = await ctx.db.insert("communityBackups", {
    serverId,
    userId,
    label,
    snapshot,
    fingerprint,
    createdAt: Date.now(),
  });
  const recent = await ctx.db
    .query("communityBackups")
    .withIndex("by_server", (q) => q.eq("serverId", serverId))
    .order("desc")
    .take(31);
  if (recent.length > 30) await ctx.db.delete(recent[30]._id);
  return backupId;
}
export const captureChange = internalMutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("communityBackupJobs")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .unique();
    if (pending) await ctx.db.delete(pending._id);
    const server = await ctx.db.get(args.serverId);
    if (!server) return;
    try {
      await capture(ctx, args.serverId, server.ownerId, "Configuration change");
    } catch {
      /* Oversized or legacy-invalid configurations stay usable without a snapshot. */
    }
  },
});
export const list = query({
  args: { serverId: v.id("servers"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await growthAccess(ctx, args.serverId, false, true);
    const page = await ctx.db
      .query("communityBackups")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(10, args.paginationOpts.numItems),
      });
    return {
      ...page,
      page: page.page.map((row) => ({
        _id: row._id,
        label: row.label,
        fingerprint: row.fingerprint,
        createdAt: row.createdAt,
      })),
    };
  },
});
export const detail = query({
  args: { backupId: v.id("communityBackups") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.backupId);
    if (!row) throw new Error("Backup not found.");
    const { server, id } = await growthAccess(ctx, row.serverId, false, true);
    const current = await configuration(ctx, row.serverId);
    const changedSections = (
      [
        "community",
        "roles",
        "categories",
        "channels",
        "automod",
        "lobby",
      ] as const
    ).filter(
      (key) =>
        JSON.stringify(current[key]) !== JSON.stringify(row.snapshot[key]),
    );
    return {
      ...row,
      currentFingerprint: sha256Hex(JSON.stringify(current)),
      currentName: server.name,
      changedSections,
      canRestore: server.ownerId === id,
    };
  },
});
export const create = mutation({
  args: { serverId: v.id("servers"), label: v.string() },
  handler: async (ctx, args) => {
    const { id } = await growthAccess(ctx, args.serverId, true, true);
    const backupId = await capture(
      ctx,
      args.serverId,
      id,
      text(args.label, "Backup label", 100),
    );
    await logAudit(ctx, {
      serverId: args.serverId,
      actorId: id,
      action: "community.backup_create",
      targetId: backupId,
    });
    return backupId;
  },
});
export const importBackup = mutation({
  args: { serverId: v.id("servers"), content: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    const { id, server } = await growthAccess(ctx, args.serverId, true, true);
    if (server.ownerId !== id)
      throw new Error("Only the community owner can import backups.");
    const snapshot = parseCommunityBackup(args.content);
    if (snapshot.serverId !== args.serverId)
      throw new Error("Choose a backup of this same community.");
    for (const [table, rows] of [
      ["channels", snapshot.channels],
      ["categories", snapshot.categories],
      ["serverRoles", snapshot.roles],
    ] as const)
      for (const row of rows) {
        const normalized = ctx.db.normalizeId(table, row.key);
        if (!normalized)
          throw new Error("Backup contains an invalid resource reference.");
        const current = await ctx.db.get(normalized);
        if (current && current.serverId !== args.serverId)
          throw new Error("Backup contains a foreign resource reference.");
      }
    const recent = await ctx.db
      .query("communityBackups")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .order("desc")
      .take(30);
    if (recent.length === 30) await ctx.db.delete(recent[29]._id);
    const backupId = await ctx.db.insert("communityBackups", {
      serverId: args.serverId,
      userId: id,
      label: text(args.label, "Backup label", 100),
      snapshot,
      fingerprint: sha256Hex(JSON.stringify(snapshot)),
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      serverId: args.serverId,
      actorId: id,
      action: "community.backup_import",
      targetId: backupId,
    });
    return backupId;
  },
});
export const restore = mutation({
  args: {
    backupId: v.id("communityBackups"),
    expectedFingerprint: v.string(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.backupId);
    if (!row) throw new Error("Backup not found.");
    const { id, server } = await growthAccess(ctx, row.serverId, true, true);
    if (server.ownerId !== id)
      throw new Error("Only the community owner can restore configuration.");
    if (args.confirmation !== server.name)
      throw new Error(
        "Type the current community name to confirm restoration.",
      );
    const current = await configuration(ctx, row.serverId);
    if (sha256Hex(JSON.stringify(current)) !== args.expectedFingerprint)
      throw new Error(
        "Configuration changed. Review the latest state before restoring.",
      );
    const snapshot = parseCommunityBackup(JSON.stringify(row.snapshot));
    if (
      snapshot.serverId !== row.serverId ||
      sha256Hex(JSON.stringify(snapshot)) !== row.fingerprint
    )
      throw new Error("Backup integrity check failed.");
    for (const [saved, present, limit] of [
      [snapshot.roles, current.roles, 200],
      [snapshot.categories, current.categories, 100],
      [snapshot.channels, current.channels, 200],
    ] as const) {
      const keys = new Set(present.map((item) => item.key));
      if (
        present.length + saved.filter((item) => !keys.has(item.key)).length >
        limit
      )
        throw new Error(
          "Restoration would exceed the configuration resource limit. Remove unused resources before retrying.",
        );
    }
    await capture(ctx, row.serverId, id, "Before restoration");
    const roleMap = new Map<string, Id<"serverRoles">>(),
      categoryMap = new Map<string, Id<"categories">>(),
      channelMap = new Map<string, Id<"channels">>();
    const defaultRole = await ctx.db
      .query("serverRoles")
      .withIndex("by_server_default", (q) =>
        q.eq("serverId", row.serverId).eq("isDefault", true),
      )
      .unique();
    for (const item of snapshot.roles) {
      const roleId = ctx.db.normalizeId("serverRoles", item.key),
        existing = roleId && (await ctx.db.get(roleId));
      if (existing && existing.serverId !== row.serverId)
        throw new Error("Backup contains a foreign role.");
      if (item.protected || (existing && protectedRole(existing))) {
        if (!existing)
          throw new Error("A protected role is no longer available.");
        roleMap.set(item.key, existing._id);
        continue;
      }
      const value = {
        name: item.name,
        color: item.color ?? undefined,
        position: item.position,
        permissions: item.permissions,
        isDefault: item.isDefault,
        hoist: item.hoist,
        mentionable: item.mentionable,
      };
      const target = item.isDefault ? defaultRole : existing;
      if (target) {
        await ctx.db.patch(target._id, value);
        roleMap.set(item.key, target._id);
      } else
        roleMap.set(
          item.key,
          await ctx.db.insert("serverRoles", {
            ...value,
            serverId: row.serverId,
          }),
        );
    }
    for (const item of snapshot.categories) {
      const categoryId = ctx.db.normalizeId("categories", item.key),
        existing = categoryId && (await ctx.db.get(categoryId));
      if (existing && existing.serverId !== row.serverId)
        throw new Error("Backup contains a foreign category.");
      const value = { name: item.name, position: item.position };
      if (existing) {
        await ctx.db.patch(existing._id, value);
        categoryMap.set(item.key, existing._id);
      } else
        categoryMap.set(
          item.key,
          await ctx.db.insert("categories", {
            ...value,
            serverId: row.serverId,
            createdAt: Date.now(),
          }),
        );
    }
    for (const item of snapshot.channels) {
      const channelId = ctx.db.normalizeId("channels", item.key),
        existing = channelId && (await ctx.db.get(channelId));
      if (existing && existing.serverId !== row.serverId)
        throw new Error("Backup contains a foreign channel.");
      if (existing && server.isPlatformHome && existing.premiumOnly) {
        channelMap.set(item.key, existing._id);
        continue;
      }
      const value = {
        name: item.name,
        topic: item.topic,
        position: item.position,
        kind: item.kind,
        slowMode: item.slowMode,
        readOnly: item.readOnly,
        premiumOnly: item.premiumOnly,
        categoryId: item.categoryKey
          ? categoryMap.get(item.categoryKey)
          : undefined,
        permissionOverwrites: item.permissionOverwrites.map((o) => ({
          roleId: roleMap.get(o.roleKey)!,
          allow: o.allow,
          deny: o.deny,
        })),
      };
      if (existing && (existing.kind ?? "text") !== item.kind)
        throw new Error(
          "An existing channel changed type. Restore its name and type manually before retrying.",
        );
      if (existing) {
        await ctx.db.patch(existing._id, value);
        channelMap.set(item.key, existing._id);
      } else
        channelMap.set(
          item.key,
          await ctx.db.insert("channels", {
            ...value,
            serverId: row.serverId,
            createdAt: Date.now(),
            createdById: id,
          }),
        );
    }
    const { rulesChannelKey, ...community } = snapshot.community;
    await ctx.runMutation(makeFunctionReference<"mutation">("servers:update"), {
      ...community,
      serverId: row.serverId,
      rulesChannelId: rulesChannelKey ? channelMap.get(rulesChannelKey) : null,
    });
    const currentAutomod = await ctx.db
      .query("serverAutomod")
      .withIndex("by_server", (q) => q.eq("serverId", row.serverId))
      .unique();
    if (snapshot.automod) {
      const { exemptRoleKeys, exemptChannelKeys, ...fields } = snapshot.automod;
      const value = {
        ...fields,
        exemptRoleIds: exemptRoleKeys.map((k) => roleMap.get(k)!),
        exemptChannelIds: exemptChannelKeys.map((k) => channelMap.get(k)!),
        updatedAt: Date.now(),
        updatedById: id,
      };
      if (currentAutomod) await ctx.db.patch(currentAutomod._id, value);
      else
        await ctx.db.insert("serverAutomod", {
          ...value,
          serverId: row.serverId,
        });
    } else if (currentAutomod)
      await ctx.db.patch(currentAutomod._id, {
        enabled: false,
        updatedAt: Date.now(),
        updatedById: id,
      });
    if (snapshot.lobby)
      await ctx.runMutation(makeFunctionReference<"mutation">("lobby:save"), {
        serverId: row.serverId,
        config: snapshot.lobby,
      });
    else {
      const currentLobby = await ctx.db
        .query("serverLobbies")
        .withIndex("by_server", (q) => q.eq("serverId", row.serverId))
        .unique();
      if (currentLobby)
        await ctx.db.patch(currentLobby._id, { enabled: false });
    }
    await logAudit(ctx, {
      serverId: row.serverId,
      actorId: id,
      action: "community.backup_restore",
      targetId: row._id,
      details: row.label,
    });
    await ctx.scheduler.runAfter(
      0,
      makeFunctionReference<"mutation">("communityBackups:captureChange"),
      { serverId: row.serverId },
    );
  },
});
