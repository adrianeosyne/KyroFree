import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LoadingRows,
  EmptyState,
  ConfirmDelete,
  TimeFields,
} from "./AdvancedShared";
import { useBotTask } from "./BotPlatformShared";
import { useNow } from "@/hooks/use-now";
import {
  deviceTimezone,
  displayInstant,
  zonedInput,
  zonedInstant,
} from "@/lib/zonedTime";

export function CompetitionHub({ serverId }: { serverId: Id<"servers"> }) {
  const [tab, setTab] = useState("clans");
  return (
    <main className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">
          Clans and competitions
        </h1>
        <p className="text-sm text-muted-foreground">
          Find your team and compete in community tournaments.
        </p>
        <div
          role="tablist"
          aria-label="Competition sections"
          className="flex flex-wrap gap-2"
        >
          {["clans", "tournaments", "leaderboard"].map((t) => (
            <Button
              key={t}
              role="tab"
              aria-selected={tab === t}
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t === "clans"
                ? "Clans"
                : t === "tournaments"
                  ? "Tournaments"
                  : "Leaderboards"}
            </Button>
          ))}
        </div>
        {tab === "clans" ? (
          <Clans serverId={serverId} />
        ) : tab === "tournaments" ? (
          <Tournaments serverId={serverId} />
        ) : (
          <Leaderboard serverId={serverId} />
        )}
      </div>
    </main>
  );
}
function Clans({ serverId }: { serverId: Id<"servers"> }) {
  const clans = usePaginatedQuery(
    api.competitions.clans,
    { serverId },
    { initialNumItems: 20 },
  );
  const join = useMutation(api.competitions.joinClan),
    create = useMutation(api.competitions.createClan),
    disband = useMutation(api.competitions.disbandClan);
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Id<"gamingClans"> | null>(null);
  const [value, setValue] = useState({
    name: "",
    tag: "",
    game: "",
    description: "",
    approvalRequired: false,
  });
  const task = useBotTask();
  const clan = clans.results.find((c) => c._id === selected);
  return (
    <div className="space-y-4">
      <Button onClick={() => setCreating(true)}>Create clan</Button>
      {clans.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !clans.results.length ? (
        <EmptyState>
          No clans in this page yet. Create a team for your favorite game.
        </EmptyState>
      ) : (
        clans.results.map((c) => (
          <article key={c._id} className="space-y-3 border-b py-4">
            <h2 className="text-lg font-semibold">
              [{c.tag}] {c.name}
            </h2>
            <p className="text-sm">
              {c.game} · {c.memberCount}/100 members
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {c.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(c._id)}
              >
                Members and requests
              </Button>
              {!c.isLeader && (
                <Button
                  size="sm"
                  disabled={
                    task.busy ||
                    (!c.joined && !c.pending && c.memberCount >= 100)
                  }
                  onClick={() =>
                    void task.run(() =>
                      join({ clanId: c._id, join: !c.joined && !c.pending }),
                    )
                  }
                >
                  {c.joined
                    ? "Leave clan"
                    : c.pending
                      ? "Cancel request"
                      : c.approvalRequired
                        ? "Request to join"
                        : "Join clan"}
                </Button>
              )}
              {c.canManage && (
                <ConfirmDelete
                  title="Disband clan?"
                  description="The clan and all memberships will be removed."
                  onConfirm={() => disband({ clanId: c._id })}
                >
                  Disband clan
                </ConfirmDelete>
              )}
            </div>
          </article>
        ))
      )}
      {clans.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => clans.loadMore(20)}>
          More clans
        </Button>
      )}
      {clan && (
        <ClanMembers
          clanId={clan._id}
          ownerId={clan.userId}
          canManage={clan.canManage}
          onClose={() => setSelected(null)}
        />
      )}
      <Dialog
        open={creating}
        onOpenChange={(open) => !task.busy && setCreating(open)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a clan</DialogTitle>
            <DialogDescription>
              Clans and their members belong to this community.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await create({ serverId, ...value });
                setCreating(false);
                setValue({
                  name: "",
                  tag: "",
                  game: "",
                  description: "",
                  approvalRequired: false,
                });
              }, "Clan created");
            }}
          >
            {(["name", "tag", "game"] as const).map((key) => (
              <Input
                key={key}
                aria-label={`Clan ${key}`}
                placeholder={`Clan ${key}`}
                maxLength={key === "tag" ? 12 : 80}
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
              />
            ))}
            <Textarea
              aria-label="Clan description"
              placeholder="Tell members about your team"
              maxLength={4000}
              value={value.description}
              onChange={(e) =>
                setValue({ ...value, description: e.target.value })
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.approvalRequired}
                onChange={(e) =>
                  setValue({ ...value, approvalRequired: e.target.checked })
                }
              />
              Require approval to join
            </label>
            <Button
              disabled={
                task.busy ||
                !value.name.trim() ||
                !value.tag.trim() ||
                !value.game.trim()
              }
              type="submit"
            >
              Create clan
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ClanMembers({
  clanId,
  ownerId,
  canManage,
  onClose,
}: {
  clanId: Id<"gamingClans">;
  ownerId: Id<"users">;
  canManage: boolean;
  onClose: () => void;
}) {
  const members = useQuery(api.competitions.clanMembers, { clanId });
  const review = useMutation(api.competitions.reviewClanMember);
  const task = useBotTask();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clan members</DialogTitle>
          <DialogDescription>
            Pending requests are visible to their author and clan managers.
          </DialogDescription>
        </DialogHeader>
        {!members ? (
          <LoadingRows />
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center gap-2 border-b py-3"
            >
              <span className="flex-1 text-sm">
                {member.name} ·{" "}
                {member.id === ownerId
                  ? "Leader"
                  : member.accepted
                    ? "Member"
                    : "Pending"}
              </span>
              {canManage && member.id !== ownerId && (
                <>
                  {!member.accepted && (
                    <Button
                      disabled={task.busy}
                      size="sm"
                      onClick={() =>
                        void task.run(() =>
                          review({ clanId, userId: member.id, accept: true }),
                        )
                      }
                    >
                      Accept request
                    </Button>
                  )}
                  <ConfirmDelete
                    title={
                      member.accepted
                        ? "Remove clan member?"
                        : "Decline request?"
                    }
                    description="This does not remove them from the community."
                    onConfirm={() =>
                      review({ clanId, userId: member.id, accept: false })
                    }
                  >
                    {member.accepted ? "Remove" : "Decline"}
                  </ConfirmDelete>
                </>
              )}
            </div>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
function Tournaments({ serverId }: { serverId: Id<"servers"> }) {
  const tournaments = usePaginatedQuery(
    api.competitions.tournaments,
    { serverId },
    { initialNumItems: 20 },
  );
  const register = useMutation(api.competitions.register),
    create = useMutation(api.competitions.createTournament);
  const [selected, setSelected] = useState<Id<"gamingTournaments"> | null>(
      null,
    ),
    [creating, setCreating] = useState(false);
  const [value, setValue] = useState({
    title: "",
    game: "",
    description: "",
    capacity: 8,
  });
  const [timezone, setTimezone] = useState(deviceTimezone),
    [time, setTime] = useState(() =>
      zonedInput(Date.now() + 3600000, deviceTimezone()),
    );
  const task = useBotTask();
  const now = useNow(1000);
  return (
    <div className="space-y-4">
      <Button onClick={() => setCreating(true)}>Host tournament</Button>
      {tournaments.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !tournaments.results.length ? (
        <EmptyState>
          No tournaments in this page yet. Host a competition for your
          community.
        </EmptyState>
      ) : (
        tournaments.results.map((t) => (
          <article key={t._id} className="space-y-3 border-b py-4">
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <p className="text-sm">
              {t.game} · {t.entrantCount}/{t.capacity} entrants · {t.status}
            </p>
            <p className="text-xs text-muted-foreground">
              {displayInstant(t.startsAt, t.timezone)} · {t.timezone}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {t.description}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(t._id)}
              >
                View bracket
              </Button>
              {t.status === "registration" && now < t.startsAt && (
                <Button
                  size="sm"
                  disabled={
                    task.busy || (!t.joined && t.entrantCount >= t.capacity)
                  }
                  onClick={() =>
                    void task.run(() =>
                      register({ tournamentId: t._id, join: !t.joined }),
                    )
                  }
                >
                  {t.joined ? "Withdraw registration" : "Register"}
                </Button>
              )}
            </div>
          </article>
        ))
      )}
      {tournaments.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => tournaments.loadMore(20)}>
          More tournaments
        </Button>
      )}
      {selected && (
        <TournamentBracket
          tournamentId={selected}
          onClose={() => setSelected(null)}
        />
      )}
      <Dialog
        open={creating}
        onOpenChange={(open) => !task.busy && setCreating(open)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Host a tournament</DialogTitle>
            <DialogDescription>
              Individual entrants compete in a single-elimination bracket.
              Registration order determines seeds. Registration closes at the
              scheduled start.
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
                  timezone,
                  startsAt: zonedInstant(time, timezone),
                });
                setCreating(false);
                setValue({ title: "", game: "", description: "", capacity: 8 });
              }, "Tournament published");
            }}
          >
            {(["title", "game"] as const).map((key) => (
              <Input
                key={key}
                aria-label={`Tournament ${key}`}
                placeholder={`Tournament ${key}`}
                maxLength={key === "title" ? 120 : 80}
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
              />
            ))}
            <Textarea
              aria-label="Tournament description"
              placeholder="Rules and format"
              maxLength={4000}
              value={value.description}
              onChange={(e) =>
                setValue({ ...value, description: e.target.value })
              }
            />
            <label className="block space-y-2 text-sm">
              Maximum entrants
              <Input
                aria-label="Maximum entrants"
                type="number"
                min={2}
                max={64}
                value={value.capacity}
                onChange={(e) =>
                  setValue({ ...value, capacity: Number(e.target.value) })
                }
              />
            </label>
            <TimeFields
              value={time}
              onChange={setTime}
              timezone={timezone}
              onTimezone={setTimezone}
            />
            <Button
              type="submit"
              disabled={task.busy || !value.title.trim() || !value.game.trim()}
            >
              Publish tournament
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function TournamentBracket({
  tournamentId,
  onClose,
}: {
  tournamentId: Id<"gamingTournaments">;
  onClose: () => void;
}) {
  const tournament = useQuery(api.competitions.tournament, { tournamentId });
  const start = useMutation(api.competitions.start),
    cancel = useMutation(api.competitions.cancel);
  const task = useBotTask();
  const now = useNow(1000);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{tournament?.title ?? "Tournament bracket"}</DialogTitle>
          <DialogDescription>
            Hosts and community managers record results. Completed results
            advance winners and cannot be overwritten.
          </DialogDescription>
        </DialogHeader>
        {!tournament ? (
          <LoadingRows />
        ) : (
          <>
            <p className="text-sm">
              {tournament.status} · {tournament.game}
            </p>
            {tournament.status === "registration" && (
              <>
                <p className="text-sm">
                  Registered:{" "}
                  {tournament.registrations
                    .map((id) => tournament.names[id])
                    .join(", ") || "No entrants yet"}
                </p>
                {tournament.canManage && (
                  <Button
                    disabled={
                      task.busy ||
                      now < tournament.startsAt ||
                      tournament.registrations.length < 2
                    }
                    onClick={() =>
                      void task.run(
                        () =>
                          start({
                            tournamentId,
                            expectedRevision: tournament.revision,
                          }),
                        "Bracket started",
                      )
                    }
                  >
                    Start bracket
                  </Button>
                )}
              </>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {tournament.matches.map((match) => (
                <article
                  key={`${match.round}:${match.slot}`}
                  className="space-y-2 rounded-xl border p-3"
                >
                  <p className="text-xs font-semibold">
                    Round {match.round} · Match {match.slot + 1} · {match.state}
                  </p>
                  <p className="text-sm">
                    {match.a
                      ? tournament.names[match.a]
                      : match.state === "pending"
                        ? "Awaiting winner"
                        : "Bye"}
                    {match.scoreA !== undefined ? ` · ${match.scoreA}` : ""}
                  </p>
                  <p className="text-sm">
                    {match.b
                      ? tournament.names[match.b]
                      : match.state === "pending"
                        ? "Awaiting winner"
                        : "Bye"}
                    {match.scoreB !== undefined ? ` · ${match.scoreB}` : ""}
                  </p>
                  {match.winner && (
                    <p className="text-xs text-primary">
                      Advances: {tournament.names[match.winner]}
                    </p>
                  )}
                  {tournament.canManage &&
                    tournament.status === "active" &&
                    match.state === "ready" && (
                      <MatchResult
                        tournamentId={tournamentId}
                        round={match.round}
                        slot={match.slot}
                        revision={tournament.revision}
                      />
                    )}
                </article>
              ))}
            </div>
            {tournament.winnerId && (
              <p className="font-semibold text-primary">
                Winner: {tournament.names[tournament.winnerId]}
              </p>
            )}
            {tournament.canManage &&
              ["registration", "active"].includes(tournament.status) && (
                <ConfirmDelete
                  title="Cancel tournament?"
                  description="Registration and scoring close. Cancelled tournaments do not award leaderboard points."
                  onConfirm={() =>
                    cancel({
                      tournamentId,
                      expectedRevision: tournament.revision,
                    })
                  }
                >
                  Cancel tournament
                </ConfirmDelete>
              )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function MatchResult({
  tournamentId,
  round,
  slot,
  revision,
}: {
  tournamentId: Id<"gamingTournaments">;
  round: number;
  slot: number;
  revision: number;
}) {
  const result = useMutation(api.competitions.result);
  const task = useBotTask();
  const [scores, setScores] = useState({ scoreA: 0, scoreB: 0 });
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          !window.confirm(
            "Record this result and advance the winner? Completed scores cannot be overwritten.",
          )
        )
          return;
        void task.run(
          () =>
            result({
              tournamentId,
              round,
              slot,
              ...scores,
              expectedRevision: revision,
            }),
          "Result recorded",
        );
      }}
    >
      {(["scoreA", "scoreB"] as const).map((key, i) => (
        <Input
          key={key}
          className="w-20"
          aria-label={`Round ${round} match ${slot + 1} score ${i + 1}`}
          type="number"
          min={0}
          max={100000}
          value={scores[key]}
          onChange={(e) =>
            setScores({ ...scores, [key]: Number(e.target.value) })
          }
        />
      ))}
      <Button
        type="submit"
        size="sm"
        disabled={task.busy || scores.scoreA === scores.scoreB}
      >
        Record result
      </Button>
    </form>
  );
}
function Leaderboard({ serverId }: { serverId: Id<"servers"> }) {
  const [game, setGame] = useState(""),
    [selected, setSelected] = useState("");
  const stats = usePaginatedQuery(
    api.competitions.leaderboard,
    selected ? { serverId, game: selected } : "skip",
    { initialNumItems: 25 },
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Community tournament wins and participation, updated once when each
        tournament finishes.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSelected(game.trim());
        }}
      >
        <Input
          aria-label="Leaderboard game"
          maxLength={80}
          placeholder="Exact game name"
          value={game}
          onChange={(e) => setGame(e.target.value)}
        />
        <Button type="submit" disabled={!game.trim()}>
          Show leaderboard
        </Button>
      </form>
      {!selected ? (
        <EmptyState>
          Choose a game to view its community leaderboard.
        </EmptyState>
      ) : stats.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !stats.results.length ? (
        <EmptyState>
          No results on this page. Finish a tournament to record stats.
        </EmptyState>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Member</th>
              <th>Wins</th>
              <th>Played</th>
            </tr>
          </thead>
          <tbody>
            {stats.results.map((row) => (
              <tr key={row._id} className="border-t">
                <td className="py-3">{row.name}</td>
                <td>{row.wins}</td>
                <td>{row.tournaments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {stats.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => stats.loadMore(25)}>
          More results
        </Button>
      )}
    </div>
  );
}
