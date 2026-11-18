import { LOBBY_DEFAULTS } from "../../src/lib/lobby";
import { WORKSPACE_DEFAULTS } from "../../src/lib/workspaceTheme";
import { getFunctionName } from "convex/server";
import { defaultAttention } from "../../src/lib/attention";
import { useState, useSyncExternalStore } from "react";

const person = (id, name, presence, customStatus = null) => ({
  id,
  name,
  username: name.toLowerCase().replaceAll(" ", "_"),
  presence,
  customStatus,
  avatarUrl: null,
  badges: [],
  links: [],
  hasUsername: true,
  device: "desktop",
});
export const me = person(
  "me",
  "Alex Morgan",
  "online",
  "Making something good",
);
Object.assign(me, {
  email: "alex@example.com",
  pronouns: "they/them",
  bio: "A little conversation, a lot of good ideas.",
  links: [],
  dmPolicy: "everyone",
  allowFriendRequests: true,
  showPresence: true,
  suggestible: true,
});
const fixtureProfile = localStorage.getItem("kyro.fixture.profile");
if (fixtureProfile) Object.assign(me, JSON.parse(fixtureProfile));
const queryOverrides = JSON.parse(
  localStorage.getItem("kyro.fixture.queries") ?? "{}",
);
let mutationErrors = JSON.parse(
  localStorage.getItem("kyro.fixture.mutationErrors") ?? "{}",
);
const queryErrors = JSON.parse(
  localStorage.getItem("kyro.fixture.queryErrors") ?? "{}",
);
let queryRevision = 0;
const queryListeners = new Set();
window.setFixtureQueries = (overrides) => {
  Object.assign(queryOverrides, overrides);
  queryRevision += 1;
  queryListeners.forEach((listener) => listener());
};
window.setFixtureQuery = (name, value) =>
  window.setFixtureQueries({ [name]: value });
window.setFixtureMutationErrors = (errors) => {
  mutationErrors = errors;
};
const subscribeQueries = (listener) => {
  queryListeners.add(listener);
  return () => queryListeners.delete(listener);
};
const querySnapshot = () => queryRevision;
const friends = [
  person("maya", "Maya Chen", "online", "Sketching new ideas"),
  person("leo", "Leo Parker", "online", "Anyone up for a game?"),
  person("sam", "Sam Rivera", "idle", "In my own little world"),
  person("nora", "Nora Ellis", "dnd", "One more chapter"),
  person("kai", "Kai Wilson", "offline"),
];
const conversations = friends.slice(0, 3).map((friend, i) => ({
  id: `dm-${friend.id}`,
  type: "dm",
  participants: [me, friend],
  name: null,
  unread: i === 0,
  lastMessagePreview: [
    "That sounds like a plan!",
    "See you tonight?",
    "Sent you a little inspiration",
  ][i],
}));
const servers = [
  {
    id: "studio",
    name: "Creative Studio",
    iconUrl: null,
    unread: true,
    mentionCount: 3,
  },
  { id: "afterhours", name: "After Hours", iconUrl: null },
  { id: "dev", name: "Build Together", iconUrl: null },
];
const discovery = servers.map((server, index) => ({
  ...server,
  description: [
    "Make, share, and find your next idea.",
    "Games and good company after a long day.",
    "A friendly corner for curious builders.",
  ][index],
  tags: [["Art", "Design"], ["Gaming"], ["Technology"]][index],
  memberCount: [126, 82, 54][index],
  onlineCount: [18, 9, 4][index],
  createdAt: 1700000000000 + index * 100000,
  permissions: [
    "manage_server",
    "manage_channels",
    "manage_roles",
    "create_invites",
    "manage_messages",
    "kick_members",
    "ban_members",
    "view_audit_log",
    "manage_emojis",
  ],
  isOwner: true,
  roles: [],
  links: [],
  verificationLevel: "none",
  applicationQuestions: [],
  tag: null,
  themeAccent: null,
  themeTint: null,
  isJoined: true,
  applyToJoin: false,
}));
const channels = {
  categories: [
    { id: "text", name: "The studio" },
    { id: "voice", name: "Hang out" },
  ],
  permissions: [
    "view_channel",
    "send_messages",
    "connect_voice",
    "speak_voice",
  ],
  channels: [
    {
      id: "general",
      name: "the-lounge",
      kind: "text",
      categoryId: "text",
      topic: "A little conversation, a lot of good ideas.",
      mentionCount: 0,
    },
    {
      id: "ideas",
      name: "good-finds",
      kind: "text",
      categoryId: "text",
      mentionCount: 0,
    },
    {
      id: "room",
      name: "The couch",
      kind: "voice",
      categoryId: "voice",
      topic: "Good company, open microphones, and your favorite people.",
      mentionCount: 0,
    },
  ],
};
const messages = [
  [
    friends[0],
    "Hey! Have you had a chance to look at the ideas for this weekend?",
  ],
  [
    me,
    "Yes! I love the idea of a little creative session. We could bring everyone together.",
  ],
  [
    friends[0],
    "Exactly what I was thinking. A few good playlists, some sketches, and no pressure.",
  ],
  [me, "Sounds perfect. Let's share it with the others ✨"],
  [friends[0], "That sounds like a plan!"],
].map(([author, content], i) => ({
  id: `message-${i}`,
  author,
  authorId: author.id,
  content,
  createdAt: Date.now() - (6 - i) * 60000,
  editedAt: null,
  attachments: [],
  reactions: [],
  replyTo: null,
}));
let connected = true;
let fixtureRevision = 0;
window.setFixtureData = (name, value) => {
  data[name] = value;
  fixtureRevision++;
  listeners.forEach((l) => l());
};
const listeners = new Set();
window.setFixtureConnection = (value) => {
  connected = value;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => connected;
export function useConvexConnectionState() {
  return { isWebSocketConnected: useSyncExternalStore(subscribe, snapshot) };
}
const empty = [];
const data = {
  "warnings:mine": { count: 0, warnings: [] },
  "security:status": {
    enabled: false,
    pending: false,
    recoveryCodesRemaining: 0,
  },
  "users:me": me,
  "automod:getSettings": {
    enabled: true,
    blockedWords: [],
    blockInvites: true,
    blockLinks: false,
    maxMentions: 10,
    blockCaps: true,
    blockSpam: true,
    exemptRoleIds: [],
    exemptChannelIds: [],
  },
  "workspace:get": {
    premiumUntil: null,
    theme: WORKSPACE_DEFAULTS,
    backgroundUrl: null,
  },
  "trustReviews:mine": { verified: false, requests: [] },
  "premium:status": {
    premiumUntil: null,
    instructions: "Contact adrianeosyne for manual payment instructions.",
    requests: [],
  },
  "communityDecorations:catalog": [],
  "communityDecorations:mine": [],
  "communityHub:events": [],
  "communityHub:tickets": [],
  "lobby:status": { enabled: false },
  "lobby:get": {
    config: { ...LOBBY_DEFAULTS, title: "Welcome to Creative Studio" },
    isOwner: true,
    serverName: "Creative Studio",
    rules: "Be kind. Share original work.",
    boards: { levels: [], messages: [], invites: [] },
    feed: [],
    feedConnected: false,
  },
  "premiumCodes:list": [],
  "premium:queue": [],
  "admin:overview": { allowed: false },
  "users:currentUser": me,
  "advancedMessages:privateState": { draft: null, note: null, folderId: null, folders: [] },
  "advancedMessages:collections": [],
  "advancedMessages:folders": [],
  "privacyControls:status": { frozen: false, frozenAt: null, policy: null },
  "socialFeed:interests": null,
  "socialFeed:discover": [],
  "socialFeed:following": { following: false },
  "gaming:activity": null,
  "collaboration:document": null,
  "communityKnowledge:page": null,

  "social:list": { friends, incoming: [], outgoing: [], blocked: [] },
  "servers:listMine": servers,
  "conversations:list": conversations,
  "notifications:unreadCount": 2,
  "notifications:mentionSummary": { count: 0, latestCreationTime: null },
  "notifications:list": empty,
  "notifications:pendingPremiumGifts": [],
  "premiumCodes:giftPreview": {
    valid: false,
    reason: "This gift has already been claimed.",
  },
  "voice:incoming": empty,
  "voice:currentCall": null,
  "messages:typingList": empty,
  "messages:list": { messages, hasMore: false, nextCursor: null },
  "users:suggest": empty,
  "servers:discover": discovery,
  "servers:joinState": { exists: true, isMember: true },
  "channels:list": channels,
  "servers:members": {
    online: friends.slice(0, 4).map((user) => ({
      user,
      nickname: null,
      isOwner: false,
      topRoleColor: null,
      topRoleName: "Member",
    })),
    offline: [],
    myPermissions: [],
  },
  "roles:list": [],
  "voice:roster": [
    {
      id: "voice-maya",
      user: friends[0],
      muted: false,
      camera: false,
      sharing: false,
    },
  ],
};
window.fixtureData = data;
export function useQuery(reference, args) {
  useSyncExternalStore(subscribeQueries, querySnapshot);
  useSyncExternalStore(subscribe, () => fixtureRevision);
  if (args === "skip") return undefined;
  const name = getFunctionName(reference);
  if (queryErrors[name]) throw new Error(queryErrors[name]);
  if (Object.hasOwn(queryOverrides, name)) return queryOverrides[name];
  if (name === "attentionSettings:get" && !data[name]) return defaultAttentionFixture;
  if (name === "advancedMessages:privateState") return data[`private:${args.containerType}:${args.containerId}`] ?? data[name];
  if (
    name === "messages:list" &&
    localStorage.getItem("kyro.fixture.media") === "1"
  )
    return {
      messages: [
        ...messages,
        {
          ...messages[0],
          id: "fixture-media",
          content: "https://example.com/settings-preview.png",
        },
      ],
      hasMore: false,
      nextCursor: null,
    };
  if (name === "servers:get")
    return (
      discovery.find((server) => server.id === args.serverId) ?? discovery[0]
    );
  if (name === "servers:discover")
    return discovery.filter((server) =>
      `${server.name} ${server.description} ${server.tags.join(" ")}`
        .toLowerCase()
        .includes((args?.term ?? "").trim().toLowerCase()),
    );
  if (name === "conversations:get")
    return conversations.find((c) => c.id === args.conversationId) ?? null;
  if (name === "users:profile")
    return data[name]?.user?.id === args.userId ? data[name] : {
      user: [data["users:me"] ?? me, ...friends].find((user) => user.id === args.userId),
      serverRoles: [],
      mutualFriends: [],
      mutualServers: [],
    };
  if (name === "users:search" || name === "users:searchUsers")
    return friends.filter((p) =>
      p.name.toLowerCase().includes((args.term ?? "").toLowerCase()),
    );
  return Object.hasOwn(data, name) ? data[name] : empty;
}
export function usePaginatedQuery(reference, args, options) {
  useSyncExternalStore(subscribeQueries, querySnapshot);
  useSyncExternalStore(subscribe, () => fixtureRevision);
  const name = getFunctionName(reference);
  if (args !== "skip" && queryErrors[name]) throw new Error(queryErrors[name]);
  const key = JSON.stringify({ name, args });
  const initial = options?.initialNumItems ?? 25;
  const [pagination, setPagination] = useState({ key, count: initial });
  const count = pagination.key === key ? pagination.count : initial;
  if (args === "skip") return { results: empty, status: "Exhausted", loadMore: () => {} };
  if (name !== "premiumCodes:history") {
    const rows = queryOverrides[name] ?? data[name] ?? [];
    const filtered = rows.filter(row => (!args.kind || row.kind === args.kind) && (!args.collectionId || row.collectionId === args.collectionId));
    return { results: filtered.slice(0, count), status: filtered.length > count ? "CanLoadMore" : "Exhausted", loadMore: size => setPagination({ key, count: count + size }) };
  }
  const rows = data["premiumCodes:list"].filter((row) => {
    const status =
      row.redeemedAt !== undefined
        ? "redeemed"
        : row.revokedAt !== undefined
          ? "revoked"
          : row.expiresAt !== undefined && row.expiresAt <= Date.now()
            ? "expired"
            : "available";
    return (
      (!args.status || args.status === "all" || args.status === status) &&
      row.suffix.startsWith(args.suffix ?? "")
    );
  });
  return {
    results: rows.slice(0, count),
    status: rows.length > count ? "CanLoadMore" : "Exhausted",
    loadMore: (size) => setPagination({ key, count: count + size }),
  };
}

const mutations = new Map();
const defaultAttentionFixture = { ...defaultAttention, revision: 0 };
export function useMutation(reference) {
  const name = getFunctionName(reference);
  if (!mutations.has(name))
    mutations.set(name, async (args) => {
      window.fixtureMutations ??= [];
      window.fixtureMutations.push({ name, args });
      if (window.fixtureMutationDelay?.[name]) await new Promise(resolve => setTimeout(resolve, window.fixtureMutationDelay[name]));
      if (mutationErrors[name]) throw new Error(mutationErrors[name]);
      if (name === "attentionSettings:save") {
        const current = queryOverrides["attentionSettings:get"] ?? data["attentionSettings:get"] ?? defaultAttentionFixture;
        if (current.revision !== args.expectedRevision) throw new Error("Settings changed on another device.");
        const { expectedRevision, ...policy } = args;
        window.setFixtureQueries({ "attentionSettings:get": { ...policy, revision: expectedRevision + 1 } });
      }
      if (name === "advancedMessages:savePrivate") {
        const key = `private:${args.containerType}:${args.containerId}`;
        const current = data[key] ?? data["advancedMessages:privateState"];
        if ((current[args.kind]?.revision ?? 0) !== args.expectedRevision) throw new Error("The draft changed on another device.");
        const revision = args.expectedRevision + 1;
        window.setFixtureData(key, { ...current, [args.kind]: { content: args.content, revision, updatedAt: Date.now() } });
        return revision;
      }
      if (name === "collaboration:createDocument") {
        const doc = { _id: "fixture-doc", title: args.title, content: args.content, revision: 1, updatedAt: Date.now(), creatorId: "me", canEdit: true, isOwner: true };
        window.setFixtureData("collaboration:documents", [doc]); window.setFixtureData("collaboration:document", doc); return doc._id;
      }
      if (name === "collaboration:saveDocument") {
        window.setFixtureData("collaboration:document", { ...data["collaboration:document"], ...args, revision: args.expectedRevision + 1 }); return args.expectedRevision + 1;
      }
      if (name === "communityKnowledge:create") {
        const row = { _id: "fixture-page", ...args, revision: 1, votes: 0, status: "open", authorId: "me", updatedAt: Date.now(), canEdit: true, canManage: true };
        window.setFixtureData("communityKnowledge:list", [row]); window.setFixtureData("communityKnowledge:page", row); return row._id;
      }
      if (name === "collaboration:createTask") {
        window.setFixtureData("collaboration:tasks", [...(data["collaboration:tasks"] ?? []), { _id: "fixture-task", ...args, status: "todo", userId: "me", revision: 1, createdAt: Date.now() }]); return "fixture-task";
      }
      if (name === "socialFeed:publish") {
        window.setFixtureData("socialFeed:feed", [...(data["socialFeed:feed"] ?? []), { _id: "fixture-post", ...args, authorId: "me", author: me, mine: true, createdAt: Date.now() }]); return "fixture-post";
      }
      if (name === "advancedMessages:forward") return { messageId: "fixture-forward", blocked: null };
      if (name === "privacyControls:setFreeze") {
        window.setFixtureData("privacyControls:status", { ...data["privacyControls:status"], frozen: args.frozen }); return null;
      }
      if (name === "gaming:createParty") {
        window.setFixtureData("gaming:parties", [{ _id: "fixture-party", ...args, memberCount: 1, status: "open", mine: true, canManage: true, joined: true, host: me }]); return "fixture-party";
      }
      if (name === "advancedMessages:createCollection") { window.setFixtureData("advancedMessages:collections", [{ _id: "fixture-collection", name: args.name }]); return "fixture-collection"; }
      if (name === "advancedMessages:schedule") {
        window.setFixtureData("advancedMessages:schedules", [{ _id: "fixture-schedule", ...args, status: "pending", createdAt: Date.now() }]); return "fixture-schedule";
      }
      if (name === "dataPortability:personalPage") return { page: [], isDone: true, continueCursor: "" };
      if (name === "files:generateUploadUrl") {
        const uploadUrl = "http://127.0.0.1:5187/tests/ui/upload";
        return Object.keys(args).length
          ? { uploadUrl, uploadId: "fixture-upload-ticket" }
          : uploadUrl;
      }
      if (name === "files:registerUpload") {
        if (args.uploadId)
          return { storageId: args.storageId, status: "pending" };
        return {
          storageId: args.storageId,
          name: args.name,
          ...(window.fixtureUploadedFiles?.[args.storageId] ?? {
            size: 1,
            mimeType: "application/octet-stream",
          }),
        };
      }
      if (name === "premium:badgeVisibility")
        window.setFixtureData("premium:status", {
          ...data["premium:status"],
          hidePremiumBadge: args.hidden,
        });
      if (
        name === "premiumCodes:generate" ||
        name === "premiumCodes:generateBatch"
      ) {
        const codes = Array.from({ length: args.count ?? 1 }, (_, i) =>
          i === 0
            ? "KYRO-ABCD-EFGH-ABCD"
            : `KYRO-ABCD-EFGH-ABC${"EFGHJKLMNPQRSTUVWXYZ23456789"[i - 1]}`,
        );
        const expiresAt = args.expiresInDays
          ? Date.now() + args.expiresInDays * 86400000
          : null;
        const rows = codes.map((code, index) => ({
          _id: `fixture-code-${Date.now()}-${index}`,
          suffix: code.slice(-4),
          days: args.days,
          giftSenderId: args.giftSenderId,
          giftSenderName: args.giftSenderId
            ? friends.find((user) => user.id === args.giftSenderId)?.name
            : undefined,
          giftSenderUsername: args.giftSenderId
            ? friends.find((user) => user.id === args.giftSenderId)?.username
            : undefined,
          createdAt: Date.now(),
          ...(expiresAt ? { expiresAt } : {}),
        }));
        window.setFixtureData("premiumCodes:list", [
          ...rows,
          ...data["premiumCodes:list"],
        ]);
        return name === "premiumCodes:generate"
          ? { code: codes[0], days: args.days, expiresAt }
          : { codes, days: args.days, expiresAt };
      }
      if (name === "premiumCodes:revoke")
        window.setFixtureData(
          "premiumCodes:list",
          data["premiumCodes:list"].map((row) =>
            row._id === args.id ? { ...row, revokedAt: Date.now() } : row,
          ),
        );
      if (name === "premiumCodes:redeem") {
        const giftReceived =
          args.fromGiftLink === true &&
          data["premiumCodes:giftPreview"].senderName !== null;
        if (giftReceived)
          window.setFixtureData("notifications:pendingPremiumGifts", [
            {
              id: "gift-note",
              days: 90,
              premiumUntil: Date.now() + 90 * 86400000,
              senderName: "Maya Chen",
              senderUsername: "maya_chen",
            },
          ]);
        if (!args.recipientId)
          window.setFixtureData("premium:status", {
            ...data["premium:status"],
            premiumUntil: Date.now() + 30 * 86400000,
            premiumSince: Date.now(),
            premiumStreakSince: Date.now(),
          });
        return {
          ok: true,
          days: 30,
          premiumUntil: Date.now() + 30 * 86400000,
          giftReceived,
        };
      }
      if (name === "premiumCodes:shareGift")
        return {
          ok: true,
          link: "https://kyro-chat.cyou/gift/KYRO-ABCD-EFGH-ABCD",
          days: 90,
        };
      if (name === "notifications:markRead")
        window.setFixtureData(
          "notifications:pendingPremiumGifts",
          data["notifications:pendingPremiumGifts"].filter(
            (gift) => !args.ids.includes(gift.id),
          ),
        );
      if (name === "lobby:save") {
        window.setFixtureData("lobby:get", {
          ...data["lobby:get"],
          config: args.config,
        });
        window.setFixtureData("lobby:status", { enabled: args.config.enabled });
      }
      if (name === "lobby:rotateFeedToken")
        return {
          token: "KyroLobby_" + "a".repeat(64),
          endpoint: "https://example.convex.site/api/lobby-feed",
        };
      if (name === "messages:send") return { messageId: "fixture-sent" };
      if (name === "conversations:createDirect") return `dm-${args.userId}`;
      return null;
    });
  return mutations.get(name);
}
export const useAction = useMutation;
const client = { query: async reference => getFunctionName(reference) === "dataPortability:personalPage" ? { page: [], isDone: true, continueCursor: "" } : empty, mutation: async () => null };
export const useConvex = () => client;
export const useConvexAuth = () => {
  useSyncExternalStore(subscribe, () => fixtureRevision);
  return { isLoading: false, isAuthenticated: !data["fixture:signedOut"] };
};
// Auth providers are pass-through in the account-free browser fixture.
export const ConvexProviderWithAuth = ({ children }) => children;
