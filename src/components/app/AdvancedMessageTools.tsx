import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageDto } from "./MessageList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Bookmark, History } from "lucide-react";
import { toast } from "sonner";
import {
  deviceTimezone,
  displayInstant,
  zonedInput,
  zonedInstant,
} from "@/lib/zonedTime";
import {
  EmptyState,
  LoadingRows,
  TimeFields,
  ConfirmDelete,
} from "./AdvancedShared";

export function ScheduleMessageButton({
  containerType,
  containerId,
  content,
  disabled,
  lifetimeSeconds,
  onScheduled,
}: {
  containerType: "channel" | "conversation";
  containerId: string;
  content: string;
  disabled?: boolean;
  lifetimeSeconds?: number;
  onScheduled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timezone, setTimezone] = useState(deviceTimezone);
  const [time, setTime] = useState(() =>
    zonedInput(Date.now() + 3600000, deviceTimezone()),
  );
  const schedule = useMutation(api.advancedMessages.schedule);
  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled || !content.trim()}
        title="Schedule text message"
        aria-label="Schedule text message"
        onClick={() => setOpen(true)}
      >
        <Clock className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send when the time is right</DialogTitle>
            <DialogDescription>
              Your text will be sent in this conversation at the selected time.
              Permissions are checked again before delivery.
            </DialogDescription>
          </DialogHeader>
          <p className="max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">
            {content}
          </p>
          <TimeFields
            value={time}
            onChange={setTime}
            timezone={timezone}
            onTimezone={setTimezone}
          />
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await schedule({
                  containerType,
                  containerId,
                  content,
                  sendAt: zonedInstant(time, timezone),
                  timezone,
                  lifetimeSeconds,
                });
                onScheduled();
                setOpen(false);
                toast.success("Message scheduled. Manage it in your library.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not schedule message.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Scheduling…" : "Schedule message"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function MessageToolsDialog({
  message,
  mode,
  isAuthor,
  onClose,
}: {
  message: MessageDto;
  mode: "save" | "remind" | "history";
  isAuthor: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "save" ? (
              <>
                <Bookmark className="size-5" />
                Save message
              </>
            ) : mode === "remind" ? (
              <>
                <Clock className="size-5" />
                Remind me
              </>
            ) : (
              <>
                <History className="size-5" />
                Edit history
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "history"
              ? "Previous text versions are visible to members who can read this message. Up to 50 previous versions are retained."
              : "Only you can see your saved messages and reminders."}
          </DialogDescription>
        </DialogHeader>
        {mode === "save" ? (
          <SaveMessage message={message} onClose={onClose} />
        ) : mode === "remind" ? (
          <RemindMessage message={message} onClose={onClose} />
        ) : (
          <EditHistory message={message} isAuthor={isAuthor} />
        )}
      </DialogContent>
    </Dialog>
  );
}
function SaveMessage({
  message,
  onClose,
}: {
  message: MessageDto;
  onClose: () => void;
}) {
  const collections = useQuery(api.advancedMessages.collections, {});
  const create = useMutation(api.advancedMessages.createCollection);
  const save = useMutation(api.advancedMessages.bookmark);
  const [collectionId, setCollectionId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">
        {message.content}
      </p>
      {collections === undefined ? (
        <LoadingRows />
      ) : (
        <Label className="block space-y-2">
          <span>Collection</span>
          <select
            aria-label="Collection"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">All saved messages</option>
            {collections.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
          </select>
        </Label>
      )}
      <div className="flex gap-2">
        <Input
          aria-label="New collection name"
          maxLength={60}
          placeholder="New collection"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              const id = await create({ name });
              setCollectionId(id);
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
      <Button
        disabled={busy || !collections}
        onClick={async () => {
          setBusy(true);
          try {
            await save({
              messageId: message.id as Id<"messages">,
              collectionId: collectionId
                ? (collectionId as Id<"savedCollections">)
                : undefined,
            });
            toast.success("Saved to your library.");
            onClose();
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not save message.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Save message
      </Button>
    </div>
  );
}
function RemindMessage({
  message,
  onClose,
}: {
  message: MessageDto;
  onClose: () => void;
}) {
  const [timezone, setTimezone] = useState(deviceTimezone);
  const [time, setTime] = useState(() =>
    zonedInput(Date.now() + 3600000, deviceTimezone()),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const remind = useMutation(api.advancedMessages.remind);
  return (
    <div className="space-y-4">
      <TimeFields
        value={time}
        onChange={setTime}
        timezone={timezone}
        onTimezone={setTimezone}
      />
      <Label className="block space-y-2">
        <span>Private reminder note</span>
        <Input
          value={note}
          maxLength={500}
          aria-label="Private reminder note"
          onChange={(e) => setNote(e.target.value)}
          placeholder="What would you like to remember?"
        />
      </Label>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await remind({
              messageId: message.id as Id<"messages">,
              remindAt: zonedInstant(time, timezone),
              timezone,
              note,
            });
            toast.success("Reminder saved.");
            onClose();
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not save reminder.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Set reminder
      </Button>
    </div>
  );
}
function EditHistory({
  message,
  isAuthor,
}: {
  message: MessageDto;
  isAuthor: boolean;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.advancedMessages.versions,
    { messageId: message.id as Id<"messages"> },
    { initialNumItems: 10 },
  );
  const restore = useMutation(api.advancedMessages.restoreVersion);
  if (status === "LoadingFirstPage") return <LoadingRows />;
  return (
    <div className="space-y-3">
      {results.length === 0 && (
        <EmptyState>No previous versions have been recorded.</EmptyState>
      )}
      {results.map((row) => (
        <div key={row._id} className="space-y-2 border-b pb-3">
          <p className="text-xs text-muted-foreground">
            Saved {displayInstant(row.savedAt)}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">
            {row.content}
          </p>
          {isAuthor && (
            <ConfirmDelete
              title="Restore this version?"
              description="The current text will become another version in the message history."
              onConfirm={async () => {
                await restore({
                  versionId: row._id,
                  expectedRevision: message.revision ?? 0,
                });
                toast.success("Message restored.");
              }}
            >
              Restore text
            </ConfirmDelete>
          )}
        </div>
      ))}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(10)}>
          Older versions
        </Button>
      )}
    </div>
  );
}
