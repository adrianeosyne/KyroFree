import type { MutationCtx } from "./functions";
import type { Doc } from "./_generated/dataModel";
import { botError } from "./botLib";
import { recordUsage } from "./botAnalytics";
export async function gatewayRequest(
  ctx: MutationCtx,
  app: Doc<"botApplications">,
  method: string,
  path: string[],
  body: unknown,
) {
  if (path.length === 1 && method === "GET")
    return {
      version: 1,
      transport: "durable-poll",
      heartbeatIntervalMs: 30000,
      sessionTimeoutMs: 90000,
      pollIntervalMs: 2500,
      maxEvents: 25,
      acknowledgementDeadlineMs: 60000,
      delivery: "at-least-once",
    };
  if (path[1] !== "sessions")
    botError(404, "NOT_FOUND", "Gateway endpoint not found.");
  if (path.length === 2 && method === "POST") {
    const label =
      body &&
      typeof body === "object" &&
      "label" in body &&
      typeof body.label === "string"
        ? body.label.slice(0, 80)
        : "Bot client";
    const recent = await ctx.db
      .query("botGatewaySessions")
      .withIndex("by_app", (q) => q.eq("applicationId", app._id))
      .order("desc")
      .take(50);
    if (
      recent.filter(
        (s) =>
          !s.closedAt &&
          s.expiresAt > Date.now() &&
          s.tokenVersion === app.tokenUpdatedAt,
      ).length >= 10
    )
      botError(429, "SESSION_LIMIT", "A bot may have ten active sessions.");
    const now = Date.now();
    const id = await ctx.db.insert("botGatewaySessions", {
      applicationId: app._id,
      tokenVersion: app.tokenUpdatedAt,
      label,
      createdAt: now,
      lastHeartbeatAt: now,
      expiresAt: now + 90000,
    });
    await recordUsage(ctx, app._id, "connections");
    return { id, heartbeatIntervalMs: 30000, expiresAt: now + 90000 };
  }
  const id = ctx.db.normalizeId("botGatewaySessions", path[2] ?? "");
  const session = id ? await ctx.db.get(id) : null;
  if (
    !session ||
    session.applicationId !== app._id ||
    session.tokenVersion !== app.tokenUpdatedAt ||
    session.closedAt ||
    session.expiresAt < Date.now()
  )
    botError(401, "SESSION_EXPIRED", "Create a new gateway session.");
  if (path.length === 3 && method === "DELETE") {
    await ctx.db.patch(session._id, { closedAt: Date.now() });
    return { disconnected: true };
  }
  if (path.length === 4 && path[3] === "heartbeat" && method === "POST") {
    await ctx.db.patch(session._id, {
      lastHeartbeatAt: Date.now(),
      expiresAt: Date.now() + 90000,
    });
    return { id: session._id, expiresAt: Date.now() + 90000 };
  }
  botError(404, "NOT_FOUND", "Gateway endpoint not found.");
}
