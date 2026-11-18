import { useState } from "react";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  LoadingRows,
  EmptyState,
  TimeFields,
  ConfirmDelete,
} from "./AdvancedShared";
import {
  deviceTimezone,
  zonedInput,
  zonedInstant,
  displayInstant,
} from "@/lib/zonedTime";

export function GameHub() {
  const { serverId } = useParams();
  if (!serverId) return null;
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-4 sm:p-8"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Find your next party
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Looking for a group? Make a plan with people in this community.
          </p>
        </div>
        <ActivitySettings />
        <PartyFinder serverId={serverId as Id<"servers">} />
      </div>
    </motion.main>
  );
}
function ActivitySettings() {
  const me = useQuery(api.users.me);
  const current = useQuery(
    api.gaming.activity,
    me ? { userId: me.id as Id<"users"> } : "skip",
  );
  const save = useMutation(api.gaming.setActivity);
  const clear = useMutation(api.gaming.clearActivity);
  const [draft, setDraft] = useState<{
    game: string;
    details: string;
    inviteUrl: string;
    visible: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? {
    game: current?.game ?? "",
    details: current?.details ?? "",
    inviteUrl: current?.inviteUrl ?? "",
    visible: current?.visible ?? true,
  };
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Your game activity{current ? ` · ${current.game}` : ""}
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Choose your activity yourself. It clears after four hours and respects
          your presence privacy.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            aria-label="Current game"
            maxLength={80}
            value={value.game}
            placeholder="Game name"
            onChange={(e) => setDraft({ ...value, game: e.target.value })}
          />
          <Input
            aria-label="Game activity status"
            maxLength={160}
            value={value.details}
            placeholder="Custom game status"
            onChange={(e) => setDraft({ ...value, details: e.target.value })}
          />
        </div>
        <Input
          aria-label="Game invitation URL"
          maxLength={1000}
          value={value.inviteUrl}
          placeholder="HTTPS game invitation link (optional)"
          onChange={(e) => setDraft({ ...value, inviteUrl: e.target.value })}
        />
        <Label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.visible}
            onChange={(e) => setDraft({ ...value, visible: e.target.checked })}
          />
          Show game activity on my profile
        </Label>
        <div className="flex gap-2">
          <Button
            disabled={busy || !value.game.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await save(value);
                setDraft(null);
                toast.success("Game activity updated.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not save activity.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Save activity
          </Button>
          {current && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await clear({});
                  setDraft(null);
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not clear activity.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Clear activity
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
function PartyFinder({ serverId }: { serverId: Id<"servers"> }) {
  const [game, setGame] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Id<"partyPosts"> | null>(null);
  const [busy, setBusy] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.gaming.parties,
    { serverId, game: game || undefined },
    { initialNumItems: 20 },
  );
  const join = useMutation(api.gaming.joinParty);
  const cancel = useMutation(api.gaming.cancelParty);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Filter party game"
          maxLength={80}
          value={game}
          onChange={(e) => setGame(e.target.value)}
          placeholder="Filter by exact game name"
        />
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" />
          Host party
        </Button>
      </div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>
          No parties yet. Host a group for your next session.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((party) => (
            <article
              key={party._id}
              className="space-y-3 rounded-xl border p-4"
            >
              <p className="text-xs font-semibold text-primary">
                {party.game} · {party.region} · {party.language}
              </p>
              <h2 className="break-words text-lg font-semibold">
                {party.title}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {party.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {displayInstant(party.startsAt, party.timezone)} ·{" "}
                {party.timezone}
              </p>
              <button
                className="text-xs underline"
                onClick={() => setSelected(party._id)}
              >
                {party.memberCount}/{party.capacity} members · hosted by{" "}
                {party.host?.name ?? "a member"}
              </button>
              <div className="flex flex-wrap gap-2">
                {!party.mine && (party.joined || party.status === "open") && (
                  <Button
                    size="sm"
                    variant={party.joined ? "outline" : "default"}
                    disabled={
                      busy ||
                      (!party.joined && party.memberCount >= party.capacity)
                    }
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await join({ id: party._id, join: !party.joined });
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Could not update party membership.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {party.joined
                      ? "Leave party"
                      : party.memberCount >= party.capacity
                        ? "Full"
                        : "Join party"}
                  </Button>
                )}
                {party.inviteUrl && party.status === "open" && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={party.inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Game invitation
                    </a>
                  </Button>
                )}
                {party.canManage && party.status === "open" && (
                  <ConfirmDelete
                    title="Cancel party?"
                    description="Registration closes and the game invitation is removed."
                    onConfirm={() => cancel({ id: party._id })}
                  >
                    Cancel party
                  </ConfirmDelete>
                )}
                {party.status !== "open" && (
                  <span className="text-xs capitalize text-muted-foreground">
                    {party.status}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(20)}>
          More parties
        </Button>
      )}
      {open && (
        <CreateParty serverId={serverId} onClose={() => setOpen(false)} />
      )}
      {selected && (
        <PartyMembers id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
function PartyMembers({
  id,
  onClose,
}: {
  id: Id<"partyPosts">;
  onClose: () => void;
}) {
  const members = useQuery(api.gaming.partyMembers, { id });
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Party members</DialogTitle>
          <DialogDescription>
            People registered for this session.
          </DialogDescription>
        </DialogHeader>
        {!members ? (
          <LoadingRows />
        ) : (
          members.map((user) => (
            <p key={user.id} className="py-2 text-sm">
              {user.name}
            </p>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
function CreateParty({
  serverId,
  onClose,
}: {
  serverId: Id<"servers">;
  onClose: () => void;
}) {
  const [value, setValue] = useState({
    game: "",
    title: "",
    description: "",
    region: "",
    language: "English",
    capacity: 4,
    inviteUrl: "",
  });
  const [timezone, setTimezone] = useState(deviceTimezone);
  const [time, setTime] = useState(() =>
    zonedInput(Date.now() + 3600000, deviceTimezone()),
  );
  const [busy, setBusy] = useState(false);
  const create = useMutation(api.gaming.createParty);
  return (
    <Dialog open onOpenChange={(value) => !busy && !value && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Host a game party</DialogTitle>
          <DialogDescription>
            Community members can reserve a seat. Capacity includes you.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["game", "title", "region", "language"] as const).map((key) => (
            <Label key={key} className="space-y-2">
              <span className="capitalize">{key}</span>
              <Input
                aria-label={`Party ${key}`}
                maxLength={key === "title" ? 120 : key === "game" ? 80 : 40}
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
              />
            </Label>
          ))}
        </div>
        <Textarea
          aria-label="Party description"
          maxLength={4000}
          value={value.description}
          placeholder="What will you play? Any requirements?"
          onChange={(e) => setValue({ ...value, description: e.target.value })}
        />
        <Label className="space-y-2">
          <span>Party size</span>
          <Input
            aria-label="Party size"
            type="number"
            min={2}
            max={50}
            value={value.capacity}
            onChange={(e) =>
              setValue({ ...value, capacity: Number(e.target.value) })
            }
          />
        </Label>
        <TimeFields
          value={time}
          onChange={setTime}
          timezone={timezone}
          onTimezone={setTimezone}
        />
        <Input
          aria-label="Party invitation link"
          maxLength={1000}
          value={value.inviteUrl}
          placeholder="HTTPS invitation link (optional)"
          onChange={(e) => setValue({ ...value, inviteUrl: e.target.value })}
        />
        <Button
          disabled={busy || !value.game || !value.title || !value.region}
          onClick={async () => {
            setBusy(true);
            try {
              await create({
                ...value,
                serverId,
                timezone,
                startsAt: zonedInstant(time, timezone),
              });
              onClose();
              toast.success("Party published.");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not host party.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Publish party
        </Button>
      </DialogContent>
    </Dialog>
  );
}
