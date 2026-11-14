# Developer ecosystem implementation plan

Inspection baseline: 2026-11-13, commit `833dc0c`, clean `main`, synchronized with
`origin/main` in `CrimsonCrown967/Kyro`. No AGENTS.md was found in the workspace.

Repository correction: the user changed the delivery target to
`adrianeosyne/KyroFree`. Its remote is `legacy-origin`; both main histories
matched at inspection and final fetch. All new work targets that repository.

## Existing architecture

React 19 / Vite 7 / TypeScript 5.9 / React Router 7 / Tailwind 4 / Radix UI.
Strict TypeScript projects cover browser, Vercel functions, Convex and SDK.
Convex owns the indexed document database, transactions, realtime subscriptions,
scheduled functions and object storage. There is no SQL database, ORM or SQL
migration framework. Convex Auth's existing password and two-factor provider
must remain authoritative. Vercel serves the SPA and forwards bot REST to
Convex HTTP actions; email and LiveKit endpoints remain separate.

Existing botApplications, botInstallations, botCommands, botInteractions,
botEvents, botRateLimits and botAuditLogs already implement identities, hashed
tokens, consent, grants capped by human permissions and role/channel rules,
REST messaging/moderation, durable leased events, Ed25519 signed webhooks and
an unpublished external Node SDK. Existing uploads use direct Convex storage
URLs and single-resource claims. Gaps: content validation, reservation ownership,
quotas, expiring attachment access, asset management, Mermaid, application URLs,
gateway sessions, some REST operations/events and advanced interactions/docs.

## Phases and dependencies

1. Extend shared validation/contracts, optional schema fields, indexed gateway
   sessions, daily usage and safe API operations. Add `/api/v1/`; preserve legacy
   routes and event names. Reuse permissions and moderation/audit records.
2. Secure direct uploads with owner-bound, expiring reservations; inspect actual
   content server-side before making it usable. Add storage quotas, explicit
   allowlist, lifecycle cleanup, expiring authorized downloads, file and asset
   browsers. Keep existing Convex object storage rather than moving live files.
3. Extend typed command arguments, interactions/components, response deadlines
   and SDK helpers/reconnection. Preserve existing commands. No hosted user code.
4. Add official Mermaid and DOMPurify with isolated rendering, strict security,
   input/complexity/time bounds, lazy preview, source, zoom/pan and SVG export.
   Store source in existing message content. Add composer templates and preview.
5. Extend developer portal using existing UI; add ownership/duplication, metadata,
   asset manager, real analytics and controlled API/event testing. Add public
   `/docs` with search/navigation/highlight/copy and actual endpoint definitions.
6. Run existing and new meaningful tests, local Convex/SDK/browser integration,
   review intended files for credentials, fetch/reconcile remote changes, commit
   and push `feature/developer-ecosystem`; verify remote commit/files.

New dependencies: Mermaid, DOMPurify, file-type, fflate (Office ZIP validation).
No new database or authentication provider. Existing Convex API code generation
continues through `npm run gen:convex`. Changes deploy additively; old records
are preserved. Private attachment URLs require a server-side signing secret.
Webhook signing continues to use the existing Ed25519 configuration.

## Validation and external setup

Validate owner isolation, token invalidation, grants/hierarchy, pagination,
events/leases/revocation, command/component validation, quotas/signatures,
signed expiry and deletion, SDK retries, Mermaid syntax/security and docs links.
Run typecheck, lint, SDK/build, bot/I/O/email/voice/desktop tests and browser
checks. Disposable integration tests must never target the live deployment.

Vercel does not deploy Convex. Deploy backend to the exact frontend deployment
before shipping UI. Configure download signing and webhook signing in Convex.
The docs hostname can point to the existing Vercel project; `/docs` works without
DNS changes. SDK publication requires a separate npm publishing action and is
not claimed here. Malware scanning is an external service: signature validation
and quarantine do not constitute a malware scan.
