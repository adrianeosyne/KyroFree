/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import { DAY_MS } from "../../src/lib/premiumProgress";
import { normalizePremiumCode } from "../../src/lib/premiumGifts";

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
    sender: await ctx.db.insert("users", {
      name: "Gift Sender",
      username: "sender",
    }),
    recipient: await ctx.db.insert("users", {
      name: "Recipient",
      username: "recipient",
    }),
    other: await ctx.db.insert("users", { name: "Other", username: "other" }),
  }));
  vi.stubEnv("KYRO_FOUNDER_USER_ID", ids.founder);
  return {
    t,
    ids,
    founder: t.withIdentity({ subject: ids.founder }),
    sender: t.withIdentity({ subject: ids.sender }),
    recipient: t.withIdentity({ subject: ids.recipient }),
    other: t.withIdentity({ subject: ids.other }),
  };
}

describe("Premium gift links and delivery", () => {
  it("reserves an unused code for its sender, previews without spending, and credits claims in settings", async () => {
    const f = await setup();
    const { code } = await f.founder.mutation(api.premiumCodes.generate, {
      days: 90,
    });
    const shared = await f.sender.mutation(api.premiumCodes.shareGift, {
      code: code.toLowerCase(),
    });
    expect(shared).toEqual({
      ok: true,
      link: `https://kyro-chat.cyou/gift/${code}`,
      days: 90,
    });
    expect((await f.sender.query(api.premium.status)).premiumGiftCount).toBe(0);
    expect((await f.sender.query(api.premium.status)).premiumUntil).toBeNull();
    await expect(
      f.t.query(api.premiumCodes.giftPreview, { code }),
    ).rejects.toThrow("sign in");
    expect(
      await f.recipient.query(api.premiumCodes.giftPreview, { code }),
    ).toEqual({
      valid: true,
      days: 90,
      senderName: "Gift Sender",
      senderUsername: "sender",
    });
    expect(
      await f.other.mutation(api.premiumCodes.shareGift, { code }),
    ).toMatchObject({ ok: false });
    vi.setSystemTime(Date.now() + 1000);
    const redeemed = await f.recipient.mutation(api.premiumCodes.redeem, {
      code,
    });
    expect(redeemed).toMatchObject({
      ok: true,
      premiumUntil: Date.now() + 90 * DAY_MS,
    });
    expect((await f.sender.query(api.premium.status)).premiumGiftCount).toBe(1);
    const gifts = await f.recipient.query(
      api.notifications.pendingPremiumGifts,
    );
    expect(gifts).toHaveLength(1);
    expect(gifts[0]).toMatchObject({
      days: 90,
      senderName: "Gift Sender",
      senderUsername: "sender",
      premiumUntil: Date.now() + 90 * DAY_MS,
    });
    expect(await f.sender.query(api.notifications.pendingPremiumGifts)).toEqual(
      [],
    );
    await f.other.mutation(api.notifications.markRead, { ids: [gifts[0].id] });
    expect(
      await f.recipient.query(api.notifications.pendingPremiumGifts),
    ).toHaveLength(1);
    // A new signed-in client still receives the unread gift after being offline.
    const returning = f.t.withIdentity({ subject: f.ids.recipient });
    expect(
      await returning.query(api.notifications.pendingPremiumGifts),
    ).toHaveLength(1);
    await returning.mutation(api.notifications.markRead, {
      ids: [gifts[0].id],
    });
    expect(
      await returning.query(api.notifications.pendingPremiumGifts),
    ).toEqual([]);
  });

  it("allows only one concurrent claimant and one gift count/notification", async () => {
    const f = await setup();
    const { code } = await f.founder.mutation(api.premiumCodes.generate, {
      days: 180,
    });
    const shared = await f.sender.mutation(api.premiumCodes.shareGift, {
      code,
    });
    if (!shared.ok) throw new Error(shared.error);
    const results = await Promise.all([
      f.recipient.mutation(api.premiumCodes.redeem, {
        code: shared.link,
        fromGiftLink: true,
      }),
      f.other.mutation(api.premiumCodes.redeem, {
        code: shared.link,
        fromGiftLink: true,
      }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await f.sender.query(api.premium.status)).premiumGiftCount).toBe(1);
    const notifications = await f.t.run((ctx) =>
      ctx.db.query("notifications").collect(),
    );
    expect(
      notifications.filter((note) => note.type === "premium_gift"),
    ).toHaveLength(1);
    expect(
      await f.recipient.query(api.premiumCodes.giftPreview, { code }),
    ).toMatchObject({ valid: false });
    expect(
      await f.sender.mutation(api.premiumCodes.shareGift, { code }),
    ).toMatchObject({ ok: false });
  });

  it("delivers direct gifts, extends existing time, and never counts self-redemption as a gift", async () => {
    const f = await setup();
    const until = Date.now() + 12 * DAY_MS;
    await f.t.run((ctx) =>
      ctx.db.patch(f.ids.recipient, { premiumUntil: until }),
    );
    const { code } = await f.founder.mutation(api.premiumCodes.generate, {
      days: 30,
    });
    await f.sender.mutation(api.premiumCodes.redeem, {
      code,
      recipientId: f.ids.recipient,
    });
    expect((await f.recipient.query(api.premium.status)).premiumUntil).toBe(
      until + 30 * DAY_MS,
    );
    expect(
      (await f.recipient.query(api.notifications.pendingPremiumGifts))[0],
    ).toMatchObject({ days: 30, senderName: "Gift Sender" });
    const self = await f.founder.mutation(api.premiumCodes.generate, {
      days: 30,
    });
    await f.sender.mutation(api.premiumCodes.shareGift, { code: self.code });
    await f.sender.mutation(api.premiumCodes.redeem, {
      code: self.code,
      fromGiftLink: true,
    });
    expect((await f.sender.query(api.premium.status)).premiumGiftCount).toBe(1);
    expect(await f.sender.query(api.notifications.pendingPremiumGifts)).toEqual(
      [],
    );
  });

  it("attributes a manually constructed code link to its creator and blocks redirecting someone else's gift", async () => {
    const f = await setup();
    const { code } = await f.founder.mutation(api.premiumCodes.generate, {
      days: 365,
    });
    await f.recipient.mutation(api.premiumCodes.redeem, {
      code,
      fromGiftLink: true,
    });
    expect(
      (await f.recipient.query(api.notifications.pendingPremiumGifts))[0],
    ).toMatchObject({ days: 365, senderName: "Founder" });
    const next = await f.founder.mutation(api.premiumCodes.generate, {
      days: 30,
    });
    await f.sender.mutation(api.premiumCodes.shareGift, { code: next.code });
    expect(
      await f.recipient.mutation(api.premiumCodes.redeem, {
        code: next.code,
        recipientId: f.ids.other,
      }),
    ).toMatchObject({ ok: false });
    expect((await f.other.query(api.premium.status)).premiumUntil).toBeNull();
    expect(
      await f.recipient.query(api.premiumCodes.giftPreview, {
        code: next.code,
      }),
    ).toMatchObject({ valid: true });
  });

  it("rejects expired and revoked links and shares failed-attempt throttles with redemption", async () => {
    const f = await setup();
    const expired = await f.founder.mutation(api.premiumCodes.generate, {
      days: 30,
      expiresInDays: 7,
    });
    await f.sender.mutation(api.premiumCodes.shareGift, { code: expired.code });
    vi.setSystemTime(Date.now() + 7 * DAY_MS);
    expect(
      await f.recipient.query(api.premiumCodes.giftPreview, {
        code: expired.code,
      }),
    ).toMatchObject({ valid: false });
    expect(
      await f.recipient.mutation(api.premiumCodes.redeem, {
        code: expired.code,
      }),
    ).toMatchObject({ ok: false });
    const revoked = await f.founder.mutation(api.premiumCodes.generate, {
      days: 90,
    });
    const [row] = await f.founder.query(api.premiumCodes.list);
    await f.founder.mutation(api.premiumCodes.revoke, { id: row._id });
    expect(
      await f.sender.mutation(api.premiumCodes.shareGift, {
        code: revoked.code,
      }),
    ).toMatchObject({ ok: false });
    for (let i = 0; i < 4; i++)
      await f.other.mutation(api.premiumCodes.shareGift, { code: "invalid" });
    await f.other.mutation(api.premiumCodes.redeem, { code: "invalid" });
    expect(
      await f.other.mutation(api.premiumCodes.shareGift, {
        code: revoked.code,
      }),
    ).toMatchObject({
      ok: false,
      error: "Too many attempts. Try again in a minute.",
    });
    expect(
      await f.recipient.query(api.notifications.pendingPremiumGifts),
    ).toEqual([]);
  });

  it("notifies the recipient once when a paid gift request is approved", async () => {
    const f = await setup();
    await f.sender.mutation(api.premium.request, {
      reference: "gift-payment-123",
      recipientId: f.ids.recipient,
    });
    const [request] = await f.founder.query(api.premium.queue);
    await f.founder.mutation(api.premium.review, {
      requestId: request._id,
      approve: true,
    });
    expect(
      (await f.recipient.query(api.notifications.pendingPremiumGifts))[0],
    ).toMatchObject({ days: 30, senderName: "Gift Sender" });
    await expect(
      f.founder.mutation(api.premium.review, {
        requestId: request._id,
        approve: true,
      }),
    ).rejects.toThrow("already been reviewed");
    expect((await f.sender.query(api.premium.status)).premiumGiftCount).toBe(1);
  });
});

it("accepts redeem codes and official gift URLs while rejecting unrelated origins and paths", () => {
  const code = "KYRO-ABCD-EFGH-2345";
  expect(normalizePremiumCode(` ${code.toLowerCase()} `)).toBe(code);
  expect(normalizePremiumCode(`https://kyro-chat.cyou/gift/${code}`)).toBe(
    code,
  );
  expect(normalizePremiumCode(`https://www.kyro-chat.cyou/gift/${code}/`)).toBe(
    code,
  );
  for (const url of [
    `https://evil.example/gift/${code}`,
    `http://kyro-chat.cyou/gift/${code}`,
    `https://kyro-chat.cyou:444/gift/${code}`,
    `https://kyro-chat.cyou/other/${code}`,
    `https://user@kyro-chat.cyou/gift/${code}`,
  ])
    expect(normalizePremiumCode(url)).toBeNull();
});
