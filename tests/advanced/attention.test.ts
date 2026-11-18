/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect, afterEach, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import {
  defaultAttention,
  inQuietHours,
  scheduledTheme,
  allowAlert,
  setAttentionPolicy,
} from "../../src/lib/attention";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.useRealTimers();
  setAttentionPolicy(null);
});
describe("account notification profiles and schedules", () => {
  it("attributes overnight hours to their start day across timezones", () => {
    const policy = {
      ...defaultAttention,
      timezone: "Asia/Colombo",
      quietEnabled: true,
      quietDays: [3],
    };
    expect(inQuietHours(policy, Date.UTC(2026, 10, 18, 17))).toBe(true); // Wednesday 22:30
    expect(inQuietHours(policy, Date.UTC(2026, 10, 18, 23))).toBe(true); // Thursday 04:30
    expect(inQuietHours(policy, Date.UTC(2026, 10, 19, 3))).toBe(false); // Thursday 08:30
    expect(inQuietHours(policy, Date.UTC(2026, 10, 19, 17))).toBe(false);
  });
  it("applies half-open boundaries and scheduled themes over midnight", () => {
    const policy = {
      ...defaultAttention,
      quietEnabled: true,
      quietStart: 600,
      quietEnd: 660,
      themeEnabled: true,
      lightStart: 1320,
      darkStart: 480,
    };
    expect(inQuietHours(policy, Date.UTC(2026, 10, 18, 10))).toBe(true);
    expect(inQuietHours(policy, Date.UTC(2026, 10, 18, 11))).toBe(false);
    expect(scheduledTheme(policy, Date.UTC(2026, 10, 18, 23))).toBe("light");
    expect(scheduledTheme(policy, Date.UTC(2026, 10, 19, 8))).toBe("dark");
    expect(scheduledTheme(defaultAttention)).toBeNull();
  });
  it("enforces profile call/mention choices and quiet hours at event time", () => {
    setAttentionPolicy({ ...defaultAttention, activeProfile: "focus" });
    expect(allowAlert("mentions")).toBe(false);
    expect(allowAlert("calls")).toBe(true);
    setAttentionPolicy({ ...defaultAttention, quietEnabled: true });
    expect(allowAlert("calls", Date.UTC(2026, 10, 18, 23))).toBe(false);
    expect(allowAlert("calls", Date.UTC(2026, 10, 18, 12))).toBe(true);
  });
  it("isolates accounts, rejects concurrent overwrites and validates schedules", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => ({
      a: await ctx.db.insert("users", { name: "A" }),
      b: await ctx.db.insert("users", { name: "B" }),
    }));
    const a = t.withIdentity({ subject: ids.a }),
      b = t.withIdentity({ subject: ids.b });
    await a.mutation(api.attentionSettings.save, {
      ...defaultAttention,
      timezone: "Asia/Colombo",
      activeProfile: "quiet",
      expectedRevision: 0,
    });
    expect((await a.query(api.attentionSettings.get)).activeProfile).toBe(
      "quiet",
    );
    expect((await b.query(api.attentionSettings.get)).revision).toBe(0);
    const results = await Promise.allSettled(
      ["focus", "standard"].map((activeProfile) =>
        a.mutation(api.attentionSettings.save, {
          ...defaultAttention,
          activeProfile,
          expectedRevision: 1,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      a.mutation(api.attentionSettings.save, {
        ...defaultAttention,
        timezone: "fake/zone",
        expectedRevision: 2,
      }),
    ).rejects.toThrow("timezone");
    await expect(
      a.mutation(api.attentionSettings.save, {
        ...defaultAttention,
        quietEnabled: true,
        quietStart: 480,
        quietEnd: 480,
        expectedRevision: 2,
      }),
    ).rejects.toThrow("different");
    await t.run((ctx) => ctx.db.patch(ids.a, { frozenAt: Date.now() }));
    await expect(
      a.mutation(api.attentionSettings.save, {
        ...defaultAttention,
        expectedRevision: 2,
      }),
    ).rejects.toThrow();
  });
});
