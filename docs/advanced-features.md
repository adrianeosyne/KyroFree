# Advanced messaging, collaboration, social and gaming

This source delivery adds persistent features to Kyro's existing React/Convex
application. It adds no AI feature, paid service, subscription or new paywall.
The complete requested ecosystem is **not implemented** by this delivery.
See [the implementation report](advanced-expansion-report.md) for tested scope
and the remaining work.

## Using the features

- In **Settings → Notifications**, edit notification profiles, timezone and
  quiet hours, or schedule light/dark themes. These choices sync to your
  account. Quiet hours suppress mention/call sounds while the inbox still
  receives notifications. Overnight hours belong to the day they start.
  Other-device changes require loading the latest settings before saving.
- Open **Releases and teams** from the sidebar, or **Releases and Team** in
  an application editor. Owners invite collaborators and activate immutable
  production releases; activation updates the bot profile and announces the
  version to installers. Viewers read releases; accepted maintainers publish
  staging release notes. Changing a collaborator's role requires acceptance
  again. Credentials and deployment of bot code remain with the owner.
- Owners can create a separate staging bot and private test community. It
  uses a separate credential and one existing application slot. Staging bots
  cannot install outside that test community. Delete the linked staging bot
  before transferring application ownership. Staging release notes do not
  automatically deploy or promote executable bot code.
- Use a community's menu → **Clans and tournaments** to create/join teams,
  approve requests or register for a tournament. Individual entrants receive
  a single-elimination bracket seeded by registration order, with byes.
  Registration closes at the scheduled time; the host or a community manager
  starts the bracket and records decisive scores. Results reject stale writes
  and cannot be overwritten. Completion records participation and wins once
  in the community/game leaderboard. This does not import external game stats.

- In a conversation, use **Message expiry** before sending temporary content,
  or the clock button to **Schedule text message**. Enter an IANA timezone such
  as `Asia/Colombo`; the stored delivery time is a UTC instant. Attachments,
  replies, polls and bot commands are not included in scheduled text messages.
- A message's menu offers **Save message**, **Remind me**, **Edit history** and
  forwarding. Save messages in named collections. Only the author can restore
  text; up to 50 previous versions are retained. Temporary messages cannot be
  bookmarked or forwarded. Forwarding copies text with backend-authenticated
  author attribution; attachments remain in their original conversation.
- **Your library** holds collections, scheduled sends, reminders, conversation
  folders and personal tasks. A saved message becomes unavailable after access
  to its conversation is removed. Use **Open conversation** to navigate to its
  history and **Latest messages** to return to the current timeline.
- The notebook button opens **Conversation workspace**. Private notes and
  folders belong to your account. Shared documents and tasks belong to the
  actual channel or conversation. Documents support Markdown preview, saved
  versions, restoration and owner-selected editor grants. Other participants
  see saved changes reactively. This is a saved-version editor, not a
  character-level CRDT editor.
- Tasks support To do, In progress and Done, member assignments and optional
  deadline notifications. Shared tasks are writable by members with permission
  to contribute; deletion is limited to their creator or a channel moderator.
- **Community knowledge** offers wiki pages/categories, announcements and
  suggestions with voting and Open/Planned/Completed/Declined statuses.
  Community managers can publish announcements and moderate pages. Authors can
  edit their own wiki pages and suggestions. Search matches page titles;
  category filtering uses the exact category.
- **Around Kyro** offers text/Markdown posts and temporary text stories.
  Choose Public, Followers, Friends or Only me. Public means visible to signed-in
  Kyro users, not an anonymous public website. Following is separate from
  friendship. Interest discovery matches explicitly selected tags and exposes
  your interests to others only when you opt in.
- **Find your next party** is available within a community. Set a manual game
  activity and optional HTTPS invitation, or host/join an LFG party with game,
  region, language, timezone and capacity. Seats are reserved transactionally.
  Hosts count toward capacity. Registration closes one hour after the selected
  start time. Game activities expire after four hours unless updated.
- **Devices & Sessions** contains password-verified account freeze and activity for
  freeze/unfreeze and retention changes. Frozen accounts cannot contribute,
  send scheduled messages, obtain new voice tickets or authenticate owned bots.
  Sessions/read access remain available so the account can be unfrozen. Leave
  active calls before freezing; this action does not terminate an active call.
- **Data & Storage** offers independent retention periods for notifications,
  cloud drafts and finished schedule history: keep until deleted, or 7, 30, 90
  or 365 days. Removal is permanent. An hourly job removes records in batches;
  large backlogs take more than one run. Pending sends and conversation message
  content are not removed by these policies.

## Drafts and offline composition

Text drafts are synchronized using an owner/container index and a revision
counter. On the device, the content, last synchronized text, revision and dirty
state are stored under `kyro.cloudDraft:<userId>:<type>:<containerId>`.
Keys are account-scoped. Local storage is plaintext browser storage, not
encrypted storage; protect access to the device and browser profile.

Saving is debounced. A slow save preserves text entered while the request is in
progress. A different cloud draft produces a conflict instead of silently
overwriting either copy. **Use cloud draft** discards your local edit;
**Keep my draft** deliberately saves it against the current cloud revision.
These choices also recover from failed saves. Reconnecting synchronizes text;
it never silently sends a message. Attachments and voice recordings are not
cloud drafts. A full browser reload while offline requires the existing cached
application shell; the browser fixture verifies composition and reconnect,
not an offline authenticated backend.

Cloud draft retention does not erase plaintext drafts on a disconnected device.
An old local revision may require an explicit conflict choice after server-side
retention removes its record.

## Convex API

These are authenticated Convex RPCs, not additional REST routes. Every public
endpoint binds private state to the current account or rechecks access to its
container/community. Observable mutations use `convex/functions.ts` to preserve
the existing bot event wrapper. Internal jobs cannot be called by clients.

| Module               | Public operations                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `advancedMessages`   | `schedule`, `schedules`, `cancelSchedule`; `versions`, `restoreVersion`; `forward`; `collections`, `createCollection`, `removeCollection`; `bookmark`, `bookmarks`; `remind`, `reminders`, `cancelReminder`; `privateState`, `savePrivate`; `createFolder`, `setFolder`, `folders`, `removeFolder`; `locate` |
| `collaboration`      | `documents`, `document`, `createDocument`, `saveDocument`, `documentHistory`, `setDocumentAccess`, `restoreDocument`, `removeDocument`; `tasks`, `createTask`, `updateTask`, `removeTask`                                                                                                                    |
| `communityKnowledge` | `list`, `page`, `create`, `save`, `vote`, `setStatus`, `history`, `restore`, `remove`                                                                                                                                                                                                                        |
| `socialFeed`         | `following`, `follow`, `followList`, `publish`, `feed`, `setPrivacy`, `remove`, `interests`, `saveInterests`, `discover`                                                                                                                                                                                     |
| `gaming`             | `activity`, `setActivity`, `clearActivity`, `parties`, `createParty`, `joinParty`, `partyMembers`, `cancelParty`                                                                                                                                                                                             |
| `privacyControls`    | `status`, `setFreeze` (action), `saveRetention`, `activity`                                                                                                                                                                                                                                                  |
| `dataPortability`    | `personalPage` with an allowlisted dataset and Convex pagination cursor                                                                                                                                                                                                                                      |

Example scheduled text:

```ts
await client.mutation(api.advancedMessages.schedule, {
  containerType: "channel",
  containerId: channelId,
  content: "Our event begins soon.",
  sendAt: Date.now() + 3_600_000,
  timezone: "Asia/Colombo",
});
```

`messages.send` retains its existing arguments and adds optional
`lifetimeSeconds`. `messages.edit` adds an optional `expectedRevision`, so
existing callers continue to work. Message DTOs add `revision`, `expiresAt`
and optional verified forwarding metadata. `restoreVersion` requires the
message's current `expectedRevision`; timestamps alone cannot prevent a stale
restore. Draft/document/task/page updates require their current revision and
fail when another device or participant has already saved a new one.

Paginated lists use Convex `paginationOpts`. Privacy filtering can return an
empty page with a continuation cursor; the UI still offers the next page.
Interest discovery is intentionally bounded to 50 candidates per interest and
20 displayed matches. Existing global message search retains its original
bounded scan and filters; this delivery does not provide unlimited search.

Validation bounds include 50 pending sends/account, 100 pending reminders,
1,000 bookmarks, 50 collections, 25 folders, 200 items/folder, 200 private
conversation states/account, 200 documents/space, 500 tasks/space, 1,000 pages
per community board, 1,000 follows, 12 interests, 20 open hosted parties and
2–50 party members. Shared document/page Markdown is limited to 50,000
characters. Scheduling is between ten seconds and one year in the future;
task deadlines must be at least one minute away. Message expiry is one minute
to 30 days; stories permit up to seven days. Existing message/Premium size
limits continue to apply to sends.

## Database and deployment

`advancedSchema.ts` adds the following indexed tables:

`retentionPolicies`, `securityActivity`, `messageVersions`, `savedCollections`,
`savedMessages`, `scheduledMessages`, `messageReminders`, `conversationFolders`,
`conversationFolderItems`, `conversationNotes`, `messageDrafts`,
`sharedDocuments`, `documentVersions`, `workTasks`, `communityPages`,
`communityPageVersions`, `suggestionVotes`.

`socialGamingSchema.ts` adds `socialFollows`, `interestProfiles`,
`interestMembers`, `socialPosts`, `gameActivities`, `partyPosts`, `partyMembers`.
The 24 tables have owner/container/community and relationship indexes;
community page titles have a Convex search index. Message `revision`, expiry,
forwarding metadata, user `frozenAt` and notification `messageId` are optional.
Legacy messages start at revision zero. Existing records require no backfill.
Convex manages indexes when the additive schema is deployed. The repository's
existing `schemaValidation: false` configuration remains unchanged; endpoint
validators, authorization and transactional uniqueness guards remain essential.

Install and verify with the existing toolchain:

```sh
npm ci
npm run gen:convex
npm run typecheck
npm run lint
npm run test:advanced
npm run test:advanced:ui
npm run build
npm --prefix desktop ci
npm run test:desktop
```

No new environment variable or third-party service is required. Reuse the
existing Convex deployment/authentication configuration, file signing secret
and LiveKit configuration described in [architecture](architecture.md).
Browser timezone conversion uses `Intl.DateTimeFormat`, with ambiguous or
nonexistent daylight-saving times rejected instead of guessed.

Deploy the Convex schema/functions **before** deploying the frontend that calls
them. Use the project's authorized Convex production deployment process, then
the normal Vercel frontend release process. Confirm index deployment, scheduler
health and the retention cron in a staging deployment first. Git push does not
deploy Convex. The November 18 continuation targets `giant-cricket-958`, which
is labeled a dev deployment by Convex but is the backend configured on the
live Vercel site. See the continuation report for rollout verification.

Rollback the frontend first. Retain the additive tables/optional fields and
the job handlers while pending scheduled work exists. Do not remove schema
tables or rename scheduler references to roll back UI changes. There is no
tested automated downgrade or restore-from-backup procedure in this delivery.

## Deletion, export and security

Expiration removes the original message, stored versions, bookmarks/reminders,
message-linked notifications, attachments and dependent thread/poll data.
Reads, reply previews, downloads and thread access check expiry before the
cleanup job executes. The client filters expired rows from cached history.
Message-linked inbox previews also recheck expiry, blocks and conversation
access, and cached inbox rows disappear at their original message expiry.
Screenshots, downloaded files and data retained by external bots/devices cannot
be recalled. This is not encrypted disappearing messaging.

Container/community/account deletion queues bounded cleanup of the new tables.
Parents and account access disappear first. Dependent documents/pages/parties
queue their own version/vote/member cleanup. Remaining parties and suggestion
votes have counts repaired when an account is removed. Legacy deletion helpers
still contain unbounded fan-out for older tables; this delivery does not claim
to eliminate all pre-existing large-community deletion limits.

Data export preserves the existing profile/Premium data and adds cursor-based
export of the new account-owned datasets. Scheduler IDs are removed. Shared
documents/tasks/pages require remaining access. Export queries are performed
over time, not as a single transactional database snapshot. Historical document
and wiki versions are available in their scoped history UI, not included in the
personal export. Legacy export remains limited to 5,000 authored messages and
1,000 notifications; the UI states those limits.

Account freeze is an application write gate, not session revocation or a
trusted-device login system. Its activity panel records freeze and retention
actions only; it is not a full login audit dashboard. Shared content is not
end-to-end encrypted. Existing blocks, membership checks, role overrides,
moderation restrictions and signed attachment access remain authoritative.

## Troubleshooting

- **Unknown Convex function:** deploy the additive backend before this frontend;
  regenerate API types after changing modules.
- **Scheduled send failed:** check membership, bans, blocks, channel permissions,
  AutoMod, channel lock and account freeze. Execution rechecks the original send
  rules. Failure is persisted and appears in the library.
- **Draft conflict:** copy important text, then choose the intended local/cloud
  version. If browser storage is full/disabled, local persistence is unavailable
  while cloud saving can still work.
- **No visible feed/board results:** check privacy, community membership and
  whether another page is available. Expired content and blocked authors are
  hidden.
- **Retained old records:** check the hourly cron and scheduler logs. Each run
  uses bounded deletion; pending schedules are intentionally retained.
- **Android native build unavailable:** install JDK 17, Android SDK platform 35
  and build tools 35.0.0, then follow [Android instructions](../mobile/android/README.md).
- **Build warnings:** current Mermaid vendor chunks and dependency annotation
  warnings remain. A successful web build does not prove native device media
  behavior or live cloud permissions; those require staging/device tests.
