/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import {
  PREMIUM_DURATIONS,
  DAY_MS,
  premiumTier,
  gifterTier,
} from "../../src/lib/premiumProgress";
import { sha256Hex } from "../../src/convex/sha256";
import type { FunctionReturnType } from "convex/server";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    founder: await ctx.db.insert("users", {
      name: "Founder",
      username: "adrianeosyne",
    }),
    user: await ctx.db.insert("users", { name: "User", username: "user" }),
    other: await ctx.db.insert("users", { name: "Other", username: "other" }),
    staff: await ctx.db.insert("users", {
      name: "Staff",
      username: "staff",
      staff: true,
    }),
  }));
  vi.stubEnv("KYRO_FOUNDER_USER_ID", ids.founder);
  return {
    t,
    ids,
    founder: t.withIdentity({ subject: ids.founder }),
    user: t.withIdentity({ subject: ids.user }),
    other: t.withIdentity({ subject: ids.other }),
    staff: t.withIdentity({ subject: ids.staff }),
  };
}
describe("Premium redeem codes", () => {
  it("redeems a custom whole-day duration and rejects out-of-range durations", async () => {
    const f = await setup();
    for (const days of [-1, 1.5, 36501]) {
      await expect(
        f.founder.mutation(api.premiumCodes.generate, { days }),
      ).rejects.toThrow("whole-number duration");
    }
    const { code } = await f.founder.mutation(api.premiumCodes.generate, {
      days: 45,
    });
    expect(
      await f.user.mutation(api.premiumCodes.redeem, { code }),
    ).toMatchObject({ ok: true, days: 45 });
    const status = await f.user.query(api.premium.status);
    expect(status.premiumUntil).toBe(status.premiumStreakSince! + 45 * DAY_MS);
  });
  it("lets only the configured founder generate supported durations and never stores or lists full codes", async () => {
    const f = await setup();
    for (const actor of [f.user, f.other, f.staff])
      await expect(
        actor.mutation(api.premiumCodes.generate, { days: 30 }),
      ).rejects.toThrow("Only adrianeosyne");
    await expect(
      f.founder.mutation(api.premiumCodes.generate, { days: 0 }),
    ).rejects.toThrow("whole-number duration");
    for (const duration of PREMIUM_DURATIONS) {
      const { code } = await f.founder.mutation(api.premiumCodes.generate, {
        days: duration.days,
      });
      expect(code).toMatch(/^KYRO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      await f.t.run(async (ctx) => {
        const row = await ctx.db
          .query("premiumCodes")
          .withIndex("by_hash", (q) => q.eq("hash", sha256Hex(code)))
          .unique();
        expect(row?.days).toBe(duration.days);
        expect(JSON.stringify(row)).not.toContain(code);
      });
    }
    const listed = await f.founder.query(api.premiumCodes.list);
    expect(listed).toHaveLength(4);
    expect(listed.every((row) => !("hash" in row) && !("code" in row))).toBe(
      true,
    );
    await expect(f.user.query(api.premiumCodes.list)).rejects.toThrow(
      "Only adrianeosyne",
    );
  });
  it("activates immediately without applying, extends current time and preserves first ownership and continuous streak dates", async () => {
    const f = await setup();
    const one = await f.founder.mutation(api.premiumCodes.generate, {
      days: 30,
    });
    vi.setSystemTime(Date.now() + 1000);
    const start = Date.now();
    expect(
      await f.user.mutation(api.premiumCodes.redeem, {
        code: one.code.toLowerCase(),
      }),
    ).toMatchObject({ ok: true, days: 30 });
    let status = await f.user.query(api.premium.status);
    expect(status.premiumUntil).toBe(start + 30 * DAY_MS);
    expect(status.premiumSince).toBe(start);
    expect(status.premiumStreakSince).toBe(start);
    vi.setSystemTime(start + 15 * DAY_MS);
    const three = await f.founder.mutation(api.premiumCodes.generate, {
      days: 90,
    });
    await f.user.mutation(api.premiumCodes.redeem, { code: three.code });
    status = await f.user.query(api.premium.status);
    expect(status.premiumUntil).toBe(start + 120 * DAY_MS);
    expect(status.premiumSince).toBe(start);
    expect(status.premiumStreakSince).toBe(start);
    expect(premiumTier(status).name).toBe("Premium");
    vi.setSystemTime(start + 31 * DAY_MS);
    expect(premiumTier(status).name).toBe("Ember");
    vi.setSystemTime(start + 121 * DAY_MS);
    const year = await f.founder.mutation(api.premiumCodes.generate, {
      days: 365,
    });
    await f.user.mutation(api.premiumCodes.redeem, { code: year.code });
    status = await f.user.query(api.premium.status);
    expect(status.premiumSince).toBe(start);
    expect(status.premiumStreakSince).toBe(start + 121 * DAY_MS);
    expect(status.premiumUntil).toBe(start + 486 * DAY_MS);
    expect(premiumTier(status).name).toBe("Premium");
  });
  it("consumes a code once across concurrent redemptions and counts only actual gifts", async () => {
    const f = await setup();
    const { code } = await f.founder.mutation(api.premiumCodes.generate, {
      days: 90,
    });
    vi.setSystemTime(Date.now() + 1000);
    const results = await Promise.all([
      f.user.mutation(api.premiumCodes.redeem, {
        code,
        recipientId: f.ids.other,
      }),
      f.user.mutation(api.premiumCodes.redeem, {
        code,
        recipientId: f.ids.other,
      }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await f.user.query(api.premium.status)).premiumGiftCount).toBe(1);
    expect((await f.other.query(api.premium.status)).premiumUntil).toBe(
      Date.now() + 90 * DAY_MS,
    );
    expect((await f.user.query(api.premium.status)).premiumUntil).toBeNull();
    const self = await f.founder.mutation(api.premiumCodes.generate, {
      days: 30,
    });
    await f.user.mutation(api.premiumCodes.redeem, {
      code: self.code,
      recipientId: f.ids.user,
    });
    expect((await f.user.query(api.premium.status)).premiumGiftCount).toBe(1);
  });
  it("rejects revoked codes and persists failed-attempt throttles", async () => {
    const f = await setup(),
      { code } = await f.founder.mutation(api.premiumCodes.generate, {
        days: 30,
      }),
      [row] = await f.founder.query(api.premiumCodes.list);
    await expect(
      f.staff.mutation(api.premiumCodes.revoke, { id: row._id }),
    ).rejects.toThrow("Only adrianeosyne");
    await f.founder.mutation(api.premiumCodes.revoke, { id: row._id });
    expect((await f.user.mutation(api.premiumCodes.redeem, { code })).ok).toBe(
      false,
    );
    for (let i = 0; i < 4; i++)
      expect(
        (await f.user.mutation(api.premiumCodes.redeem, { code: "bad" })).ok,
      ).toBe(false);
    expect(
      await f.user.mutation(api.premiumCodes.redeem, { code }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("Too many") });
    vi.setSystemTime(Date.now() + 60001);
    expect(
      await f.user.mutation(api.premiumCodes.redeem, { code }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("invalid") });
  });
  it("generates unique bounded batches with optional redemption deadlines and founder-only access", async () => {
    const f = await setup();
    await expect(
      f.staff.mutation(api.premiumCodes.generateBatch, { days: 30, count: 5 }),
    ).rejects.toThrow("Only adrianeosyne");
    for (const count of [0, 21, 1.5])
      await expect(
        f.founder.mutation(api.premiumCodes.generateBatch, { days: 30, count }),
      ).rejects.toThrow("1 and 20");
    await expect(
      f.founder.mutation(api.premiumCodes.generateBatch, {
        days: 30,
        count: 5,
        expiresInDays: 1,
      }),
    ).rejects.toThrow("redemption window");
    const batch = await f.founder.mutation(api.premiumCodes.generateBatch, {
      days: 90,
      count: 20,
      expiresInDays: 7,
    });
    expect(new Set(batch.codes).size).toBe(20);
    expect(batch.expiresAt).toBe(Date.now() + 7 * DAY_MS);
    const history = await f.founder.query(api.premiumCodes.history, {
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(history.page).toHaveLength(20);
    expect(history.isDone).toBe(true);
    expect(
      history.page.every(
        (row) => row.days === 90 && row.expiresAt === batch.expiresAt,
      ),
    ).toBe(true);
    for (const code of batch.codes)
      expect(JSON.stringify(history)).not.toContain(code);
    expect(history.page.some((row) => "hash" in row)).toBe(false);
  });
  it("rejects codes at their redemption deadline without shortening already redeemed membership", async () => {
    const f = await setup();
    const batch = await f.founder.mutation(api.premiumCodes.generateBatch, {
      days: 30,
      count: 2,
      expiresInDays: 7,
    });
    const deadline = batch.expiresAt!;
    vi.setSystemTime(deadline - 1);
    const before = await f.user.mutation(api.premiumCodes.redeem, {
      code: batch.codes[0],
    });
    expect(before).toMatchObject({
      ok: true,
      premiumUntil: deadline - 1 + 30 * DAY_MS,
    });
    vi.setSystemTime(deadline);
    const at = await f.other.mutation(api.premiumCodes.redeem, {
      code: batch.codes[1],
    });
    expect(at).toMatchObject({
      ok: false,
      error: expect.stringContaining("expired"),
    });
    expect((await f.other.query(api.premium.status)).premiumUntil).toBeNull();
    const available = await f.founder.query(api.premiumCodes.history, {
      status: "available",
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(available.page).toHaveLength(0);
    const expired = await f.founder.query(api.premiumCodes.history, {
      status: "expired",
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(expired.page).toHaveLength(1);
    const redeemed = await f.founder.query(api.premiumCodes.history, {
      status: "redeemed",
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(redeemed.page).toHaveLength(1);
    await expect(
      f.founder.mutation(api.premiumCodes.revoke, { id: expired.page[0]._id }),
    ).rejects.toThrow("no longer available");
    expect((await f.user.query(api.premium.status)).premiumUntil).toBe(
      deadline - 1 + 30 * DAY_MS,
    );
  });
  it("paginates all code history beyond 100 entries and applies status and ending searches on the server", async () => {
    const f = await setup();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 125; i++)
        await ctx.db.insert("premiumCodes", {
          hash: sha256Hex(`fixture-${i}`),
          suffix: i === 0 ? "ZZZZ" : "ABCD",
          days: 30,
          creatorId: f.ids.founder,
          createdAt: Date.now() + i,
          ...(i % 2 === 0 ? { revokedAt: Date.now() } : {}),
        });
    });
    await expect(
      f.user.query(api.premiumCodes.history, {
        paginationOpts: { numItems: 25, cursor: null },
      }),
    ).rejects.toThrow("Only adrianeosyne");
    const found = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 8; page++) {
      const result: FunctionReturnType<typeof api.premiumCodes.history> =
        await f.founder.query(api.premiumCodes.history, {
          paginationOpts: { numItems: 25, cursor },
        });
      result.page.forEach((row) => found.add(row._id));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(found.size).toBe(125);
    const search = await f.founder.query(api.premiumCodes.history, {
      suffix: "zz",
      status: "revoked",
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(search.page).toHaveLength(1);
    expect(search.page[0].suffix).toBe("ZZZZ");
    const available = await f.founder.query(api.premiumCodes.history, {
      status: "available",
      paginationOpts: { numItems: 1000, cursor: null },
    });
    expect(available.page.length).toBeLessThanOrEqual(50);
    expect(available.page.every((row) => row.revokedAt === undefined)).toBe(
      true,
    );
  });
  it("has all elapsed-time badge milestones and gift-count tiers", () => {
    const start = Date.UTC(2020, 0, 1);
    for (const [days, name] of [
      [0, "Premium"],
      [30, "Ember"],
      [90, "Iron"],
      [180, "Radiant"],
      [365, "Glacier"],
      [730, "Crimson"],
      [1095, "Verdant"],
      [1825, "Celestial"],
    ] as const)
      expect(
        premiumTier(
          {
            premiumUntil: start + (days + 1) * DAY_MS,
            premiumStreakSince: start,
          },
          start + days * DAY_MS,
        ).name,
      ).toBe(name);
    expect(gifterTier(1)).toBe("Gifter");
    expect(gifterTier(10)).toBe("Big Gifter");
    expect(gifterTier(25)).toBe("Super Gifter");
    expect(gifterTier(50)).toBe("Legendary Gifter");
  });
});
