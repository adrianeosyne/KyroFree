/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import {
  DAY_MS,
  PREMIUM_TIERS,
  premiumDays,
  premiumTier,
} from "../../src/lib/premiumProgress";
import { hasPremium } from "../../src/lib/entitlements";

const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    founder: await ctx.db.insert("users", {
      name: "Founder",
      username: "adrianeosyne",
    }),
    member: await ctx.db.insert("users", {
      name: "Member",
      username: "member",
    }),
    admin: await ctx.db.insert("users", { name: "Admin", role: "admin" }),
    staff: await ctx.db.insert("users", { name: "Staff", staff: true }),
    impostor: await ctx.db.insert("users", {
      name: "Impostor",
      username: "adrianeosyne",
      founderBadge: true,
    }),
  }));
  vi.stubEnv("KYRO_FOUNDER_USER_ID", ids.founder);
  return {
    t,
    ids,
    founder: t.withIdentity({ subject: ids.founder }),
    member: t.withIdentity({ subject: ids.member }),
  };
}

describe("Founder Premium administration", () => {
  it("allows every tier for members and the founder immediately without inventing streak time", async () => {
    const f = await setup();
    const now = Date.now();
    for (const userId of [f.ids.member, f.ids.founder]) {
      let until: number | null = null;
      let since: number | null = null;
      for (const tier of PREMIUM_TIERS) {
        await f.founder.mutation(api.premium.setBadgeTier, {
          userId,
          tier: tier.name,
        });
        const status = await f.founder.query(api.premium.memberStatus, {
          userId,
        });
        if (until === null) {
          until = status.premiumUntil;
          since = status.premiumSince;
          expect(since).toBeGreaterThanOrEqual(now);
          // Convex uses monotonic write timestamps even while fake time is frozen.
          expect(since).toBeLessThanOrEqual(now + 1000);
          expect(until).toBe(since! + 30 * DAY_MS);
        }
        expect(status.premiumUntil).toBe(until);
        expect(status.premiumSince).toBe(since);
        expect(status.premiumStreakSince).toBe(since);
        expect(premiumDays(status)).toBe(0);
        expect(premiumTier(status).name).toBe(tier.name);
        expect(status.premiumBadgeTier).toBe(tier.name);
        const profile = await f.member.query(api.users.profile, { userId });
        expect(profile?.user.premiumBadgeTier).toBe(tier.name);
        expect(profile?.user.badges).toContain("premium");
      }
    }
  });

  it("limits grants, revocation, tier assignment and member status to the configured founder", async () => {
    const f = await setup();
    for (const id of [f.ids.member, f.ids.admin, f.ids.staff, f.ids.impostor]) {
      const actor = f.t.withIdentity({ subject: id });
      await expect(
        actor.mutation(api.premium.grant, { userId: f.ids.member }),
      ).rejects.toThrow("Only adrianeosyne");
      await expect(
        actor.mutation(api.premium.grant, {
          userId: f.ids.member,
          revoke: true,
        }),
      ).rejects.toThrow("Only adrianeosyne");
      await expect(
        actor.mutation(api.premium.setBadgeTier, {
          userId: f.ids.member,
          tier: "Celestial",
        }),
      ).rejects.toThrow("Only adrianeosyne");
      await expect(
        actor.query(api.premium.memberStatus, { userId: f.ids.member }),
      ).rejects.toThrow("Only adrianeosyne");
    }
    vi.stubEnv("KYRO_FOUNDER_USER_ID", "");
    await expect(
      f.founder.mutation(api.premium.setBadgeTier, {
        userId: f.ids.member,
        tier: "Celestial",
      }),
    ).rejects.toThrow("Only adrianeosyne");
  });

  it("preserves existing expiry and history, reveals the assigned badge and can restore the earned tier", async () => {
    const f = await setup();
    const now = Date.now();
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.member, {
        premiumUntil: now + 12 * DAY_MS,
        premiumSince: now - 200 * DAY_MS,
        premiumStreakSince: now - 90 * DAY_MS,
        hidePremiumBadge: true,
      }),
    );
    await f.founder.mutation(api.premium.setBadgeTier, {
      userId: f.ids.member,
      tier: "Celestial",
    });
    let status = await f.member.query(api.premium.status);
    expect(status.premiumUntil).toBe(now + 12 * DAY_MS);
    expect(status.premiumSince).toBe(now - 200 * DAY_MS);
    expect(premiumDays(status)).toBe(90);
    expect(status.hidePremiumBadge).toBe(false);
    expect(premiumTier(status).name).toBe("Celestial");
    await f.founder.mutation(api.premium.setBadgeTier, {
      userId: f.ids.member,
      tier: "Premium",
    });
    expect(premiumTier(await f.member.query(api.premium.status)).name).toBe(
      "Premium",
    );
    await f.founder.mutation(api.premium.setBadgeTier, {
      userId: f.ids.member,
      tier: null,
    });
    status = await f.member.query(api.premium.status);
    expect(status.premiumBadgeTier).toBeNull();
    expect(premiumTier(status).name).toBe("Iron");
    const actions = await f.t.run((ctx) =>
      ctx.db.query("adminActions").collect(),
    );
    expect(
      actions.filter((action) => action.action === "premium_badge_tier_set"),
    ).toHaveLength(3);
    expect(actions.every((action) => action.actorId === f.ids.founder)).toBe(
      true,
    );
  });

  it("removes Premium, the tier override and lounge access, including from the founder's own account", async () => {
    const f = await setup();
    for (const userId of [f.ids.member, f.ids.founder]) {
      await f.founder.mutation(api.premium.grant, { userId });
      await f.founder.mutation(api.premium.setBadgeTier, {
        userId,
        tier: "Celestial",
      });
      await f.founder.mutation(api.premium.grant, { userId, revoke: true });
      const status = await f.founder.query(api.premium.memberStatus, {
        userId,
      });
      expect(hasPremium(status)).toBe(false);
      expect(status.premiumBadgeTier).toBeNull();
      expect(status.premiumStreakSince).toBeNull();
      const profile = await f.member.query(api.users.profile, { userId });
      expect(profile?.user.badges).not.toContain("premium");
    }
    await expect(
      f.member.mutation(api.premium.enterLounge, {}),
    ).rejects.toThrow("Premium lounge");
  });

  it("keeps an assigned tier through renewal, ignores stale expiry, and clears it when Premium ends", async () => {
    const f = await setup();
    await f.founder.mutation(api.premium.setBadgeTier, {
      userId: f.ids.member,
      tier: "Celestial",
    });
    const original = (await f.member.query(api.premium.status)).premiumUntil!;
    await f.founder.mutation(api.premium.grant, { userId: f.ids.member });
    vi.setSystemTime(original);
    await f.t.mutation(internal.premium.expire, {
      userId: f.ids.member,
      expectedUntil: original,
    });
    let status = await f.member.query(api.premium.status);
    expect(status.premiumBadgeTier).toBe("Celestial");
    vi.setSystemTime(status.premiumUntil!);
    await f.t.mutation(internal.premium.expire, {
      userId: f.ids.member,
      expectedUntil: status.premiumUntil!,
    });
    expect(
      (await f.member.query(api.premium.status)).premiumBadgeTier,
    ).toBeNull();
    await f.founder.mutation(api.premium.grant, { userId: f.ids.member });
    status = await f.member.query(api.premium.status);
    expect(premiumTier(status).name).toBe("Premium");
  });

  it("clears a lapsed override on a normal new grant even if expiry scheduling was missed", async () => {
    const f = await setup();
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.member, {
        premiumUntil: Date.now() - 1,
        premiumBadgeTier: "Celestial",
      }),
    );
    await f.founder.mutation(api.premium.grant, { userId: f.ids.member });
    expect(
      (await f.member.query(api.premium.status)).premiumBadgeTier,
    ).toBeNull();
    await f.founder.mutation(api.premium.grant, {
      userId: f.ids.member,
      revoke: true,
    });
    await f.founder.mutation(api.premium.setBadgeTier, {
      userId: f.ids.member,
      tier: null,
    });
    expect(hasPremium(await f.member.query(api.premium.status))).toBe(false);
  });

  it("rejects unavailable members and unknown tiers", async () => {
    const f = await setup();
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.member, { deletedAt: Date.now() }),
    );
    await expect(
      f.founder.mutation(api.premium.setBadgeTier, {
        userId: f.ids.member,
        tier: "Iron",
      }),
    ).rejects.toThrow("active member");
    await expect(
      f.founder.mutation(api.premium.setBadgeTier, {
        userId: f.ids.founder,
        tier: "Silver" as "Iron",
      }),
    ).rejects.toThrow();
  });
});
