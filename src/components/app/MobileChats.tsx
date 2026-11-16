import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import {
  Search,
  MessageCircle,
  ArrowRight as ArrowUpRight,
  Users,
} from "@/components/icons";
import { UserAvatar } from "./UserAvatar";
import { StyledDisplayName } from "./StyledDisplayName";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

/** A full-width conversation list instead of the desktop channel sidebar. */
export function MobileChatsView() {
  const conversations = useQuery(api.conversations.list);
  const social = useQuery(api.social.list);
  const me = useQuery(api.users.me);
  const [term, setTerm] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const online = (social?.friends ?? []).filter((user) =>
    ["online", "idle"].includes(user.presence),
  );
  const labelFor = (conversation: NonNullable<typeof conversations>[number]) =>
    (conversation.name ??
      conversation.participants
        .filter((user) => user.id !== me?.id)
        .map((user) => user.name)
        .join(", ")) ||
    "Group chat";
  const rows = (conversations ?? []).filter(
    (conversation) =>
      (!unreadOnly || conversation.unread) &&
      labelFor(conversation).toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <div className="mobile-chats h-full overflow-y-auto px-4 pb-5 pt-5 sm:px-7">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">
              Pick up where you left off
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              Messages<span className="text-primary">.</span>
            </h1>
          </div>
          <Link
            to="/dashboard?tab=add"
            aria-label="Start a conversation"
            className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15"
          >
            <ArrowUpRight className="size-5" />
          </Link>
        </div>
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search mobile messages"
            placeholder="Find a conversation"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-12 rounded-2xl border-border/60 bg-panel pl-11 text-sm"
          />
        </div>
        {online.length > 0 && (
          <section aria-label="Friends around now" className="mb-6">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">
                Around now
              </span>
              <Link to="/dashboard" className="font-semibold text-primary">
                See friends
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {online.slice(0, 10).map((friend) => (
                <Link
                  key={friend.id}
                  to={`/dashboard?previewUser=${friend.id}`}
                  className="flex w-16 shrink-0 flex-col items-center gap-2"
                >
                  <span className="rounded-full border border-primary/25 p-1">
                    <UserAvatar user={friend} size="md" showStatus />
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-medium">
                    {friend.name.split(" ")[0]}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <div
          aria-label="Mobile message filters"
          role="group"
          className="mb-3 flex gap-2"
        >
          {[
            { label: "All messages", unread: false },
            { label: "Unread", unread: true },
          ].map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-pressed={unreadOnly === filter.unread}
              onClick={() => setUnreadOnly(filter.unread)}
              className={cn(
                "min-h-11 rounded-full px-4 text-xs font-semibold",
                unreadOnly === filter.unread
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rows.map((conversation) => {
            const other = conversation.participants.find(
              (user) => user.id !== me?.id,
            );
            const label = labelFor(conversation);
            return (
              <Link
                key={conversation.id}
                to={`/dashboard/dm/${conversation.id}`}
                className="flex min-h-[88px] items-center gap-3 rounded-[22px] border border-border/45 bg-panel/70 p-3.5 transition-colors active:bg-primary/10"
              >
                <UserAvatar
                  user={{
                    id: other?.id ?? conversation.id,
                    name: label,
                    avatarUrl:
                      conversation.type === "dm" ? other?.avatarUrl : null,
                    presence: other?.presence,
                  }}
                  size="md"
                  showStatus={conversation.type === "dm"}
                />
                <span className="min-w-0 flex-1">
                  {conversation.type === "dm" && other ? (
                    <StyledDisplayName
                      user={other}
                      className="block truncate text-sm font-semibold"
                    />
                  ) : (
                    <span className="block truncate text-sm font-semibold">
                      {label}
                    </span>
                  )}
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {conversation.lastMessagePreview ?? "Say hello"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  {conversation.lastMessageAt > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(conversation.lastMessageAt)}
                    </span>
                  )}
                  {conversation.unread && (
                    <span
                      aria-label="Unread message"
                      className="size-2.5 rounded-full bg-primary"
                    />
                  )}
                </span>
              </Link>
            );
          })}
          {conversations === undefined ? (
            <p
              role="status"
              className="p-6 text-center text-sm text-muted-foreground"
            >
              Loading your conversations…
            </p>
          ) : (
            rows.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center">
                <MessageCircle className="mx-auto mb-3 size-8 text-primary" />
                <p className="text-sm font-semibold">
                  {term
                    ? "No conversations found"
                    : unreadOnly
                      ? "You're all caught up"
                      : "Start with a hello"}
                </p>
                <Link
                  to="/dashboard?tab=add"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
                >
                  <Users className="size-4" /> Find your people
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
