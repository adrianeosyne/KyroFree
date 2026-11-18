import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayInstant } from "@/lib/zonedTime";
import { LoadingRows, EmptyState, ConfirmDelete } from "./AdvancedShared";
import { TaskBoard } from "./TaskBoard";
import { toast } from "sonner";

export function PersonalLibrary() {
  const [tab, setTab] = useState("saved");
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-4 sm:p-8"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A little less to keep in your head. Saved messages, reminders, plans
            and conversations.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Library sections"
          className="flex flex-wrap gap-2"
        >
          {[
            ["saved", "Saved messages"],
            ["scheduled", "Scheduled"],
            ["reminders", "Reminders"],
            ["folders", "Folders"],
            ["tasks", "Personal tasks"],
          ].map(([id, label]) => (
            <Button
              key={id}
              role="tab"
              aria-selected={tab === id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "saved" ? (
            <Saved />
          ) : tab === "scheduled" ? (
            <Scheduled />
          ) : tab === "reminders" ? (
            <Reminders />
          ) : tab === "folders" ? (
            <Folders />
          ) : (
            <TaskBoard />
          )}
        </div>
      </div>
    </motion.main>
  );
}
function Saved() {
  const collections = useQuery(api.advancedMessages.collections, {});
  const [collection, setCollection] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.advancedMessages.bookmarks,
    {
      collectionId: collection
        ? (collection as Id<"savedCollections">)
        : undefined,
    },
    { initialNumItems: 25 },
  );
  const remove = useMutation(api.advancedMessages.bookmark);
  const removeCollection = useMutation(api.advancedMessages.removeCollection);
  const create = useMutation(api.advancedMessages.createCollection);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter saved collection"
          className="h-10 max-w-full rounded-md border bg-background px-3"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="">All saved messages</option>
          {collections?.map((row) => (
            <option key={row._id} value={row._id}>
              {row.name}
            </option>
          ))}
        </select>
        {collection && (
          <ConfirmDelete
            title="Delete this collection?"
            description="Saved messages are moved to All saved messages."
            onConfirm={async () => {
              const id = collection as Id<"savedCollections">;
              setCollection("");
              await removeCollection({ id });
            }}
          />
        )}
        <Input
          className="sm:w-44"
          aria-label="Library collection name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection"
        />
        <Button
          variant="outline"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const id = await create({ name });
              setCollection(id);
              setName("");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create collection.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Create
        </Button>
      </div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>Save a message from its menu to keep it here.</EmptyState>
      ) : (
        <div className="divide-y">
          {results.map((row) => (
            <article key={row.id} className="space-y-3 py-4">
              <p className="whitespace-pre-wrap break-words text-sm">
                {row.content ??
                  "This message is unavailable or you no longer have access."}
              </p>
              <div className="flex gap-2">
                {row.link && (
                  <Button asChild variant="outline" size="sm">
                    <Link to={row.link}>Open conversation</Link>
                  </Button>
                )}
                <ConfirmDelete
                  title="Remove saved message?"
                  description="The original message stays in its conversation."
                  onConfirm={() =>
                    remove({ messageId: row.messageId, remove: true })
                  }
                >
                  Unsave
                </ConfirmDelete>
              </div>
            </article>
          ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(25)}>
          More saved messages
        </Button>
      )}
    </div>
  );
}
function Scheduled() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.advancedMessages.schedules,
    {},
    { initialNumItems: 25 },
  );
  const cancel = useMutation(api.advancedMessages.cancelSchedule);
  return (
    <div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>
          Use the clock beside the composer to schedule a text message.
        </EmptyState>
      ) : (
        <div className="divide-y">
          {results.map((row) => (
            <article key={row._id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {displayInstant(row.sendAt, row.timezone)} · {row.timezone}
                </p>
                <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                  {row.status}
                </span>
              </div>
              {row.content && (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {row.content}
                </p>
              )}
              {row.error && (
                <p role="alert" className="text-xs text-destructive">
                  {row.error}
                </p>
              )}
              {row.status === "pending" && (
                <ConfirmDelete
                  title="Cancel scheduled message?"
                  description="This text will not be delivered."
                  onConfirm={() => cancel({ id: row._id })}
                >
                  Cancel schedule
                </ConfirmDelete>
              )}
            </article>
          ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(25)}>
          More schedules
        </Button>
      )}
    </div>
  );
}
function Reminders() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.advancedMessages.reminders,
    {},
    { initialNumItems: 25 },
  );
  const cancel = useMutation(api.advancedMessages.cancelReminder);
  return (
    <div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>
          Choose Remind me from a message menu. Reminders appear in your Kyro
          inbox.
        </EmptyState>
      ) : (
        <div className="divide-y">
          {results.map((row) => (
            <article key={row._id} className="space-y-2 py-4">
              <p className="text-sm font-semibold">
                {displayInstant(row.remindAt, row.timezone)} · {row.status}
              </p>
              {row.note && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {row.note}
                </p>
              )}
              {row.status === "pending" && (
                <ConfirmDelete
                  title="Cancel reminder?"
                  description="You will not receive this reminder."
                  onConfirm={() => cancel({ id: row._id })}
                >
                  Cancel reminder
                </ConfirmDelete>
              )}
            </article>
          ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(25)}>
          More reminders
        </Button>
      )}
    </div>
  );
}
function Folders() {
  const folders = useQuery(api.advancedMessages.folders, {});
  const create = useMutation(api.advancedMessages.createFolder);
  const remove = useMutation(api.advancedMessages.removeFolder);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          maxLength={60}
          aria-label="Library folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New conversation folder"
        />
        <Button
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await create({ name });
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
      {folders === undefined ? (
        <LoadingRows />
      ) : folders.length === 0 ? (
        <EmptyState>
          Add folders here, then organize each chat from Conversation workspace
          → Folder.
        </EmptyState>
      ) : (
        folders.map((folder) => (
          <section key={folder._id} className="border-b py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{folder.name}</h2>
              <ConfirmDelete
                title="Delete folder?"
                description="Its conversations stay available in your messages and communities."
                onConfirm={() => remove({ id: folder._id })}
              />
            </div>
            {folder.items.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">
                No conversations in this folder yet.
              </p>
            ) : (
              folder.items.map((item) => (
                <Link
                  key={item._id}
                  to={item.link}
                  className="block rounded-lg px-2 py-3 text-sm hover:bg-muted"
                >
                  {item.name}
                </Link>
              ))
            )}
          </section>
        ))
      )}
    </div>
  );
}
