import { API_ENDPOINTS } from "./apiReference";
import { BOT_PERMISSIONS, EVENT_NAMES } from "./botContract";
import { PERMISSION_META } from "./permissions";
import { FILE_TYPES } from "./filePolicy";
export interface DocSection {
  title: string;
  text: string;
  code?: string;
  language?: string;
}
export interface DocPage {
  slug: string;
  title: string;
  group: string;
  summary: string;
  sections: DocSection[];
}
const sdkSetup = `import { KyroClient } from "kyro.js";\n\nconst client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });\nclient.on("ready", () => console.log("Connected to Kyro"));\nclient.on("message.created", async message => {\n  if (!message.author.bot && message.content === "!hello") {\n    await message.reply({ content: "Hello from Kyro!", nonce: "hello:" + message.id });\n  }\n});\nclient.on("error", error => console.error(error.message));\nawait client.login();`;
export const DOC_PAGES: DocPage[] = [
  {
    slug: "welcome",
    title: "Welcome to Kyro Developers",
    group: "Introduction",
    summary:
      "Build free community tools with Kyro's bot API, durable events, commands, and official SDK.",
    sections: [
      {
        title: "What you can build",
        text: "Build welcome, moderation, logging, utility, poll, ticket, announcement and server statistics bots. Bots run on your own infrastructure. Kyro does not run developer-supplied code or charge for access to the developer platform.",
      },
      {
        title: "Architecture and versioning",
        text: "The React portal uses Kyro's existing Convex authentication. The REST API is https://kyro-chat.cyou/api/v1. Vercel forwards JSON requests to Convex. Convex stores the database, durable event outbox and object storage. Gateway v1 uses durable polling with identified sessions and signed HTTPS webhooks. The older /api/bots/v1 path and camelCase event types remain compatible.",
      },
      {
        title: "Developer terms and policies",
        text: "Follow Kyro's terms and privacy policy. Request only permissions your bot needs, provide clear support and privacy URLs, respect community moderation, protect tokens, and avoid unsolicited messages. Review /terms and /privacy on Kyro before distributing your integration.",
      },
    ],
  },
  {
    slug: "getting-started",
    title: "Your first bot",
    group: "Getting started",
    summary: "Create an application, install it and respond to a real event.",
    sections: [
      {
        title: "Create an application and bot",
        text: "Sign in to Kyro, open Developer Portal, and select New application. Choose an application name, unique bot username and description. An application owns one bot identity; the account has a BOT badge and cannot sign in as a human.",
      },
      {
        title: "Save the one-time token",
        text: "Copy the newly generated token into your bot host's KYRO_BOT_TOKEN secret. Close the token dialog after saving. Existing tokens cannot be retrieved. Generate a replacement if the original was lost.",
      },
      {
        title: "Install and subscribe",
        text: "Open Installation, copy the installation link, select a server you manage and approve its permissions. Enable message.created in Events, keep SDK event polling selected, and grant view_channel, read_message_history and send_messages. Sensitive permissions require explicit consent and cannot exceed the installer's own authority.",
      },
      {
        title: "Connect with the SDK",
        text: "The SDK is distributed from this repository and is not published to npm. Clone adrianeosyne/KyroFree, run npm ci and npm run build:sdk, then install the local SDK package into your Node.js 20.19+ project. Run this example with your saved token.",
        code: sdkSetup,
        language: "typescript",
      },
      {
        title: "Test in isolation",
        text: "Use a separate application and token for testing. In its Sandbox section, create a private test server, install the bot, and open the server to send a message. API and event logs appear in Analytics and Events. The API testing panel restricts writes to this private test server.",
      },
    ],
  },
  {
    slug: "authentication",
    title: "Authentication and installation",
    group: "Authentication",
    summary:
      "Bot credentials, rotation, authorization headers and installation consent.",
    sections: [
      {
        title: "Bot authentication",
        text: "Every protected REST request uses Authorization: Bot <token>. Tokens contain 32 cryptographically random bytes and use the kyro_bot_ prefix. Only their SHA-256 hashes are stored. Authentication checks bot enabled status, suspension, revocation and account availability on every request.",
        code: 'curl "https://kyro-chat.cyou/api/v1/me" \\\n  -H "Authorization: Bot $KYRO_BOT_TOKEN"',
        language: "bash",
      },
      {
        title: "Rotation and revocation",
        text: "The Bot Token page confirms before rotating or revoking. Rotation invalidates the previous token and its gateway sessions immediately. Update the token in your external host. Token changes are audited; API requests track last-used activity without logging the credential.",
      },
      {
        title: "OAuth2-style installation consent",
        text: "Installation links identify the application. The signed-in manager chooses the target server and permissions. Authorization records bind the account, application, server, permission list, secure state and ten-minute expiry; approval consumes the authorization once. This is an installation authorization flow, not a generic user OAuth token service. Registered HTTPS redirect URIs are validated exactly. Human login remains Convex Auth.",
      },
      {
        title: "Security recommendations",
        text: "Keep tokens in environment secrets, never browser code, source control or logs. Use HTTPS, explicit grants and separate test applications. Revoke compromised tokens promptly. Ownership transfers require acceptance and revoke credentials; contact email is owner-only.",
      },
    ],
  },
  {
    slug: "api",
    title: "REST API reference",
    group: "REST API",
    summary: `${API_ENDPOINTS.length} implemented routes, sourced from the API's routing definitions.`,
    sections: [
      {
        title: "Requests and responses",
        text: "Use JSON with Content-Type: application/json and the Bot authorization header. JSON requests are limited to 64 KiB. Successful replies use {ok:true,data:…}; failures use {ok:false,error:{code,message}}. File bytes go directly to storage using upload URLs.",
        code: JSON.stringify(
          {
            ok: false,
            error: {
              code: "MISSING_PERMISSION",
              message: "Missing permission: send_messages.",
            },
          },
          null,
          2,
        ),
        language: "json",
      },
      {
        title: "Rate limits",
        text: "Each bot may make 120 accepted requests per minute. 429 responses include Retry-After in seconds. Messages additionally allow five messages per five seconds and respect channel slow mode. Upload reservations allow 20 per minute per identity. Do not retry non-idempotent writes automatically; use message nonces and honor Retry-After.",
      },
      {
        title: "Pagination and collection bounds",
        text: "Messages, members, bans, audit logs and moderation cases use limit (1–100) and opaque cursor pagination. Use nextCursor until null. Commands and installations are bounded at 100. Preserve cursor strings exactly. The before message parameter uses Unix milliseconds; cursor avoids losing rows sharing a timestamp.",
      },
      {
        title: "Error codes",
        text: "400 INVALID_REQUEST/INVALID_JSON/INVALID_UPLOAD: fix input. 401 UNAUTHORIZED/SESSION_EXPIRED: authenticate or reconnect. 403 MISSING_PERMISSION/ROLE_HIERARCHY: review grants. 404 NOT_FOUND: check IDs and scope. 409 conflict: check resource state. 410 INTERACTION_EXPIRED: acknowledge promptly. 413 PAYLOAD_TOO_LARGE: reduce JSON size. 429 RATE_LIMITED: wait. 502 UPSTREAM_UNAVAILABLE: retry safe reads later. Internal credentials and private database fields are excluded.",
      },
    ],
  },
  {
    slug: "gateway",
    title: "Gateway connections",
    group: "Gateway",
    summary:
      "Identified durable polling, heartbeats, acknowledgements and reconnection.",
    sections: [
      {
        title: "Connect and identify",
        text: "GET /gateway describes v1. POST /gateway/sessions with a label creates a connection ID. Poll GET /events?sessionId=ID at approximately 2.5-second intervals. Send POST /gateway/sessions/ID/heartbeat every 30 seconds; the session expires after 90 seconds. Ten active sessions per bot are allowed. DELETE the session to disconnect. SDK login handles this lifecycle.",
      },
      {
        title: "Event delivery",
        text: "Events commit atomically with the source database mutation. The outbox survives serverless restarts. Each envelope has applicationId, id, type (legacy or canonical), name (canonical dotted name), version:1, serverId, nullable channelId, timestamp in milliseconds and data. Only subscribed, authorized events are delivered.",
        code: JSON.stringify(
          {
            id: "EVENT_ID",
            version: 1,
            type: "messageCreate",
            name: "message.created",
            serverId: "SERVER_ID",
            channelId: "CHANNEL_ID",
            timestamp: 1794528000000,
            data: { id: "MESSAGE_ID", content: "Hello", attachments: [] },
          },
          null,
          2,
        ),
        language: "json",
      },
      {
        title: "Leases and acknowledgements",
        text: "GET /events leases at most 25 events for 60 seconds. POST /events/ack with {ids:[…]} after successful durable processing. Poll delivery allows six attempts before an event is dead; event retention is seven days. Webhooks are scheduled immediately on enqueue and retried by durable workers. Defaults retry after 1, 5, 15, 60 and 360 minutes; the portal configures 1–6 attempts and a 10–3,600-second base multiplied by 1, 5, 15, 60 and 360. Permission and membership revocation are checked again at delivery. A server.deleted event contains only the deleted server ID and can deliver after the installation is removed.",
      },
      {
        title: "Reconnection and duplicate protection",
        text: "The SDK reconnects expired sessions and backs off transient failures exponentially up to 60 seconds, respecting rate-limit delays. Revoked or unavailable bots stop. Gateway delivery is at least once: use event IDs in your own durable database. The SDK caches processed event IDs in memory; this cache does not survive a process restart.",
      },
    ],
  },
  {
    slug: "events",
    title: "Event reference",
    group: "Events",
    summary: "Every implemented event and the data it delivers.",
    sections: [
      {
        title: "Names and subscriptions",
        text: "Select event subscriptions in the portal. messageCreate/messageUpdate/messageDelete, memberJoin/memberLeave/memberUpdate, serverCreate/serverUpdate, channelCreate/channelDelete, roleCreate/roleUpdate and interactionCreate are compatibility aliases for dotted event names. The SDK accepts either listener spelling.",
      },
      ...Object.entries({
        "message.created / message.updated":
          "A public message DTO: id, channelId, content, embeds, components, replyToId, createdAt, editedAt, author and attachments. Requires view_channel and read_message_history. Attachment URLs expire and recheck authorization.",
        "message.deleted":
          "{id,channelId}. Requires view_channel and read_message_history. Contains no deleted message content.",
        "message.reaction_added / message.reaction_removed":
          "{messageId,channelId,userId,emoji}. Requires view_channel and read_message_history; emitted when a reaction record is inserted/deleted.",
        "member.joined / member.left / member.updated":
          "{id,username,name,bot,roleIds,nickname,joinedAt}. Requires view_channel in the server; emitted by existing membership mutations as well as the bot API.",
        "member.banned / member.unbanned":
          "{id,serverId}. Requires server visibility. Contains no private moderation reason.",
        "member.timeout":
          "{id,communicationDisabledUntil}, nullable Unix milliseconds. Requires server visibility. Emitted when timeout state changes.",
        "server.created / server.updated":
          "{id,name,description,ownerId}. Requires server visibility. server.created is also delivered to the newly installed bot if subscribed.",
        "server.deleted":
          "{id}. Authorized at deletion before memberships are cleaned up. Contains only the deleted server ID.",
        "channel.created / channel.updated":
          "{id,name,kind,serverId}. Requires channel visibility. Hidden channel changes do not disclose metadata.",
        "channel.deleted":
          "{id,serverId}. Requires server visibility; only IDs are included to avoid exposing hidden names.",
        "role.created / role.updated":
          "{id,name,permissions,color,position}. Requires server visibility.",
        "role.deleted": "{id,serverId}. Requires server visibility.",
        "interaction.created":
          "{id,kind,commandId?,name?,customId?,userId,channelId,serverId,options,acknowledgeBy,expiresAt}. Delivered only to the owning application. Command, button, select and modal interactions use the same response endpoints.",
        "slash_command.executed":
          "{id,commandId,name,userId,channelId,serverId,options,subcommand}. A command execution notification for the owning application. Respond using the interaction ID from interaction.created.",
        "button.clicked / select_menu.selected / modal.submitted":
          "Interaction payload with kind and customId. Select options include {value}; modal options contain submitted field values. Only the owning application receives these events.",
        "attachment.created / attachment.deleted":
          "{id,name,size,mimeType,messageId}. Requires channel access and message history. Creation occurs when a verified file is claimed by a channel message; deletion follows file cleanup.",
      }).map(([title, text]) => ({
        title,
        text:
          text +
          " Delivery uses the durable v1 envelope, retries and at-least-once semantics described in Gateway.",
      })),
    ],
  },
  {
    slug: "webhooks",
    title: "Signed webhooks",
    group: "Gateway",
    summary: "Configure, test and verify HTTPS event delivery.",
    sections: [
      {
        title: "Configuration and delivery",
        text: "Configure a public HTTPS endpoint on port 443 in Webhooks, select subscriptions and switch to webhook delivery. Toggle back to polling to disable the webhook. Pending outbox entries migrate to the selected transport in bounded jobs. Delivery logs show status, attempts and safe error codes; failed entries can be retried before their retention expiry.",
      },
      {
        title: "Verification",
        text: "Kyro signs timestamp + '.' + rawBody using Ed25519. Requests include X-Kyro-Signature (base64), X-Kyro-Timestamp (Unix seconds) and X-Kyro-Event-Id. Pin the public key from /api/v1/webhook-key (public discovery endpoint). verifyWebhook enforces a five-minute timestamp window. Verify raw bytes before JSON parsing, compare applicationId to your expected application ID, persist event IDs to prevent replay, and return 2xx only after accepting work durably.",
        code: 'import { verifyWebhook } from "kyro.js";\nif (!verifyWebhook(rawBody, signature, timestamp, pinnedPublicKey)) {\n  throw new Error("Invalid webhook signature");\n}\nconst event = JSON.parse(rawBody);\nif (event.applicationId !== expectedApplicationId) throw new Error("Wrong application");\n// Atomically deduplicate event.id and enqueue work before returning 2xx.',
        language: "typescript",
      },
      {
        title: "Destination safety and testing",
        text: "HTTP, credential-bearing URLs, private IPv4 networks, redirects and unsafe ports are rejected. DNS is resolved and pinned for each outgoing request to resist rebinding. Outgoing requests have time limits. Configure the platform Ed25519 private key on Convex, never in VITE variables. Use a subscribed test event from a private sandbox to test the actual delivery worker.",
      },
    ],
  },
  {
    slug: "commands",
    title: "Commands and components",
    group: "Commands",
    summary:
      "Register commands with typed arguments and respond to interactions.",
    sections: [
      {
        title: "Slash commands and scopes",
        text: "Commands appear as /bot_username:command. Omit serverId for global commands; a server-specific command overrides the same global name. Names are 1–32 lowercase characters starting with a letter. Descriptions are 1–100 characters. Up to 100 commands per application, ten leaf arguments and 25 subcommands.",
      },
      {
        title: "Arguments and subcommands",
        text: "Argument types are string, integer, number, boolean, user, channel and role. required controls mandatory input. String choices are static values. Channel and role IDs are checked against the current server and channel visibility. Subcommands can optionally have a group; put leaf options within each subcommand instead of mixing them with root options.",
        code: 'await client.registerCommand({\n  name: "admin", description: "Community tools",\n  subcommands: [{ group: "member", name: "inspect", description: "Inspect a member",\n    options: [{ name: "user", description: "Member", type: "user", required: true }] }]\n});',
        language: "typescript",
      },
      {
        title: "Autocomplete and context commands",
        text: "Set autocomplete:true on a string argument without static choices. Typing in the command dialog queues an autocomplete interaction; respond using interaction.autocomplete with up to 25 label/value choices within 30 seconds. Register type:user or type:message for context commands. Members open Application actions from a message menu; the interaction carries targetId after server visibility checks.",
      },
      {
        title: "Buttons and select menus",
        text: "Messages accept up to five validated components. Each has a developer customId that is checked against the persisted message, and each click creates a server-generated interaction ID. Disabled components cannot be invoked. Select values must match registered choices.",
        code: 'await client.sendMessage(channelId, {\n  content: "Choose an action",\n  components: [{ type: "button", customId: "ticket:create", label: "Open ticket", style: "primary" },\n    { type: "select", customId: "category", options: [{ label: "Support", value: "support" }] }]\n});',
        language: "typescript",
      },
      {
        title: "Acknowledgements, modals and private replies",
        text: "Acknowledge within 15 seconds and respond once within 15 minutes. The SDK acknowledges new interactions before dispatching handlers. Ephemeral text responses are visible only to the invoking account. showModal opens up to five validated text fields for that account; submissions create new interactions.",
        code: 'client.on("interaction.created", async interaction => {\n  if (interaction.customId === "ticket:create") {\n    await interaction.showModal({ customId: "ticket", title: "Open ticket",\n      fields: [{ customId: "subject", label: "Subject", required: true, maxLength: 100 }] });\n  } else if (interaction.kind === "modal") {\n    await interaction.reply("Ticket received", { ephemeral: true });\n  }\n});',
        language: "typescript",
      },
    ],
  },
  {
    slug: "messaging",
    title: "Messages, replies and embeds",
    group: "Messaging",
    summary:
      "Send content that respects channel grants, slow mode and AutoMod.",
    sections: [
      {
        title: "Send, reply, edit and delete",
        text: "sendMessage accepts text or an object with content, embeds, components, attachmentIds, replyToId and nonce. Bots can edit only their own messages. Deleting another author's message requires manage_messages. Replies must reference the same channel. Mass and role mentions require mention_everyone. Reactions require add_reactions.",
        code: 'const message = await client.sendMessage(channelId, "Hello!");\nawait message.edit("Updated");\nawait message.react("👍");\nawait message.reply("A reply");\nawait message.delete();',
        language: "typescript",
      },
      {
        title: "Embeds",
        text: "Send up to three embeds with title, description, HTTPS url, hexadecimal color and up to ten name/value fields. React renders text safely; embed fields cannot inject HTML. AutoMod checks embed text as well as message content.",
      },
      {
        title: "Delivery and permissions",
        text: "Channel overrides, bot installation caps, timeouts, read-only channels, server lockdown, rules channels, custom emoji membership and AutoMod apply on the backend. Nonces make repeated message sends idempotent within a channel. Do not rely on client-side disabled controls for security.",
      },
    ],
  },
  {
    slug: "files",
    title: "Files and object storage",
    group: "File uploads",
    summary: "Direct uploads, verified content, quotas and private downloads.",
    sections: [
      {
        title: "Workflow",
        text: "Reserve an upload with original filename, actual byte length and SHA-256 hex digest. Kyro checks identity, channel permission, allowlist, rate limit and quota, then returns a direct Convex object-storage URL. POST file bytes to that URL. Register the returned storageId with uploadId. A server action compares bytes, signature and digest before marking metadata verified. Send the verified storage ID as attachmentIds.",
      },
      {
        title: "Types and limits",
        text: `Supported formats: ${Object.values(FILE_TYPES)
          .flatMap((t) => t.extensions)
          .join(
            ", ",
          )}. Each file is at most 10 MiB; messages accept six attachments. Default quota is 250 MiB per identity, with a 2,000-file metadata bound. SVG, HTML and executables are disabled. ZIPs and Office documents are inspected for traversal, executable entries, macros and excessive expansion. The backend can restrict allowed extensions and configure quota.`,
      },
      {
        title: "SDK uploads",
        text: "The SDK computes the digest, uploads directly, registers verification and attaches the file. Paths are read on the developer's Node host. A Blob with name also works.",
        code: 'await client.sendMessage(channelId, {\n  content: "Here is your report", files: ["./report.pdf"]\n});\nconst id = await client.upload(channelId, new Blob(["Hello"], { type: "text/plain" }), "hello.txt");\nawait client.sendMessage(channelId, { content: "File", attachmentIds: [id] });',
        language: "typescript",
      },
      {
        title: "Access, retention and quarantine",
        text: "Downloads use HMAC-SHA256 signed URLs valid for approximately 15 minutes. Each download rechecks the viewer, message/container membership, channel access and bot availability. No raw object keys or storage credentials are exposed in attachment metadata. Uploaded files have owner, size, MIME, timestamp, status, application/channel context and resource claims. A referenced file cannot be deleted from the asset manager. Message deletion uses existing ownership-aware cleanup. Rejected files cannot be claimed or downloaded. Signature validation is not a malware scanner; an external scanner is a separate deployment integration.",
      },
      {
        title: "Application assets",
        text: "File Assets lists application-owned uploads with previews, file IDs, metadata and storage usage. Upload branding from General Information or Bot Configuration. Assets remain private until deliberately attached to a visible message or used as public application/profile branding.",
      },
    ],
  },
  {
    slug: "permissions",
    title: "Permissions and hierarchy",
    group: "Permissions",
    summary: "Existing Kyro capabilities cap every bot operation.",
    sections: [
      {
        title: "Grants and hierarchy",
        text: "Installation grants form a ceiling. Effective access is the intersection of grants, current membership roles and channel overrides. Bots never gain administrator bypass or grant themselves privileges. Role changes and member moderation require targets below the bot's highest role; the server owner and the bot itself cannot be moderated. Managers may grant only powers they hold. Disabling/removing an installation immediately stops API and event access.",
      },
      ...BOT_PERMISSIONS.map((p) => ({
        title: p,
        text: `${PERMISSION_META[p].label}: ${PERMISSION_META[p].description} This permission must be explicitly granted to the installation and remain allowed by role/channel rules.`,
      })),
      {
        title: "Permission mapping",
        text: "Kyro reuses its existing permissions: ATTACH_FILES maps to upload_attachments; VIEW_SERVER/VIEW_CHANNELS/VIEW_ROLES map to view_channel; channel creation/update/deletion uses manage_channels; assigning roles uses manage_roles; unbanning uses ban_members; own edits use send_messages and authorship. No separate permission bitfield or authentication system is introduced.",
      },
    ],
  },
  {
    slug: "sdk",
    title: "kyro.js SDK",
    group: "SDK",
    summary:
      "Official Node.js / TypeScript client, version 0.2.0, distributed from the repository.",
    sections: [
      {
        title: "Install and initialize",
        text: "The package is not published to npm. Build from adrianeosyne/KyroFree and install the local sdk/kyro.js directory. Requires Node 20.19+ and ES modules. TypeScript definitions ship with the build. Token is required; baseUrl defaults to https://kyro-chat.cyou/api/v1. Optional label identifies the gateway connection.",
        code: "git clone https://github.com/adrianeosyne/KyroFree.git\ncd KyroFree\nnpm ci\nnpm run build:sdk\n# In your bot project:\nnpm install /absolute/path/to/Kyro/sdk/kyro.js",
        language: "bash",
      },
      {
        title: "Events and lifecycle",
        text: "on/off accept typed events and asynchronous handlers. login authenticates, identifies a session, emits ready and starts polling. destroy aborts requests and disconnects. Errors are emitted through error; reconnecting reports exponential-backoff attempts. Both dotted and legacy event names are supported. Subscribe on the application before expecting events.",
        code: sdkSetup,
        language: "typescript",
      },
      {
        title: "Helpers and errors",
        text: "KyroMessage adds reply/edit/delete/react. KyroInteraction adds reply/acknowledge/showModal. Client helpers cover messages, reactions, polls, server/channel/role operations, commands and uploads. request<T> exposes every REST route, with typed result interfaces. KyroApiError includes status, code and retryAfter. Writes are never retried automatically. Use safe error messages, message nonces and durable event deduplication.",
      },
    ],
  },
  {
    slug: "examples",
    title: "Example bots",
    group: "Examples",
    summary:
      "Complete runnable bot examples are included in sdk/kyro.js/examples.",
    sections: [
      ...[
        "welcome",
        "moderation",
        "logging",
        "utility",
        "poll",
        "ticket",
        "announcement",
        "statistics",
      ].map((name) => ({
        title: name[0].toUpperCase() + name.slice(1) + " bot",
        text: `Build the SDK, configure KYRO_BOT_TOKEN and the environment variables described at the top of examples/${name}.ts, then run it with tsx from the repository. Choose only the permissions it needs, install it in a test server first, and enable its event subscriptions.`,
      })),
      {
        title: "Hosting and idempotency",
        text: "Run your bots on your own Node infrastructure. Keep credentials in secret environment variables. Welcome/logging examples use event IDs as message nonces. Persist IDs for external side effects. The ticket example persists requests on the bot host, posts to an existing staff channel and provides an authorized close command. Moderation operations and polls need their documented granular permissions.",
      },
    ],
  },
  {
    slug: "mermaid",
    title: "Mermaid diagrams in chats",
    group: "Messaging",
    summary: "Share diagrams as editable source directly inside messages.",
    sections: [
      {
        title: "Syntax and supported diagrams",
        text: "Only fenced code explicitly labelled mermaid renders as a diagram. Mermaid 12 supports flowcharts, sequence, class, state, ER, Gantt, journey, Git, pie, mindmap, timeline, quadrant, requirement and architecture diagrams. Ordinary code blocks remain code. Original source stays in message content.",
        code: "```mermaid\nflowchart TD\n    A[Open Kyro] --> B[Sign in]\n    B --> C[Join server]\n    C --> D[Send message]\n```",
        language: "text",
      },
      {
        title: "Composer and controls",
        text: "Use Create Mermaid diagram in the composer, choose one of six templates, edit the source and preview. Rendered diagrams offer Copy source, View source, Download SVG and an expanded viewer with keyboard zoom and pan. Previews adapt to light/dark theme and mobile width.",
      },
      {
        title: "Safety and limits",
        text: "Strict Mermaid security disables links and unsafe configuration. Rendering occurs in a sandboxed iframe with a restrictive CSP. DOMPurify sanitizes SVG and removes active/external content; the parent displays a Blob image. Rendering is lazy, input is bounded to 12,000 characters/200 lines/200 connections, and a timeout discards slow previews. Message limits still apply. Invalid syntax has a plain-text error and view-source fallback.",
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    group: "Troubleshooting",
    summary:
      "Diagnose credentials, permissions, delivery, interactions and storage.",
    sections: [
      {
        title: "Invalid token or missing permissions",
        text: "Check Bot authorization syntax, enabled state, suspension and token rotation. Install the bot before calling server endpoints. Review both installation grants and channel overrides. Bots cannot bypass a deny with administrator roles. Move the bot's managed role above lower roles before assigning or moderating them.",
      },
      {
        title: "Bot not connecting or events missing",
        text: "Use HTTPS and the correct deployment. Check Events subscriptions and SDK polling mode. Confirm the backend was deployed: Vercel does not deploy Convex. View Analytics sessions and Events delivery status. SESSION_EXPIRED reconnects; revoked credentials stop. Dead deliveries can be retried before expiry.",
      },
      {
        title: "Rate limits, commands and interaction timeouts",
        text: "Honor Retry-After. Register valid unique option names and use the correct command scope. Required arguments and referenced member/channel/role IDs are checked. Acknowledge interactions within 15 seconds before doing lengthy work, then respond within 15 minutes.",
      },
      {
        title: "Upload and download errors",
        text: "Check the actual signature, extension, hash and file size, not just Content-Type. Quarantine means the file failed validation. Quotas count reservations and existing files. Downloads require current conversation or channel access; refresh expired signed URLs. Configure KYRO_FILE_SIGNING_SECRET on the correct Convex deployment.",
      },
    ],
  },
  {
    slug: "deployment",
    title: "Deployment and configuration",
    group: "Introduction",
    summary: "Keep Convex, Vercel, object storage and domains aligned.",
    sections: [
      {
        title: "Required environment",
        text: "Vercel: VITE_CONVEX_URL (existing frontend deployment), optional BOT_CONVEX_SITE_URL for the REST proxy. Convex: KYRO_FILE_SIGNING_SECRET (at least 32 random characters) for attachments; existing KYRO_BOT_WEBHOOK_PRIVATE_KEY (base64 PKCS8 Ed25519) for webhook signing. Optional KYRO_STORAGE_QUOTA_BYTES and KYRO_UPLOAD_EXTENSIONS restrict storage. Keep existing SMTP/email, Convex Auth and LiveKit variables intact. Never prefix server secrets with VITE_.",
      },
      {
        title: "Backend and storage setup",
        text: "Convex object storage is already integrated; no new bucket credentials or database migration are needed. Deploy additive schema/functions to the exact Convex deployment used by the site before deploying the frontend. Confirm the intended deployment in CLI output before applying changes. Add download signing through Convex's secure environment controls. Existing files and user data are retained.",
      },
      {
        title: "Vercel and documentation URL",
        text: "Build with npm run build. Keep /api/v1 and legacy bot rewrites and the Mermaid HTML renderer asset. Developer documentation uses https://kyro-chat.cyou/docs on the existing site. No separate documentation domain or DNS configuration is required.",
      },
    ],
  },
  {
    slug: "changelog",
    title: "Changelog",
    group: "Changelog",
    summary: "API v1 and SDK 0.2.0 developer ecosystem upgrade.",
    sections: [
      {
        title: "0.2.0 — November 2026",
        text: "Adds the /api/v1 alias, identified gateway sessions, canonical event names, more moderation/file endpoints, secure file reservations and content validation, private downloads, developer assets, database-backed analytics, command options/subcommands/components/modals, Mermaid chat diagrams and searchable documentation. Legacy API paths and existing data remain supported. Upload clients must upgrade to the reservation/size/SHA-256 protocol in SDK 0.2.0; unbound legacy registration is rejected for security. The SDK remains repository-distributed.",
      },
    ],
  },
];
export function searchDocs(query: string) {
  const terms = query
    .trim()
    .toLowerCase()
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean);
  return terms.length
    ? DOC_PAGES.filter((p) => {
        const text =
          `${p.title} ${p.summary} ${p.sections.map((s) => s.title + " " + s.text).join(" ")}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      })
    : [];
}
export const DOC_EVENT_ALIASES = EVENT_NAMES;
