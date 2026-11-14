# Kyro developer ecosystem delivery

Repository: https://github.com/adrianeosyne/KyroFree

Working branch: `feature/developer-ecosystem`

Implementation and verification date: 2026-11-14

## Implementation status

Implemented the developer ecosystem on the existing React/Vite frontend and
Convex backend. Existing Convex Auth, users, memberships, roles, messages, email,
LiveKit and desktop code remain in place. There are no paid plans or paywalls.
The feature branch contains the source changes; production deployment is a
separate rollout step described below.

| Area            | Implemented behavior                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Applications    | Multiple applications, selector, metadata/policy URLs, icons/branding, duplication, ownership offers and acceptance, audit records                                                       |
| Bot identities  | Existing distinct bot identities and BOT indicators, configuration, enable/disable, installations, one-time tokens, rotation/revocation confirmations                                    |
| Installation    | Manager consent, requested grants capped by human permissions, one-use authorization records, state, exact registered HTTPS redirects, success screen, admin disable/remove and activity |
| REST v1         | 53 documented routes including public webhook key discovery; existing legacy prefix retained; authenticated validation, backend permissions, quotas/rate limits and consistent envelopes |
| Gateway         | Durable outbox polling, identified sessions, heartbeats, expiry, token-version invalidation, acknowledgements, leases, retries and reconnecting SDK                                      |
| Webhooks        | Ed25519 signatures, immediate scheduled delivery, durable retries, configurable attempts/base delay, destination/DNS validation, redirect rejection and delivery logs                    |
| Interactions    | Typed arguments, subcommands/groups, global/server commands, autocomplete, message/user context actions, buttons, selects, modals, acknowledgement deadlines and private text replies    |
| Assets/uploads  | Direct object storage, reservation/hash/content verification, quarantine, quotas, metadata, private authorized downloads, app asset manager and My Files                                 |
| Chat uploads    | Multiple files, drag/drop, clipboard images, previews, progress, cancellation, retry, send guards, conversation-scoped queues and author removal                                         |
| Mermaid         | Official Mermaid 12 renderer, six composer templates, preview/source/export, zoom/pan, lazy isolated rendering, dark/light themes and source persistence                                 |
| Developer tools | Database analytics with time ranges, request/session/delivery logs, security notices, installation activity and private sandbox API/event testing                                        |
| SDK/docs        | Repository-distributed kyro.js 0.2.0, typed helpers/events, eight bot examples, public searchable documentation and a shared route reference                                             |

## Architectural decisions

- Keep the existing indexed Convex database, transactions, authentication,
  schedulers and object storage. No PostgreSQL/R2 migration and no second auth
  system were introduced.
- Extend existing bot tables and the existing permission vocabulary. Installation
  grants cap roles and channel overrides; bots have no administrator bypass.
- Durable polling is the gateway transport appropriate to the existing
  serverless deployment. There is no long-lived WebSocket server on Vercel.
- Events are inserted in the same transaction as source mutations. Visibility
  is checked again before delivery; successful processing is acknowledged.
- Installation is account-based authorization with OAuth-style state and
  redirects, not a general OAuth authorization-code/user-access-token service.
- An application owns one bot. Existing hashed credentials remain authoritative;
  rotation invalidates old API credentials and gateway sessions.
- Uploaded objects retain the existing single-resource claim rule. Reupload a
  file to use it independently in another message. Unproven legacy objects are
  never deleted merely because one reference is removed.

## Developer ecosystem and API

Portal: `/dashboard/developers` and `/dashboard/developers/:applicationId`.
Application navigation preserves context and includes overview, general/bot
information, installation/authorization, token, permissions, commands,
events/webhooks, integrations, assets, analytics, audit, settings and sandbox.

REST: `/api/v1/`; `/api/bots/v1/` remains available. **Upload protocol change:**
clients must provide the reservation, size and SHA-256 digest added in SDK 0.2.0.
Unbound legacy upload registration is intentionally rejected to enforce
ownership/content verification. Upgrade external upload clients during rollout. The shared catalog at
`src/lib/apiReference.ts` defines the supported method/path pairs and public
reference. It covers identities/profiles, servers/settings, channels, members,
roles and assignment, messaging/replies/embeds/polls/reactions, moderation,
files, commands/interactions, sessions and events. Collections use cursor
pagination or explicit existing collection bounds. The public Ed25519 key is
`GET /api/v1/webhook-key`.

Gateway events cover message creation/update/deletion/reactions;
member join/leave/update/ban/unban/timeout; server creation/update/deletion;
channel creation/update/deletion; role creation/update/deletion; interactions,
slash-command execution, button/select/modal actions; and attachment creation
and deletion. Compatibility aliases are retained. Envelopes include application
ID, event ID, version, canonical name, timestamp and scoped payload.

Sessions heartbeat every 30 seconds and expire after 90 seconds. Polling is
approximately every 2.5 seconds, with up to 25 leased events per response,
60-second leases and six delivery attempts. Event retention is seven days.
Webhooks default to retries after 1, 5, 15, 60 and 360 minutes. Configurable base
intervals multiply those factors. Delivery is at least once; durable external
side effects still require the bot developer's own deduplication store.

SDK version: `0.2.0`. Build with `npm run build:sdk` and install the local package.
It is **not published to npm**. It supports Node.js 20.19+; build/test this repository
with Node.js 22+ because the server file inspection dependency requires it.
Examples include welcome, moderation, logging, utility, poll, ticket,
announcement and statistics bots. The ticket example stores records on the bot
host's persistent disk and posts to an existing staff-restricted channel.

## Documentation

Public route: `/docs` with 17 pages and a reference for all 53 REST routes.
Sections cover introduction, getting started, authentication/installation,
API, gateway, events, webhooks, commands/components, messaging, files,
permissions, SDK, examples, Mermaid, troubleshooting, deployment and changelog.

The site includes search, sidebar/mobile navigation, breadcrumbs, highlighted
copyable code, API/SDK versions and previous/next links. The planned docs hostname
is supported by the app, but DNS/Vercel domain configuration has not been performed.

## Mermaid

Verified flowchart, sequence, class, state, ER, Gantt, journey, Git graph, pie,
mindmap, timeline, quadrant, requirement and architecture rendering. Only
explicit `mermaid` fences render; other code blocks retain normal rendering.

Messages store source, not SVG. An opaque sandbox iframe loads Mermaid under a
restrictive CSP. Strict configuration and DOMPurify remove active/external SVG
content; the parent displays a Blob image. Source is limited to 12,000 characters,
200 lines and 200 connections; the existing 2,000-character message limit also
applies. Lazy previews have a timeout and plain-text error/source fallback.
Keyboard zoom/pan and source controls provide an accessible alternative.

## Storage and file access

Provider: **existing Convex object storage**, with metadata in Convex tables.
There are no object-storage credentials in browser code and no binaries in the
database. The frontend hashes a file, reserves quota, uploads directly, registers
its storage ID, requests server verification and attaches verified metadata.

- Maximum file: **10 MiB**; maximum attachments per message: **6**.
- Default quota: **250 MiB per identity**, maximum 2,000 metadata rows.
- Upload reservations: 20/minute, expire in 15 minutes.
- Supported: PNG/JPG/JPEG/GIF/WEBP, MP4/WEBM, MP3/WAV/OGG/M4A,
  PDF/TXT/Markdown/JSON/CSV/DOCX/XLSX/PPTX and ZIP.
- SVG, HTML and executable formats are disabled. ZIP/Office checks reject unsafe
  paths, executable entries, macros and excessive declared expansion.
- File inspection compares actual bytes, digest, size, extension and signatures.
  Failed verification quarantines metadata and prevents attachment/download.
- Download links expire in roughly 15 minutes; each request rechecks current
  account and resource access. Asset and attachment links refresh in the UI.
- Images, audio and video use native previews. Text, CSV, Markdown and JSON
  support safe text previews capped at 64 KiB. Office/PDF files are downloads.
- File deletion requires ownership/resource authority. Claimed assets cannot
  be removed from the general file browser. Legacy objects without provable
  ownership are retained.

## Database changes and deployment

No destructive migration, table replacement or data reset was performed.
Convex deploys additive schema/functions; there is no SQL migration name.
New tables: `uploadTickets`, `botAuthorizations`, `botGatewaySessions`,
`botUsageDaily`, `botRequestLogs`.

Existing `botApplications`, `botInstallations`, `botCommands`, `botInteractions`,
`uploads`, `messages` and `serverMembers` gain optional fields and indexes.
Existing identities, token hashes, installations, event outbox and audit tables
are reused. Cleanup jobs expire reservations, authorization records, delivery
records and request/session logs in bounded batches.

Required configuration:

| Location | Variable/configuration                | Purpose                                                                    |
| -------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Convex   | `KYRO_FILE_SIGNING_SECRET`            | At least 32 random secret characters for private download links            |
| Convex   | `KYRO_BOT_WEBHOOK_PRIVATE_KEY`        | Base64 PKCS8 Ed25519 key for signed delivery; existing key can be retained |
| Convex   | `KYRO_STORAGE_QUOTA_BYTES` (optional) | Identity quota, default 262144000                                          |
| Convex   | `KYRO_UPLOAD_EXTENSIONS` (optional)   | Restrict the built-in extension allowlist                                  |
| Vercel   | `VITE_CONVEX_URL`                     | Existing frontend's intended Convex deployment                             |
| Vercel   | `BOT_CONVEX_SITE_URL` (optional)      | Matching HTTP site endpoint when it cannot be derived                      |
| Bot host | `KYRO_BOT_TOKEN`                      | The application's one-time token; never a browser variable                 |

`CONVEX_SITE_URL` is supplied by Convex. Preserve existing Auth, SMTP/email,
LiveKit and GIF service configuration. `.env.example` contains placeholders
and non-secret defaults only.

Rollout:

1. Install locked dependencies with `npm ci` on Node.js 22+.
2. Set signing configuration in the intended Convex deployment's secure settings.
3. Deploy schema/functions to the same deployment used by the website. Use
   `npx convex deploy` for a production deployment; for an intentionally used
   development deployment, target it explicitly with the existing Convex CLI
   workflow. Verify CLI output before applying any change.
4. Run the checks below and deploy the feature through the normal Vercel process.
   Vercel alone does not deploy Convex. Existing REST rewrites, LiveKit and email
   routes are preserved, and `mermaid.html` must remain a separately served asset.
5. For `docs.kyro-chat.cyou`, add the hostname to the Vercel project and create
   the DNS record Vercel requests. The existing `/docs` route needs no new domain.
6. Verify production login, chat, file links, SDK callbacks and voice/screen sharing
   after rollout. Do not run disposable test-account scripts against production.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed; optional Mermaid/ELK chunk-size and dependency
  annotation warnings remain. Diagram engines are lazy loaded.
- `npm run lint`: passed with 22 warnings, primarily existing fast-refresh and
  generated-file directives; zero errors.
- `npm run test:bots`: 59 passing tests across six files, including backend,
  SDK, upload/security and existing I/O/email backend coverage.
- `npm run test:email`: 13 Node tests and seven Vitest tests passed.
- `npm run test:voice`: three passed. `npm run test:desktop`: three passed.
- SDK build and standalone TypeScript checking of all SDK examples passed.
- `node scripts/bot-live-smoke.mjs --configure-auth`: passed against a disposable
  local Convex backend, including real authentication and SDK/REST operations.
- `node scripts/bot-browser-smoke.mjs`: passed real login, application creation,
  token display, permission/subscription setup, installation, command execution,
  private response isolation, user-to-bot reply, SDK uploads, multiple files,
  drag/drop, clipboard image, invalid-file rejection, retry/cancel, persisted
  Mermaid rendering and database-backed analytics.
- `node scripts/ecosystem-browser-smoke.mjs`: passed all 14 diagram types,
  light/dark, source copy/export, zoom/pan, malformed/oversized/malicious input,
  composer and documentation navigation/search/reference/mobile checks.

## Partial or external work

Production deployment, docs DNS, and npm publication were not performed.
The code is verified locally; production email delivery, LiveKit calls and screen
sharing were not exercised against live external services in this run. Existing
regression suites passed, but they do not constitute a production smoke test.

Signature inspection/quarantine is implemented; an external malware scanning
service is not connected. Object-store orphan lifecycle management for old,
unregistered objects still follows existing provider operations. A generic
user OAuth2 token service and embedded Office/PDF viewers are not implemented.
Gateway transport is durable polling/webhooks, not a dedicated WebSocket host.
Bots run on developer infrastructure; no arbitrary bot-code hosting was added.

## GitHub delivery

Push target is `legacy-origin` → `adrianeosyne/KyroFree`, never the old `origin`.
Branch: `feature/developer-ecosystem`.
Commit message: `feat: expand Kyro developer ecosystem, bot API, docs, Mermaid and file uploads`.
The final response records the actual commit hash and verified push result.
No `.env.local`, test credentials, keys, storage objects, local database state,
screenshots or build artifacts are included in the commit.
