import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState, LoadingRows, ConfirmDelete } from "./AdvancedShared";
import { useBotTask } from "./BotPlatformShared";
import { useUploadFile } from "@/lib/upload";
import { renderMessage } from "@/lib/markdown";
type Privacy = "public" | "followers" | "friends" | "private";
function PrivacyChoice({
  value,
  onChange,
}: {
  value: Privacy;
  onChange: (value: Privacy) => void;
}) {
  return (
    <Label className="block space-y-2">
      Visibility
      <select
        aria-label="Gallery visibility"
        className="h-10 w-full rounded-md border bg-background px-3"
        value={value}
        onChange={(e) => onChange(e.target.value as Privacy)}
      >
        <option value="private">Private</option>
        <option value="friends">Friends</option>
        <option value="followers">Followers</option>
        <option value="public">Everyone signed in</option>
      </select>
    </Label>
  );
}
type Project = FunctionReturnType<
  typeof api.socialGallery.projects
>["page"][number];
export function Portfolio({ authorId }: { authorId: string | null }) {
  const me = useQuery(api.users.me),
    userId = (authorId ?? me?.id) as Id<"users"> | undefined;
  const projects = usePaginatedQuery(
    api.socialGallery.projects,
    userId ? { userId } : "skip",
    { initialNumItems: 20 },
  );
  const remove = useMutation(api.socialGallery.removeProject);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Portfolio</h2>
      <p className="text-sm text-muted-foreground">
        Show your projects, work and skills. Each project has its own
        visibility.
      </p>
      {userId === me?.id && (
        <Button onClick={() => setEditing("new")}>Add portfolio project</Button>
      )}
      {projects.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !projects.results.length ? (
        <EmptyState>No visible projects on this page.</EmptyState>
      ) : (
        projects.results.map((project) => (
          <article
            key={project._id}
            className="space-y-3 rounded-xl border p-4"
          >
            <a
              className="font-semibold text-primary underline"
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {project.title}
            </a>
            <div className="whitespace-pre-wrap break-words text-sm">
              {renderMessage(project.description)}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.skills.join(" · ")} · {project.privacy}
            </p>
            {project.mine && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(project)}
                >
                  Edit project
                </Button>
                <ConfirmDelete
                  title="Delete portfolio project?"
                  description="This removes the project from your portfolio."
                  onConfirm={() =>
                    remove({
                      projectId: project._id,
                      expectedRevision: project.revision,
                    })
                  }
                />
              </div>
            )}
          </article>
        ))
      )}
      {projects.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => projects.loadMore(20)}>
          More projects
        </Button>
      )}
      {editing && (
        <ProjectEditor
          key={editing === "new" ? "new" : editing._id}
          project={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
function ProjectEditor({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const save = useMutation(api.socialGallery.saveProject),
    task = useBotTask();
  const [title, setTitle] = useState(project?.title ?? ""),
    [description, setDescription] = useState(project?.description ?? ""),
    [url, setUrl] = useState(project?.url ?? ""),
    [skills, setSkills] = useState(project?.skills.join(", ") ?? ""),
    [privacy, setPrivacy] = useState<Privacy>(project?.privacy ?? "private");
  return (
    <Dialog open onOpenChange={(open) => !open && !task.busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit portfolio project" : "Add portfolio project"}
          </DialogTitle>
          <DialogDescription>
            Describe the work and link to its HTTPS project page.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await save({
                projectId: project?._id,
                title,
                description,
                url,
                skills: skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                privacy,
                expectedRevision: project?.revision ?? 0,
              });
              onClose();
            }, "Portfolio saved");
          }}
        >
          <Label className="block space-y-2">
            Project title
            <Input
              aria-label="Project title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Label>
          <Label className="block space-y-2">
            Project description
            <Textarea
              aria-label="Project description"
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Label>
          <Label className="block space-y-2">
            Project URL
            <Input
              aria-label="Project URL"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Label>
          <Label className="block space-y-2">
            Skills, separated by commas
            <Input
              aria-label="Project skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </Label>
          <PrivacyChoice value={privacy} onChange={setPrivacy} />
          <Button type="submit" disabled={task.busy}>
            Save project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
type Collection = FunctionReturnType<
  typeof api.socialGallery.collections
>[number];
export function SocialCollections({ authorId }: { authorId: string | null }) {
  const [params, setParams] = useSearchParams(),
    selected = params.get("collection");
  const collections = useQuery(
    api.socialGallery.collections,
    authorId ? { userId: authorId as Id<"users"> } : {},
  );
  const respond = useMutation(api.socialGallery.respond),
    remove = useMutation(api.socialGallery.removeCollection),
    task = useBotTask();
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  if (selected)
    return (
      <CollectionDetail
        collectionId={selected as Id<"socialCollections">}
        onBack={() =>
          setParams((old) => {
            const next = new URLSearchParams(old);
            next.delete("collection");
            return next;
          })
        }
      />
    );
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Shared and sticker collections</h2>
      <p className="text-sm text-muted-foreground">
        Collect links, saved posts and your uploaded stickers. Invite viewers or
        editors to private collections.
      </p>
      {!authorId && (
        <Button onClick={() => setEditing("new")}>
          Create social collection
        </Button>
      )}
      {!collections ? (
        <LoadingRows />
      ) : !collections.length ? (
        <EmptyState>No visible collections yet.</EmptyState>
      ) : (
        collections.map((collection) => (
          <article
            key={collection._id}
            className="space-y-3 rounded-xl border p-4"
          >
            <h3 className="font-semibold">{collection.name}</h3>
            <p className="whitespace-pre-wrap break-words text-sm">
              {collection.description}
            </p>
            <p className="text-xs text-muted-foreground">
              {collection.privacy} ·{" "}
              {collection.pending ? "Invitation pending" : collection.role}
            </p>
            <div className="flex flex-wrap gap-2">
              {collection.pending ? (
                <>
                  <Button
                    size="sm"
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(
                        () =>
                          respond({
                            collectionId: collection._id,
                            accept: true,
                          }),
                        "Invitation accepted",
                      )
                    }
                  >
                    Accept collection invitation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(() =>
                        respond({
                          collectionId: collection._id,
                          accept: false,
                        }),
                      )
                    }
                  >
                    Decline invitation
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setParams((old) => {
                      const next = new URLSearchParams(old);
                      next.set("section", "collections");
                      next.set("collection", collection._id);
                      return next;
                    })
                  }
                >
                  Open collection
                </Button>
              )}
              {collection.mine && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(collection)}
                  >
                    Collection settings
                  </Button>
                  <ConfirmDelete
                    title="Delete social collection?"
                    description="This removes the collection, member invitations and its sticker files."
                    onConfirm={() =>
                      remove({
                        collectionId: collection._id,
                        expectedRevision: collection.revision,
                      })
                    }
                  />
                </>
              )}
              {!collection.mine && !collection.pending && !authorId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void task.run(() =>
                      respond({ collectionId: collection._id, accept: false }),
                    )
                  }
                >
                  Leave shared collection
                </Button>
              )}
            </div>
          </article>
        ))
      )}
      {editing && (
        <CollectionEditor
          key={editing === "new" ? "new" : editing._id}
          collection={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
function CollectionEditor({
  collection,
  onClose,
}: {
  collection: Collection | null;
  onClose: () => void;
}) {
  const save = useMutation(api.socialGallery.saveCollection),
    task = useBotTask();
  const [name, setName] = useState(collection?.name ?? ""),
    [description, setDescription] = useState(collection?.description ?? ""),
    [privacy, setPrivacy] = useState<Privacy>(collection?.privacy ?? "private");
  return (
    <Dialog open onOpenChange={(open) => !open && !task.busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {collection ? "Collection settings" : "Create social collection"}
          </DialogTitle>
          <DialogDescription>
            Accepted invitations grant access regardless of this collection's
            visibility.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await save({
                collectionId: collection?._id,
                name,
                description,
                privacy,
                expectedRevision: collection?.revision ?? 0,
              });
              onClose();
            }, "Collection saved");
          }}
        >
          <Label className="block space-y-2">
            Collection name
            <Input
              aria-label="Social collection name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Label>
          <Label className="block space-y-2">
            Description
            <Textarea
              aria-label="Social collection description"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Label>
          <PrivacyChoice value={privacy} onChange={setPrivacy} />
          <Button type="submit" disabled={task.busy}>
            Save social collection
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CollectionDetail({
  collectionId,
  onBack,
}: {
  collectionId: Id<"socialCollections">;
  onBack: () => void;
}) {
  const info = useQuery(api.socialGallery.info, { collectionId }),
    items = usePaginatedQuery(
      api.socialGallery.collection,
      { collectionId },
      { initialNumItems: 20 },
    );
  const remove = useMutation(api.socialGallery.removeItem),
    task = useBotTask(),
    [adding, setAdding] = useState(false);
  return (
    <section className="space-y-4">
      <Button size="sm" variant="outline" onClick={onBack}>
        Back to collections
      </Button>
      <h2 className="text-lg font-semibold">{info?.name ?? "Collection"}</h2>
      <p className="whitespace-pre-wrap text-sm">{info?.description}</p>
      {info?.canEdit && (
        <Button onClick={() => setAdding(true)}>Add link or sticker</Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={task.busy}
        onClick={() =>
          void task.run(
            () =>
              navigator.clipboard.writeText(
                `${location.origin}/dashboard/social?section=collections&collection=${collectionId}`,
              ),
            "Collection link copied",
          )
        }
      >
        Copy collection link
      </Button>
      {items.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !items.results.length ? (
        <EmptyState>
          No visible items on this page. Save posts from the Posts tab.
        </EmptyState>
      ) : (
        items.results.map((item) => (
          <article key={item._id} className="space-y-2 rounded-xl border p-4">
            <h3 className="font-semibold">{item.title}</h3>
            {item.downloadUrl && (
              <img
                src={item.downloadUrl}
                alt={item.title}
                className="max-h-40 max-w-full rounded-lg object-contain"
                loading="lazy"
              />
            )}
            {item.kind === "sticker" && !item.downloadUrl && (
              <p className="text-sm text-muted-foreground">
                Sticker preview is temporarily unavailable.
              </p>
            )}
            {item.url && (
              <a
                className="break-all text-sm text-primary underline"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open saved link
              </a>
            )}
            <div className="whitespace-pre-wrap break-words text-sm">
              {renderMessage(item.postContent ?? item.description)}
            </div>
            {item.downloadUrl && (
              <a
                className="text-sm text-primary underline"
                href={item.downloadUrl}
                download
              >
                Download sticker
              </a>
            )}
            {item.canRemove && (
              <ConfirmDelete
                title="Remove collection item?"
                description="This removes the item and its sticker file if present."
                onConfirm={() => remove({ itemId: item._id })}
              />
            )}
          </article>
        ))
      )}
      {items.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => items.loadMore(20)}>
          More collection items
        </Button>
      )}
      {info?.mine && <CollectionMembers collectionId={collectionId} />}
      {adding && (
        <AddCollectionItem
          collectionId={collectionId}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}
function AddCollectionItem({
  collectionId,
  onClose,
}: {
  collectionId: Id<"socialCollections">;
  onClose: () => void;
}) {
  const add = useMutation(api.socialGallery.addItem),
    discard = useMutation(api.files.discard),
    upload = useUploadFile({ requireRegistration: true }),
    task = useBotTask();
  const [kind, setKind] = useState<"link" | "sticker">("link"),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [url, setUrl] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [storageId, setStorageId] = useState<Id<"_storage"> | null>(null);
  const close = () =>
    void task.run(async () => {
      if (storageId) await discard({ storageId });
      onClose();
    });
  return (
    <Dialog open onOpenChange={(open) => !open && !task.busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add link or sticker</DialogTitle>
          <DialogDescription>
            Sticker images must be PNG, JPEG, WebP or GIF and at most 1 MiB.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              let stored = storageId;
              if (kind === "sticker" && !stored) {
                if (!file) throw new Error("Choose a sticker image.");
                if (file.size > 1024 * 1024)
                  throw new Error("Sticker images can be at most 1 MiB.");
                stored = (await upload(file)).storageId;
                setStorageId(stored);
              }
              await add({
                collectionId,
                kind,
                title,
                description,
                url: kind === "link" ? url : undefined,
                storageId: kind === "sticker" ? stored! : undefined,
              });
              setStorageId(null);
              onClose();
            }, "Collection item added");
          }}
        >
          <Label className="block space-y-2">
            Item type
            <select
              aria-label="Collection item type"
              className="h-10 w-full rounded-md border bg-background px-3"
              disabled={!!storageId}
              value={kind}
              onChange={(e) => setKind(e.target.value as "link" | "sticker")}
            >
              <option value="link">Link</option>
              <option value="sticker">Sticker image</option>
            </select>
          </Label>
          <Input
            aria-label="Collection item title"
            placeholder="Item title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            aria-label="Collection item description"
            placeholder="Description"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {kind === "link" ? (
            <Input
              aria-label="Collection item URL"
              placeholder="https://"
              required
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          ) : (
            <Label className="block space-y-2">
              Sticker image
              <Input
                aria-label="Sticker image"
                type="file"
                accept="image/png,image/apng,image/jpeg,image/webp,image/gif"
                disabled={!!storageId}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Label>
          )}
          <Button
            type="submit"
            disabled={task.busy || (kind === "sticker" && !file && !storageId)}
          >
            Add collection item
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CollectionMembers({
  collectionId,
}: {
  collectionId: Id<"socialCollections">;
}) {
  const members = useQuery(api.socialGallery.members, { collectionId }),
    invite = useMutation(api.socialGallery.invite),
    revoke = useMutation(api.socialGallery.revoke),
    task = useBotTask();
  const [term, setTerm] = useState(""),
    [selected, setSelected] = useState(""),
    [role, setRole] = useState<"viewer" | "editor">("viewer");
  const users = useQuery(
    api.users.searchUsers,
    term.trim().length > 1 ? { term, limit: 12 } : "skip",
  );
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="font-semibold">Collection members</h3>
      {members?.map((member) => (
        <div
          key={member._id}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span>
            {member.name} · {member.role} ·{" "}
            {member.accepted ? "Accepted" : "Invited"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={task.busy}
            onClick={() =>
              void task.run(() => revoke({ memberId: member._id }))
            }
          >
            Revoke collection access
          </Button>
        </div>
      ))}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await invite({
              collectionId,
              userId: selected as Id<"users">,
              role,
            });
            setSelected("");
          }, "Collection invitation sent");
        }}
      >
        <Input
          aria-label="Search collection invitees"
          placeholder="Search members"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setSelected("");
          }}
        />
        <select
          aria-label="Collection invitee"
          className="h-10 w-full rounded-md border bg-background px-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a member</option>
          {users?.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} @{user.username}
            </option>
          ))}
        </select>
        <select
          aria-label="Collection invitation role"
          className="h-10 w-full rounded-md border bg-background px-3"
          value={role}
          onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <Button type="submit" disabled={task.busy || !selected}>
          Invite collection member
        </Button>
      </form>
    </section>
  );
}
export function SaveSocialPost({ postId }: { postId: Id<"socialPosts"> }) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState("");
  const collections = useQuery(
      api.socialGallery.collections,
      open ? {} : "skip",
    ),
    add = useMutation(api.socialGallery.addItem),
    task = useBotTask();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Save to social collection
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => !task.busy && setOpen(value)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save post to a collection</DialogTitle>
            <DialogDescription>
              The original post's privacy is checked whenever someone opens it.
            </DialogDescription>
          </DialogHeader>
          <select
            aria-label="Save post collection"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose an editable collection</option>
            {collections
              ?.filter((c) => c.canEdit && !c.pending)
              .map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
          </select>
          <Button
            disabled={task.busy || !selected}
            onClick={() =>
              void task.run(async () => {
                await add({
                  collectionId: selected as Id<"socialCollections">,
                  postId,
                  kind: "post",
                  title: "Saved post",
                  description: "",
                });
                setOpen(false);
              }, "Post saved")
            }
          >
            Save post
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
