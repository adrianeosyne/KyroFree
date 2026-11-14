import { v } from "convex/values";
import { internalMutation, query } from "./functions";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./functions";
import { ownerApp } from "./botLib";
import { requireActiveUser } from "./lib";
import { matchApiEndpoint } from "../lib/apiReference";
export type UsageField =
  | "requests"
  | "errors"
  | "commands"
  | "connections"
  | "delivered"
  | "failed"
  | "uploadedBytes";
export async function recordUsage(
  ctx: MutationCtx,
  applicationId: Id<"botApplications">,
  field: UsageField,
  amount = 1,
) {
  const day = Math.floor(Date.now() / 86400000) * 86400000;
  const row = await ctx.db
    .query("botUsageDaily")
    .withIndex("by_app_day", (q) =>
      q.eq("applicationId", applicationId).eq("day", day),
    )
    .unique();
  if (row) await ctx.db.patch(row._id, { [field]: row[field] + amount });
  else
    await ctx.db.insert("botUsageDaily", {
      applicationId,
      day,
      requests: 0,
      errors: 0,
      commands: 0,
      connections: 0,
      delivered: 0,
      failed: 0,
      uploadedBytes: 0,
      [field]: amount,
    });
}
export const requestFinished = internalMutation({
  args: {
    tokenHash: v.string(),
    method: v.string(),
    path: v.string(),
    status: v.number(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("botApplications")
      .withIndex("by_token", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!app) return;
    await recordUsage(ctx, app._id, "requests");
    if (args.status >= 400) await recordUsage(ctx, app._id, "errors");
    await ctx.db.insert("botRequestLogs", {
      applicationId: app._id,
      method: args.method.slice(0, 10),
      path: matchApiEndpoint(args.method, args.path)?.path ?? "unmatched",
      status: args.status,
      durationMs: Math.max(0, Math.min(args.durationMs, 120000)),
      createdAt: Date.now(),
    });
  },
});
export const get = query({
  args: {
    applicationId: v.id("botApplications"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const app = await ownerApp(ctx, args.applicationId);
    const days = Math.min(90, Math.max(1, Math.floor(args.days ?? 7)));
    const [daily, requests, sessions, deliveries, installs] = await Promise.all(
      [
        ctx.db
          .query("botUsageDaily")
          .withIndex("by_app_day", (q) =>
            q
              .eq("applicationId", app._id)
              .gte(
                "day",
                Math.floor(Date.now() / 86400000) * 86400000 -
                  (days - 1) * 86400000,
              ),
          )
          .collect(),
        ctx.db
          .query("botRequestLogs")
          .withIndex("by_app", (q) => q.eq("applicationId", app._id))
          .order("desc")
          .take(50),
        ctx.db
          .query("botGatewaySessions")
          .withIndex("by_app", (q) => q.eq("applicationId", app._id))
          .order("desc")
          .take(50),
        ctx.db
          .query("botEvents")
          .withIndex("by_app_created", (q) => q.eq("applicationId", app._id))
          .order("desc")
          .take(100),
        ctx.db
          .query("botInstallations")
          .withIndex("by_app", (q) => q.eq("applicationId", app._id))
          .collect(),
      ],
    );
    return {
      daily,
      requests: requests.map((r) => ({
        id: r._id,
        method: r.method,
        path: r.path,
        status: r.status,
        durationMs: r.durationMs,
        createdAt: r.createdAt,
      })),
      sessions: sessions.map((s) => ({
        id: s._id,
        label: s.label,
        createdAt: s.createdAt,
        lastHeartbeatAt: s.lastHeartbeatAt,
        connected:
          !s.closedAt &&
          s.expiresAt > Date.now() &&
          s.tokenVersion === app.tokenUpdatedAt &&
          app.enabled &&
          Boolean(app.tokenHash),
      })),
      installations: installs.length,
      activeInstallations: installs.filter(
        (i) => !i.disabled && app.enabled && !app.suspended,
      ).length,
      recentDelivered: deliveries.filter((e) => e.status === "delivered")
        .length,
      recentFailed: deliveries.filter((e) => e.status === "dead").length,
    };
  },
});
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const { id } = await requireActiveUser(ctx);
    const apps = (
      await ctx.db
        .query("botApplications")
        .withIndex("by_owner", (q) => q.eq("ownerId", id))
        .collect()
    ).filter((a) => !a.deletedAt);
    let installations = 0,
      activeInstallations = 0,
      connections = 0,
      eventDeliveries = 0,
      deliveryFailures = 0,
      apiErrors = 0;
    const activity = [];
    for (const app of apps) {
      const rows = await ctx.db
        .query("botInstallations")
        .withIndex("by_app", (q) => q.eq("applicationId", app._id))
        .collect();
      installations += rows.length;
      activeInstallations += rows.filter(
        (r) => !r.disabled && app.enabled && !app.suspended,
      ).length;
      connections += (
        await ctx.db
          .query("botGatewaySessions")
          .withIndex("by_app", (q) => q.eq("applicationId", app._id))
          .order("desc")
          .take(50)
      ).filter(
        (s) =>
          !s.closedAt &&
          s.expiresAt > Date.now() &&
          s.tokenVersion === app.tokenUpdatedAt &&
          Boolean(app.tokenHash),
      ).length;
      const usage = await ctx.db
        .query("botUsageDaily")
        .withIndex("by_app_day", (q) =>
          q
            .eq("applicationId", app._id)
            .gte(
              "day",
              Math.floor(Date.now() / 86400000) * 86400000 - 29 * 86400000,
            ),
        )
        .collect();
      for (const day of usage) {
        eventDeliveries += day.delivered;
        deliveryFailures += day.failed;
        apiErrors += day.errors;
      }
      activity.push(
        ...(
          await ctx.db
            .query("botAuditLogs")
            .withIndex("by_app", (q) => q.eq("applicationId", app._id))
            .order("desc")
            .take(5)
        ).map((l) => ({
          id: l._id,
          applicationId: app._id,
          applicationName: app.name,
          action: l.action,
          createdAt: l.createdAt,
        })),
      );
    }
    return {
      eventDeliveries,
      deliveryFailures,
      apiErrors,
      applications: apps.length,
      bots: apps.length,
      installations,
      activeInstallations,
      gatewayConnections: connections,
      apiRequests: apps.reduce((s, a) => s + a.apiRequests, 0),
      commandsExecuted: apps.reduce((s, a) => s + a.commandsExecuted, 0),
      activity: activity.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20),
      security: apps
        .filter((a) => !a.tokenHash || a.suspended)
        .map((a) => ({
          id: a._id,
          name: a.name,
          message: a.suspended ? "Application suspended" : "No active token",
        })),
    };
  },
});
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db
      .query("botRequestLogs")
      .withIndex("by_created", (q) =>
        q.lt("createdAt", Date.now() - 30 * 86400000),
      )
      .take(500))
      await ctx.db.delete(row._id);
    for (const row of await ctx.db
      .query("botGatewaySessions")
      .withIndex("by_expiry", (q) =>
        q.lt("expiresAt", Date.now() - 7 * 86400000),
      )
      .take(200))
      await ctx.db.delete(row._id);
  },
});
