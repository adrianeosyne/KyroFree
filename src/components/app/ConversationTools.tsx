import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
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
import { FileText, Plus, NotebookPen, ListTodo, Folder } from "lucide-react";
import { toast } from "sonner";
import { renderMessage } from "@/lib/markdown";
import { displayInstant } from "@/lib/zonedTime";
import { TaskBoard, type CollaborationScope } from "./TaskBoard";
import { EmptyState, LoadingRows, ConfirmDelete } from "./AdvancedShared";
import { WhiteboardWorkspace } from "./WhiteboardWorkspace";

export function ConversationTools({
  scope,
  members,
  onClose,
  initialTab = "notes",
}: {
  scope: CollaborationScope;
  members: { id: string; name: string }[];
  onClose: () => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[90dvh] min-h-96 flex-col gap-4 overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Conversation workspace</DialogTitle>
          <DialogDescription>
            Keep private context, write together and organize the next steps.
          </DialogDescription>
        </DialogHeader>
        <div
          role="tablist"
          aria-label="Conversation tools"
          className="flex flex-wrap gap-2"
        >
          {[
            ["notes", "Private notes", NotebookPen],
            ["documents", "Documents", FileText],
            ["tasks", "Tasks", ListTodo],
            ["whiteboards", "Whiteboards", FileText],
            ["folders", "Folder", Folder],
          ].map(([id, label, Icon]) => {
            const Symbol = Icon as typeof FileText;
            return (
              <Button
                key={id as string}
                role="tab"
                aria-selected={tab === id}
                variant={tab === id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(id as string)}
              >
                <Symbol className="mr-1.5 size-4" />
                {label as string}
              </Button>
            );
          })}
        </div>
        <div className="min-h-0 flex-1" role="tabpanel">
          {tab === "notes" ? (
            <PrivateNote scope={scope} />
          ) : tab === "documents" ? (
            <Documents scope={scope} members={members} />
          ) : tab === "whiteboards" ? (
            <WhiteboardWorkspace scope={scope} members={members} />
          ) : tab === "tasks" ? (
            <TaskBoard scope={scope} members={members} />
          ) : (
            <FolderPicker scope={scope} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function PrivateNote({ scope }: { scope: CollaborationScope }) {
  const state = useQuery(api.advancedMessages.privateState, scope);
  const save = useMutation(api.advancedMessages.savePrivate);
  const [draft, setDraft] = useState<{
    content: string;
    revision: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return <LoadingRows />;
  const changed = !!draft && draft.revision !== (state.note?.revision ?? 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This note belongs to your account. Other participants cannot read it.
      </p>
      {changed && (
        <p role="alert" className="text-sm text-destructive">
          Your note changed on another device. Copy your edits before loading
          the latest version.
        </p>
      )}
      <Textarea
        aria-label="Private conversation note"
        className="min-h-56"
        maxLength={10000}
        value={draft?.content ?? state.note?.content ?? ""}
        onChange={(e) =>
          setDraft({
            content: e.target.value,
            revision: draft?.revision ?? state.note?.revision ?? 0,
          })
        }
        placeholder="Keep context, ideas and things to follow up on…"
      />
      <div className="flex gap-2">
        <Button
          disabled={busy || !draft || changed}
          onClick={async () => {
            setBusy(true);
            try {
              await save({
                ...scope,
                kind: "note",
                content: draft!.content,
                expectedRevision: draft!.revision,
              });
              setDraft(null);
              toast.success("Private note saved.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not save note.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Save note
        </Button>
        {draft && (
          <Button variant="outline" onClick={() => setDraft(null)}>
            Load latest
          </Button>
        )}
      </div>
    </div>
  );
}
function FolderPicker({ scope }: { scope: CollaborationScope }) {
  const state = useQuery(api.advancedMessages.privateState, scope);
  const set = useMutation(api.advancedMessages.setFolder);
  const create = useMutation(api.advancedMessages.createFolder);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!state) return <LoadingRows />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Group your channels and direct messages in personal folders. Open them
        from your library.
      </p>
      <Label className="block space-y-2">
        <span>Conversation folder</span>
        <select
          aria-label="Conversation folder"
          value={state.folderId ?? ""}
          disabled={busy}
          className="h-10 w-full rounded-md border bg-background px-3"
          onChange={async (e) => {
            setBusy(true);
            try {
              await set({
                ...scope,
                folderId: e.target.value
                  ? (e.target.value as Id<"conversationFolders">)
                  : undefined,
              });
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not change folder.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="">No folder</option>
          {state.folders.map((folder) => (
            <option key={folder._id} value={folder._id}>
              {folder.name}
            </option>
          ))}
        </select>
      </Label>
      <div className="flex gap-2">
        <Input
          aria-label="New folder name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="New folder"
        />
        <Button
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const id = await create({ name });
              await set({ ...scope, folderId: id });
              setName("");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create folder.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Create
        </Button>
      </div>
    </div>
  );
}
function Documents({
  scope,
  members,
}: {
  scope: CollaborationScope;
  members: { id: string; name: string }[];
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.collaboration.documents,
    scope,
    { initialNumItems: 20 },
  );
  const create = useMutation(api.collaboration.createDocument);
  const [selected, setSelected] = useState<Id<"sharedDocuments"> | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  if (selected)
    return (
      <DocumentEditor
        id={selected}
        members={members}
        onBack={() => setSelected(null)}
      />
    );
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          aria-label="New document title"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name a shared document"
        />
        <Button
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const id = await create({ ...scope, title, content: "" });
              setSelected(id);
              setTitle("");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create document.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Plus className="mr-1 size-4" />
          Create
        </Button>
      </div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>
          No documents yet. Start with notes, a project brief or shared Markdown
          documentation.
        </EmptyState>
      ) : (
        <div className="divide-y">
          {results.map((doc) => (
            <button
              key={doc._id}
              className="flex w-full items-center gap-3 py-4 text-left hover:text-primary"
              onClick={() => setSelected(doc._id)}
            >
              <FileText className="size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {doc.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  Version {doc.revision} · {displayInstant(doc.updatedAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(20)}>
          More documents
        </Button>
      )}
    </div>
  );
}
function DocumentEditor({
  id,
  members,
  onBack,
}: {
  id: Id<"sharedDocuments">;
  members: { id: string; name: string }[];
  onBack: () => void;
}) {
  const doc = useQuery(api.collaboration.document, { id });
  const save = useMutation(api.collaboration.saveDocument);
  const remove = useMutation(api.collaboration.removeDocument);
  const access = useMutation(api.collaboration.setDocumentAccess);
  const restore = useMutation(api.collaboration.restoreDocument);
  const [draft, setDraft] = useState<{
    title: string;
    content: string;
    revision: number;
  } | null>(null);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const versions = usePaginatedQuery(
    api.collaboration.documentHistory,
    history ? { id } : "skip",
    { initialNumItems: 10 },
  );
  if (!doc) return <LoadingRows />;
  const value = draft ?? doc;
  const conflict = !!draft && draft.revision !== doc.revision;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (
              !draft ||
              window.confirm("Discard your unsaved document changes?")
            )
              onBack();
          }}
        >
          Back to documents
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPreview(!preview)}>
          {preview ? "Markdown source" : "Preview"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHistory(!history)}>
          {history ? "Close history" : "Version history"}
        </Button>
        {doc.isOwner && (
          <ConfirmDelete
            title="Delete document?"
            description="This permanently removes the document and all its versions."
            onConfirm={async () => {
              await remove({ id });
              onBack();
            }}
          />
        )}
      </div>
      {conflict && (
        <p role="alert" className="text-sm text-destructive">
          Someone saved a newer version. Copy your changes, then load the latest
          version before saving.
        </p>
      )}
      <Input
        aria-label="Document title"
        value={value.title}
        maxLength={120}
        readOnly={!doc.canEdit || busy}
        onChange={(e) =>
          setDraft({
            title: e.target.value,
            content: value.content,
            revision: value.revision,
          })
        }
      />
      {preview ? (
        <div className="min-h-56 whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-4">
          {renderMessage(value.content)}
        </div>
      ) : (
        <Textarea
          aria-label="Document Markdown"
          className="min-h-64 font-mono text-sm"
          maxLength={50000}
          readOnly={!doc.canEdit || busy}
          value={value.content}
          onChange={(e) =>
            setDraft({
              title: value.title,
              content: e.target.value,
              revision: value.revision,
            })
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {doc.canEdit && (
          <Button
            disabled={busy || !draft || conflict}
            onClick={async () => {
              setBusy(true);
              try {
                await save({
                  id,
                  title: value.title,
                  content: value.content,
                  expectedRevision: value.revision,
                });
                setDraft(null);
                toast.success("Document saved.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not save document.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Save version
          </Button>
        )}
        {draft && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setDraft(null)}
          >
            Load latest
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Version {doc.revision} · Changes appear to readers after saving.
        </span>
      </div>
      {doc.isOwner && (
        <fieldset disabled={busy} className="space-y-2 rounded-lg border p-3">
          <legend className="px-1 text-xs">Who can edit</legend>
          <select
            aria-label="Document editing access"
            value={doc.editors === undefined ? "everyone" : "selected"}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            onChange={async (e) => {
              setBusy(true);
              try {
                await access({
                  id,
                  editors: e.target.value === "everyone" ? undefined : [],
                });
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not update access.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <option value="everyone">Everyone in this conversation</option>
            <option value="selected">Owner and selected members</option>
          </select>
          {doc.editors && (
            <div className="flex flex-wrap gap-3">
              {members
                .filter((member) => member.id !== doc.creatorId)
                .map((member) => (
                  <Label key={member.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={doc.editors?.includes(member.id as Id<"users">)}
                      onChange={async (e) => {
                        setBusy(true);
                        try {
                          const editors = e.target.checked
                            ? [...(doc.editors ?? []), member.id as Id<"users">]
                            : doc.editors?.filter(
                                (editor) => editor !== member.id,
                              );
                          await access({ id, editors });
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not update access.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                    {member.name}
                  </Label>
                ))}
            </div>
          )}
        </fieldset>
      )}
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
                <p className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                  {version.content}
                </p>
                {doc.canEdit && (
                  <ConfirmDelete
                    title="Restore document version?"
                    description="The current version is preserved in history."
                    onConfirm={async () => {
                      await restore({
                        versionId: version._id,
                        expectedRevision: doc.revision,
                      });
                      setDraft(null);
                      toast.success("Document restored.");
                    }}
                  >
                    Restore version {version.revision}
                  </ConfirmDelete>
                )}
              </div>
            ))
          )}
          {versions.status === "CanLoadMore" && (
            <Button variant="outline" onClick={() => versions.loadMore(10)}>
              Older versions
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
