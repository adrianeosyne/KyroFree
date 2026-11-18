# Advanced expansion implementation report

Delivery date: November 18, 2026. Repository: `adrianeosyne/KyroFree`.
Source branch: `codex/restore-all-updates`.

This is a substantial messaging, collaboration, knowledge, social, gaming and
privacy expansion. **The full requested communication/gaming/developer
ecosystem is not complete.** There are no new AI features, paid dependencies or
mandatory subscriptions. Existing Premium, founder and gifting systems remain.

## Implemented scope

| Area                    | Delivered behavior                                                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messaging               | Timezone-aware scheduled text with cancellation and durable failure; configurable expiry; edit versions/restoration guarded by revisions; bookmarks/collections; textual forwarding with verified attribution; private reminders; folders; scoped historical navigation |
| Collaboration           | Private conversation notes; account-scoped cloud/offline text drafts with explicit conflict resolution; shared Markdown documents with versions/restoration/editor grants; personal/shared tasks, Kanban states, assignments and deadline notifications                 |
| Communities             | Wiki/knowledge pages, categories, title search, suggestion voting/statuses, manager announcements and page versions/restoration                                                                                                                                         |
| Social                  | Authenticated public/follower/friend/private text posts; configurable expiring text stories; independent follows; activity feed; opt-in discovery based on explicitly selected interests                                                                                |
| Gaming                  | Manual game presence/status with optional HTTPS invitations; community Party Finder/LFG, transactional capacity, participants, leaving/cancellation and automatic registration closure                                                                                  |
| Privacy and portability | Password-verified account freeze; activity for freeze/unfreeze/retention; independent notification/draft/finished-schedule retention; new datasets in cursor-based personal export; bounded new-data deletion cascades                                                  |

Every UI action above calls an authenticated backend endpoint. Test fixtures
exist only under `tests/ui` and are not shipped as product features.

## Preserved and partial areas

Existing threads already supply branching discussions. Search already has
author/channel/date/type filters; the existing implementation was reused and
expiry/access handling strengthened. Existing LiveKit calls, device controls,
quality controls, permission grants and moderation remain; this delivery adds
freeze protection to new voice tickets, not a new stage/meeting system.

Existing community discovery, lobby/landing customization, XP, events,
onboarding/applications, moderation, settings and configuration export remain.
Existing developer directory/review, portal/API explorer, scoped installations,
SDK, gateway polling/webhooks, analytics, app security reports and management
remain. Existing account switching, accessibility, preferences, recovery,
offline shell and release/update features are preserved through the merge.

Scheduled messages and forwarding are text-only. Stories are text/Markdown,
not media stories. Document collaboration distributes saved revisions, not
simultaneous character edits. Social public posts require sign-in. Game activity
is manually entered, not automatic game detection/playtime tracking. Account
freeze does not revoke sessions or terminate active calls. Security activity
does not include a login/device audit. Retention covers the three named datasets,
not every community or message record. Personal export excludes shared version
history and retains the documented legacy message/notification limits.

## Remaining requested features

- **Messaging:** additional rich-link presentation customization and search
  indexing/navigation beyond the delivered and existing behavior.
- **Voice/video:** captions/subtitles, stages and speaker/audience lifecycle,
  raise hands, breakout rooms, dedicated meetings/attendance, equalizer/effects,
  virtual backgrounds/blur and new pop-out flows.
- **Communities:** custom domains and expanded backup coverage beyond configuration.
- **Social:** further creator/profile activity controls beyond the delivered
  post, portfolio and shared-collection visibility settings.
- **Gaming:** external game stats, playtime/achievements,
  Minecraft/game-server and game-library integrations,
  overlay/detection and streaming integration.
- **Developers:** general scheduled-task API, general OAuth2, hosted
  WebSocket transport and additional extension/plugin interfaces.
- **Security:** WebAuthn passkey ceremony/provider, trusted-device approval,
  suspicious-login notifications, additional phishing/impersonation protection,
  permission-change notifications and audited E2EE/key
  verification for direct/group conversations.
- **Productivity/platform:** file versioning, live collaborative code editor,
  and additional team activity; new split-screen,
  multi-window/media pop-outs, notification grouping,
  Discord-export import and broader cache/offline sync.

These are not represented by placeholder buttons. Captions commonly rely on
learned recognition models; no transcription provider was enabled under the
no-AI requirement. Custom domains require verified DNS/hosting control. Game
providers require supported legitimate APIs/credentials/terms. Native detection
and overlays require OS integration. WebSocket hosting needs a long-lived
service. WebAuthn/E2EE require established libraries, device recovery and
protocol interoperability testing; the existing passkey schema is not a
working passkey authentication implementation.

## Database and API changes

24 new tables in `advancedSchema.ts` and `socialGamingSchema.ts`; optional
message revision/expiry/forwarding, user freeze and notification message-link
metadata; owner/container/community indexes and community-title search index.
Existing rows need no migration/backfill. Existing schema validation setting
remains unchanged. Public RPCs and validation limits are listed in
[feature/API documentation](advanced-features.md).

Internal jobs deliver scheduled sends/reminders, expire content, notify task
deadlines, close parties, apply hourly retention and remove dependent data.
Original send validation is reused and checked again during delivery. Public
API arguments remain compatible, with optional message lifetime/revision
additions. The generated Convex API includes the new modules. No new external
REST route or environment variable is required.

Deploy Convex before the frontend. No production database/schema/frontend
deployment is included in this Git delivery. Real-time multi-device cloud
behavior, real LiveKit media and native Android require deployment/device QA.

## Verification

Verification ran on Windows against the resolved checkout. The 39 new backend
tests are included in the 192-test total; email's seven Vitest tests are also
included in that total and must not be counted twice.

| Command                                         | Result                                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`                             | Passed                                                                                                                                                                                                                                                                               |
| `npm run lint`                                  | Passed: zero errors, 24 existing warnings                                                                                                                                                                                                                                            |
| `npx vitest run`                                | Passed: 192 tests across 20 files, including 39 advanced-feature tests                                                                                                                                                                                                               |
| `node scripts/ui-smoke.mjs --attachments`       | Passed: desktop/phone downloads, previews/playback, authoritative upload metadata, sending, cancellation and retries                                                                                                                                                                 |
| `node scripts/ui-smoke.mjs --advanced`          | Passed: slow/concurrent/failed draft saves, offline composition/reconnect, cached notification expiry, scheduling/timezones, collections, reminders, history/forwarding, notes/documents/tasks, social/wiki/gaming, freeze/retention and desktop/phone light/dark layouts            |
| `node scripts/ui-smoke.mjs --community`         | Passed: Premium/founder administration, gifting, consistent tier metadata, lobby editing/routing and AutoMod                                                                                                                                                                         |
| `node scripts/ui-smoke.mjs --shell`             | Passed: navigation, favorites, private drafts, reconnection, responsive layouts, touch/crop controls, service worker recovery, Android browser flows and iPhone installation UI                                                                                                      |
| `node scripts/ui-smoke.mjs`                     | Passed: complete combined browser regression suite, including existing settings, Premium/gifting/founder behavior, admin permissions, uploads/downloads, workspace customization, communities, navigation/drafts, voice preview, touch controls, mobile layouts and offline recovery |
| `npm run test:desktop`                          | Passed: Windows TypeScript build and 11 unit tests                                                                                                                                                                                                                                   |
| `npm run test:voice`                            | Passed: three LiveKit endpoint validation tests                                                                                                                                                                                                                                      |
| `npm run test:email`                            | Passed: 13 Node tests and seven Vitest tests                                                                                                                                                                                                                                         |
| `npm run build:sdk`                             | Passed                                                                                                                                                                                                                                                                               |
| `npm run build`                                 | Passed in 55.47 seconds; existing vendor/chunk-size and dependency annotation warnings remain                                                                                                                                                                                        |
| `node scripts/signup-policy-smoke.mjs`          | Passed: loading/current-policy guards, stale-policy rejection, preserved signup fields and successful retry                                                                                                                                                                          |
| `node scripts/desktop-update-smoke.mjs`         | Passed: nine browser scenarios for immediate/deferred updates, drafts/calls/uploads/dialogs and unavailable or invalid manifests                                                                                                                                                     |
| `node scripts/community-verification-smoke.mjs` | Passed: authenticated heartbeat/reconnect behavior, signed-out guards, verification permissions, badge display, revocation and mobile layout                                                                                                                                         |

Backend tests cover scheduled delivery/cancellation/failure, revoked access,
expiry and downloads/threads, versions/restoration, private isolation,
forwarding, revisions, documents/tasks, community roles/votes, social privacy,
interest opt-in, transactional parties, freeze/retention, export and deletion
across batches. Notification reads recheck expiry, blocks and access before
cleanup; the inbox also filters expired cached previews. Browser tests use real
components with an isolated Convex
fixture and cover conflicts, slow/failed saves, reconnect, scheduling, notes,
documents, tasks, social/wiki and mobile light/dark pages. They do not substitute
for authenticated cloud or native device tests.

Final staged review checked 297 changed paths for common credential patterns
and unresolved conflict markers; no matches were found. The staged whitespace
check passed.

The checkout began with an unfinished merge and 29 unmerged paths. Initial
index/working patches and conflict stages were copied outside the repository.
The resolution retains both release/Premium/mobile work and developer/upload
work. The delivery commit completes that existing merge and includes the
expansion, preserving both parent histories without reset/abort/force push.
Regression fixes reconnect the attachment gallery to the managed upload queue,
retain the developer-docs hostname route, and direct shared-task notifications
to their actual conversation task board.

Android SDK 35/JDK 17 were unavailable, so there is no native Android build or
device result. Electron's executable was absent from the installed desktop
dependencies, so Windows unit/build results do not include a packaged runtime
or installer smoke test. No production deployment, authenticated multi-device
cloud integration, live LiveKit session or production migration was tested.
The exact pushed delivery hash is included in the final delivery response.

Known remaining risks: existing vendor chunk/annotation and Fast Refresh
warnings; pre-existing bounded global search and legacy export; unbounded
fan-out in some legacy deletion paths; plaintext local drafts; no verified
native Android build without JDK 17/SDK 35; no live cloud migration/media QA.

## November 18 continuation

The continuation finishes the saved notification, application release/team,
and competition work. The wider remaining-feature list above still applies;
this is not a claim that the entire original expansion is complete.

- Account notification profiles, quiet hours and scheduled themes now have
  persisted settings, validated timezones, optimistic revisions and runtime
  enforcement. Quiet hours control sounds, not delivery or unread counts.
- Applications have accepted viewer/maintainer grants, immutable production
  and staging changelogs, compare-and-set activation/rollback and bounded
  installer update notifications. Active versions appear in bot profiles.
  Isolated staging creates a separate bot credential and private test community;
  publishing a release does not host or deploy the developer's executable code.
- Communities have clans, private approval requests, tournaments with bounded
  transactional registration, seeded brackets/byes and protected scoring.
  Finished tournaments update game/community wins and participation once.
  Removed members release clan and registration seats through bounded cleanup.
- New personal datasets are included in the existing account export. Shared
  records recheck access. App deletion removes grants/releases, and community/
  account deletion removes new competition data in batches. Staging-linked
  applications must unlink through staging deletion before ownership transfer.

Eight additive tables are defined in the attention, release and competition
schema modules. Existing application rows use optional release/staging IDs.
No new dependency, service credential or new Premium restriction was added;
staging consumes the existing application quota.

Verification: typecheck passed; 55 advanced tests passed across eight files;
the expansion browser suite passed for settings conflicts and themes,
release roles/activation, clan approval, scoring, leaderboards and desktop/
phone light/dark layouts. The original advanced browser suite also passed.
The full Vitest regression passed 208 tests across 23 files, including the
owner-deletion regression. Lint passed with
zero errors and 24 existing warnings. The web build passed; vendor chunk,
dependency annotation and mixed static/dynamic release import warnings remain.
Browser fixtures exercise real UI components with isolated RPC data.
Native Android/Windows media and authenticated multi-device
cloud behavior remain outside these fixture results.

Rollout targets the verified live Convex backend `giant-cricket-958` (labeled
dev by Convex) before the production Vercel project `kyro-free`, serving
`kyro-chat.cyou`. Use `npx convex dev --once` for this configured deployment;
`convex deploy` would select a different production deployment. The final
delivery response records the actual deployed status and source commit.

## Community, appeals, gallery and workspace continuation

Community tools are available at `/dashboard/s/:serverId/growth`. Members can
join quests, claim achievements, search resources and view active partnerships.
Managers can define immutable targets, manage resources and bilateral proposals,
inspect observed daily growth/retention and review configuration history.
Earned rewards remain visible after a goal is archived. Analytics starts with
observed events and retains up to 365 days; the chart shows the latest 31 UTC
days. It does not invent historical activity or count bot posts.

Configuration history coalesces configuration changes and retains up to 30
fingerprinted snapshots. Owners can import validated configuration backups of
the same community and restore reviewed state after confirming the current
name. Restoration checks a current-state fingerprint, protects system roles
and the official Premium lounge, recreates missing configuration resources,
preserves messages/members/extra channels and saves pre-restore state.
Snapshots include roles, categories, channels, AutoMod and lobby settings,
exclude private content and media, and have bounded resource/size limits.
Oversized or legacy-invalid configurations remain usable but cannot be captured
until corrected; managers can verify capture through the history UI.

`/dashboard/appeals` provides personal moderation cases and one appeal per
unresolved warning/timeout/kick/ban. Removed or banned community members can
appeal their own cases. Private moderator notes are excluded. Authorized
reviewers decide in Community tools, with current permissions, hierarchy and
revision checks. Acceptance resolves the original action, preserves newer bans
and timeouts, and does not automatically rejoin kicked members.

Around Kyro includes portfolios with per-project privacy and shared collections
of HTTPS links, live references to social posts and verified uploaded stickers.
Invitations require acceptance; viewer/editor grants can be revoked. Collection
reads recheck original post visibility/expiry and blocks. Sticker downloads
recheck collection membership and blocking using the existing signed file
service. Upload ownership, existing upload limits and storage quotas remain.

Conversation workspaces include whiteboards with strokes, rectangles and notes,
object-level revisions, current member/editor authorization and SVG download.
Completed drawings synchronize through Convex; different objects can be edited
concurrently, while conflicting changes to the same object require review.
Whiteboards support up to 500 objects, 300 points per stroke and 20 boards per
conversation. Tasks have optional planned starts, a timeline of loaded tasks,
and revision-checked rescheduling. Each deadline reminder is delivered once.

New personal datasets use the existing cursor-based export, recheck shared
access, and exclude scheduler identifiers. Configuration snapshots export one
at a time. Community, account, collection and whiteboard deletion use bounded
cleanup, including dependent records authored by other members and sticker
storage. No new dependency, AI service or Premium restriction was introduced.

Verification includes 231 passing Vitest tests across 27 files. New browser
checks cover community goals/resources/partnerships, restoration conflicts,
appeal submission/review, portfolios, shared collections/invitations, whiteboard
drawing/concurrent edits and timeline scheduling on desktop and phone layouts.
These fixtures exercise real product components with isolated RPC data; they
do not establish authenticated multi-device or native media behavior.

The remaining-feature section above reflects the unfinished wider request;
this continuation does not claim that voice stages, external integrations,
passkeys, E2EE or the complete platform expansion are implemented.

Final checks passed: typecheck; lint with zero errors and 24 existing warnings;
production build; all 231 Vitest tests; new `--growth` and `--workspace` browser
checks; original `--advanced` and `--expansion` browser checks; and the complete
combined browser regression. The combined run's AutoMod discard check now uses
the keyboard path to avoid interception by a previous save toast. The existing
signed-file service is configured on `giant-cricket-958` for sticker previews
and downloads. Native media and authenticated multi-device verification remain
outside these checks.
