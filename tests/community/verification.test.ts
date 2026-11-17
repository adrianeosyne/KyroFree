/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import { PERMISSIONS } from "../../src/lib/permissions";

const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const founder = await ctx.db.insert("users", {
      username: "adrianeosyne",
      name: "Founder",
    });
    const kyro = await ctx.db.insert("users", {
      username: "kyro",
      name: "Kyro",
    });
    const owner = await ctx.db.insert("users", {
      username: "owner",
      name: "Owner",
    });
    const nextOwner = await ctx.db.insert("users", {
      username: "next_owner",
      name: "Next owner",
    });
    const admin = await ctx.db.insert("users", {
      username: "admin",
      role: "admin",
    });
    const impostor = await ctx.db.insert("users", {
      username: "impostor",
      founderBadge: true,
    });
    const server = await ctx.db.insert("servers", {
      name: "Private community",
      ownerId: owner,
      isPublic: false,
      createdAt: Date.now(),
    });
    const home = await ctx.db.insert("servers", {
      name: "Kyro HQ",
      ownerId: founder,
      isPublic: true,
      isPlatformHome: true,
      createdAt: Date.now(),
    });
    const everyone = await ctx.db.insert("serverRoles", {
      serverId: server,
      name: "@everyone",
      position: 0,
      isDefault: true,
      permissions: [PERMISSIONS.VIEW_CHANNEL, PERMISSIONS.SEND_MESSAGES],
    });
    const founderRole = await ctx.db.insert("serverRoles", {
      serverId: server,
      name: "Founder",
      position: 10,
      isDefault: false,
      permissions: [PERMISSIONS.ADMINISTRATOR],
    });
    const memberRole = await ctx.db.insert("serverRoles", {
      serverId: server,
      name: "Member",
      position: 1,
      isDefault: false,
      permissions: [],
    });
    for (const userId of [owner, nextOwner, founder, kyro]) {
      await ctx.db.insert("serverMembers", {
        serverId: server,
        userId,
        roleIds:
          userId === founder || userId === kyro
            ? [founderRole, memberRole]
            : [],
        joinedAt: Date.now(),
      });
    }
    const homeRole = await ctx.db.insert("serverRoles", {
      serverId: home,
      name: "Founder",
      position: 10,
      isDefault: false,
      permissions: [PERMISSIONS.ADMINISTRATOR],
    });
    await ctx.db.insert("serverMembers", {
      serverId: home,
      userId: founder,
      roleIds: [homeRole],
      joinedAt: Date.now(),
    });
    return {
      founder,
      kyro,
      owner,
      nextOwner,
      admin,
      impostor,
      server,
      home,
      founderRole,
      memberRole,
      homeRole,
      everyone,
    };
  });
  vi.stubEnv("KYRO_FOUNDER_USER_ID", ids.founder);
  return {
    t,
    ids,
    founder: t.withIdentity({ subject: ids.founder }),
    owner: t.withIdentity({ subject: ids.owner }),
    nextOwner: t.withIdentity({ subject: ids.nextOwner }),
  };
}

describe("server verification", () => {
  it("lets the configured founder verify a private server without joining, and shows its owner's badge", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const membership = await ctx.db
        .query("serverMembers")
        .withIndex("by_server_user", (q) =>
          q.eq("serverId", f.ids.server).eq("userId", f.ids.founder),
        )
        .unique();
      await ctx.db.delete(membership!._id);
    });
    await f.founder.mutation(api.admin.setServerVerified, {
      serverId: f.ids.server,
      verified: true,
    });
    const server = await f.owner.query(api.servers.get, {
      serverId: f.ids.server,
    });
    expect(server.verified).toBe(true);
    const owner = await f.owner.query(api.users.me, {});
    expect(owner?.badges).toContain("verifiedserverowner");
    const portalOwner = (
      await f.founder.query(api.admin.searchMembers, { term: "owner" })
    ).find((user) => user.id === f.ids.owner);
    expect(portalOwner?.badges).toContain("verifiedserverowner");
    await f.owner.mutation(api.users.updateProfile, {
      primaryBadge: "verifiedserverowner",
    });
    expect(
      (await f.t.run((ctx) => ctx.db.get(f.ids.server)))?.verifiedById,
    ).toBe(f.ids.founder);
    expect((await f.founder.query(api.admin.actionLog, {}))[0].action).toBe(
      "verify_server",
    );
  });

  it("rejects verification by an ordinary owner, another admin, and a granted Founder badge", async () => {
    const f = await fixture();
    for (const subject of [f.ids.owner, f.ids.admin, f.ids.impostor]) {
      await expect(
        f.t
          .withIdentity({ subject })
          .mutation(api.admin.setServerVerified, {
            serverId: f.ids.server,
            verified: true,
          }),
      ).rejects.toThrow(/Only adrianeosyne/);
    }
    await expect(
      f.owner.mutation(api.users.updateProfile, {
        primaryBadge: "verifiedserverowner",
      }),
    ).rejects.toThrow(/hold/);
    expect((await f.owner.query(api.users.me, {}))?.badges).not.toContain(
      "verifiedserverowner",
    );
  });

  it("moves the badge to the new owner and removes it on revocation or server deletion", async () => {
    const f = await fixture();
    await f.founder.mutation(api.admin.setServerVerified, {
      serverId: f.ids.server,
      verified: true,
    });
    await f.owner.mutation(api.servers.transferOwnership, {
      serverId: f.ids.server,
      userId: f.ids.nextOwner,
    });
    expect((await f.owner.query(api.users.me, {}))?.badges).not.toContain(
      "verifiedserverowner",
    );
    expect((await f.nextOwner.query(api.users.me, {}))?.badges).toContain(
      "verifiedserverowner",
    );
    await f.founder.mutation(api.admin.setServerVerified, {
      serverId: f.ids.server,
      verified: false,
    });
    expect((await f.nextOwner.query(api.users.me, {}))?.badges).not.toContain(
      "verifiedserverowner",
    );
    await f.founder.mutation(api.admin.setServerVerified, {
      serverId: f.ids.server,
      verified: true,
    });
    await f.founder.mutation(api.admin.removeServer, {
      serverId: f.ids.server,
    });
    expect((await f.nextOwner.query(api.users.me, {}))?.badges).not.toContain(
      "verifiedserverowner",
    );
  });

  it("keeps HQ verified and supports paginating all public and private servers", async () => {
    const f = await fixture();
    expect(
      (await f.founder.query(api.servers.get, { serverId: f.ids.home }))
        .verified,
    ).toBe(true);
    await expect(
      f.founder.mutation(api.admin.setServerVerified, {
        serverId: f.ids.home,
        verified: false,
      }),
    ).rejects.toThrow(/permanent/);
    const first = await f.founder.query(api.admin.servers, {
      term: "",
      paginationOpts: { cursor: null, numItems: 1 },
    });
    const second = await f.founder.query(api.admin.servers, {
      term: "",
      paginationOpts: { cursor: first.continueCursor, numItems: 1 },
    });
    expect([...first.page, ...second.page].map((server) => server.id)).toEqual(
      expect.arrayContaining([f.ids.server, f.ids.home]),
    );
    await expect(
      f.owner.query(api.admin.servers, {
        term: "",
        paginationOpts: { cursor: null, numItems: 30 },
      }),
    ).rejects.toThrow(/staff/);
  });
});

describe("community founder roles", () => {
  it("ignores legacy Founder assignments for platform accounts in another owner's server", async () => {
    const f = await fixture();
    for (const subject of [f.ids.founder, f.ids.kyro]) {
      const client = f.t.withIdentity({ subject });
      const server = await client.query(api.servers.get, {
        serverId: f.ids.server,
      });
      expect(server.permissions).not.toContain(PERMISSIONS.ADMINISTRATOR);
      const profile = await client.query(api.users.profile, {
        userId: subject,
        serverId: f.ids.server,
      });
      expect(profile?.serverRoles.map((role) => role.name)).toEqual(["Member"]);
      const members = await client.query(api.servers.members, {
        serverId: f.ids.server,
      });
      const member = [...members.online, ...members.offline].find(
        (member) => member.user.id === subject,
      );
      expect(member?.roles.map((role) => role.name)).toEqual(["Member"]);
    }
    expect(
      (await f.founder.query(api.servers.get, { serverId: f.ids.home }))
        .permissions,
    ).toContain(PERMISSIONS.ADMINISTRATOR);
  });

  it("prevents new assignments and repairs old ones without stripping other roles or owner roles", async () => {
    const f = await fixture();
    await expect(
      f.owner.mutation(api.servers.updateMemberRoles, {
        serverId: f.ids.server,
        userId: f.ids.kyro,
        roleIds: [f.ids.founderRole],
      }),
    ).rejects.toThrow(/only available/);
    expect(
      await f.t.mutation(internal.admin.removeNonOwnerFounderRoles, {}),
    ).toEqual({ removed: 2 });
    expect(
      await f.t.mutation(internal.admin.removeNonOwnerFounderRoles, {}),
    ).toEqual({ removed: 0 });
    const memberships = await f.t.run((ctx) =>
      ctx.db.query("serverMembers").collect(),
    );
    expect(
      memberships.find((member) => member.serverId === f.ids.home)?.roleIds,
    ).toEqual([f.ids.homeRole]);
    for (const userId of [f.ids.founder, f.ids.kyro]) {
      expect(
        memberships.find(
          (member) =>
            member.serverId === f.ids.server && member.userId === userId,
        )?.roleIds,
      ).toEqual([f.ids.memberRole]);
    }
  });
});
