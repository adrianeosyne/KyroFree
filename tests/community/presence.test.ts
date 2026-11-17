/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import { PRESENCE_TIMEOUT_MS } from "../../src/convex/lib";
import { startPresenceHeartbeat } from "../../src/lib/presenceHeartbeat";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T00:00:00Z"));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("presence leases", () => {
  it("survives a delayed background heartbeat, expires disconnected accounts, and recovers on reconnect", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { username: "adrianeosyne", name: "Adrian" }),
    );
    const client = t.withIdentity({ subject: id });
    await client.mutation(api.users.setPresence, { status: "dnd" });
    const start = Date.now();
    vi.setSystemTime(start + 180_000);
    await t.mutation(internal.presence.expire, {});
    expect((await client.query(api.users.me, {}))?.presence).toBe("dnd");
    vi.setSystemTime(start + PRESENCE_TIMEOUT_MS + 1);
    await t.mutation(internal.presence.expire, {});
    expect((await client.query(api.users.me, {}))?.presence).toBe("offline");
    await client.mutation(api.users.heartbeat, {});
    expect((await client.query(api.users.me, {}))?.presence).toBe("dnd");
  });
  it("keeps explicit offline and invisible preferences private", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { username: "member" }),
    );
    const client = t.withIdentity({ subject: id });
    for (const status of ["offline", "invisible"] as const) {
      await client.mutation(api.users.setPresence, { status });
      await client.mutation(api.users.heartbeat, {});
      expect((await client.query(api.users.me, {}))?.presence).toBe(status);
    }
  });
});

describe("presence heartbeat scheduling", () => {
  it("renews immediately, resumes without the old 45-second gate, retries errors, and cleans up", async () => {
    const windowEvents = new EventTarget();
    const documentEvents = new EventTarget();
    vi.stubGlobal(
      "window",
      Object.assign(windowEvents, { setInterval, clearInterval }),
    );
    vi.stubGlobal(
      "document",
      Object.assign(documentEvents, { visibilityState: "visible" }),
    );
    const heartbeat = vi.fn().mockResolvedValue(undefined);
    const stop = startPresenceHeartbeat(heartbeat);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(heartbeat).toHaveBeenCalledTimes(1);
    windowEvents.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(heartbeat).toHaveBeenCalledTimes(2);
    heartbeat.mockRejectedValueOnce(new Error("Network unavailable"));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(heartbeat).toHaveBeenCalledTimes(2);
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(heartbeat).toHaveBeenCalledTimes(3);
    windowEvents.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(heartbeat).toHaveBeenCalledTimes(4);
    stop();
    windowEvents.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(heartbeat).toHaveBeenCalledTimes(4);
  });
});
