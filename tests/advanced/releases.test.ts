/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const paginationOpts = { numItems: 25, cursor: null };
it("removes all teams and releases of a deleted owner's applications", async () => {
  const f = await fixture();
  await f.owner.mutation(api.appReleases.invite, {
    applicationId: f.applicationId,
    username: "member",
    role: "maintainer",
  });
  await f.member.mutation(api.appReleases.respond, {
    applicationId: f.applicationId,
    accept: true,
  });
  await f.release(f.member, "staging");
  await f.t.run((ctx) => ctx.db.patch(f.ids.owner, { deletedAt: Date.now() }));
  await f.t.mutation(internal.expansionLifecycle.cleanup, {
    kind: "user",
    id: f.ids.owner,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const table of ["appReleases", "appCollaborators"] as const)
    expect(await f.t.run((ctx) => ctx.db.query(table).collect())).toHaveLength(
      0,
    );
  expect((await f.t.run((ctx) => ctx.db.get(f.applicationId)))?.enabled).toBe(
    false,
  );
});
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
    third: await ctx.db.insert("users", { name: "Other", username: "other" }),
  }));
  const owner = t.withIdentity({ subject: ids.owner }),
    member = t.withIdentity({ subject: ids.member }),
    third = t.withIdentity({ subject: ids.third });
  const applicationId = await owner.mutation(api.botApplications.create, {
    name: "Release bot",
    username: "release_bot",
    description: "Test",
    tokenHash: "a".repeat(64),
  });
  const release = (
    client = owner,
    channel: "production" | "staging" = "production",
    version = "1.0.0",
  ) =>
    client.mutation(api.appReleases.publish, {
      applicationId,
      channel,
      version,
      changelog: "Release notes",
    });
  return { t, ids, owner, member, third, applicationId, release };
}
it("requires acceptance, restricts viewers and maintainers, and revokes immediately", async () => {
  const f = await fixture();
  await f.owner.mutation(api.appReleases.invite, {
    applicationId: f.applicationId,
    username: "member",
    role: "viewer",
  });
  await expect(
    f.member.query(api.appReleases.list, {
      applicationId: f.applicationId,
      channel: "production",
      paginationOpts,
    }),
  ).rejects.toThrow("unavailable");
  await f.member.mutation(api.appReleases.respond, {
    applicationId: f.applicationId,
    accept: true,
  });
  await expect(f.release(f.member, "staging")).rejects.toThrow("Maintainer");
  await f.owner.mutation(api.appReleases.invite, {
    applicationId: f.applicationId,
    username: "member",
    role: "maintainer",
  });
  await expect(f.release(f.member, "staging")).rejects.toThrow("unavailable");
  await f.member.mutation(api.appReleases.respond, {
    applicationId: f.applicationId,
    accept: true,
  });
  await f.release(f.member, "staging");
  await expect(f.release(f.member)).rejects.toThrow("owner");
  await f.owner.mutation(api.appReleases.removeCollaborator, {
    applicationId: f.applicationId,
    userId: f.ids.member,
  });
  await expect(
    f.member.query(api.appReleases.collaborators, {
      applicationId: f.applicationId,
    }),
  ).rejects.toThrow("unavailable");
  await expect(
    f.third.query(api.appReleases.collaborators, {
      applicationId: f.applicationId,
    }),
  ).rejects.toThrow("unavailable");
});
it("records immutable unique releases and compares activation state before rollback", async () => {
  const f = await fixture(),
    releaseId = await f.release();
  await expect(f.release()).rejects.toThrow("already exists");
  const second = await f.release(f.owner, "production", "1.1.0");
  await f.owner.mutation(api.appReleases.activate, {
    releaseId,
    expectedActive: null,
  });
  expect(
    (
      await f.owner.query(api.botApplications.get, {
        applicationId: f.applicationId,
      })
    ).version,
  ).toBe("1.0.0");
  await expect(
    f.owner.mutation(api.appReleases.activate, {
      releaseId: second,
      expectedActive: null,
    }),
  ).rejects.toThrow("changed");
  await f.owner.mutation(api.appReleases.activate, {
    releaseId: second,
    expectedActive: releaseId,
  });
  await f.owner.mutation(api.appReleases.activate, {
    releaseId,
    expectedActive: second,
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    (
      await f.owner.query(api.appReleases.list, {
        applicationId: f.applicationId,
        channel: "production",
        paginationOpts,
      })
    ).page,
  ).toHaveLength(2);
  await expect(
    f.owner.mutation(api.appReleases.publish, {
      applicationId: f.applicationId,
      version: "2.0.0",
      channel: "production",
      changelog: "Unsafe URL",
      sourceUrl: "javascript:alert(1)",
    }),
  ).rejects.toThrow("HTTPS");
});
it("creates separate staging credentials and rejects public installs and transfers", async () => {
  const f = await fixture();
  const stagingId = await f.owner.mutation(api.appReleases.createStaging, {
    applicationId: f.applicationId,
    name: "Staging bot",
    username: "staging_bot",
    tokenHash: "b".repeat(64),
  });
  const stage = await f.t.run((ctx) => ctx.db.get(stagingId));
  expect(stage).toMatchObject({
    stagingParentId: f.applicationId,
    discoverable: false,
    tokenHash: "b".repeat(64),
  });
  expect(
    await f.t.run((ctx) =>
      ctx.db
        .query("botInstallations")
        .withIndex("by_app", (q) => q.eq("applicationId", stagingId))
        .collect(),
    ),
  ).toHaveLength(1);
  const serverId = await f.owner.mutation(api.servers.create, {
    name: "Public",
    isPublic: true,
  });
  await expect(
    f.owner.mutation(api.botApplications.install, {
      applicationId: stagingId,
      serverId,
      permissions: stage!.permissions,
    }),
  ).rejects.toThrow("STAGING_ONLY");
  await expect(
    f.owner.mutation(api.developerManagement.requestTransfer, {
      applicationId: f.applicationId,
      username: "member",
      confirmation: "Release bot",
    }),
  ).rejects.toThrow("STAGING_LINKED");
  await f.owner.mutation(api.botApplications.remove, {
    applicationId: stagingId,
    confirmation: "Staging bot",
  });
  expect(
    (
      await f.owner.query(api.appReleases.collaborators, {
        applicationId: f.applicationId,
      })
    ).stagingApplicationId,
  ).toBeNull();
});
it("invalidates grants after owner transfer and removes app data on deletion", async () => {
  const f = await fixture();
  await f.owner.mutation(api.appReleases.invite, {
    applicationId: f.applicationId,
    username: "member",
    role: "maintainer",
  });
  await f.member.mutation(api.appReleases.respond, {
    applicationId: f.applicationId,
    accept: true,
  });
  await f.release();
  await f.owner.mutation(api.developerManagement.requestTransfer, {
    applicationId: f.applicationId,
    username: "other",
    confirmation: "Release bot",
  });
  await f.third.mutation(api.developerManagement.acceptTransfer, {
    applicationId: f.applicationId,
    accept: true,
  });
  await expect(f.release(f.member, "staging")).rejects.toThrow("unavailable");
  await f.third.mutation(api.botApplications.remove, {
    applicationId: f.applicationId,
    confirmation: "Release bot",
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const table of ["appReleases", "appCollaborators"] as const)
    expect(await f.t.run((ctx) => ctx.db.query(table).collect())).toHaveLength(
      0,
    );
});
