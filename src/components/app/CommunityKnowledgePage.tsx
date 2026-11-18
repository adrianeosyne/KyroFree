import { useEffect, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useParams } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Lightbulb, Megaphone, Plus, ThumbsUp } from "lucide-react";
import { renderMessage } from "@/lib/markdown";
import { displayInstant } from "@/lib/zonedTime";
import { toast } from "sonner";
import { LoadingRows, EmptyState, ConfirmDelete } from "./AdvancedShared";

type Kind = "wiki" | "suggestion" | "announcement";
export function CommunityKnowledgePage() {
  const { serverId } = useParams();
  if (!serverId) return null;
  return <KnowledgeBoard key={serverId} serverId={serverId as Id<"servers">} />;
}
function KnowledgeBoard({ serverId }: { serverId: Id<"servers"> }) {
  const [kind, setKind] = useState<Kind>("wiki");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Id<"communityPages"> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const server = useQuery(api.servers.get, { serverId });
  const { results, status, loadMore } = usePaginatedQuery(
    api.communityKnowledge.list,
    { serverId, kind, term, category: category || undefined },
    { initialNumItems: 25 },
  );
  const vote = useMutation(api.communityKnowledge.vote);
  const manager =
    server?.isOwner || server?.permissions?.includes("manage_server");
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-4 sm:p-8"
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <p className="text-xs text-primary">{server?.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Community knowledge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a useful wiki, share announcements and decide what comes next.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Community boards"
          className="flex flex-wrap gap-2"
        >
          {(
            [
              ["wiki", "Wiki", BookOpen],
              ["suggestion", "Suggestions", Lightbulb],
              ["announcement", "Announcements", Megaphone],
            ] as const
          ).map(([id, label, Icon]) => (
            <Button
              key={id}
              role="tab"
              aria-selected={kind === id}
              size="sm"
              variant={kind === id ? "default" : "outline"}
              onClick={() => {
                setKind(id);
                setCategory("");
              }}
            >
              <Icon className="mr-1.5 size-4" />
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-32 flex-1"
            aria-label="Search community pages"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            placeholder="Search page titles"
          />
          <Input
            className="sm:w-40"
            aria-label="Filter page category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={60}
            placeholder="Category (exact)"
          />
          {(kind !== "announcement" || manager) && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="mr-1 size-4" />
              {kind === "suggestion"
                ? "Suggest"
                : kind === "wiki"
                  ? "New page"
                  : "Announce"}
            </Button>
          )}
        </div>
        <div role="tabpanel">
          {status === "LoadingFirstPage" ? (
            <LoadingRows />
          ) : results.length === 0 ? (
            <EmptyState>
              {term || category
                ? "No pages match these filters."
                : kind === "suggestion"
                  ? "No suggestions yet. Share an idea for the community."
                  : kind === "wiki"
                    ? "Start a wiki page to share guides, answers and useful resources."
                    : "No announcements have been published."}
            </EmptyState>
          ) : (
            <div className="divide-y">
              {results.map((page) => (
                <article key={page._id} className="flex items-start gap-3 py-5">
                  {kind === "suggestion" && (
                    <Button
                      aria-label={`Vote for ${page.title}`}
                      variant={page.voted ? "default" : "outline"}
                      size="sm"
                      disabled={busyId !== null}
                      onClick={async () => {
                        setBusyId(page._id);
                        try {
                          await vote({ id: page._id });
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not vote.",
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      <ThumbsUp className="mr-1 size-4" />
                      {page.votes}
                    </Button>
                  )}
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelected(page._id)}
                  >
                    <h2 className="break-words text-lg font-semibold hover:text-primary">
                      {page.title}
                    </h2>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {page.content}
                      {page.content.length === 240 ? "…" : ""}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {page.category || "Uncategorized"} ·{" "}
                      {displayInstant(page.updatedAt)}
                      {kind === "suggestion" && ` · ${page.status}`}
                    </p>
                  </button>
                </article>
              ))}
            </div>
          )}
          {status === "CanLoadMore" && (
            <Button variant="outline" onClick={() => loadMore(25)}>
              More pages
            </Button>
          )}
        </div>
      </div>
      {creating && (
        <CreatePage
          serverId={serverId}
          kind={kind}
          onClose={() => setCreating(false)}
        />
      )}
      {selected && (
        <PageDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </motion.main>
  );
}
function CreatePage({
  serverId,
  kind,
  onClose,
}: {
  serverId: Id<"servers">;
  kind: Kind;
  onClose: () => void;
}) {
  const create = useMutation(api.communityKnowledge.create);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(value) => !busy && !value && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {kind === "suggestion"
              ? "Share a suggestion"
              : kind === "wiki"
                ? "Create a wiki page"
                : "Publish an announcement"}
          </DialogTitle>
          <DialogDescription>
            Visible to members of this community. Markdown and links are
            supported.
          </DialogDescription>
        </DialogHeader>
        <PageFields
          value={{ title, content, category }}
          onChange={(value) => {
            setTitle(value.title);
            setContent(value.content);
            setCategory(value.category);
          }}
        />
        <Button
          disabled={busy || !title.trim() || !content.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await create({ serverId, kind, title, content, category });
              toast.success("Published to your community.");
              onClose();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not publish page.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Publish
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function PageFields({
  value,
  onChange,
}: {
  value: { title: string; content: string; category: string };
  onChange: (value: {
    title: string;
    content: string;
    category: string;
  }) => void;
}) {
  return (
    <div className="space-y-3">
      <Label className="block space-y-2">
        <span>Title</span>
        <Input
          aria-label="Page title"
          maxLength={160}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </Label>
      <Label className="block space-y-2">
        <span>Category</span>
        <Input
          aria-label="Page category"
          maxLength={60}
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value })}
          placeholder="Guides, resources, events…"
        />
      </Label>
      <Label className="block space-y-2">
        <span>Markdown content</span>
        <Textarea
          aria-label="Page Markdown"
          className="min-h-60 font-mono text-sm"
          maxLength={50000}
          value={value.content}
          onChange={(e) => onChange({ ...value, content: e.target.value })}
        />
      </Label>
    </div>
  );
}
function PageDetail({
  id,
  onClose,
}: {
  id: Id<"communityPages">;
  onClose: () => void;
}) {
  const page = useQuery(api.communityKnowledge.page, { id });
  const save = useMutation(api.communityKnowledge.save);
  const remove = useMutation(api.communityKnowledge.remove);
  const statusChange = useMutation(api.communityKnowledge.setStatus);
  const restore = useMutation(api.communityKnowledge.restore);
  const [draft, setDraft] = useState<{
    title: string;
    content: string;
    category: string;
    revision: number;
  } | null>(null);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const versions = usePaginatedQuery(
    api.communityKnowledge.history,
    history ? { id } : "skip",
    { initialNumItems: 10 },
  );
  const conflict = draft && page && draft.revision !== page.revision;
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (
          !busy &&
          !value &&
          (!draft || window.confirm("Discard your unsaved changes?"))
        )
          onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{page?.title ?? "Opening page…"}</DialogTitle>
          <DialogDescription>
            {page
              ? `${page.category || "Uncategorized"} · Version ${page.revision}`
              : "Loading community page."}
          </DialogDescription>
        </DialogHeader>
        {!page ? (
          <LoadingRows />
        ) : (
          <div className="space-y-4">
            {draft ? (
              <>
                <PageFields
                  value={draft}
                  onChange={(value) =>
                    setDraft({ ...value, revision: draft.revision })
                  }
                />
                {conflict && (
                  <p role="alert" className="text-sm text-destructive">
                    A newer version was saved. Copy your changes and load the
                    latest version.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    disabled={busy || !!conflict}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await save({
                          id,
                          title: draft.title,
                          content: draft.content,
                          category: draft.category,
                          expectedRevision: draft.revision,
                        });
                        setDraft(null);
                        toast.success("Page saved.");
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not save page.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save version
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setDraft(null)}
                  >
                    Load latest
                  </Button>
                </div>
              </>
            ) : (
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {renderMessage(page.content)}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {page.canEdit && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      title: page.title,
                      content: page.content,
                      category: page.category,
                      revision: page.revision,
                    })
                  }
                >
                  Edit page
                </Button>
              )}
              <Button variant="ghost" onClick={() => setHistory(!history)}>
                {history ? "Close history" : "Version history"}
              </Button>
              {page.canManage && page.kind === "suggestion" && (
                <select
                  aria-label="Suggestion status"
                  disabled={busy}
                  value={page.status}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  onChange={async (e) => {
                    setBusy(true);
                    try {
                      await statusChange({
                        id,
                        status: e.target.value as
                          | "open"
                          | "planned"
                          | "completed"
                          | "declined",
                      });
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not update status.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <option value="open">Open</option>
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="declined">Declined</option>
                </select>
              )}
              {page.canEdit && (
                <ConfirmDelete
                  title="Delete community page?"
                  description="The page, versions and votes will be permanently removed."
                  onConfirm={async () => {
                    await remove({ id });
                    onClose();
                  }}
                />
              )}
            </div>
            {history && (
              <div className="space-y-3 border-t pt-3">
                {versions.status === "LoadingFirstPage" ? (
                  <LoadingRows />
                ) : versions.results.length === 0 ? (
                  <EmptyState>No previous versions yet.</EmptyState>
                ) : (
                  versions.results.map((version) => (
                    <div key={version._id} className="space-y-2 border-b pb-3">
                      <p className="text-sm font-semibold">
                        Version {version.revision} · {version.title}
                      </p>
                      <p className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                        {version.content}
                      </p>
                      {page.canEdit && (
                        <ConfirmDelete
                          title="Restore page version?"
                          description="The current content will be preserved in history."
                          onConfirm={async () => {
                            await restore({
                              versionId: version._id,
                              expectedRevision: page.revision,
                            });
                            setDraft(null);
                          }}
                        >
                          Restore version
                        </ConfirmDelete>
                      )}
                    </div>
                  ))
                )}
                {versions.status === "CanLoadMore" && (
                  <Button
                    variant="outline"
                    onClick={() => versions.loadMore(10)}
                  >
                    Older versions
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
