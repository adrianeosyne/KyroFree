import { useMutation, useQuery } from "convex/react";
import { useState, useReducer } from "react";
import { Link } from "react-router";
import { Reorder, useDragControls } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import {
  LOBBY_SECTION_TYPES,
  LOBBY_THEMES,
  type LobbyConfig,
  type LobbySection,
} from "@/lib/lobby";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "./UserAvatar";
import { StyledDisplayName } from "./StyledDisplayName";
import { toast } from "sonner";
type LobbyEdits = {
  draft: LobbyConfig | null;
  past: LobbyConfig[];
  future: LobbyConfig[];
};
type LobbyEditAction =
  | { type: "change"; current: LobbyConfig; patch: Partial<LobbyConfig> }
  | { type: "undo" | "redo" | "reset" };
const EMPTY_EDITS: LobbyEdits = { draft: null, past: [], future: [] };
function editHistory(state: LobbyEdits, action: LobbyEditAction): LobbyEdits {
  if (action.type === "reset") return EMPTY_EDITS;
  if (action.type === "change")
    return {
      draft: { ...action.current, ...action.patch },
      past: [...state.past, action.current].slice(-50),
      future: [],
    };
  if (action.type === "undo" && state.past.length && state.draft)
    return {
      draft: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.draft, ...state.future],
    };
  if (action.type === "redo" && state.future.length && state.draft)
    return {
      draft: state.future[0],
      past: [...state.past, state.draft].slice(-50),
      future: state.future.slice(1),
    };
  return state;
}
type LobbyData = FunctionReturnType<typeof api.lobby.get>;
function SectionContent({
  section,
  config,
  data,
}: {
  section: LobbySection;
  config: LobbyConfig;
  data: LobbyData;
}) {
  if (section.type === "buttons")
    return (
      <div className="flex flex-wrap gap-2">
        {config.buttons.length ? (
          config.buttons.map((button) => (
            <a
              key={button.id}
              href={button.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold"
              style={{ background: config.accent, color: "#11121c" }}
            >
              {button.label} ↗
            </a>
          ))
        ) : (
          <p className="text-sm text-white/60">
            The owner can add links to channels, events and community resources.
          </p>
        )}
      </div>
    );
  if (["levels", "messages", "invites"].includes(section.type)) {
    const board = data.boards[section.type as keyof typeof data.boards];
    return (
      <ol className="space-y-3">
        {board.length ? (
          board.map(
            (entry, index) =>
              entry.user && (
                <li
                  key={entry.user.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 p-3"
                >
                  <span className="text-xs text-white/50">#{index + 1}</span>
                  <UserAvatar user={entry.user} size="xs" />
                  <StyledDisplayName
                    user={entry.user}
                    className="min-w-0 flex-1 truncate text-sm"
                  />
                  <strong className="text-sm" style={{ color: config.accent }}>
                    {entry.value}
                    {section.type === "levels" ? " LVL" : ""}
                  </strong>
                </li>
              ),
          )
        ) : (
          <li className="text-sm text-white/60">
            No activity yet. New messages and successful invites build this
            board.
          </li>
        )}
      </ol>
    );
  }
  if (section.type === "feed")
    return (
      <div className="space-y-3">
        {data.feed.length ? (
          data.feed.map((post) => (
            <article
              key={post._id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <p className="text-xs text-white/50">
                {post.source} · {new Date(post.createdAt).toLocaleDateString()}
              </p>
              <h4 className="mt-2 font-bold">{post.title}</h4>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/70">
                {post.text}
              </p>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm underline"
                  style={{ color: config.accent }}
                >
                  Open update ↗
                </a>
              )}
            </article>
          ))
        ) : (
          <p className="text-sm text-white/60">
            YouTube uploads, stream alerts and community updates appear here
            when an app posts to this lobby's feed.
          </p>
        )}
      </div>
    );
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/75">
      {section.text ||
        (section.type === "rules" ? data.rules : "Welcome to the community.") ||
        "Treat people with care and follow the community's rules."}
    </p>
  );
}
function EditableSection({
  section,
  config,
  data,
  onChange,
  move,
  remove,
  duplicate,
}: {
  section: LobbySection;
  config: LobbyConfig;
  data: LobbyData;
  onChange: (section: LobbySection) => void;
  move: (direction: number) => void;
  remove: () => void;
  duplicate?: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      className="list-none rounded-2xl border border-white/15 p-5"
      style={{ background: config.panel }}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={`Drag ${section.title} section`}
          onPointerDown={(e) => controls.start(e)}
          className="touch-none rounded-lg border border-white/20 px-3 py-1 text-sm"
        >
          ⠿ Drag
        </button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => move(-1)}
          aria-label={`Move ${section.title} up`}
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => move(1)}
          aria-label={`Move ${section.title} down`}
        >
          ↓
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!duplicate}
          onClick={duplicate}
          aria-label={`Duplicate ${section.title} section`}
        >
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={remove}
          aria-label={`Remove ${section.title} section`}
        >
          Remove
        </Button>
      </div>
      <label className="mb-3 block text-xs">
        Section title
        <Input
          aria-label={`Title for ${section.id}`}
          value={section.title}
          maxLength={80}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          className="mt-1"
        />
      </label>
      {["welcome", "rules"].includes(section.type) && (
        <label className="mb-4 block text-xs">
          Section text
          <textarea
            aria-label={`Text for ${section.id}`}
            value={section.text ?? ""}
            maxLength={4000}
            onChange={(e) => onChange({ ...section, text: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm"
          />
        </label>
      )}
      <SectionContent section={section} config={config} data={data} />
    </Reorder.Item>
  );
}
export function ServerLobby(props: { serverId: string; studio?: boolean }) {
  return <LobbyEditor key={props.serverId} {...props} />;
}
function LobbyEditor({
  serverId,
  studio = false,
}: {
  serverId: string;
  studio?: boolean;
}) {
  const id = serverId as Id<"servers">,
    data = useQuery(api.lobby.get, { serverId: id }),
    channels = useQuery(api.channels.list, { serverId: id });
  const save = useMutation(api.lobby.save),
    rotate = useMutation(api.lobby.rotateFeedToken);
  const [edits, dispatch] = useReducer(editHistory, EMPTY_EDITS);
  const [edit, setEdit] = useState(studio),
    [busy, setBusy] = useState(false),
    [sectionType, setSectionType] = useState("welcome"),
    [feedToken, setFeedToken] = useState(""),
    [endpoint, setEndpoint] = useState("");
  if (!data)
    return (
      <p role="status" className="p-6">
        Opening the lobby…
      </p>
    );
  const config = edits.draft ?? data.config;
  const dirty = JSON.stringify(config) !== JSON.stringify(data.config);
  const editing = edit && data.isOwner;
  const first =
    channels?.channels.find((c) => c.kind === "text") ?? channels?.channels[0];
  const chat = first
    ? `/dashboard/s/${serverId}/${first.kind === "voice" ? "v" : first.kind === "forum" ? "f" : "c"}/${first.id}`
    : null;
  const change = (patch: Partial<LobbyConfig>) => {
    if (!busy) dispatch({ type: "change", current: config, patch });
  };
  const move = (index: number, direction: number) => {
    const sections = [...config.sections],
      next = index + direction;
    if (next < 0 || next >= sections.length) return;
    [sections[index], sections[next]] = [sections[next], sections[index]];
    change({ sections });
  };
  return (
    <div
      className="h-full overflow-y-auto p-4 text-white md:p-8"
      style={{ background: config.background }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className="text-xs font-bold uppercase tracking-[.2em]"
            style={{ color: config.accent }}
          >
            {data.serverName} · Lobby
          </p>
          <div className="flex gap-2">
            {chat && (
              <Link
                to={chat}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold"
              >
                Enter chat →
              </Link>
            )}
            {data.isOwner && (
              <Button variant="outline" onClick={() => setEdit(!edit)}>
                {editing ? "View lobby" : "Edit lobby"}
              </Button>
            )}
          </div>
        </div>
        {!config.enabled && !editing && (
          <p className="rounded-xl border border-white/10 p-4 text-sm">
            The lobby is currently off. Continue to chat to meet the community.
          </p>
        )}
        <header className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 to-transparent p-7 md:p-10">
          <p className="text-xs uppercase tracking-widest text-white/50">
            Your people. Your place.
          </p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">
            {config.title}
          </h1>
          <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-white/70">
            {config.intro}
          </p>
        </header>
        {editing && (
          <section
            className="space-y-4 rounded-2xl border border-white/15 p-5"
            style={{ background: config.panel }}
          >
            <h2 className="text-xl font-bold">Lobby studio</h2>
            <p className="text-sm text-white/60">
              Drag a section by its handle, or use its arrow buttons on a phone
              or keyboard. Your changes go live when you save.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={busy || !edits.past.length}
                onClick={() => dispatch({ type: "undo" })}
              >
                Undo lobby change
              </Button>
              <Button
                variant="outline"
                disabled={busy || !edits.future.length}
                onClick={() => dispatch({ type: "redo" })}
              >
                Redo lobby change
              </Button>
              <p role="status" className="text-xs text-white/60">
                {dirty ? "Unsaved changes" : "All changes saved."}
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Theme presets</h3>
              <div className="flex flex-wrap gap-2">
                {LOBBY_THEMES.map((theme) => (
                  <Button
                    key={theme.name}
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    aria-label={`Apply ${theme.name} lobby theme`}
                    onClick={() =>
                      change({
                        background: theme.background,
                        panel: theme.panel,
                        accent: theme.accent,
                      })
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-full"
                      style={{ background: theme.accent }}
                    />
                    {theme.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-white/60">
                Presets change your colors. Your sections, text and links stay
                in place.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                aria-label="Enable server lobby"
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => change({ enabled: e.target.checked })}
              />{" "}
              Open this lobby when members join or open the server
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs">
                Lobby title
                <Input
                  aria-label="Lobby title"
                  maxLength={80}
                  value={config.title}
                  onChange={(e) => change({ title: e.target.value })}
                />
              </label>
              <label className="text-xs">
                Layout
                <select
                  aria-label="Lobby layout"
                  value={config.layout}
                  onChange={(e) => change({ layout: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2"
                >
                  <option value="columns">Two columns</option>
                  <option value="stacked">One column</option>
                  <option value="spotlight">Spotlight</option>
                </select>
              </label>
            </div>
            <label className="block text-xs">
              Welcome introduction
              <textarea
                aria-label="Lobby introduction"
                value={config.intro}
                maxLength={1000}
                onChange={(e) => change({ intro: e.target.value })}
                className="mt-1 w-full rounded-lg border border-input bg-background p-3"
              />
            </label>
            <div className="flex flex-wrap gap-5">
              {(["background", "panel", "accent"] as const).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-xs capitalize"
                >
                  {key}
                  <input
                    aria-label={`Lobby ${key} color`}
                    type="color"
                    value={config[key]}
                    onChange={(e) => change({ [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                aria-label="New lobby section type"
                value={sectionType}
                onChange={(e) => setSectionType(e.target.value)}
                className="rounded-lg border border-input bg-background p-2"
              >
                {LOBBY_SECTION_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={config.sections.length >= 12}
                onClick={() =>
                  change({
                    sections: [
                      ...config.sections,
                      {
                        id: crypto.randomUUID(),
                        type: sectionType,
                        title:
                          sectionType[0].toUpperCase() + sectionType.slice(1),
                      },
                    ],
                  })
                }
              >
                Add section
              </Button>
            </div>
            <h3 className="font-semibold">Community buttons</h3>
            {config.buttons.map((button, index) => (
              <div
                key={button.id}
                className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
              >
                <Input
                  aria-label={`Button ${index + 1} label`}
                  value={button.label}
                  maxLength={48}
                  placeholder="Button label"
                  onChange={(e) =>
                    change({
                      buttons: config.buttons.map((b) =>
                        b.id === button.id
                          ? { ...b, label: e.target.value }
                          : b,
                      ),
                    })
                  }
                />
                <Input
                  aria-label={`Button ${index + 1} link`}
                  value={button.url}
                  maxLength={512}
                  placeholder="https://…"
                  onChange={(e) =>
                    change({
                      buttons: config.buttons.map((b) =>
                        b.id === button.id ? { ...b, url: e.target.value } : b,
                      ),
                    })
                  }
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    change({
                      buttons: config.buttons.filter((b) => b.id !== button.id),
                    })
                  }
                >
                  Remove button
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              disabled={config.buttons.length >= 8}
              onClick={() =>
                change({
                  buttons: [
                    ...config.buttons,
                    { id: crypto.randomUUID(), label: "", url: "" },
                  ],
                })
              }
            >
              Add button
            </Button>
            <div className="flex gap-3">
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const {
                      enabled,
                      title,
                      intro,
                      layout,
                      background,
                      panel,
                      accent,
                      sections,
                      buttons,
                    } = config;
                    await save({
                      serverId: id,
                      config: {
                        enabled,
                        title,
                        intro,
                        layout,
                        background,
                        panel,
                        accent,
                        sections,
                        buttons,
                      },
                    });
                    dispatch({ type: "reset" });
                    toast.success("Lobby saved.");
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Could not save lobby.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save lobby
              </Button>
              <Button
                variant="outline"
                disabled={busy || !dirty}
                onClick={() => dispatch({ type: "reset" })}
              >
                Discard changes
              </Button>
            </div>
            <h3 className="pt-3 font-semibold">App feed</h3>
            <p className="text-xs text-white/60">
              Let an outside app post YouTube uploads or stream alerts into the
              feed using a private webhook token. Creating a new token
              invalidates the previous one. Keep tokens in your app's server
              settings.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await rotate({ serverId: id });
                    setFeedToken(result.token ?? "");
                    setEndpoint(result.endpoint);
                    toast.success("Feed token created. Copy it now.");
                  } catch (e) {
                    toast.error(
                      e instanceof Error
                        ? e.message
                        : "Could not create feed token.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {data.feedConnected ? "Rotate feed token" : "Create feed token"}
              </Button>
              {data.feedConnected && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await rotate({ serverId: id, disable: true });
                      setFeedToken("");
                      toast.success("App feed disconnected.");
                    } catch (e) {
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : "Could not disconnect feed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Disconnect feed
                </Button>
              )}
            </div>
            {feedToken && (
              <div className="space-y-2 rounded-xl border border-white/15 p-4">
                <label className="block text-xs">
                  Webhook endpoint
                  <Input
                    aria-label="Lobby feed endpoint"
                    value={endpoint}
                    readOnly
                  />
                </label>
                <label className="block text-xs">
                  Private feed token
                  <Input
                    aria-label="Lobby feed token"
                    value={feedToken}
                    readOnly
                  />
                </label>
                <p className="text-xs text-white/60">
                  POST JSON with title, text, source, clientId, and optional
                  url. Send Authorization: Bearer followed by this token.
                </p>
              </div>
            )}
          </section>
        )}
        {editing ? (
          <Reorder.Group
            axis="y"
            values={config.sections}
            onReorder={(sections) => change({ sections })}
            className="space-y-4"
          >
            {config.sections.map((section, index) => (
              <EditableSection
                key={section.id}
                section={section}
                config={config}
                data={data}
                onChange={(updated) =>
                  change({
                    sections: config.sections.map((s) =>
                      s.id === updated.id ? updated : s,
                    ),
                  })
                }
                duplicate={
                  config.sections.length >= 12
                    ? undefined
                    : () =>
                        change({
                          sections: [
                            ...config.sections.slice(0, index + 1),
                            {
                              ...section,
                              id: crypto.randomUUID(),
                              title: `${section.title.slice(0, 75)} copy`,
                            },
                            ...config.sections.slice(index + 1),
                          ],
                        })
                }
                move={(direction) => move(index, direction)}
                remove={() =>
                  change({
                    sections: config.sections.filter(
                      (s) => s.id !== section.id,
                    ),
                  })
                }
              />
            ))}
          </Reorder.Group>
        ) : (
          <div
            className={`grid gap-5 ${config.layout !== "stacked" ? "md:grid-cols-2" : ""}`}
          >
            {config.sections.map((section, index) => (
              <section
                key={section.id}
                className={`min-w-0 rounded-2xl border border-white/10 p-5 ${config.layout === "spotlight" && index === 0 ? "md:col-span-2" : ""}`}
                style={{ background: config.panel }}
              >
                <h2 className="mb-4 text-lg font-bold">{section.title}</h2>
                <SectionContent section={section} config={config} data={data} />
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export function ShardsBoard() {
  const rows = useQuery(api.activity.topPlayers);
  return (
    <div className="h-full overflow-y-auto p-5 md:p-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
          Shards · Community levels
        </p>
        <h1 className="mt-3 text-3xl font-black">The top 50</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Join conversations and build your level. Human messages earn 10 XP at
          most once per minute. These points have no cash value.
        </p>
        <ol className="mt-6 space-y-3">
          {rows?.map(
            (entry) =>
              entry.user && (
                <li
                  key={entry.user.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-panel p-4"
                >
                  <span className="text-sm text-muted-foreground">
                    #{entry.rank}
                  </span>
                  <UserAvatar user={entry.user} size="sm" />
                  <StyledDisplayName
                    user={entry.user}
                    className="min-w-0 flex-1 truncate"
                  />
                  <div className="text-right">
                    <strong className="text-primary">
                      Level {entry.level}
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      {entry.xp} XP
                    </p>
                  </div>
                </li>
              ),
          )}
        </ol>
        {rows === undefined ? (
          <p role="status" className="mt-6">
            Loading the level board…
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-panel p-5 text-sm text-muted-foreground">
            The board starts with new activity. Send a message in a server to
            join it.
          </p>
        ) : null}
      </div>
    </div>
  );
}
