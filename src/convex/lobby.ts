import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  httpAction,
  type MutationCtx,
} from "./functions";
import { makeFunctionReference } from "convex/server";
import { requireActiveUser, requireServerAccess, hydrateUsers } from "./lib";
import { LOBBY_DEFAULTS, LOBBY_SECTION_TYPES } from "../lib/lobby";
import { playerLevel, weekStart } from "./activityLib";
import { sha256Hex } from "./sha256";
import type { Id } from "./_generated/dataModel";
const configValidator = v.object({
  enabled: v.boolean(),
  title: v.string(),
  intro: v.string(),
  layout: v.string(),
  background: v.string(),
  panel: v.string(),
  accent: v.string(),
  sections: v.array(
    v.object({
      id: v.string(),
      type: v.string(),
      title: v.string(),
      text: v.optional(v.string()),
    }),
  ),
  buttons: v.array(
    v.object({ id: v.string(), label: v.string(), url: v.string() }),
  ),
});
function safeLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
async function owned(ctx: MutationCtx, serverId: Id<"servers">) {
  const { id } = await requireActiveUser(ctx),
    access = await requireServerAccess(ctx, serverId, id);
  if (access.server.ownerId !== id)
    throw new Error("Only the server owner can edit the lobby.");
  return access;
}
export const status = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { id } = await requireActiveUser(ctx);
    await requireServerAccess(ctx, serverId, id);
    const row = await ctx.db
      .query("serverLobbies")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .unique();
    return { enabled: row?.enabled ?? false };
  },
});
export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { id } = await requireActiveUser(ctx),
      access = await requireServerAccess(ctx, serverId, id);
    const row = await ctx.db
      .query("serverLobbies")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .unique();
    const config = {
      ...LOBBY_DEFAULTS,
      ...row,
      title: row?.title ?? `Welcome to ${access.server.name}`,
      intro:
        row?.intro ??
        access.server.welcomeMessage ??
        access.server.description ??
        LOBBY_DEFAULTS.intro,
    };
    const types = new Set(config.sections.map((s) => s.type));
    const levels = types.has("levels")
      ? await ctx.db
          .query("serverActivity")
          .withIndex("by_server_xp", (q) =>
            q.eq("serverId", serverId).eq("active", true),
          )
          .order("desc")
          .take(10)
      : [];
    const messages = types.has("messages")
      ? await ctx.db
          .query("serverActivity")
          .withIndex("by_server_week", (q) =>
            q
              .eq("serverId", serverId)
              .eq("active", true)
              .eq("weekStart", weekStart()),
          )
          .order("desc")
          .take(10)
      : [];
    const invites = types.has("invites")
      ? await ctx.db
          .query("serverActivity")
          .withIndex("by_server_invites", (q) =>
            q.eq("serverId", serverId).eq("active", true),
          )
          .order("desc")
          .take(10)
      : [];
    const users = await hydrateUsers(
      ctx,
      [...levels, ...messages, ...invites].map((r) => r.userId),
      id,
    );
    const board = (
      rows: typeof levels,
      key: "xp" | "weeklyMessages" | "invites",
    ) =>
      rows
        .map((r) => ({
          user: users.get(r.userId) ?? null,
          value: key === "xp" ? playerLevel(r.xp) : r[key],
        }))
        .filter((r) => r.user !== null);
    const feed = types.has("feed")
      ? await ctx.db
          .query("lobbyFeed")
          .withIndex("by_server_created", (q) => q.eq("serverId", serverId))
          .order("desc")
          .take(20)
      : [];
    // Secret hashes never leave the server.
    const {
      enabled,
      title,
      intro,
      layout,
      background,
      panel,
      accent,
      sections,
      buttons,
    } = config;
    const publicConfig = {
      enabled,
      title,
      intro,
      layout,
      background,
      panel,
      accent,
      sections,
      buttons,
    };
    return {
      config: publicConfig,
      isOwner: access.server.ownerId === id,
      serverName: access.server.name,
      rules: access.server.rules ?? "",
      boards: {
        levels: board(levels, "xp"),
        messages: board(messages, "weeklyMessages"),
        invites: board(invites, "invites"),
      },
      feed,
      feedConnected: !!row?.feedTokenHash,
    };
  },
});
export const save = mutation({
  args: { serverId: v.id("servers"), config: configValidator },
  handler: async (ctx, { serverId, config }) => {
    await owned(ctx, serverId);
    if (
      !["columns", "stacked", "spotlight"].includes(config.layout) ||
      config.title.length > 80 ||
      config.intro.length > 1000 ||
      !config.title.trim()
    )
      throw new Error("Choose a lobby title and supported layout.");
    if (
      [config.background, config.panel, config.accent].some(
        (c) => !/^#[0-9a-f]{6}$/i.test(c),
      )
    )
      throw new Error("Choose valid lobby colors.");
    if (
      config.sections.length > 12 ||
      new Set(config.sections.map((s) => s.id)).size !==
        config.sections.length ||
      config.sections.some(
        (s) =>
          !s.id ||
          s.id.length > 60 ||
          !(LOBBY_SECTION_TYPES as readonly string[]).includes(s.type) ||
          s.title.length > 80 ||
          (s.text?.length ?? 0) > 4000,
      )
    )
      throw new Error("Choose up to 12 valid lobby sections.");
    if (
      config.buttons.length > 8 ||
      new Set(config.buttons.map((b) => b.id)).size !== config.buttons.length ||
      config.buttons.some(
        (b) =>
          !b.id ||
          b.id.length > 60 ||
          !b.label.trim() ||
          b.label.length > 48 ||
          b.url.length > 512 ||
          !safeLink(b.url),
      )
    )
      throw new Error("Add up to 8 buttons with HTTPS links.");
    const row = await ctx.db
      .query("serverLobbies")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .unique();
    if (row) await ctx.db.patch(row._id, { ...config, updatedAt: Date.now() });
    else
      await ctx.db.insert("serverLobbies", {
        serverId,
        ...config,
        updatedAt: Date.now(),
      });
  },
});
export const rotateFeedToken = mutation({
  args: { serverId: v.id("servers"), disable: v.optional(v.boolean()) },
  handler: async (ctx, { serverId, disable }) => {
    await owned(ctx, serverId);
    const row = await ctx.db
      .query("serverLobbies")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .unique();
    const token = disable
      ? null
      : "KyroLobby_" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
    const patch = {
      feedTokenHash: token ? sha256Hex(token) : undefined,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, patch);
    else
      await ctx.db.insert("serverLobbies", {
        serverId,
        ...LOBBY_DEFAULTS,
        ...patch,
      });
    return {
      token,
      endpoint:
        (process.env.CONVEX_SITE_URL ??
          "https://giant-cricket-958.convex.site") + "/api/lobby-feed",
    };
  },
});
export const postFeed = internalMutation({
  args: {
    token: v.string(),
    title: v.string(),
    text: v.string(),
    url: v.optional(v.string()),
    source: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    if (!/^KyroLobby_[0-9a-f]{64}$/.test(args.token)) return { status: 401 };
    const lobby = await ctx.db
      .query("serverLobbies")
      .withIndex("by_feed_token", (q) =>
        q.eq("feedTokenHash", sha256Hex(args.token)),
      )
      .unique();
    if (!lobby?.enabled) return { status: 401 };
    if (
      !args.title.trim() ||
      args.title.length > 120 ||
      args.text.length > 1500 ||
      args.source.length > 60 ||
      !args.clientId ||
      args.clientId.length > 120 ||
      (args.url && (!safeLink(args.url) || args.url.length > 512))
    )
      return { status: 400 };
    const duplicate = await ctx.db
      .query("lobbyFeed")
      .withIndex("by_server_client", (q) =>
        q.eq("serverId", lobby.serverId).eq("clientId", args.clientId),
      )
      .unique();
    if (duplicate) return { status: 200 };
    const recent = await ctx.db
      .query("lobbyFeed")
      .withIndex("by_server_created", (q) =>
        q.eq("serverId", lobby.serverId).gt("createdAt", Date.now() - 3600000),
      )
      .order("desc")
      .take(30);
    if (recent.length >= 30) return { status: 429 };
    await ctx.db.insert("lobbyFeed", {
      serverId: lobby.serverId,
      title: args.title.trim(),
      text: args.text,
      url: args.url,
      source: args.source,
      clientId: args.clientId,
      createdAt: Date.now(),
    });
    return { status: 201 };
  },
});
const postRef = makeFunctionReference<
  "mutation",
  {
    token: string;
    title: string;
    text: string;
    url?: string;
    source: string;
    clientId: string;
  },
  { status: number }
>("lobby:postFeed");
export const feedHttp = httpAction(async (ctx, request) => {
  const json = (status: number) =>
    new Response(JSON.stringify({ ok: status < 300 }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (Number(request.headers.get("content-length") ?? 0) > 16000)
    return json(413);
  const body = await request.text();
  if (body.length > 16000) return json(413);
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return json(400);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    ["title", "text", "source", "clientId"].some(
      (k) => typeof payload[k] !== "string",
    ) ||
    (payload.url !== undefined && typeof payload.url !== "string")
  )
    return json(400);
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  const result = await ctx.runMutation(postRef, {
    token,
    title: payload.title,
    text: payload.text,
    source: payload.source,
    clientId: payload.clientId,
    ...(payload.url ? { url: payload.url } : {}),
  });
  return json(result.status);
});
