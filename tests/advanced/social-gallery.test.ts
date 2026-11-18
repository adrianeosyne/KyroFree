/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../src/convex/schema";
import { api, internal } from "../../src/convex/_generated/api";
import { authorizeFile } from "../../src/convex/fileAccess";
const modules = import.meta.glob("../../src/convex/**/*.{ts,tsx}");
const paginationOpts = { numItems: 20, cursor: null };
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules),
    ids = await t.run(async (ctx) => ({
      owner: await ctx.db.insert("users", { name: "Owner", username: "owner" }),
      editor: await ctx.db.insert("users", {
        name: "Editor",
        username: "editor",
      }),
      other: await ctx.db.insert("users", { name: "Other", username: "other" }),
    }));
  const owner = t.withIdentity({ subject: ids.owner }),
    editor = t.withIdentity({ subject: ids.editor }),
    other = t.withIdentity({ subject: ids.other });
  const collectionId = await owner.mutation(api.socialGallery.saveCollection, {
    name: "Private gallery",
    description: "",
    privacy: "private",
    expectedRevision: 0,
  });
  return { t, ids, owner, editor, other, collectionId };
}
describe("portfolios and shared collections", () => {
  it("enforces project visibility, HTTPS links, freeze and concurrent edits", async () => {
    const f = await fixture(),
      args = {
        title: "Project",
        description: "Work",
        url: "https://example.com/work",
        skills: ["Design"],
        privacy: "followers" as const,
        expectedRevision: 0,
      };
    await f.t.run((ctx) => ctx.db.patch(f.ids.other, { username: undefined }));
    await expect(
      f.other.mutation(api.socialGallery.saveProject, args),
    ).rejects.toThrow("username");
    const projectId = await f.owner.mutation(
      api.socialGallery.saveProject,
      args,
    );
    expect(
      (
        await f.editor.query(api.socialGallery.projects, {
          userId: f.ids.owner,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(0);
    await f.editor.mutation(api.socialFeed.follow, {
      userId: f.ids.owner,
      following: true,
    });
    expect(
      (
        await f.editor.query(api.socialGallery.projects, {
          userId: f.ids.owner,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
    await expect(
      f.owner.mutation(api.socialGallery.saveProject, {
        ...args,
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("HTTPS");
    await expect(
      f.editor.mutation(api.socialGallery.saveProject, {
        ...args,
        projectId,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("unavailable");
    const results = await Promise.allSettled(
      ["First", "Second"].map((title) =>
        f.owner.mutation(api.socialGallery.saveProject, {
          ...args,
          title,
          projectId,
          expectedRevision: 1,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await f.t.run((ctx) => ctx.db.patch(f.ids.owner, { frozenAt: Date.now() }));
    await expect(
      f.owner.mutation(api.socialGallery.saveProject, args),
    ).rejects.toThrow("frozen");
  });
  it("requires invitation acceptance and stops revoked editors from reading or writing", async () => {
    const f = await fixture(),
      memberId = await f.owner.mutation(api.socialGallery.invite, {
        collectionId: f.collectionId,
        userId: f.ids.editor,
        role: "editor",
      });
    await expect(
      f.editor.query(api.socialGallery.info, { collectionId: f.collectionId }),
    ).rejects.toThrow("unavailable");
    expect(
      (await f.editor.query(api.socialGallery.collections, {}))[0].pending,
    ).toBe(true);
    await f.editor.mutation(api.socialGallery.respond, {
      collectionId: f.collectionId,
      accept: true,
    });
    const item = {
      collectionId: f.collectionId,
      kind: "link" as const,
      title: "Guide",
      description: "",
      url: "https://example.com",
    };
    await f.editor.mutation(api.socialGallery.addItem, item);
    await expect(
      f.editor.mutation(api.socialGallery.saveCollection, {
        collectionId: f.collectionId,
        name: "Hijack",
        description: "",
        privacy: "public",
        expectedRevision: 1,
      }),
    ).rejects.toThrow("owner");
    await f.owner.mutation(api.socialGallery.revoke, { memberId });
    await expect(
      f.editor.mutation(api.socialGallery.addItem, item),
    ).rejects.toThrow("editor access");
    await expect(
      f.editor.query(api.socialGallery.collection, {
        collectionId: f.collectionId,
        paginationOpts,
      }),
    ).rejects.toThrow("unavailable");
    expect(
      (
        await f.editor.query(api.dataPortability.personalPage, {
          dataset: "socialCollectionItems",
          paginationOpts,
        })
      ).page,
    ).toHaveLength(0);
  });
  it("checks source post privacy and expiry whenever a collection is read", async () => {
    const f = await fixture();
    const postId = await f.owner.mutation(api.socialFeed.publish, {
      kind: "post",
      content: "Private source",
      privacy: "private",
    });
    await f.owner.mutation(api.socialGallery.saveCollection, {
      collectionId: f.collectionId,
      name: "Public gallery",
      description: "",
      privacy: "public",
      expectedRevision: 1,
    });
    await f.owner.mutation(api.socialGallery.addItem, {
      collectionId: f.collectionId,
      kind: "post",
      title: "Saved",
      description: "",
      postId,
    });
    expect(
      (
        await f.other.query(api.socialGallery.collection, {
          collectionId: f.collectionId,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(0);
    await f.owner.mutation(api.socialFeed.setPrivacy, {
      id: postId,
      privacy: "public",
    });
    expect(
      (
        await f.other.query(api.socialGallery.collection, {
          collectionId: f.collectionId,
          paginationOpts,
        })
      ).page[0].postContent,
    ).toBe("Private source");
    await f.t.run((ctx) => ctx.db.patch(postId, { expiresAt: Date.now() - 1 }));
    expect(
      (
        await f.other.query(api.socialGallery.collection, {
          collectionId: f.collectionId,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(0);
  });
  it("claims verified sticker uploads once and rechecks download access", async () => {
    const f = await fixture(),
      storageId = await f.t.run(async (ctx) => {
        const storageId = await ctx.storage.store(
          new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
        );
        await ctx.db.insert("uploads", {
          storageId,
          ownerId: f.ids.owner,
          name: "sticker.png",
          mimeType: "image/png",
          size: 4,
          createdAt: Date.now(),
          status: "verified",
        });
        return storageId;
      });
    const args = {
      collectionId: f.collectionId,
      kind: "sticker" as const,
      storageId,
      title: "Smile",
      description: "",
    };
    const itemId = await f.owner.mutation(api.socialGallery.addItem, args);
    await expect(
      f.owner.mutation(api.socialGallery.addItem, args),
    ).rejects.toThrow("already being used");
    await expect(
      f.t.run((ctx) => authorizeFile(ctx, f.ids.other, storageId)),
    ).rejects.toThrow("unavailable");
    await f.owner.mutation(api.socialGallery.invite, {
      collectionId: f.collectionId,
      userId: f.ids.editor,
      role: "viewer",
    });
    await f.editor.mutation(api.socialGallery.respond, {
      collectionId: f.collectionId,
      accept: true,
    });
    expect(
      await f.t.run((ctx) => authorizeFile(ctx, f.ids.editor, storageId)),
    ).not.toBeNull();
    await f.editor.mutation(api.socialGallery.respond, {
      collectionId: f.collectionId,
      accept: false,
    });
    await expect(
      f.t.run((ctx) => authorizeFile(ctx, f.ids.editor, storageId)),
    ).rejects.toThrow("unavailable");
    await f.owner.mutation(api.socialGallery.removeItem, { itemId });
    expect(await f.t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
  });
  it("cleans galleries in batches including other authors' collection items", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 55; i++)
        await ctx.db.insert("socialCollectionItems", {
          collectionId: f.collectionId,
          userId: f.ids.editor,
          kind: "link",
          title: "Link",
          description: "",
          url: "https://example.com",
          createdAt: Date.now(),
        });
    });
    await f.t.mutation(internal.galleryLifecycle.cleanup, {
      kind: "user",
      id: f.ids.owner,
    });
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await f.t.run((ctx) => ctx.db.query("socialCollectionItems").collect()),
    ).toHaveLength(0);
    expect(
      await f.t.run((ctx) => ctx.db.query("socialCollections").collect()),
    ).toHaveLength(0);
  });
});
