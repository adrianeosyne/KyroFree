/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import { LOBBY_DEFAULTS } from "../../src/lib/lobby";
import { weekStart } from "../../src/convex/activityLib";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 16));
  const t = convexTest(schema, modules),
    ids = await t.run(async (ctx) => ({
      owner: await ctx.db.insert("users", { name: "Owner", username: "owner" }),
      member: await ctx.db.insert("users", {
        name: "Member",
        username: "member",
      }),
      outsider: await ctx.db.insert("users", {
        name: "Outside",
        username: "outsider",
      }),
    }));
  const owner = t.withIdentity({ subject: ids.owner }),
    member = t.withIdentity({ subject: ids.member }),
    outsider = t.withIdentity({ subject: ids.outsider });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Arena",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  return { t, ids, owner, member, outsider, serverId };
}
describe("Community lobbies and activity", () => {
  it("restricts editing to owners, keeps lobbies off by default, and validates links, order and layouts", async () => {
    const f = await fixture();
    expect(
      await f.member.query(api.lobby.status, { serverId: f.serverId }),
    ).toEqual({ enabled: false });
    await expect(
      f.outsider.query(api.lobby.get, { serverId: f.serverId }),
    ).rejects.toThrow();
    await expect(
      f.member.mutation(api.lobby.save, {
        serverId: f.serverId,
        config: LOBBY_DEFAULTS,
      }),
    ).rejects.toThrow("Only the server owner");
    const config = {
      ...LOBBY_DEFAULTS,
      enabled: true,
      title: "Welcome racers",
      layout: "spotlight",
      sections: [...LOBBY_DEFAULTS.sections].reverse(),
      buttons: [
        { id: "rules", label: "Read rules", url: "https://example.com/rules" },
      ],
    };
    await f.owner.mutation(api.lobby.save, { serverId: f.serverId, config });
    expect(
      (await f.member.query(api.lobby.get, { serverId: f.serverId })).config,
    ).toEqual(config);
    await expect(
      f.owner.mutation(api.lobby.save, {
        serverId: f.serverId,
        config: {
          ...config,
          buttons: [{ id: "bad", label: "Bad", url: "javascript:alert(1)" }],
        },
      }),
    ).rejects.toThrow("HTTPS");
    await expect(
      f.owner.mutation(api.lobby.save, {
        serverId: f.serverId,
        config: {
          ...config,
          sections: [config.sections[0], config.sections[0]],
        },
      }),
    ).rejects.toThrow("valid lobby sections");
  });
  it("protects the external feed with owner-issued tokens, supports idempotency, and invalidates rotated tokens", async () => {
    const f = await fixture();
    await f.owner.mutation(api.lobby.save, {
      serverId: f.serverId,
      config: { ...LOBBY_DEFAULTS, enabled: true },
    });
    await expect(
      f.member.mutation(api.lobby.rotateFeedToken, { serverId: f.serverId }),
    ).rejects.toThrow("Only the server owner");
    const { token } = await f.owner.mutation(api.lobby.rotateFeedToken, {
      serverId: f.serverId,
    });
    expect(token).toMatch(/^KyroLobby_[a-f0-9]{64}$/);
    const view = await f.member.query(api.lobby.get, { serverId: f.serverId });
    expect(JSON.stringify(view)).not.toContain(token);
    expect(view.config).not.toHaveProperty("feedTokenHash");
    const payload = {
      title: "A new upload",
      text: "New original gaming video",
      url: "https://example.com/video",
      source: "YouTube",
      clientId: "video-1",
    };
    const post = (key: string | null, body = payload) =>
      f.t.fetch("/api/lobby-feed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    expect((await post("wrong")).status).toBe(401);
    expect((await post(token)).status).toBe(201);
    expect((await post(token)).status).toBe(200);
    expect(
      (await f.member.query(api.lobby.get, { serverId: f.serverId })).feed,
    ).toHaveLength(1);
    expect(
      (
        await post(token, {
          ...payload,
          clientId: "bad",
          url: "javascript:alert(1)",
        })
      ).status,
    ).toBe(400);
    const next = await f.owner.mutation(api.lobby.rotateFeedToken, {
      serverId: f.serverId,
    });
    expect(
      (await post(token, { ...payload, clientId: "rotated" })).status,
    ).toBe(401);
    expect(
      (await post(next.token, { ...payload, clientId: "rotated" })).status,
    ).toBe(201);
    await f.owner.mutation(api.lobby.rotateFeedToken, {
      serverId: f.serverId,
      disable: true,
    });
    expect(
      (await post(next.token, { ...payload, clientId: "disabled" })).status,
    ).toBe(401);
  });
  it("counts human messages, awards XP with a cooldown, resets weekly counts and prevents rejoin invite farming", async () => {
    const f = await fixture(),
      channel = (
        await f.owner.query(api.channels.list, { serverId: f.serverId })
      ).channels.find((c) => c.kind === "text")!;
    const send = () =>
      f.member.mutation(api.messages.send, {
        containerType: "channel",
        containerId: channel.id,
        content: "A real message",
      });
    await send();
    await send();
    vi.setSystemTime(Date.now() + 61000);
    await send();
    let board = await f.member.query(api.lobby.get, { serverId: f.serverId });
    expect(
      board.boards.messages.find((r) => r.user?.id === f.ids.member)?.value,
    ).toBe(3);
    const top = await f.member.query(api.activity.topPlayers);
    expect(top.find((r) => r.user?.id === f.ids.member)?.xp).toBe(20);
    vi.setSystemTime(weekStart() + 7 * 86400000 + 1000);
    await send();
    board = await f.member.query(api.lobby.get, { serverId: f.serverId });
    expect(
      board.boards.messages.find((r) => r.user?.id === f.ids.member)?.value,
    ).toBe(1);
    const invite = await f.owner.mutation(api.servers.createInvite, {
      serverId: f.serverId,
    });
    await f.outsider.mutation(api.servers.joinByCode, { code: invite });
    await f.outsider.mutation(api.servers.leave, { serverId: f.serverId });
    await f.outsider.mutation(api.servers.joinByCode, { code: invite });
    board = await f.member.query(api.lobby.get, { serverId: f.serverId });
    expect(
      board.boards.invites.find((r) => r.user?.id === f.ids.owner)?.value,
    ).toBe(1);
  });
  it("removes lobby capabilities and activity when a community is deleted", async () => {
    const f = await fixture();
    await f.owner.mutation(api.lobby.save, {
      serverId: f.serverId,
      config: LOBBY_DEFAULTS,
    });
    await f.owner.mutation(api.lobby.rotateFeedToken, { serverId: f.serverId });
    await f.owner.mutation(api.servers.remove, {
      serverId: f.serverId,
      confirm: "Arena",
    });
    await f.t.run(async (ctx) => {
      expect(await ctx.db.query("serverLobbies").collect()).toHaveLength(0);
      expect(await ctx.db.query("serverActivity").collect()).toHaveLength(0);
    });
  });
  it("keeps an email recovery link one-time, expiring, and bound to the current authenticator", async () => {
    const f = await fixture(),
      token = "a".repeat(64);
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.ids.member, { email: "member@example.com" });
      await ctx.db.insert("accountSecurity", {
        userId: f.ids.member,
        twoFactorEnabled: true,
        totpSecret: "secret",
        recoveryCodeHashes: [],
        updatedAt: Date.now(),
      });
    });
    await f.t.mutation(internal.accountRecovery.prepare, {
      userId: f.ids.member,
      token,
    });
    await f.t.run(async (ctx) => {
      const rows = await ctx.db.query("accountRecoveryTokens").collect();
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain(token);
    });
    expect(
      await f.t.mutation(internal.accountRecovery.consume, {
        token: "b".repeat(64),
      }),
    ).toBeNull();
    expect(
      await f.t.mutation(internal.accountRecovery.consume, { token }),
    ).toBe(f.ids.member);
    expect(
      await f.t.mutation(internal.accountRecovery.consume, { token }),
    ).toBeNull();
  });
  it("blocks stale recovery emails, expires links, scrubs sent tokens and throttles requests", async () => {
    const f = await fixture();
    const enroll = () =>
      f.t.run(async (ctx) => {
        await ctx.db.patch(f.ids.member, { email: "member@example.com" });
        return ctx.db.insert("accountSecurity", {
          userId: f.ids.member,
          twoFactorEnabled: true,
          totpSecret: "secret",
          recoveryCodeHashes: [],
          updatedAt: Date.now(),
        });
      });
    const securityId = await enroll(),
      token = "c".repeat(64);
    await f.t.mutation(internal.accountRecovery.prepare, {
      userId: f.ids.member,
      token,
    });
    await f.t.mutation(internal.accountRecovery.prepare, {
      userId: f.ids.member,
      token: "d".repeat(64),
    });
    const outbox = await f.t.run(async (ctx) => {
      expect(
        await ctx.db.query("accountRecoveryRequests").collect(),
      ).toHaveLength(1);
      return (await ctx.db.query("emailOutbox").collect())[0];
    });
    expect(
      await f.t.mutation(internal.emailOutbox.claim, { outboxId: outbox._id }),
    ).not.toBeNull();
    await f.t.mutation(internal.emailOutbox.markSent, {
      outboxId: outbox._id,
      providerMessageId: "test",
    });
    await f.t.run(async (ctx) => {
      expect((await ctx.db.get(outbox._id))?.payload).toBe("{}");
    });
    vi.setSystemTime(Date.now() + 15 * 60000 + 1);
    expect(
      await f.t.mutation(internal.accountRecovery.consume, { token }),
    ).toBeNull();
    await f.t.mutation(internal.accountRecovery.prepare, {
      userId: f.ids.member,
      token: "e".repeat(64),
    });
    const stale = await f.t.run(
      async (ctx) =>
        (await ctx.db.query("emailOutbox").collect()).find(
          (r) => r._id !== outbox._id,
        )!,
    );
    await f.t.run(async (ctx) => ctx.db.delete(securityId));
    await enroll();
    expect(
      await f.t.mutation(internal.accountRecovery.consume, {
        token: "e".repeat(64),
      }),
    ).toBeNull();
    expect(
      await f.t.mutation(internal.emailOutbox.claim, { outboxId: stale._id }),
    ).toBeNull();
    await f.t.run(async (ctx) => {
      const row = await ctx.db.get(stale._id);
      expect(row?.lastErrorCode).toBe("CODE_SUPERSEDED");
      expect(row?.payload).toBe("{}");
    });
    vi.setSystemTime(Date.now() + 3600001);
    await f.t.mutation(internal.emailOutbox.cleanupExpiredRecords, {});
    await f.t.run(async (ctx) => {
      expect(
        await ctx.db.query("accountRecoveryTokens").collect(),
      ).toHaveLength(0);
      expect(
        await ctx.db.query("accountRecoveryRequests").collect(),
      ).toHaveLength(0);
    });
  });
  it("limits authenticated feed posts to thirty per hour", async () => {
    const f = await fixture();
    await f.owner.mutation(api.lobby.save, {
      serverId: f.serverId,
      config: { ...LOBBY_DEFAULTS, enabled: true },
    });
    const { token } = await f.owner.mutation(api.lobby.rotateFeedToken, {
      serverId: f.serverId,
    });
    const post = (clientId: string) =>
      f.t.mutation(internal.lobby.postFeed, {
        token: token!,
        title: "Stream",
        text: "Live now",
        source: "Stream alerts",
        clientId,
      });
    for (let i = 0; i < 30; i++)
      expect((await post(`event-${i}`)).status).toBe(201);
    expect((await post("event-30")).status).toBe(429);
    expect((await post("event-0")).status).toBe(200);
    vi.setSystemTime(Date.now() + 3600001);
    expect((await post("event-30")).status).toBe(201);
  });
  it("syncs HQ OG roles and imports existing membership history only once", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) =>
      ctx.db.patch(f.serverId, { isPlatformHome: true }),
    );
    const roleId = await f.owner.mutation(api.roles.create, {
      serverId: f.serverId,
      name: "OG",
      permissions: [],
    });
    await f.owner.mutation(api.servers.updateMemberRoles, {
      serverId: f.serverId,
      userId: f.ids.member,
      roleIds: [roleId],
    });
    expect((await f.member.query(api.users.me))?.badges).toContain("og");
    await f.owner.mutation(api.roles.update, { roleId, name: "Early crew" });
    expect((await f.member.query(api.users.me))?.badges).not.toContain("og");
    const grantedAt = Date.now() - 86400000;
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.ids.member, { premiumUntil: Date.now() + 86400000 });
      await ctx.db.insert("adminActions", {
        actorId: f.ids.owner,
        action: "premium_granted",
        targetType: "user",
        targetId: f.ids.member,
        createdAt: grantedAt,
      });
    });
    await f.t.mutation(internal.communityMigration.initializeHistory, {});
    await f.t.mutation(internal.communityMigration.initializeHistory, {});
    const status = await f.member.query(api.premium.status);
    expect(status.premiumSince).toBe(grantedAt);
    expect(status.premiumStreakSince).toBe(status.premiumSince);
    expect(status.premiumGiftCount).toBe(0);
  });
});
