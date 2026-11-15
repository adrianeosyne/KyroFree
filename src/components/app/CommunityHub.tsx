import { useNow } from "@/hooks/use-now";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
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
import { hasPremium } from "@/lib/entitlements";
import { toast } from "sonner";

export function CommunityHubDialog({
  serverId,
  section,
  onClose,
}: {
  serverId: string;
  section: "events" | "tickets";
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {section === "events" ? "Community events" : "Support tickets"}
          </DialogTitle>
          <DialogDescription>
            {section === "events"
              ? "Find your next gaming session or community meetup."
              : "A private conversation with your server's moderation team."}
          </DialogDescription>
        </DialogHeader>
        {section === "events" ? (
          <CommunityEvents serverId={serverId} />
        ) : (
          <CommunityTickets serverId={serverId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
export function CommunityEvents({
  serverId,
  manage = false,
}: {
  serverId: string;
  manage?: boolean;
}) {
  const now = useNow();
  const args = { serverId: serverId as Id<"servers"> };
  const events = useQuery(api.communityHub.events, args);
  const supporters = useQuery(api.communityHub.supporters, args);
  const me = useQuery(api.users.me);
  const create = useMutation(api.communityHub.createEvent);
  const cancel = useMutation(api.communityHub.cancelEvent);
  const rsvp = useMutation(api.communityHub.rsvp);
  const charge = useMutation(api.communityHub.supercharge);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [capacity, setCapacity] = useState(50);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const perform = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-panel p-5">
        <h2 className="text-xl font-bold">Find your next party.</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Community events, game nights and creative sessions.
        </p>
        {!!supporters?.length && (
          <p className="mt-3 text-xs text-fuchsia-300">
            Supercharged by {supporters.map((p) => p.name).join(", ")}
          </p>
        )}
        {hasPremium(me) && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await charge(args);
                toast.success("You're featured as a supporter of this server.");
              })
            }
          >
            Supercharge this community
          </Button>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          Premium members can feature one community on the supporter board.
        </p>
      </section>
      {manage && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold">Schedule an event</h3>
          <Input
            aria-label="Event title"
            placeholder="Game night, tournament, watch party…"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            aria-label="Event description"
            placeholder="What should members know?"
            value={description}
            maxLength={1500}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            aria-label="Event location"
            placeholder="Voice channel or meeting location"
            value={location}
            maxLength={120}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              Starts (your local time)
              <Input
                aria-label="Event start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="text-xs">
              Ends (your local time)
              <Input
                aria-label="Event end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs">
            Capacity
            <Input
              aria-label="Event capacity"
              type="number"
              min={2}
              max={1000}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
          <Button
            disabled={busy || title.trim().length < 3 || !start || !end}
            onClick={() =>
              void perform(async () => {
                await create({
                  ...args,
                  title,
                  description,
                  location,
                  startsAt: new Date(start).getTime(),
                  endsAt: new Date(end).getTime(),
                  capacity,
                });
                setTitle("");
                setDescription("");
                toast.success("Event scheduled.");
              })
            }
          >
            Create event
          </Button>
        </section>
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={showPast}
          onChange={(e) => setShowPast(e.target.checked)}
        />
        Show past and cancelled events
      </label>
      {events === undefined ? (
        <p role="status">Loading events…</p>
      ) : (
        events
          .filter((e) => showPast || (!e.cancelled && e.endsAt > now))
          .sort((a, b) => a.startsAt - b.startsAt)
          .map((event) => (
            <section
              key={event._id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary/15 p-3 text-center text-xs font-bold text-primary">
                  {new Date(event.startsAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(event.startsAt).toLocaleString()} ·{" "}
                    {event.location || "Community meetup"}
                  </p>
                  <p className="mt-2 text-sm">{event.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {event.attendeeCount} / {event.capacity} attending
                    {event.cancelled ? " · Cancelled" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {!event.cancelled && event.endsAt > now && (
                  <Button
                    size="sm"
                    disabled={busy}
                    variant={event.attending ? "outline" : "default"}
                    onClick={() =>
                      void perform(() =>
                        rsvp({ id: event._id, attending: !event.attending }),
                      )
                    }
                  >
                    {event.attending ? "Cancel RSVP" : "Join event"}
                  </Button>
                )}
                {manage && !event.cancelled && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void perform(() => cancel({ id: event._id }))
                    }
                  >
                    Cancel event
                  </Button>
                )}
              </div>
            </section>
          ))
      )}
      {events?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No events yet. Your next community gathering can start here.
        </p>
      )}
    </div>
  );
}
export function CommunityTickets({
  serverId,
  manage = false,
}: {
  serverId: string;
  manage?: boolean;
}) {
  const args = { serverId: serverId as Id<"servers"> };
  const tickets = useQuery(api.communityHub.tickets, args);
  const create = useMutation(api.communityHub.openTicket);
  const reply = useMutation(api.communityHub.reply);
  const status = useMutation(api.communityHub.setTicketStatus);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<"help" | "report" | "idea">("help");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("active");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const perform = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Open a private ticket</h2>
        <p className="text-xs text-muted-foreground">
          Only you and authorized server staff can read this conversation.
        </p>
        <Input
          aria-label="Ticket title"
          placeholder="How can we help?"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          aria-label="Ticket details"
          placeholder="Describe the question, report or idea"
          maxLength={2000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <select
          aria-label="Ticket category"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="rounded-lg border border-border bg-panel p-2 text-sm"
        >
          <option value="help">Help</option>
          <option value="report">Report</option>
          <option value="idea">Suggestion</option>
        </select>
        <Button
          disabled={
            busy || title.trim().length < 3 || details.trim().length < 10
          }
          onClick={() =>
            void perform(async () => {
              await create({ ...args, title, details, category });
              setTitle("");
              setDetails("");
              toast.success("Ticket opened.");
            })
          }
        >
          Submit ticket
        </Button>
      </section>
      <select
        aria-label="Ticket status filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="rounded-lg border border-border bg-panel p-2 text-sm"
      >
        <option value="active">Active tickets</option>
        <option value="closed">Closed tickets</option>
        <option value="all">All tickets</option>
      </select>
      {tickets
        ?.filter(
          (t) =>
            filter === "all" ||
            (filter === "active"
              ? t.status !== "closed"
              : t.status === "closed"),
        )
        .map((ticket) => (
          <section
            key={ticket._id}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <h3 className="font-semibold">{ticket.title}</h3>
            <p className="mt-1 text-xs capitalize text-primary">
              {ticket.category} · {ticket.status.replace(/_/g, " ")}
              {ticket.assignedTo ? " · Assigned" : ""}
            </p>
            <p className="my-3 whitespace-pre-wrap text-sm">{ticket.details}</p>
            {ticket.responses.map((r, i) => (
              <div key={i} className="mb-2 rounded-xl bg-panel p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">
                  {r.name} · {new Date(r.at).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{r.text}</p>
              </div>
            ))}
            {ticket.status !== "closed" && (
              <div className="mt-3 flex gap-2">
                <Input
                  aria-label={`Reply to ${ticket.title}`}
                  maxLength={1500}
                  placeholder="Write a reply"
                  value={responses[ticket._id] ?? ""}
                  onChange={(e) =>
                    setResponses({ ...responses, [ticket._id]: e.target.value })
                  }
                />
                <Button
                  disabled={busy || !responses[ticket._id]?.trim()}
                  onClick={() =>
                    void perform(async () => {
                      await reply({
                        id: ticket._id,
                        text: responses[ticket._id],
                      });
                      setResponses({ ...responses, [ticket._id]: "" });
                    })
                  }
                >
                  Reply
                </Button>
              </div>
            )}
            {manage && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["open", "in_progress", "closed"] as const).map((next) => (
                  <Button
                    key={next}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void perform(() =>
                        status({
                          id: ticket._id,
                          status: next,
                          claim: next === "in_progress",
                        }),
                      )
                    }
                  >
                    {next === "in_progress"
                      ? "Claim & work"
                      : next === "closed"
                        ? "Close ticket"
                        : "Reopen"}
                  </Button>
                ))}
              </div>
            )}
          </section>
        ))}
      {tickets === undefined && <p role="status">Loading tickets…</p>}
      {tickets?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Your tickets will appear here.
        </p>
      )}
    </div>
  );
}
