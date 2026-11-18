/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", {
      name: "Owner",
      username: "owner",
      createdAt: 1,
    }),
    member: await ctx.db.insert("users", {
      name: "Member",
      username: "member",
      createdAt: 1,
    }),
    third: await ctx.db.insert("users", {
      name: "Third",
      username: "third",
      createdAt: 1,
    }),
    outsider: await ctx.db.insert("users", {
      name: "Outsider",
      username: "outsider",
      createdAt: 1,
    }),
  }));
  const owner = t.withIdentity({ subject: ids.owner });
  const member = t.withIdentity({ subject: ids.member });
  const third = t.withIdentity({ subject: ids.third });
  const outsider = t.withIdentity({ subject: ids.outsider });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Game community",
    isPublic: true,
  });
  await member.mutation(api.servers.join, { serverId });
  await third.mutation(api.servers.join, { serverId });
  return { t, ids, owner, member, third, outsider, serverId };
}
const paginationOpts = { numItems: 25, cursor: null };
describe("privacy-controlled social posts", () => {
  it("separates public, follower and private feeds and respects revocation", async () => {
    const f = await fixture();
    await f.owner.mutation(api.socialFeed.publish, {
      kind: "post",
      privacy: "public",
      content: "Public",
    });
    const privateId = await f.owner.mutation(api.socialFeed.publish, {
      kind: "post",
      privacy: "private",
      content: "Private",
    });
    await f.owner.mutation(api.socialFeed.publish, {
      kind: "post",
      privacy: "followers",
      content: "Followers",
    });
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "post",
          paginationOpts,
        })
      ).page.map((row) => row.content),
    ).toEqual(["Public"]);
    await f.member.mutation(api.socialFeed.follow, {
      userId: f.ids.owner,
      following: true,
    });
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "post",
          paginationOpts,
        })
      ).page
        .map((row) => row.content)
        .sort(),
    ).toEqual(["Followers", "Public"]);
    expect((await f.member.query(api.social.list)).friends).toHaveLength(0);
    await f.member.mutation(api.socialFeed.follow, {
      userId: f.ids.owner,
      following: false,
    });
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "post",
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
    await expect(
      f.member.mutation(api.socialFeed.setPrivacy, {
        id: privateId,
        privacy: "public",
      }),
    ).rejects.toThrow("not found");
    await f.owner.mutation(api.social.block, { userId: f.ids.member });
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "post",
          paginationOpts,
        })
      ).page,
    ).toHaveLength(0);
  });
  it("shows friends-only posts exclusively to accepted friendships", async () => {
    const f = await fixture();
    await f.owner.mutation(api.socialFeed.publish, {
      kind: "post",
      privacy: "friends",
      content: "Friends",
    });
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "post",
          paginationOpts,
        })
      ).page,
    ).toHaveLength(0);
    await f.t.run((ctx) =>
      ctx.db.insert("connections", {
        requesterId: f.ids.owner,
        addresseeId: f.ids.member,
        status: "accepted",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "post",
          paginationOpts,
        })
      ).page[0].content,
    ).toBe("Friends");
  });
  it("expires persisted stories and validates lifetime bounds", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.socialFeed.publish, {
      kind: "story",
      privacy: "public",
      content: "A moment",
      lifetimeSeconds: 60,
    });
    expect(
      (
        await f.member.query(api.socialFeed.feed, {
          kind: "story",
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await f.t.run((ctx) => ctx.db.get(id))).toBeNull();
    await expect(
      f.owner.mutation(api.socialFeed.publish, {
        kind: "story",
        privacy: "public",
        content: "Too long",
        lifetimeSeconds: 30 * 86400,
      }),
    ).rejects.toThrow("seven days");
  });
  it("matches explicitly selected interests and removes opted-out profiles", async () => {
    const f = await fixture();
    await f.owner.mutation(api.socialFeed.saveInterests, {
      interests: ["Minecraft", "Design"],
      discoverable: false,
    });
    await f.member.mutation(api.socialFeed.saveInterests, {
      interests: ["minecraft"],
      discoverable: true,
    });
    const matches = await f.owner.query(api.socialFeed.discover, {});
    expect(matches[0].user?.id).toBe(f.ids.member);
    expect(matches[0].sharedInterests).toEqual(["minecraft"]);
    await f.member.mutation(api.socialFeed.saveInterests, {
      interests: ["minecraft"],
      discoverable: false,
    });
    expect(await f.owner.query(api.socialFeed.discover, {})).toHaveLength(0);
    await expect(
      f.member.mutation(api.socialFeed.saveInterests, {
        interests: Array.from({ length: 13 }, (_, i) => `tag-${i}`),
        discoverable: true,
      }),
    ).rejects.toThrow("12");
  });
});
describe("gaming presence and Party Finder", () => {
  it("persists manual game status and protects invisible and blocked users", async () => {
    const f = await fixture();
    await f.owner.mutation(api.users.setPresence, { status: "online" });
    await f.owner.mutation(api.gaming.setActivity, {
      game: "Minecraft",
      details: "Building",
      visible: true,
      inviteUrl: "https://example.com/join",
    });
    expect(
      (await f.member.query(api.gaming.activity, { userId: f.ids.owner }))
        ?.game,
    ).toBe("Minecraft");
    await f.owner.mutation(api.users.setPresence, { status: "invisible" });
    expect(
      await f.member.query(api.gaming.activity, { userId: f.ids.owner }),
    ).toBeNull();
    expect(
      (await f.owner.query(api.gaming.activity, { userId: f.ids.owner }))?.game,
    ).toBe("Minecraft");
    await expect(
      f.owner.mutation(api.gaming.setActivity, {
        game: "Minecraft",
        details: "",
        visible: true,
        inviteUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow("HTTPS");
  });
  it("reserves seats transactionally and prevents cross-community registration", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.gaming.createParty, {
      serverId: f.serverId,
      game: "Minecraft",
      title: "Build night",
      description: "Survival",
      region: "Asia",
      language: "English",
      capacity: 2,
      startsAt: Date.now() + 120_000,
      timezone: "Asia/Colombo",
    });
    await expect(
      f.outsider.mutation(api.gaming.joinParty, { id, join: true }),
    ).rejects.toThrow();
    const attempts = await Promise.allSettled([
      f.member.mutation(api.gaming.joinParty, { id, join: true }),
      f.third.mutation(api.gaming.joinParty, { id, join: true }),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const party = await f.t.run((ctx) => ctx.db.get(id));
    expect(party?.memberCount).toBe(2);
    expect(await f.owner.query(api.gaming.partyMembers, { id })).toHaveLength(
      2,
    );
    await f.owner.mutation(api.gaming.cancelParty, { id });
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.status).toBe("cancelled");
  });
  it("makes joining idempotent, releases seats and closes old registrations", async () => {
    const f = await fixture();
    const id = await f.owner.mutation(api.gaming.createParty, {
      serverId: f.serverId,
      game: "Chess",
      title: "Casual games",
      description: "",
      region: "Global",
      language: "English",
      capacity: 4,
      startsAt: Date.now() + 120_000,
      timezone: "UTC",
    });
    await f.member.mutation(api.gaming.joinParty, { id, join: true });
    await f.member.mutation(api.gaming.joinParty, { id, join: true });
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.memberCount).toBe(2);
    await f.member.mutation(api.gaming.joinParty, { id, join: false });
    expect((await f.t.run((ctx) => ctx.db.get(id)))?.memberCount).toBe(1);
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      f.member.mutation(api.gaming.joinParty, { id, join: true }),
    ).rejects.toThrow("closed");
  });
});
