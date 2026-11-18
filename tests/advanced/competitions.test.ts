/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import { advanceBracket, makeBracket } from "../../src/lib/tournament";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const paginationOpts = { numItems: 25, cursor: null };
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { name: "Owner", username: "owner" }),
    member: await ctx.db.insert("users", {
      name: "Member",
      username: "member",
    }),
    third: await ctx.db.insert("users", { name: "Third", username: "third" }),
    outsider: await ctx.db.insert("users", {
      name: "Other",
      username: "other",
    }),
  }));
  const owner = t.withIdentity({ subject: ids.owner }),
    member = t.withIdentity({ subject: ids.member }),
    third = t.withIdentity({ subject: ids.third }),
    outsider = t.withIdentity({ subject: ids.outsider });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Competition",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  await third.mutation(api.servers.join, { serverId });
  const create = (capacity = 8) =>
    owner.mutation(api.competitions.createTournament, {
      serverId,
      title: "Community Cup",
      game: "Chess",
      description: "Rules",
      capacity,
      startsAt: Date.now() + 120000,
      timezone: "Asia/Colombo",
    });
  return { t, ids, owner, member, third, outsider, serverId, create };
}
describe("single elimination tournaments", () => {
  it("advances every field size from 2 to 64 through byes without losing entrants", () => {
    for (let count = 2; count <= 64; count++) {
      const entrants = Array.from({ length: count }, (_, i) => `entrant-${i}`);
      let matches = makeBracket(entrants);
      expect(
        matches
          .filter((m) => m.round === 1)
          .flatMap((m) => [m.a, m.b])
          .filter(Boolean)
          .sort(),
      ).toEqual([...entrants].sort());
      let played = 0;
      while (matches.at(-1)?.state !== "complete") {
        const ready = matches.find((m) => m.state === "ready")!;
        expect(ready.a).toBeTruthy();
        expect(ready.b).toBeTruthy();
        ready.winner = ready.a;
        ready.state = "complete";
        played++;
        matches = advanceBracket(matches);
      }
      expect(played).toBe(count - 1);
      expect(entrants).toContain(matches.at(-1)!.winner);
    }
  });
  it("enforces capacity atomically, closes registration and awards stats exactly once", async () => {
    const f = await fixture(),
      tournamentId = await f.create(2);
    const registrations = await Promise.allSettled(
      [f.owner, f.member, f.third].map((client) =>
        client.mutation(api.competitions.register, {
          tournamentId,
          join: true,
        }),
      ),
    );
    expect(registrations.filter((r) => r.status === "fulfilled")).toHaveLength(
      2,
    );
    await expect(
      f.owner.mutation(api.competitions.start, {
        tournamentId,
        expectedRevision: 3,
      }),
    ).rejects.toThrow("scheduled");
    vi.advanceTimersByTime(120000);
    await expect(
      f.third.mutation(api.competitions.register, { tournamentId, join: true }),
    ).rejects.toThrow("closed");
    await f.owner.mutation(api.competitions.start, {
      tournamentId,
      expectedRevision: 3,
    });
    const row = await f.owner.query(api.competitions.tournament, {
      tournamentId,
    });
    await expect(
      f.third.mutation(api.competitions.result, {
        tournamentId,
        round: 1,
        slot: 0,
        scoreA: 1,
        scoreB: 0,
        expectedRevision: row.revision,
      }),
    ).rejects.toThrow("host");
    const result = {
      tournamentId,
      round: 1,
      slot: 0,
      scoreA: 1,
      scoreB: 0,
      expectedRevision: row.revision,
    };
    const writes = await Promise.allSettled([
      f.owner.mutation(api.competitions.result, result),
      f.owner.mutation(api.competitions.result, result),
    ]);
    expect(writes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = await f.owner.query(api.competitions.tournament, {
      tournamentId,
    });
    expect(final.status).toBe("completed");
    const board = await f.owner.query(api.competitions.leaderboard, {
      serverId: f.serverId,
      game: "Chess",
      paginationOpts,
    });
    expect(board.page).toHaveLength(2);
    expect(board.page.map((r) => r.wins)).toEqual([1, 0]);
    expect(board.page.every((r) => r.tournaments === 1)).toBe(true);
    await expect(
      f.owner.mutation(api.competitions.result, {
        ...result,
        expectedRevision: final.revision,
      }),
    ).rejects.toThrow("active");
  });
  it("excludes removed entrants at start and rejects stale results and tied scores", async () => {
    const f = await fixture(),
      tournamentId = await f.create();
    for (const client of [f.owner, f.member, f.third])
      await client.mutation(api.competitions.register, {
        tournamentId,
        join: true,
      });
    await f.t.run(async (ctx) => {
      const row = await ctx.db
        .query("serverMembers")
        .withIndex("by_server_user", (q) =>
          q.eq("serverId", f.serverId).eq("userId", f.ids.third),
        )
        .unique();
      await ctx.db.delete(row!._id);
    });
    vi.advanceTimersByTime(120000);
    await f.owner.mutation(api.competitions.start, {
      tournamentId,
      expectedRevision: 4,
    });
    const row = await f.owner.query(api.competitions.tournament, {
      tournamentId,
    });
    expect(row.entrants).toHaveLength(2);
    await expect(
      f.third.query(api.competitions.tournament, { tournamentId }),
    ).rejects.toThrow();
    await expect(
      f.owner.mutation(api.competitions.result, {
        tournamentId,
        round: 1,
        slot: 0,
        scoreA: 1,
        scoreB: 0,
        expectedRevision: 4,
      }),
    ).rejects.toThrow("changed");
    await expect(
      f.owner.mutation(api.competitions.result, {
        tournamentId,
        round: 1,
        slot: 0,
        scoreA: 1,
        scoreB: 1,
        expectedRevision: 5,
      }),
    ).rejects.toThrow("decisive");
  });
  it("blocks outsiders and frozen contributors and cancels without stats", async () => {
    const f = await fixture(),
      tournamentId = await f.create();
    await expect(
      f.outsider.query(api.competitions.tournaments, {
        serverId: f.serverId,
        paginationOpts,
      }),
    ).rejects.toThrow();
    await expect(
      f.member.mutation(api.competitions.cancel, {
        tournamentId,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("host");
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.member, { frozenAt: Date.now() }),
    );
    await expect(
      f.member.mutation(api.competitions.register, {
        tournamentId,
        join: true,
      }),
    ).rejects.toThrow();
    await f.owner.mutation(api.competitions.cancel, {
      tournamentId,
      expectedRevision: 1,
    });
    expect(
      (await f.owner.query(api.competitions.tournament, { tournamentId }))
        .status,
    ).toBe("cancelled");
    expect(
      await f.t.run((ctx) => ctx.db.query("competitionStats").collect()),
    ).toHaveLength(0);
  });
});
describe("community clans", () => {
  it("releases clan and tournament seats when a member leaves", async () => {
    const f = await fixture(),
      tournamentId = await f.create();
    const clanId = await f.owner.mutation(api.competitions.createClan, {
      serverId: f.serverId,
      name: "Team",
      tag: "TEAM",
      game: "Chess",
      description: "",
      approvalRequired: false,
    });
    await f.member.mutation(api.competitions.joinClan, { clanId, join: true });
    await f.member.mutation(api.competitions.register, {
      tournamentId,
      join: true,
    });
    await f.member.mutation(api.servers.leave, { serverId: f.serverId });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      (
        await f.owner.query(api.competitions.clans, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page[0].memberCount,
    ).toBe(1);
    expect(
      (await f.owner.query(api.competitions.tournament, { tournamentId }))
        .entrantCount,
    ).toBe(0);
  });
  it("keeps join requests private, verifies approval permissions and lets managers join", async () => {
    const f = await fixture();
    const clanId = await f.member.mutation(api.competitions.createClan, {
      serverId: f.serverId,
      name: "Team",
      tag: "TEAM",
      game: "Chess",
      description: "",
      approvalRequired: true,
    });
    await f.third.mutation(api.competitions.joinClan, { clanId, join: true });
    expect(
      (
        await f.owner.query(api.competitions.clans, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page[0],
    ).toMatchObject({ canManage: true, isLeader: false });
    await f.owner.mutation(api.competitions.joinClan, { clanId, join: true });
    expect(
      (await f.third.query(api.competitions.clanMembers, { clanId })).map(
        (m) => m.id,
      ),
    ).not.toContain(f.ids.owner);
    await expect(
      f.third.mutation(api.competitions.reviewClanMember, {
        clanId,
        userId: f.ids.owner,
        accept: true,
      }),
    ).rejects.toThrow("leader");
    await f.member.mutation(api.competitions.reviewClanMember, {
      clanId,
      userId: f.ids.third,
      accept: true,
    });
    expect(
      (
        await f.member.query(api.competitions.clans, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page[0].memberCount,
    ).toBe(2);
    await f.third.mutation(api.competitions.joinClan, { clanId, join: false });
    expect(
      (
        await f.member.query(api.competitions.clans, {
          serverId: f.serverId,
          paginationOpts,
        })
      ).page[0].memberCount,
    ).toBe(1);
    await f.owner.mutation(api.competitions.disbandClan, { clanId });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await f.t.run((ctx) => ctx.db.query("clanMemberships").collect()),
    ).toHaveLength(0);
  });
  it("requires current community membership at approval and respects blocks", async () => {
    const f = await fixture(),
      clanId = await f.owner.mutation(api.competitions.createClan, {
        serverId: f.serverId,
        name: "Team",
        tag: "TEAM",
        game: "Chess",
        description: "",
        approvalRequired: true,
      });
    await f.member.mutation(api.competitions.joinClan, { clanId, join: true });
    await f.t.run(async (ctx) => {
      const row = await ctx.db
        .query("serverMembers")
        .withIndex("by_server_user", (q) =>
          q.eq("serverId", f.serverId).eq("userId", f.ids.member),
        )
        .unique();
      await ctx.db.delete(row!._id);
    });
    await expect(
      f.owner.mutation(api.competitions.reviewClanMember, {
        clanId,
        userId: f.ids.member,
        accept: true,
      }),
    ).rejects.toThrow();
    expect(
      (await f.owner.query(api.competitions.clanMembers, { clanId })).map(
        (m) => m.id,
      ),
    ).not.toContain(f.ids.member);
    await f.owner.mutation(api.social.block, { userId: f.ids.third });
    await expect(
      f.third.mutation(api.competitions.joinClan, { clanId, join: true }),
    ).rejects.toThrow("unavailable");
  });
});
