/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import { WORKSPACE_DEFAULTS } from "../../src/lib/workspaceTheme";
import {
  hasPremium,
  uploadLimit,
  PREMIUM_MONTH_MS,
} from "../../src/lib/entitlements";
import {
  AVATAR_DECORATIONS,
  PROFILE_DECORATIONS,
} from "../../src/lib/decorations";
import { PROFILE_THEMES } from "../../src/lib/profileThemes";
import { AVATAR_FRAMES } from "../../src/lib/frames";
import { requireOwnedUpload } from "../../src/convex/uploadSecurity";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const founder = await ctx.db.insert("users", {
      name: "Founder",
      username: "adrianeosyne",
    });
    const owner = await ctx.db.insert("users", {
      name: "Creator",
      username: "creator",
    });
    const other = await ctx.db.insert("users", {
      name: "Other",
      username: "other",
    });
    const staff = await ctx.db.insert("users", {
      name: "Staff",
      username: "staff",
      staff: true,
    });
    return { founder, owner, other, staff };
  });
  vi.stubEnv("KYRO_FOUNDER_USER_ID", ids.founder);
  return {
    t,
    ids,
    founder: t.withIdentity({ subject: ids.founder }),
    owner: t.withIdentity({ subject: ids.owner }),
    other: t.withIdentity({ subject: ids.other }),
    staff: t.withIdentity({ subject: ids.staff }),
  };
}
async function asset(
  f: Awaited<ReturnType<typeof fixture>>,
  mime = "image/png",
  size = 100,
) {
  const storageId = await f.t.run((ctx) =>
    ctx.storage.store(new Blob([new Uint8Array(size)], { type: mime })),
  );
  await f.owner.mutation(api.files.registerUpload, {
    storageId,
    name: "artwork.png",
  });
  return storageId;
}
describe("Premium, original artwork and community access", () => {
  it("keeps all reviewed and pending artwork reachable through paginated staff and community queries", async () => {
    const f = await fixture();
    const storageId = await asset(f);
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 5; i++)
        await ctx.db.insert("communityDecorations", {
          ownerId: f.ids.owner,
          storageId,
          kind: "avatar",
          name: `Dragon artwork ${i}`,
          description: "My original art",
          animated: i % 2 === 0,
          status: "approved",
          createdAt: Date.now() + i,
        });
    });
    const first = await f.staff.query(api.communityDecorations.queue, {
      status: "approved",
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const second = await f.staff.query(api.communityDecorations.queue, {
      status: "approved",
      paginationOpts: { numItems: 3, cursor: first.continueCursor },
    });
    expect(second.page).toHaveLength(3);
    expect(second.isDone).toBe(true);
    await expect(
      f.other.query(api.communityDecorations.queue, {
        paginationOpts: { numItems: 2, cursor: null },
      }),
    ).rejects.toThrow("Staff");
    const gallery = await f.other.query(api.communityDecorations.gallery, {
      kind: "avatar",
      term: "Dragon",
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(gallery.page).toHaveLength(2);
    expect(gallery.isDone).toBe(false);
  });
  it("enforces increased upload and message limits on the server, then removes them on expiry", async () => {
    const f = await fixture();
    const tooBig = await f.t.run((ctx) =>
      ctx.storage.store(
        new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "video/webm" }),
      ),
    );
    await expect(
      f.owner.mutation(api.files.registerUpload, {
        storageId: tooBig,
        name: "large.webm",
      }),
    ).rejects.toThrow("upload limit");
    const serverId = await f.founder.mutation(api.servers.create, {
      name: "Premium test",
      isPublic: true,
    });
    await f.owner.mutation(api.servers.join, { serverId });
    const channel = (
      await f.owner.query(api.channels.list, { serverId })
    ).channels.find((c) => c.kind === "text")!;
    const message = {
      containerType: "channel" as const,
      containerId: channel.id,
      content: "x".repeat(3000),
    };
    await expect(f.owner.mutation(api.messages.send, message)).rejects.toThrow(
      "2000",
    );
    await f.founder.mutation(api.premium.grant, { userId: f.ids.owner });
    const large = await asset(f, "video/webm", 11 * 1024 * 1024);
    await f.owner.mutation(api.messages.send, message);
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.owner, { premiumUntil: Date.now() - 1 }),
    );
    await expect(
      f.t.run((ctx) => requireOwnedUpload(ctx, f.ids.owner, large)),
    ).rejects.toThrow("upload limit");
    await expect(f.owner.mutation(api.messages.send, message)).rejects.toThrow(
      "2000",
    );
  });
  it("keeps 200 unique entries in each collection and safe geometry seeds", () => {
    for (const source of [
      AVATAR_DECORATIONS,
      PROFILE_DECORATIONS,
      PROFILE_THEMES,
      AVATAR_FRAMES,
    ]) {
      expect(source).toHaveLength(200);
      expect(new Set(source.map((x) => x.id)).size).toBe(200);
    }
    expect(hasPremium({ premiumUntil: Date.now() - 1 })).toBe(false);
    expect(uploadLimit({ premiumUntil: Date.now() + 1000 })).toBe(
      200 * 1024 * 1024,
    );
  });
  it("only the configured founder can grant; staff badges and renamed accounts cannot", async () => {
    const f = await fixture();
    await expect(
      f.staff.mutation(api.premium.grant, { userId: f.ids.other }),
    ).rejects.toThrow("Only adrianeosyne");
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.other, {
        username: "adrianeosyne",
        founderBadge: true,
      }),
    );
    await expect(
      f.other.mutation(api.premium.grant, { userId: f.ids.owner }),
    ).rejects.toThrow("Only adrianeosyne");
    await f.founder.mutation(api.premium.grant, { userId: f.ids.owner });
    expect((await f.owner.query(api.users.me))?.badges).toContain("premium");
    await f.founder.mutation(api.premium.grant, {
      userId: f.ids.owner,
      revoke: true,
    });
    expect((await f.owner.query(api.users.me))?.badges).not.toContain(
      "premium",
    );
  });
  it("approves a manual payment once and extends renewals without double granting", async () => {
    const f = await fixture();
    await f.owner.mutation(api.premium.request, { reference: "payment-123" });
    const [r] = await f.founder.query(api.premium.queue);
    await f.founder.mutation(api.premium.review, {
      requestId: r._id,
      approve: true,
    });
    const until = (await f.owner.query(api.premium.status)).premiumUntil!;
    expect(until).toBeGreaterThan(Date.now() + PREMIUM_MONTH_MS - 1000);
    await expect(
      f.founder.mutation(api.premium.review, {
        requestId: r._id,
        approve: true,
      }),
    ).rejects.toThrow("already been reviewed");
    await f.owner.mutation(api.premium.request, { reference: "renewal-456" });
    const [next] = await f.founder.query(api.premium.queue);
    await f.founder.mutation(api.premium.review, {
      requestId: next._id,
      approve: true,
    });
    expect((await f.owner.query(api.premium.status)).premiumUntil).toBe(
      until + PREMIUM_MONTH_MS,
    );
  });
  it("blocks spoofed badges and exclusive workspace settings after expiry", async () => {
    const f = await fixture();
    await expect(
      f.owner.mutation(api.users.updateProfile, { primaryBadge: "premium" }),
    ).rejects.toThrow("don't hold");
    await expect(
      f.owner.mutation(api.workspace.save, { theme: WORKSPACE_DEFAULTS }),
    ).rejects.toThrow("active Premium");
    await f.founder.mutation(api.premium.grant, { userId: f.ids.owner });
    await f.owner.mutation(api.workspace.save, {
      theme: { ...WORKSPACE_DEFAULTS, radius: 22 },
    });
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.owner, { premiumUntil: Date.now() - 1 }),
    );
    await expect(
      f.owner.mutation(api.workspace.save, { theme: WORKSPACE_DEFAULTS }),
    ).rejects.toThrow("active Premium");
  });
  it("accepts only owned original artwork and publishes only after staff approval", async () => {
    const f = await fixture();
    const storageId = await asset(f);
    const args = {
      storageId,
      kind: "avatar" as const,
      name: "Neon dragon",
      description: "Original artwork",
      animated: false,
      originalWork: true,
    };
    await expect(
      f.other.mutation(api.communityDecorations.submit, args),
    ).rejects.toThrow("does not belong");
    await expect(
      f.owner.mutation(api.communityDecorations.submit, {
        ...args,
        originalWork: false,
      }),
    ).rejects.toThrow("created and own");
    const id = await f.owner.mutation(api.communityDecorations.submit, args);
    expect(await f.other.query(api.communityDecorations.catalog)).toHaveLength(
      0,
    );
    await expect(
      f.owner.mutation(api.communityDecorations.equip, { id }),
    ).rejects.toThrow("Only approved");
    await expect(
      f.owner.mutation(api.communityDecorations.review, { id, approve: true }),
    ).rejects.toThrow("Staff");
    await f.staff.mutation(api.communityDecorations.review, {
      id,
      approve: true,
    });
    expect(await f.other.query(api.communityDecorations.catalog)).toHaveLength(
      1,
    );
    await f.other.mutation(api.communityDecorations.equip, { id });
    expect(
      (await f.other.query(api.users.me))?.avatarDecorationUrl,
    ).toBeTruthy();
    await f.staff.mutation(api.communityDecorations.review, {
      id,
      approve: false,
    });
    expect((await f.other.query(api.users.me))?.avatarDecorationUrl).toBeNull();
    await expect(
      f.other.mutation(api.communityDecorations.withdraw, { id }),
    ).rejects.toThrow("your own");
  });
  it("blocks self-review and unsafe decoration formats", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.ids.owner, { staff: true }));
    const storageId = await asset(f);
    const id = await f.owner.mutation(api.communityDecorations.submit, {
      storageId,
      kind: "profile",
      name: "Orbit grid",
      description: "My own art",
      animated: true,
      originalWork: true,
    });
    await expect(
      f.owner.mutation(api.communityDecorations.review, { id, approve: true }),
    ).rejects.toThrow("Another staff");
    const svg = await asset(f, "image/svg+xml");
    await expect(
      f.owner.mutation(api.communityDecorations.submit, {
        storageId: svg,
        kind: "avatar",
        name: "Unsafe image",
        description: "",
        animated: false,
        originalWork: true,
      }),
    ).rejects.toThrow("SVG");
  });
  it("checks server storage metadata, decoration quotas, and notification sound ownership", async () => {
    const f = await fixture();
    const big = await asset(f, "image/png", 3 * 1024 * 1024);
    const args = {
      storageId: big,
      kind: "avatar" as const,
      name: "Large artwork",
      description: "",
      animated: false,
      originalWork: true,
    };
    await expect(
      f.owner.mutation(api.communityDecorations.submit, args),
    ).rejects.toThrow("2 MB");
    await f.founder.mutation(api.premium.grant, { userId: f.ids.owner });
    await f.owner.mutation(api.communityDecorations.submit, args);
    const sound = await asset(f, "audio/mpeg");
    await expect(
      f.other.mutation(api.notificationSounds.set, { storageId: sound }),
    ).rejects.toThrow("does not belong");
    await f.owner.mutation(api.notificationSounds.set, { storageId: sound });
    expect(
      (await f.owner.query(api.users.me))?.notificationSoundUrl,
    ).toBeTruthy();
    expect(
      (await f.other.query(api.users.me))?.notificationSoundUrl,
    ).toBeNull();
    await f.owner.mutation(api.notificationSounds.set, { storageId: null });
  });
  it("keeps tickets private and requires server permissions for scheduling and support", async () => {
    const f = await fixture();
    const serverId = await f.founder.mutation(api.servers.create, {
      name: "Gaming squad",
      isPublic: true,
    });
    await f.owner.mutation(api.servers.join, { serverId });
    await f.other.mutation(api.servers.join, { serverId });
    await f.owner.mutation(api.communityHub.openTicket, {
      serverId,
      title: "Need help",
      details: "I cannot find our tournament channel.",
      category: "help",
    });
    expect(
      await f.other.query(api.communityHub.tickets, { serverId }),
    ).toHaveLength(0);
    const [ticket] = await f.founder.query(api.communityHub.tickets, {
      serverId,
    });
    await expect(
      f.other.mutation(api.communityHub.reply, {
        id: ticket._id,
        text: "intrusion",
      }),
    ).rejects.toThrow("private");
    await f.founder.mutation(api.communityHub.setTicketStatus, {
      id: ticket._id,
      status: "in_progress",
      claim: true,
    });
    await expect(
      f.owner.mutation(api.communityHub.setTicketStatus, {
        id: ticket._id,
        status: "closed",
      }),
    ).rejects.toThrow("permission");
    const event = {
      serverId,
      title: "Game night",
      description: "Let's play",
      startsAt: Date.now() + 60000,
      endsAt: Date.now() + 3600000,
      location: "Squad voice",
      capacity: 2,
    };
    await expect(
      f.owner.mutation(api.communityHub.createEvent, event),
    ).rejects.toThrow("permission");
    await f.founder.mutation(api.communityHub.createEvent, event);
    const [e] = await f.owner.query(api.communityHub.events, { serverId });
    await f.owner.mutation(api.communityHub.rsvp, {
      id: e._id,
      attending: true,
    });
    await f.other.mutation(api.communityHub.rsvp, {
      id: e._id,
      attending: true,
    });
    await expect(
      f.founder.mutation(api.communityHub.rsvp, { id: e._id, attending: true }),
    ).rejects.toThrow("full");
  });
});
