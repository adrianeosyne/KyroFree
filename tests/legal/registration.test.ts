/// <reference types="vite/client" />
import { generateKeyPairSync } from "node:crypto";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import schema from "../../src/convex/schema";
import { api } from "../../src/convex/_generated/api";
import { LEGAL_POLICY_VERSIONS } from "../../src/lib/legalPolicies";

const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const accepted = {
  termsAccepted: true,
  privacyAccepted: true,
  copyrightAccepted: true,
  termsVersion: LEGAL_POLICY_VERSIONS.terms,
  privacyVersion: LEGAL_POLICY_VERSIONS.privacy,
  copyrightVersion: LEGAL_POLICY_VERSIONS.copyright,
};
const account = {
  email: "legal-test@example.invalid",
  password: "test-only-strong-password",
  username: "legal_test",
};
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("KYRO_EMAIL_VERIFICATION_ENABLED", "false");
  vi.stubEnv("CONVEX_SITE_URL", "https://legal-test.convex.site");
  vi.stubEnv(
    "JWT_PRIVATE_KEY",
    privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("registration legal acceptance", () => {
  it.each([
    undefined,
    { ...accepted, termsAccepted: false },
    { ...accepted, privacyAccepted: false },
    { ...accepted, copyrightAccepted: false },
    { ...accepted, copyrightVersion: "old-version" },
  ])(
    "rejects incomplete or outdated acceptance before account creation: %j",
    async (legalAcceptance) => {
      const t = convexTest(schema, modules);
      await expect(
        t.action(api.users.createAccount.createAccount, {
          ...account,
          ...(legalAcceptance ? { legalAcceptance } : {}),
        } as FunctionArgs<typeof api.users.createAccount.createAccount>),
      ).rejects.toThrow();
      expect(
        await t.run((ctx) => ctx.db.query("users").collect()),
      ).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("authAccounts").collect()),
      ).toHaveLength(0);
    },
  );

  it.each([
    undefined,
    { ...accepted, copyrightAccepted: false },
    { ...accepted, termsVersion: "old-version" },
  ])(
    "the direct password signup route cannot bypass acceptance: %j",
    async (legalAcceptance) => {
      const t = convexTest(schema, modules);
      await expect(
        t.action(api.auth.signIn, {
          provider: "password",
          params: {
            flow: "signUp",
            email: account.email,
            password: account.password,
            ...(legalAcceptance ? { legalAcceptance } : {}),
          },
        }),
      ).rejects.toThrow(/LEGAL_/);
      expect(
        await t.run((ctx) => ctx.db.query("users").collect()),
      ).toHaveLength(0);
    },
  );

  it("stores server time and policy versions and includes them in a private export", async () => {
    const t = convexTest(schema, modules);
    const result = await t.action(api.users.createAccount.createAccount, {
      ...account,
      legalAcceptance: accepted,
    });
    const user = await t.run((ctx) => ctx.db.get(result.userId));
    expect(user?.legalAcceptance).toEqual({
      acceptedAt: Date.now(),
      termsVersion: accepted.termsVersion,
      privacyVersion: accepted.privacyVersion,
      copyrightVersion: accepted.copyrightVersion,
    });
    const me = t.withIdentity({ subject: result.userId });
    const exported = await me.mutation(api.users.exportData, {});
    expect(exported.profile.legalAcceptance).toEqual(user?.legalAcceptance);
    const publicProfile = await me.query(api.users.me, {});
    expect(publicProfile).not.toHaveProperty("legalAcceptance");
  });

  it("direct signup records acceptance and existing accounts can still sign in without resubmitting it", async () => {
    const t = convexTest(schema, modules);
    const signup = await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signUp",
        email: account.email,
        password: account.password,
        legalAcceptance: accepted,
      },
    });
    expect(signup.tokens?.token).toBeTruthy();
    const user = await t.run((ctx) => ctx.db.query("users").unique());
    expect(user?.legalAcceptance?.copyrightVersion).toBe(
      accepted.copyrightVersion,
    );
    // An existing account from before this rollout has no recorded acceptance.
    await t.run((ctx) =>
      ctx.db.patch(user!._id, { legalAcceptance: undefined }),
    );
    const signin = await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: account.email,
        password: account.password,
      },
    });
    expect(signin.tokens?.token).toBeTruthy();
  });
});
