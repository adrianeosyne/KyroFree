/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as auth from "@convex-dev/auth/server";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
vi.mock("@convex-dev/auth/server", async (original) => ({
  ...(await original<typeof auth>()),
  retrieveAccount: vi.fn(),
}));
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 18, 10));
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      name: "Owner",
      username: "owner",
      email: "owner@example.com",
      createdAt: 1,
    });
    const other = await ctx.db.insert("users", {
      name: "Other",
      username: "other",
      createdAt: 1,
    });
    await ctx.db.insert("authAccounts", {
      userId: owner,
      provider: "password",
      providerAccountId: "owner@example.com",
    });
    return { owner, other };
  });
  const owner = t.withIdentity({ subject: ids.owner });
  const other = t.withIdentity({ subject: ids.other });
  const serverId = await owner.mutation(api.servers.create, {
    name: "Privacy",
    isPublic: true,
  });
  const channel = (
    await owner.query(api.channels.list, { serverId })
  ).channels.find((row) => row.kind === "text")!;
  return {
    t,
    ids,
    owner,
    other,
    scope: { containerType: "channel" as const, containerId: channel.id },
  };
}
describe("account freeze and retention", () => {
  it("requires password proof and binds freeze to the signed-in identity", async () => {
    const f = await fixture();
    vi.mocked(auth.retrieveAccount).mockRejectedValue(
      new Error("Invalid credentials"),
    );
    await expect(
      f.owner.action(api.privacyControls.setFreeze, {
        frozen: true,
        password: "wrong",
      }),
    ).rejects.toThrow("incorrect");
    expect((await f.owner.query(api.privacyControls.status, {})).frozen).toBe(
      false,
    );
    vi.mocked(auth.retrieveAccount).mockResolvedValue({
      user: { _id: f.ids.owner },
      account: {},
    } as NonNullable<Awaited<ReturnType<typeof auth.retrieveAccount>>>);
    await f.owner.action(api.privacyControls.setFreeze, {
      frozen: true,
      password: "correct",
    });
    expect((await f.owner.query(api.privacyControls.status, {})).frozen).toBe(
      true,
    );
    await expect(
      f.owner.mutation(api.messages.send, { ...f.scope, content: "Blocked" }),
    ).rejects.toThrow("frozen");
    await f.owner.action(api.privacyControls.setFreeze, {
      frozen: false,
      password: "correct",
    });
    await f.owner.mutation(api.messages.send, {
      ...f.scope,
      content: "Allowed",
    });
    expect(
      (
        await f.owner.query(api.privacyControls.activity, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(2);
    expect(
      (
        await f.other.query(api.privacyControls.activity, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(0);
  });
  it("does not let another account's valid password unfreeze the current account", async () => {
    const f = await fixture();
    vi.mocked(auth.retrieveAccount).mockResolvedValue({
      user: { _id: f.ids.other },
      account: {},
    } as NonNullable<Awaited<ReturnType<typeof auth.retrieveAccount>>>);
    await expect(
      f.owner.action(api.privacyControls.setFreeze, {
        frozen: true,
        password: "other password",
      }),
    ).rejects.toThrow("incorrect");
  });
  it("applies per-account retention and preserves pending schedules and other users", async () => {
    const f = await fixture();
    const old = Date.now() - 10 * 86400000;
    await f.owner.mutation(api.privacyControls.saveRetention, {
      notificationDays: 7,
      draftDays: 7,
      scheduleHistoryDays: 7,
    });
    await f.t.run(async (ctx) => {
      await ctx.db.insert("notifications", {
        userId: f.ids.owner,
        title: "Old owner note",
        type: "system",
        createdAt: old,
        read: false,
      });
      await ctx.db.insert("notifications", {
        userId: f.ids.other,
        title: "Other note",
        type: "system",
        createdAt: old,
        read: false,
      });
      await ctx.db.insert("messageDrafts", {
        userId: f.ids.owner,
        ...f.scope,
        content: "Old",
        revision: 1,
        updatedAt: old,
      });
      await ctx.db.insert("scheduledMessages", {
        userId: f.ids.owner,
        ...f.scope,
        content: "Keep pending",
        sendAt: Date.now() + 120000,
        timezone: "UTC",
        status: "pending",
        createdAt: old,
      });
    });
    expect(
      await f.t.mutation(internal.privacyControls.applyRetention, {}),
    ).toEqual({ deleted: 2 });
    const notes = await f.t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].userId).toBe(f.ids.other);
    expect(
      (await f.t.run((ctx) => ctx.db.query("scheduledMessages").collect()))[0]
        .content,
    ).toBe("Keep pending");
    await expect(
      f.owner.mutation(api.privacyControls.saveRetention, {
        notificationDays: 1 as 7,
        draftDays: 7,
        scheduleHistoryDays: 7,
      }),
    ).rejects.toThrow();
  });
});
