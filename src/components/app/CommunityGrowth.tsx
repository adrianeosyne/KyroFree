import { useState } from "react";
import { Link } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
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
import {
  EmptyState,
  LoadingRows,
  ConfirmDelete,
  TimeFields,
} from "./AdvancedShared";
import { useBotTask } from "./BotPlatformShared";
import { AppealReviewQueue } from "./ModerationAppeals";
import { deviceTimezone, zonedInput, zonedInstant } from "@/lib/zonedTime";
import { renderMessage } from "@/lib/markdown";
import { useNow } from "@/hooks/use-now";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function CommunityGrowth({ serverId }: { serverId: Id<"servers"> }) {
  const server = useQuery(api.servers.get, { serverId });
  const [tab, setTab] = useState("goals");
  const manager =
    server?.isOwner || server?.permissions.includes("manage_server");
  const tabs = [
    { id: "goals", label: "Achievements and quests" },
    { id: "resources", label: "Resources" },
    { id: "partnerships", label: "Partnerships" },
    ...(manager || server?.permissions.includes("ban_members")
      ? [{ id: "appeals", label: "Appeals" }]
      : []),
    ...(manager
      ? [
          { id: "analytics", label: "Growth history" },
          { id: "backups", label: "Configuration history" },
        ]
      : []),
  ];
  const selected = tabs.some((t) => t.id === tab) ? tab : "goals";
  return (
    <main className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm text-primary">{server?.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Community tools</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Build shared resources, reward participation and work with other
            communities.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Community tools"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((t) => (
            <Button
              key={t.id}
              role="tab"
              aria-selected={selected === t.id}
              size="sm"
              variant={selected === t.id ? "default" : "outline"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        {selected === "goals" ? (
          <Goals serverId={serverId} manager={!!manager} />
        ) : selected === "resources" ? (
          <Resources serverId={serverId} manager={!!manager} />
        ) : selected === "partnerships" ? (
          <Partnerships serverId={serverId} manager={!!manager} />
        ) : selected === "appeals" ? (
          <AppealReviewQueue serverId={serverId} />
        ) : selected === "analytics" ? (
          <GrowthHistory serverId={serverId} />
        ) : (
          <ConfigurationHistory serverId={serverId} owner={!!server?.isOwner} />
        )}
      </div>
    </main>
  );
}
function Goals({
  serverId,
  manager,
}: {
  serverId: Id<"servers">;
  manager: boolean;
}) {
  const goals = usePaginatedQuery(
    api.communityGrowth.goals,
    { serverId },
    { initialNumItems: 20 },
  );
  const create = useMutation(api.communityGrowth.createGoal),
    join = useMutation(api.communityGrowth.joinGoal),
    claim = useMutation(api.communityGrowth.claimGoal),
    archive = useMutation(api.communityGrowth.archiveGoal);
  const [open, setOpen] = useState(false),
    [deadline, setDeadline] = useState(false);
  const [value, setValue] = useState({
    title: "",
    description: "",
    kind: "achievement" as "achievement" | "quest",
    metric: "messages" as "messages" | "xp" | "invites",
    target: 10,
  });
  const [zone, setZone] = useState(deviceTimezone),
    [time, setTime] = useState(() =>
      zonedInput(Date.now() + 86400000, deviceTimezone()),
    );
  const task = useBotTask(),
    now = useNow(1000);
  return (
    <section className="space-y-4">
      {manager && (
        <Button onClick={() => setOpen(true)}>
          Create achievement or quest
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        Achievements use all your community contributions. Join a quest to start
        collecting new progress. Rewards are community achievements.
      </p>
      {goals.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !goals.results.length ? (
        <EmptyState>No community goals on this page yet.</EmptyState>
      ) : (
        goals.results.map((goal) => {
          const closed =
            goal.closed ||
            (goal.closesAt !== undefined && goal.closesAt <= now);
          return (
            <article key={goal._id} className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{goal.title}</h2>
                <span className="text-xs text-muted-foreground">
                  {goal.kind}
                  {goal.archived ? " · Archived" : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {goal.description}
              </p>
              <Label className="block space-y-1">
                <span>
                  {goal.progress}/{goal.target} {goal.metric}
                </span>
                <progress
                  className="h-2 w-full accent-primary"
                  aria-label={`${goal.title} progress`}
                  value={goal.progress}
                  max={goal.target}
                />
              </Label>
              {goal.closesAt !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Closes {new Date(goal.closesAt).toLocaleString()}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {goal.awardedAt !== null ? (
                  <p className="text-sm font-semibold text-primary">
                    {goal.kind === "quest"
                      ? "Quest completed"
                      : "Achievement earned"}
                  </p>
                ) : goal.kind === "quest" && !goal.joined ? (
                  <Button
                    size="sm"
                    disabled={task.busy || closed}
                    onClick={() =>
                      void task.run(
                        () => join({ goalId: goal._id }),
                        "Quest joined",
                      )
                    }
                  >
                    Join quest
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={
                      task.busy || closed || goal.progress < goal.target
                    }
                    onClick={() =>
                      void task.run(
                        () => claim({ goalId: goal._id }),
                        "Reward claimed",
                      )
                    }
                  >
                    Claim achievement
                  </Button>
                )}
                {manager && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(() =>
                        archive({
                          goalId: goal._id,
                          archived: !goal.archived,
                          expectedRevision: goal.revision,
                        }),
                      )
                    }
                  >
                    {goal.archived ? "Unarchive" : "Archive"}
                  </Button>
                )}
              </div>
            </article>
          );
        })
      )}
      {goals.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => goals.loadMore(20)}>
          More goals
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a community goal</DialogTitle>
            <DialogDescription>
              Goals use verified messages, contribution XP or credited
              invitations. Changing a target after publication is not supported.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await create({
                  serverId,
                  ...value,
                  closesAt: deadline ? zonedInstant(time, zone) : undefined,
                });
                setOpen(false);
              }, "Community goal created");
            }}
          >
            <Input
              aria-label="Goal title"
              placeholder="Goal title"
              maxLength={100}
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
            />
            <Textarea
              aria-label="Goal description"
              placeholder="Explain the challenge"
              maxLength={2000}
              value={value.description}
              onChange={(e) =>
                setValue({ ...value, description: e.target.value })
              }
            />
            <Label className="block space-y-2">
              Goal type
              <select
                aria-label="Goal type"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={value.kind}
                onChange={(e) =>
                  setValue({
                    ...value,
                    kind: e.target.value as typeof value.kind,
                  })
                }
              >
                <option value="achievement">Lifetime achievement</option>
                <option value="quest">Quest from enrollment</option>
              </select>
            </Label>
            <Label className="block space-y-2">
              Measure
              <select
                aria-label="Goal metric"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={value.metric}
                onChange={(e) =>
                  setValue({
                    ...value,
                    metric: e.target.value as typeof value.metric,
                  })
                }
              >
                <option value="messages">Messages</option>
                <option value="xp">Contribution XP</option>
                <option value="invites">Credited invitations</option>
              </select>
            </Label>
            <Label className="block space-y-2">
              Target
              <Input
                aria-label="Goal target"
                type="number"
                min={1}
                max={1000000}
                value={value.target}
                onChange={(e) =>
                  setValue({ ...value, target: Number(e.target.value) })
                }
              />
            </Label>
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deadline}
                onChange={(e) => setDeadline(e.target.checked)}
              />
              Set a deadline
            </Label>
            {deadline && (
              <TimeFields
                value={time}
                onChange={setTime}
                timezone={zone}
                onTimezone={setZone}
              />
            )}
            <Button type="submit" disabled={task.busy || !value.title.trim()}>
              Publish goal
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
type Resource = FunctionReturnType<
  typeof api.communityGrowth.resources
>["page"][number];
function Resources({
  serverId,
  manager,
}: {
  serverId: Id<"servers">;
  manager: boolean;
}) {
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [category, setCategory] = useState("");
  const resources = usePaginatedQuery(
    api.communityGrowth.resources,
    { serverId, term, category: category || undefined },
    { initialNumItems: 20 },
  );
  const remove = useMutation(api.communityGrowth.removeResource);
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  return (
    <section className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(search.trim());
        }}
      >
        <Input
          className="min-w-40 flex-1"
          aria-label="Search resources"
          placeholder="Search resource titles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
        />
        <Input
          className="max-w-48"
          aria-label="Resource category filter"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          maxLength={60}
        />
        <Button type="submit" variant="outline">
          Search resources
        </Button>
        {manager && (
          <Button type="button" onClick={() => setEditing("new")}>
            Add resource
          </Button>
        )}
      </form>
      {resources.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !resources.results.length ? (
        <EmptyState>
          No resources on this page. Try another title or category.
        </EmptyState>
      ) : (
        resources.results.map((row) => (
          <article key={row._id} className="space-y-2 border-b py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 font-semibold">
                <a
                  className="text-primary underline"
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {row.title}
                </a>
              </h2>
              <span className="text-xs text-muted-foreground">
                {row.category}
              </span>
            </div>
            <div className="whitespace-pre-wrap break-words text-sm">
              {renderMessage(row.description)}
            </div>
            {manager && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(row)}
                >
                  Edit resource
                </Button>
                <ConfirmDelete
                  title="Remove resource?"
                  description="This removes the community's saved link."
                  onConfirm={() =>
                    remove({
                      resourceId: row._id,
                      expectedRevision: row.revision,
                    })
                  }
                >
                  Remove resource
                </ConfirmDelete>
              </div>
            )}
          </article>
        ))
      )}
      {resources.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => resources.loadMore(20)}>
          More resources
        </Button>
      )}
      {editing && (
        <ResourceEditor
          key={editing === "new" ? "new" : editing._id}
          serverId={serverId}
          resource={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
function ResourceEditor({
  serverId,
  resource,
  onClose,
}: {
  serverId: Id<"servers">;
  resource?: Resource;
  onClose: () => void;
}) {
  const save = useMutation(api.communityGrowth.saveResource),
    task = useBotTask();
  const [value, setValue] = useState({
    title: resource?.title ?? "",
    description: resource?.description ?? "",
    url: resource?.url ?? "",
    category: resource?.category ?? "",
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resource ? "Edit resource" : "Add resource"}
          </DialogTitle>
          <DialogDescription>
            Save a useful HTTPS link for community members.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await save({
                serverId,
                resourceId: resource?._id,
                expectedRevision: resource?.revision ?? 0,
                ...value,
              });
              onClose();
            }, "Resource saved");
          }}
        >
          {(["title", "url", "category"] as const).map((key) => (
            <Input
              key={key}
              aria-label={`Resource ${key}`}
              placeholder={
                key === "url" ? "https://example.com/guide" : `Resource ${key}`
              }
              maxLength={key === "url" ? 2000 : key === "title" ? 120 : 60}
              value={value[key]}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          ))}
          <Textarea
            aria-label="Resource description"
            placeholder="What makes this useful?"
            maxLength={4000}
            value={value.description}
            onChange={(e) =>
              setValue({ ...value, description: e.target.value })
            }
          />
          <Button
            type="submit"
            disabled={task.busy || !value.title.trim() || !value.url.trim()}
          >
            Save resource
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Partnerships({
  serverId,
  manager,
}: {
  serverId: Id<"servers">;
  manager: boolean;
}) {
  const partnerships = useQuery(api.communityGrowth.partnerships, { serverId }),
    propose = useMutation(api.communityGrowth.proposePartnership),
    decide = useMutation(api.communityGrowth.decidePartnership);
  const [open, setOpen] = useState(false),
    [term, setTerm] = useState(""),
    [target, setTarget] = useState(""),
    [notes, setNotes] = useState("");
  const communities = useQuery(api.servers.discover, open ? { term } : "skip"),
    task = useBotTask();
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Partnerships become visible to members after both public communities
        agree.
      </p>
      {manager && (
        <Button onClick={() => setOpen(true)}>Propose partnership</Button>
      )}
      {!partnerships ? (
        <LoadingRows />
      ) : !partnerships.length ? (
        <EmptyState>No partnerships to show.</EmptyState>
      ) : (
        partnerships.map((row) => (
          <article key={row._id} className="space-y-3 border-b py-4">
            <h2 className="font-semibold">
              {row.partnerName} · {row.status}
            </h2>
            <p className="whitespace-pre-wrap break-words text-sm">
              {row.notes}
            </p>
            {row.status === "active" && (
              <Link
                className="text-sm text-primary underline"
                to={`/dashboard/s/${row.partnerId}`}
              >
                View community
              </Link>
            )}
            {manager && (
              <div className="flex flex-wrap gap-2">
                {row.incoming &&
                  row.status === "pending" &&
                  ["accept", "decline"].map((decision) => (
                    <Button
                      key={decision}
                      size="sm"
                      variant={decision === "accept" ? "default" : "outline"}
                      disabled={task.busy}
                      onClick={() =>
                        void task.run(() =>
                          decide({
                            serverId,
                            partnershipId: row._id,
                            expectedRevision: row.revision,
                            decision: decision as "accept" | "decline",
                          }),
                        )
                      }
                    >
                      {decision === "accept"
                        ? "Accept partnership"
                        : "Decline partnership"}
                    </Button>
                  ))}
                {["active", "pending"].includes(row.status) && (
                  <ConfirmDelete
                    title="End partnership?"
                    description="This closes the relationship for both communities."
                    onConfirm={() =>
                      decide({
                        serverId,
                        partnershipId: row._id,
                        expectedRevision: row.revision,
                        decision: "end",
                      })
                    }
                  >
                    {row.status === "pending"
                      ? "Withdraw proposal"
                      : "End partnership"}
                  </ConfirmDelete>
                )}
              </div>
            )}
          </article>
        ))
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Propose a partnership</DialogTitle>
            <DialogDescription>
              Choose a public community and explain the proposed collaboration.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await propose({
                  serverId,
                  targetId: target as Id<"servers">,
                  notes,
                });
                setOpen(false);
                setNotes("");
                setTarget("");
              }, "Partnership proposed");
            }}
          >
            <Input
              aria-label="Find partner community"
              placeholder="Search public communities"
              maxLength={100}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <select
              aria-label="Partner community"
              className="h-10 w-full rounded-md border bg-background px-3"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose a community</option>
              {communities
                ?.filter((c) => c.id !== serverId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <Textarea
              aria-label="Partnership proposal"
              maxLength={2000}
              placeholder="What will the communities do together?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              type="submit"
              disabled={task.busy || !target || !notes.trim()}
            >
              Send proposal
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
function GrowthHistory({ serverId }: { serverId: Id<"servers"> }) {
  const stats = useQuery(api.communityGrowth.analytics, { serverId });
  if (!stats) return <LoadingRows />;
  if (!stats.days.length)
    return (
      <EmptyState>
        Growth history starts with recorded community activity. No earlier
        history is inferred.
      </EmptyState>
    );
  const totals = stats.days.reduce(
    (a, d) => ({
      messages: a.messages + d.messages,
      joins: a.joins + d.joins,
      leaves: a.leaves + d.leaves,
    }),
    { messages: 0, joins: 0, leaves: 0 },
  );
  const days = stats.days.map((d) => ({
    ...d,
    date: new Date(d.day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  }));
  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Up to 31 UTC days of observed activity. Capture began{" "}
        {new Date(stats.capturedSince!).toLocaleDateString(undefined, {
          timeZone: "UTC",
        })}
        . Retention means yesterday's active posters who posted again today.
        Bots are excluded.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Messages", totals.messages],
          ["Joins", totals.joins],
          ["Net growth", totals.joins - totals.leaves],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div
        className="h-64 min-w-0"
        role="img"
        aria-label="Daily active community posters"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
            <Bar
              name="Active posters"
              dataKey="activeMembers"
              fill="var(--primary)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Daily community growth and posting retention
          </caption>
          <thead>
            <tr>
              <th className="p-2">UTC day</th>
              <th className="p-2">Messages</th>
              <th className="p-2">Active</th>
              <th className="p-2">Joins</th>
              <th className="p-2">Leaves</th>
              <th className="p-2">Retention</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day._id} className="border-t">
                <td className="p-2 whitespace-nowrap">{day.date}</td>
                <td className="p-2">{day.messages}</td>
                <td className="p-2">{day.activeMembers}</td>
                <td className="p-2">{day.joins}</td>
                <td className="p-2">{day.leaves}</td>
                <td className="p-2">
                  {day.retentionPercent === null
                    ? "—"
                    : `${day.retentionPercent}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ConfigurationHistory({
  serverId,
  owner,
}: {
  serverId: Id<"servers">;
  owner: boolean;
}) {
  const history = usePaginatedQuery(
      api.communityBackups.list,
      { serverId },
      { initialNumItems: 10 },
    ),
    create = useMutation(api.communityBackups.create),
    importBackup = useMutation(api.communityBackups.importBackup);
  const [label, setLabel] = useState(""),
    [selected, setSelected] = useState<Id<"communityBackups"> | null>(null),
    task = useBotTask();
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Up to 30 configurations are kept. Changes to community settings, roles,
        channels, categories, AutoMod and the lobby create snapshots
        automatically. Backups contain configuration, with no messages, members,
        passwords or media files.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(
            () => create({ serverId, label: label.trim() || "Manual backup" }),
            "Configuration saved",
          );
        }}
      >
        <Input
          className="min-w-40 flex-1"
          aria-label="Backup label"
          maxLength={100}
          placeholder="Backup label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button type="submit" disabled={task.busy}>
          Save current configuration
        </Button>
      </form>
      {owner && (
        <Label className="block space-y-2">
          Import a JSON backup of this community
          <Input
            aria-label="Import community backup"
            type="file"
            accept=".json,application/json"
            disabled={task.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void task.run(async () => {
                if (file.size > 450000)
                  throw new Error("Choose a backup below 450 KB.");
                const id = await importBackup({
                  serverId,
                  content: await file.text(),
                  label: label.trim() || file.name.slice(0, 100),
                });
                setSelected(id);
              }, "Backup imported for review");
            }}
          />
        </Label>
      )}
      {history.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !history.results.length ? (
        <EmptyState>
          No configuration snapshots on this page yet. Save the current
          configuration to begin.
        </EmptyState>
      ) : (
        history.results.map((row) => (
          <article
            key={row._id}
            className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
          >
            <div>
              <p className="font-semibold">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(row._id)}
            >
              Review backup
            </Button>
          </article>
        ))
      )}
      {history.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => history.loadMore(10)}>
          More snapshots
        </Button>
      )}
      {selected && (
        <BackupReview
          key={selected}
          backupId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function BackupReview({
  backupId,
  onClose,
}: {
  backupId: Id<"communityBackups">;
  onClose: () => void;
}) {
  const live = useQuery(api.communityBackups.detail, { backupId });
  if (!live)
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading configuration</DialogTitle>
            <DialogDescription>
              Opening the saved configuration.
            </DialogDescription>
          </DialogHeader>
          <LoadingRows />
        </DialogContent>
      </Dialog>
    );
  return (
    <LoadedBackupReview backupId={backupId} live={live} onClose={onClose} />
  );
}
function LoadedBackupReview({
  backupId,
  live,
  onClose,
}: {
  backupId: Id<"communityBackups">;
  live: FunctionReturnType<typeof api.communityBackups.detail>;
  onClose: () => void;
}) {
  const restore = useMutation(api.communityBackups.restore),
    task = useBotTask();
  const [reviewed, setReviewed] =
      useState<FunctionReturnType<typeof api.communityBackups.detail>>(live),
    [confirmation, setConfirmation] = useState("");
  const conflict =
    reviewed && live && reviewed.currentFingerprint !== live.currentFingerprint;
  const download = () => {
    if (!reviewed) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(reviewed.snapshot, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kyro-community-${new Date(reviewed.createdAt).toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !task.busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{reviewed?.label ?? "Review configuration"}</DialogTitle>
          <DialogDescription>
            Review the configuration before restoring. Only the current
            community owner can restore it.
          </DialogDescription>
        </DialogHeader>
        {!reviewed ? (
          <LoadingRows />
        ) : (
          <>
            <p className="text-sm">
              Saved community name:{" "}
              <strong>{reviewed.snapshot.community.name}</strong>
            </p>
            <p className="text-sm">
              {reviewed.snapshot.roles.length} roles ·{" "}
              {reviewed.snapshot.categories.length} categories ·{" "}
              {reviewed.snapshot.channels.length} channels
            </p>
            <p className="text-sm">
              Sections that differ:{" "}
              {reviewed.changedSections.join(", ") || "None"}
            </p>
            <p className="text-sm text-muted-foreground">
              Restoration updates existing configuration and recreates missing
              resources. Extra channels, existing messages and members remain.
              System roles and the official Premium lounge are protected.
            </p>
            <Button variant="outline" onClick={download}>
              Download JSON backup
            </Button>
            {conflict && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"
              >
                <p>
                  Configuration changed while you were reviewing it. Load the
                  latest state before restoring.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewed(live!);
                    setConfirmation("");
                  }}
                >
                  Review latest configuration
                </Button>
              </div>
            )}
            {reviewed.canRestore && (
              <form
                className="space-y-3 border-t pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void task.run(async () => {
                    await restore({
                      backupId,
                      expectedFingerprint: reviewed.currentFingerprint,
                      confirmation,
                    });
                    onClose();
                  }, "Configuration restored");
                }}
              >
                <Label className="block space-y-2">
                  Type “{reviewed.currentName}” to confirm restoration
                  <Input
                    aria-label="Confirm community name"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </Label>
                <Button
                  type="submit"
                  disabled={
                    task.busy ||
                    !!conflict ||
                    confirmation !== reviewed.currentName
                  }
                >
                  Restore reviewed configuration
                </Button>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
