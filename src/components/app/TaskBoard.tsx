import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useBotTask } from "./BotPlatformShared";
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
type TimelineTask = FunctionReturnType<
  typeof api.collaboration.tasks
>["page"][number];
function TaskTimeline({
  tasks,
  onSchedule,
}: {
  tasks: TimelineTask[];
  onSchedule: (task: TimelineTask) => void;
}) {
  const dated = tasks
    .filter((t) => t.startsAt !== undefined || t.dueAt !== undefined)
    .sort((a, b) => (a.startsAt ?? a.dueAt!) - (b.startsAt ?? b.dueAt!));
  if (!dated.length)
    return (
      <EmptyState>
        Set planned starts or deadlines to see your task timeline.
      </EmptyState>
    );
  const minimum = Math.min(...dated.map((t) => t.startsAt ?? t.dueAt!)),
    maximum = Math.max(
      minimum + 86400000,
      ...dated.map((t) => t.dueAt ?? t.startsAt!),
    ),
    span = maximum - minimum;
  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Timeline of loaded tasks · {new Date(minimum).toLocaleDateString()} –{" "}
        {new Date(maximum).toLocaleDateString()}. Tasks with only a start or
        deadline appear as milestones.
      </p>
      {dated.map((task) => {
        const start = task.startsAt ?? task.dueAt!,
          end = task.dueAt ?? start;
        return (
          <article key={task._id} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="text-sm font-semibold">{task.title}</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSchedule(task)}
              >
                Edit task dates
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {task.startsAt !== undefined &&
                `Start ${displayInstant(task.startsAt, task.timezone)}`}
              {task.startsAt !== undefined && task.dueAt !== undefined && " · "}
              {task.dueAt !== undefined &&
                `Due ${displayInstant(task.dueAt, task.timezone)}`}{" "}
              · {task.status}
            </p>
            <div
              className="relative h-4 overflow-hidden rounded bg-muted"
              role="img"
              aria-label={`${task.title} timeline`}
            >
              <div
                className={`absolute inset-y-0 rounded ${task.status === "done" ? "bg-green-600" : task.status === "doing" ? "bg-primary" : "bg-slate-500"}`}
                style={{
                  left: `${Math.min(98, ((start - minimum) / span) * 100)}%`,
                  width: `${Math.max(2, ((end - start) / span) * 100)}%`,
                }}
              />
            </div>
          </article>
        );
      })}
      <p className="text-xs text-muted-foreground">
        {tasks.length - dated.length} loaded tasks have no planned dates.
      </p>
    </section>
  );
}
function ScheduleTask({
  task,
  onClose,
}: {
  task: TimelineTask;
  onClose: () => void;
}) {
  const schedule = useMutation(api.collaboration.scheduleTask),
    work = useBotTask();
  const [zone, setZone] = useState(task.timezone ?? deviceTimezone()),
    [start, setStart] = useState(
      task.startsAt !== undefined
        ? zonedInput(task.startsAt, task.timezone ?? deviceTimezone())
        : "",
    ),
    [due, setDue] = useState(
      task.dueAt !== undefined
        ? zonedInput(task.dueAt, task.timezone ?? deviceTimezone())
        : "",
    );
  return (
    <Dialog open onOpenChange={(open) => !open && !work.busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task dates</DialogTitle>
          <DialogDescription>
            {task.title}. Leave a date empty to clear it. A deadline must be in
            the future.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void work.run(async () => {
              await schedule({
                id: task._id,
                startsAt: start ? zonedInstant(start, zone) : null,
                dueAt: due ? zonedInstant(due, zone) : null,
                timezone: zone,
                expectedRevision: task.revision,
              });
              onClose();
            }, "Task dates saved");
          }}
        >
          <Label className="block space-y-2">
            Planned start
            <Input
              aria-label="Task planned start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Label>
          <Label className="block space-y-2">
            Deadline
            <Input
              aria-label="Task deadline"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Label>
          <Label className="block space-y-2">
            Timezone
            <Input
              aria-label="Task date timezone"
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            />
          </Label>
          <Button type="submit" disabled={work.busy}>
            Save task dates
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
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
  const [view, setView] = useState("board"),
    [scheduling, setScheduling] = useState<
      FunctionReturnType<typeof api.collaboration.tasks>["page"][number] | null
    >(null);
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
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={view === "board" ? "default" : "outline"}
          onClick={() => setView("board")}
        >
          Board view
        </Button>
        <Button
          size="sm"
          variant={view === "timeline" ? "default" : "outline"}
          onClick={() => setView("timeline")}
        >
          Timeline view
        </Button>
      </div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : view === "timeline" ? (
        <TaskTimeline tasks={results} onSchedule={setScheduling} />
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setScheduling(task)}
                      >
                        Edit task dates
                      </Button>
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
      {scheduling && (
        <ScheduleTask task={scheduling} onClose={() => setScheduling(null)} />
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
  const [hasStart, setHasStart] = useState(false),
    [startTime, setStartTime] = useState(() =>
      zonedInput(Date.now(), deviceTimezone()),
    );
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
            checked={hasStart}
            onChange={(e) => setHasStart(e.target.checked)}
          />
          Set a planned start
        </Label>
        {hasStart && (
          <Label className="block space-y-2">
            Planned start
            <Input
              aria-label="Task planned start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
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
                startsAt: hasStart
                  ? zonedInstant(startTime, timezone)
                  : undefined,
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
