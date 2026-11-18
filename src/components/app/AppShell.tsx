import { WorkspaceAppearance } from "./WorkspaceStudio";
import { AttentionRuntime } from "./AttentionSettings";
import { useQuery } from "convex/react";
import {
  Bell,
  Home,
  Menu,
  Search,
  User,
  MessageCircle,
} from "@/components/icons";
import { AppLoading } from "@/components/AppLoading";
import { useEffect, useRef, type ReactNode } from "react";
import {
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams,
} from "react-router";
import { api } from "@/convex/_generated/api";
import { ClaimUsername } from "@/components/app/ClaimUsername";
import { Inbox } from "@/components/app/Inbox";
import { ProfileCard } from "@/components/app/ProfileCard";
import { PremiumGiftNotice } from "@/components/app/PremiumGiftNotice";
import { UserPreviewPanel } from "@/components/app/UserPreviewPanel";
import { SearchOverlay } from "@/components/app/SearchOverlay";
import { ServerRail } from "@/components/app/ServerRail";
import { SettingsDialog } from "@/components/app/Settings";
import { Sidebar } from "@/components/app/Sidebar";
import { IncomingCallBanner } from "@/components/app/Voice";
import { ConnectionBanner } from "@/components/app/ConnectionBanner";
import { PremiumExpiryBanner } from "@/components/app/PremiumExpiryBanner";
import { QuickAppearance } from "@/components/app/QuickAppearance";
import { MobileDownloadBanner } from "@/components/app/MobileDownloadBanner";
import { UserAvatar } from "@/components/app/UserAvatar";
import { KyroMark } from "@/components/KyroMark";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useUiStore } from "@/lib/store";
import { playNotificationPing, setNotificationSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * The application frame: community rail, channel sidebar and the routed
 * conversation area, keyboard shortcuts, search, the inbox and user settings.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const privacyStatus = useQuery(api.privacyControls.status, isAuthenticated ? {} : "skip");
  const unread = useQuery(
    api.notifications.unreadCount,
    isAuthenticated ? {} : "skip",
  );
  const mentionSummary = useQuery(
    api.notifications.mentionSummary,
    isAuthenticated ? {} : "skip",
  );
  const mentionCount = mentionSummary?.count;
  useEffect(() => {
    setNotificationSound(me?.notificationSoundUrl ?? null);
    return () => setNotificationSound(null);
  }, [me?.notificationSoundUrl]);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    mobileNavOpen,
    setMobileNav,
    searchOpen,
    setSearchOpen,
    inboxOpen,
    setInboxOpen,
  } = useUiStore();

  const channelMatch = useMatch("/dashboard/s/:serverId/c/:channelId");
  const voiceMatch = useMatch("/dashboard/s/:serverId/v/:channelId");
  const forumMatch = useMatch("/dashboard/s/:serverId/f/:channelId");
  const serverSettingsMatch = useMatch("/dashboard/s/:serverId/settings/*");
  const lobbyMatch = useMatch("/dashboard/s/:serverId/lobby");
  const serverMatch = useMatch("/dashboard/s/:serverId");
  const serverToolsMatch = useMatch("/dashboard/s/:serverId/*");
  const activeServerId =
    channelMatch?.params.serverId ??
    voiceMatch?.params.serverId ??
    forumMatch?.params.serverId ??
    serverSettingsMatch?.params.serverId ??
    lobbyMatch?.params.serverId ??
    serverMatch?.params.serverId ??
    serverToolsMatch?.params.serverId;
  const settingsOpen = searchParams.get("settings") !== null;
  const isConversationView =
    Boolean(channelMatch) || location.pathname.startsWith("/dashboard/dm/");

  // Mention ping: only direct mentions/replies make a sound. Unlike the old
  // unread counter this also works while the tab is visible, Discord-style.
  const previousMentionEvent = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (mentionSummary === undefined) return;
    const latest = mentionSummary.latestCreationTime;
    const previous = previousMentionEvent.current;
    previousMentionEvent.current = latest;
    if (
      previous !== undefined &&
      latest !== null &&
      (previous === null || latest > previous) &&
      useUiStore.getState().notificationSounds
    ) {
      playNotificationPing();
    }
  }, [mentionSummary]);

  // Browser tab title mirrors unread mentions only, Discord-style: "(6) Kyro".
  // Ordinary unread DMs and system notes deliberately stay out of the count.
  useEffect(() => {
    document.title =
      mentionCount !== undefined && mentionCount > 0
        ? `(${mentionCount}) Kyro`
        : "Kyro";
  }, [mentionCount]);

  // Global shortcuts: ⌘K opens search, Esc closes overlays.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(!useUiStore.getState().searchOpen);
      }
      if (event.key === "Escape") {
        const state = useUiStore.getState();
        state.setSearchOpen(false);
        state.setInboxOpen(false);
        state.setMobileNav(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSearchOpen]);

  // A selected destination should be visible immediately on phones.
  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname, location.search, setMobileNav]);

  if (isLoading || !user) {
    return <AppLoading label="Opening your space" />;
  }

  // Onboarding gate: Kyro needs a unique handle before you can talk.
  if (me && !me.hasUsername) return <ClaimUsername />;

  const openSettings = () => {
    const next = new URLSearchParams(searchParams);
    next.set("settings", "1");
    setSearchParams(next, { replace: false });
  };

  const rail = <ServerRail activeServerId={activeServerId} />;
  const sidebar = (
    <Sidebar activeServerId={activeServerId} onOpenSettings={openSettings} />
  );
  const desktopTitle = location.pathname.startsWith("/dashboard/admin")
    ? "Admin Portal"
    : location.pathname.startsWith("/dashboard/discover")
      ? "Discover"
      : location.pathname.startsWith("/dashboard/developers")
        ? "Developer portal"
        : location.pathname.startsWith("/dashboard/bots")
          ? "Bot directory"
          : location.pathname === "/dashboard/chats"
            ? "Messages"
            : location.pathname === "/dashboard"
              ? "Friends"
              : activeServerId
                ? "Community"
                : "Direct Messages";

  return (
    <div className="kyro-app-shell flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="hidden h-14 shrink-0 items-center gap-5 border-b border-border/70 bg-rail px-5 md:flex">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          aria-label="Kyro home"
          className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight"
        >
          <KyroMark className="size-7" /> kyro
          <span className="text-primary">.</span>
        </button>
        <span className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">{desktopTitle}</span>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mx-auto flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="Search Kyro"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Find your next conversation</span>
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">
            Ctrl K
          </kbd>
        </button>
        <span className="hidden text-[10px] font-medium tracking-[.16em] text-muted-foreground xl:block">
          YOUR PEOPLE. YOUR PLACE.
        </span>
        <QuickAppearance />
        <button
          type="button"
          aria-label="Inbox"
          title="Inbox"
          onClick={() => setInboxOpen(!inboxOpen)}
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <Bell className="size-4" />
          {(unread ?? 0) > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
          ) : null}
        </button>
      </div>
      <WorkspaceAppearance />
      <AttentionRuntime />
      <ConnectionBanner />
      <PremiumExpiryBanner premiumUntil={me?.premiumUntil} />
      <div className="flex min-h-0 flex-1">
        <div className="hidden md:flex">{rail}</div>
        <div className="hidden md:flex">{sidebar}</div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "mobile-app-header h-16 shrink-0 items-center gap-3 px-4 md:hidden",
              isConversationView ? "hidden" : "flex",
            )}
          >
            <button
              type="button"
              aria-label="Open navigation"
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border/60 bg-panel text-muted-foreground active:bg-primary/10"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="size-5" />
            </button>

            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
                <KyroMark className="size-5" /> kyro
                <span className="text-primary">.</span>
              </span>
              <p className="truncate text-[10px] font-medium text-muted-foreground">
                {desktopTitle}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <QuickAppearance />
              <button
                type="button"
                aria-label="Search Kyro"
                onClick={() => setSearchOpen(true)}
                className="grid size-11 place-items-center rounded-2xl text-muted-foreground active:bg-panel"
              >
                <Search className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Inbox"
                onClick={() => setInboxOpen(!inboxOpen)}
                className="relative grid size-11 place-items-center rounded-2xl text-muted-foreground active:bg-panel"
              >
                <Bell className="size-5" />
                {(unread ?? 0) > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unread! > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </div>
          </header>
          <MobileDownloadBanner />

          <main className="min-h-0 flex-1 bg-background">
            <div
              key={location.pathname}
              className="kyro-view-enter h-full min-h-0"
            >
              {privacyStatus?.frozen && <div role="status" className="border-b bg-muted px-4 py-2 text-xs">Your account is frozen. Open Settings → Security to unfreeze with your password.</div>}
          {children}
            </div>
          </main>

          {/* Phone-first dock: large touch targets, safe-area padding and one
            thumb-reachable route to every core surface. Account/status tools
            remain in the navigation sheet's UserBar. */}
          <nav
            aria-label="Mobile navigation"
            className={cn(
              "mobile-dock shrink-0 grid-cols-5 md:hidden",
              isConversationView ? "hidden" : "grid",
            )}
          >
            {[
              {
                label: "Home",
                icon: Home,
                active: location.pathname === "/dashboard",
                action: () => navigate("/dashboard"),
              },
              {
                label: "Chats",
                icon: MessageCircle,
                active:
                  location.pathname === "/dashboard/chats" ||
                  location.pathname.includes("/dashboard/dm/"),
                action: () => navigate("/dashboard/chats"),
              },
              {
                label: "Servers",
                icon: Menu,
                active: location.pathname.includes("/dashboard/s/"),
                action: () => setMobileNav(true),
              },
              {
                label: "Inbox",
                icon: Bell,
                active: inboxOpen,
                action: () => setInboxOpen(true),
              },
              {
                label: "You",
                icon: User,
                active: settingsOpen,
                action: openSettings,
              },
            ].map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={entry.action}
                aria-pressed={entry.active}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition-colors",
                  entry.active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground active:bg-surface active:text-foreground",
                )}
              >
                {entry.label === "You" && me ? (
                  <UserAvatar user={me} size="xs" />
                ) : (
                  <entry.icon className="size-5" />
                )}
                {entry.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile navigation drawer keeps the rail + sidebar reachable. */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNav}>
        <SheetContent
          side="left"
          className="mobile-navigation-sheet w-[94vw] max-w-sm gap-0 rounded-r-3xl border-r-border/70 p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full">
            <div className="w-[76px] shrink-0 overflow-y-auto">{rail}</div>
            <div className="min-w-0 flex-1">{sidebar}</div>
          </div>
        </SheetContent>
      </Sheet>

      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
      <Inbox open={inboxOpen} onOpenChange={setInboxOpen} />
      <SettingsDialog
        initialTab={
          searchParams.get("settings") === "1"
            ? "account"
            : (searchParams.get("settings") ?? "account")
        }
        open={settingsOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            const next = new URLSearchParams(searchParams);
            next.delete("settings");
            setSearchParams(next, { replace: true });
          }
        }}
      />
      {/* Profile popups are opened by adding ?user=<id> anywhere in the app. */}
      <UserPreviewPanel />
      <ProfileCard />
      <PremiumGiftNotice
        defer={
          settingsOpen ||
          inboxOpen ||
          searchOpen ||
          mobileNavOpen ||
          searchParams.has("user") ||
          searchParams.has("previewUser")
        }
      />
      {/* A ringing DM call surfaces over every view of the app. */}
      <IncomingCallBanner />
    </div>
  );
}
