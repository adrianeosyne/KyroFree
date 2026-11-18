import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  deviceTimezone,
  displayInstant,
  zonedInput,
  zonedInstant,
} from "@/lib/zonedTime";
import {
  LoadingRows,
  EmptyState,
  ConfirmDelete,
  TimeFields,
} from "./AdvancedShared";

export type CollaborationScope = {
  containerType: "channel" | "conversation";
  containerId: string;
};
export function TaskBoard({
  scope,
  members = [],
}: {
  scope?: CollaborationScope;
  members?: { id: string; name: string }[];
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.collaboration.tasks,
    scope ?? {},
    { initialNumItems: 60 },
  );
  const update = useMutation(api.collaboration.updateTask);
  const remove = useMutation(api.collaboration.removeTask);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {scope
            ? "Plan together, assign work and keep track of deadlines."
            : "Your personal tasks, with private deadline reminders."}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-4" />
          New task
        </Button>
      </div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(["todo", "doing", "done"] as const).map((column) => (
            <section
              key={column}
              className="min-w-0 rounded-xl bg-muted/40 p-3"
            >
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide">
                {column === "todo"
                  ? "To do"
                  : column === "doing"
                    ? "In progress"
                    : "Done"}{" "}
                · {results.filter((row) => row.status === column).length}
              </h3>
              {results.filter((row) => row.status === column).length === 0 && (
                <EmptyState>No tasks here yet.</EmptyState>
              )}
              <div className="space-y-3">
                {results
                  .filter((row) => row.status === column)
                  .map((task) => (
                    <article
                      key={task._id}
                      className="space-y-2 rounded-lg border bg-background p-3"
                    >
                      <p className="break-words text-sm font-semibold">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      {task.assigneeId && (
                        <p className="text-xs text-muted-foreground">
                          Assigned to{" "}
                          {members.find(
                            (member) => member.id === task.assigneeId,
                          )?.name ?? (scope ? "a member" : "you")}
                        </p>
                      )}
                      {task.dueAt && (
                        <p
                          className={`text-xs ${task.dueAt < Date.now() && task.status !== "done" ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          Due {displayInstant(task.dueAt, task.timezone)}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <select
                          aria-label={`Status of ${task.title}`}
                          disabled={busyId !== null}
                          value={task.status}
                          className="h-8 max-w-full rounded-md border bg-background px-2 text-xs"
                          onChange={async (e) => {
                            setBusyId(task._id);
                            try {
                              await update({
                                id: task._id,
                                status: e.target.value as
                                  | "todo"
                                  | "doing"
                                  | "done",
                                expectedRevision: task.revision,
                              });
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not update task.",
                              );
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          <option value="todo">To do</option>
                          <option value="doing">In progress</option>
                          <option value="done">Done</option>
                        </select>
                        <ConfirmDelete
                          title="Delete task?"
                          description="This removes the task and its deadline reminder."
                          onConfirm={() => remove({ id: task._id })}
                        />
                      </div>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(60)}>
          Load more tasks
        </Button>
      )}
      {createOpen && (
        <CreateTask
          scope={scope}
          members={members}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}
function CreateTask({
  scope,
  members,
  onClose,
}: {
  scope?: CollaborationScope;
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useMutation(api.collaboration.createTask);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [timezone, setTimezone] = useState(deviceTimezone);
  const [time, setTime] = useState(() =>
    zonedInput(Date.now() + 86400000, deviceTimezone()),
  );
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(value) => !busy && !value && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a task</DialogTitle>
          <DialogDescription>
            {scope
              ? "Everyone who can read this conversation can view this task."
              : "This task is private to your account."}
          </DialogDescription>
        </DialogHeader>
        <Label className="space-y-2">
          <span>Title</span>
          <Input
            aria-label="Task title"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Label>
        <Label className="space-y-2">
          <span>Description</span>
          <Textarea
            aria-label="Task description"
            value={description}
            maxLength={10000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Label>
        {scope && (
          <Label className="space-y-2">
            <span>Assign to</span>
            <select
              aria-label="Task assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="">Me</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Label>
        )}
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasDeadline}
            onChange={(e) => setHasDeadline(e.target.checked)}
          />
          Set a deadline reminder
        </Label>
        {hasDeadline && (
          <TimeFields
            value={time}
            onChange={setTime}
            timezone={timezone}
            onTimezone={setTimezone}
          />
        )}
        <Button
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await create({
                ...scope,
                title,
                description,
                assigneeId: assignee ? (assignee as Id<"users">) : undefined,
                dueAt: hasDeadline ? zonedInstant(time, timezone) : undefined,
                timezone: hasDeadline ? timezone : undefined,
              });
              toast.success("Task created.");
              onClose();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not create task.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating…" : "Create task"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
