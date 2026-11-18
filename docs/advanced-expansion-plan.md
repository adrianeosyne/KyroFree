# Advanced expansion: architecture and delivery plan

Audit date: November 18, 2026. Target repository: `adrianeosyne/KyroFree`.

## Architecture and baseline

React 19, TypeScript, Vite, Tailwind 4, Radix/shadcn and Convex reactive RPC
remain the stack. The Electron Windows and Android WebView clients share the
web app. Convex Auth, immutable founder identity, TOTP, channel overrides,
community membership, bans, blocks, AutoMod, private storage and LiveKit remain
authoritative. New observable mutations use `convex/functions.ts` so the bot
event wrapper stays active. No AI feature, paid dependency or new paywall is
part of this delivery.

The checkout initially contained an unfinished merge of `origin/main` into
`codex/restore-all-updates`, with 29 unmerged paths. A copy of the initial index,
working changes and all three conflict stages was saved outside the repository.
Resolve it by retaining both release/Premium/mobile changes and the existing
developer/upload changes. Establish typecheck, build and regression results
before adding product code. Complete the existing merge with both parent
histories preserved; the delivery commit also includes the verified expansion.

## Existing functionality: extend rather than duplicate

| Request area  | Already in the source                                                                                                                                            | Actual gaps                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messaging     | Replies, threads/branching, polls, pins, editing, attachments, mention/author/channel/date/type search, local drafts                                             | Scheduling, versions/restore, private bookmarks/collections, forwarding, expiry, reminders, cloud drafts, private notes, folders, direct navigation to old messages     |
| Voice         | LiveKit calls, persistent channel identities, camera/screen sharing, processing/device controls, moderation and quality targets                                  | Stage roles, raise hand, breakout/meeting lifecycle and attendance, media effects, pop-outs, accessibility captions                                                     |
| Communities   | Discovery/tags, landing/lobby layouts, onboarding/applications, moderation/audit, events/RSVP, private tickets, contribution XP and boards, configuration export | Wiki/knowledge pages, suggestions/voting, announcements, revisions/restoration, resources, achievements/quests, partnerships and historical analytics                   |
| Social        | Profiles/bios/links, creator verification, friendships, blocks, presence                                                                                         | Follow graph, posts/stories with privacy, explicit interest discovery, social collections/stickers                                                                      |
| Gaming        | Presence/status, gaming appearance themes, community XP                                                                                                          | LFG/party finder, game activity, clans/tournaments/brackets, legitimate external integrations and native overlay                                                        |
| Developers    | Application directory/review, rich developer portal/API explorer, scoped revocable installs, SDK, logs/analytics, durable gateway/webhooks, security reports     | Collaborators, application release versions/changelogs, staging, scheduled tasks, general OAuth2 and hosted WebSocket transport                                         |
| Security      | Password/Scrypt, TOTP/recovery, email verification, blocks/privacy, bans/reports/audit, passkey schema only                                                      | WebAuthn auth ceremony/provider, trusted sessions/approvals, account freeze, retention, appeals and audited encrypted chat                                              |
| Collaboration | Community events/calendar and Mermaid source/diagrams                                                                                                            | Shared Markdown documents with versions and optimistic concurrency; personal/shared tasks and Kanban; assignments/deadlines; later code editor/whiteboard/file versions |
| Platform      | Account switcher, recovery/offline shell, shortcuts, responsive navigation, accessibility/appearance preferences, connection recovery                            | Cloud/offline draft reconciliation, notification schedules/profiles, split/pop-out windows, import/export and richer caching                                            |

## Implementation sequence

1. Reconcile the merge, inspect schemas/APIs/permissions and run baseline checks.
2. Add optional message metadata and indexed private messaging tables. Extract
   the existing send/edit handlers for reuse; never bypass their validation,
   membership, bans, Premium channel, block, rate-limit or AutoMod checks.
3. Implement scheduler delivery, cancellation and durable failure state;
   expiration with existing deletion cascades; edit versions and restoration;
   collection bookmarks/reminders; folder membership; notes and synchronized
   drafts. All timestamps are UTC instants with validated IANA timezone labels.
4. Integrate real actions in the composer/message menu and a personal library;
   add scoped conversation tools and safe navigation to historical messages.
5. Add community knowledge/suggestion/announcement pages and shared Markdown
   documents using a revision counter. Add assignments, tasks, Kanban state and
   deadline notifications scoped to the existing container access rules.
6. Extend social/gaming/developer/platform surfaces only where fully persisted,
   scoped behavior can be verified; record every remaining gap explicitly.
7. Add Convex tests for cross-community isolation, removed membership, blocks,
   lost permissions, scheduling/expiry, concurrency, quotas and pagination;
   browser checks for real components at desktop/mobile sizes and both themes.
8. Regenerate the committed API, review all changes, scan for secrets, run
   available lint/type/build/test commands and document migration/rollout.
9. Commit with the authorized GitHub identity, push a `codex/` branch without
   force pushing, and report the exact commit and verification limits.

## Data, authorization and compatibility rules

New tables are additive; legacy records must not require backfills to remain
readable. Private state always has an owner index. Shared state references a
real community/channel/conversation, and every read and write rechecks access.
Collections use Convex cursor pagination. User-supplied titles, Markdown,
identifiers, times and status values have server bounds and validators.
Scheduling rechecks permissions at execution, not only when scheduling.
Deleted messages remove versions and saved private references, and expiry does
not leave message text in notifications or conversation previews.

Editors use optimistic revisions and report conflicts instead of silently
overwriting another member's work. A reactive editor is not a character-level
CRDT editor; document this distinction. Local drafts are account-scoped and
only explicit user actions send messages. Offline composition never silently
sends a message after reconnect.

## External and longer-term work

Custom domains require DNS and hosting ownership verification. A hosted
WebSocket gateway requires a long-lived host; Vercel functions cannot supply
one. Game detection/overlay requires native desktop OS integration and
supported games; Steam and other libraries require approved provider APIs.
WebAuthn and encrypted chat require established audited libraries, recovery,
device lifecycle and protocol interoperability tests. Schema presence is not
authentication. These must not be represented by placeholder buttons.

Browser speech recognition has limited support and commonly uses statistical
or learned recognition systems. Under the no-AI requirement, do not enable a
transcription provider without an explicit compliant technical choice.

Research references: [Discord search](https://support.discord.com/hc/en-us/articles/115000468588-How-to-Use-Search-on-Discord),
[LiveKit token grants](https://docs.livekit.io/frontends/reference/tokens-grants/),
[LiveKit participant permissions](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/),
[MDN speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

See the delivery report for implemented scope and actual test results; this
plan is not a claim that all requested features are complete.
