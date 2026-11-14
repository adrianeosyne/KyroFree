import { BOT_EVENTS, BOT_PERMISSIONS } from "./botContract";
import { API_ENDPOINTS } from "./apiReference";
import { PERMISSION_META } from "./permissions";

export interface DocSection {
  title: string;
  text: string;
  code?: string;
  language?: string;
  link?: { href: string; label: string };
}
export interface DocPage {
  slug: string;
  title: string;
  group: string;
  summary: string;
  sections: DocSection[];
}

const sdkSetup = `import { KyroClient } from "kyro.js";

const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("ready", () => console.log("Bot is online!"));
client.on("messageCreate", async (message) => {
  if (!message.author.bot && message.content === "!ping") {
    await message.reply({ content: "Pong!", nonce: "pong:" + message.id });
  }
});
client.on("error", (error) => console.error(error.message));
await client.login();`;

export const DOC_PAGES: DocPage[] = [
  {
    slug: "welcome",
    title: "Welcome to Kyro Developers",
    group: "Introduction",
    summary:
      "Build community bots with Kyro's REST API, events, slash commands, and official TypeScript SDK.",
    sections: [
      {
        title: "Build your first bot",
        text: "Create an application in the Developer portal, install it in a server you manage, and connect your code. Your bot can reply to messages, welcome members, run commands, and help moderate your community. You host the bot on your own infrastructure.",
        link: {
          href: "/docs/getting-started",
          label: "Follow the quick start",
        },
      },
      {
        title: "API and SDK versions",
        text: "These guides describe the current API v1 at https://kyro-chat.cyou/api/bots/v1 and kyro.js SDK 0.1.0. The SDK is distributed from the KyroFree repository and is not published to npm. Choose SDK polling or signed HTTPS webhooks to receive events.",
        link: { href: "/docs/api", label: "Browse the REST API reference" },
      },
      {
        title: "Developer responsibilities",
        text: "Request only permissions your bot needs, protect its token, respect server moderation and member privacy, and follow Kyro's Terms of Service, Privacy Policy, and Copyright Policy. Access to the source does not grant permission to copy Kyro into a competing website.",
        link: { href: "/copyright", label: "Review Kyro's policies" },
      },
    ],
  },
  {
    slug: "getting-started",
    title: "Your first bot",
    group: "Getting started",
    summary:
      "Create an application, install it, and reply to your first message.",
    sections: [
      {
        title: "1. Create an application",
        text: "Sign in to Kyro and open Developer portal. Select New application, enter a name and unique bot username, and save the token shown once. Store it as KYRO_BOT_TOKEN in your bot host's secret environment.",
        link: { href: "/dashboard/developers", label: "Open Developer portal" },
      },
      {
        title: "2. Subscribe and install",
        text: "Under Webhooks & Events, subscribe to messageCreate and select SDK polling. Under Permissions, request View Channels, Read Message History, and Send Messages. Open Installation, follow the invite link, select a server you manage, review permissions, and authorize. Subscribe before installing if you need the initial serverCreate event.",
      },
      {
        title: "3. Install the SDK",
        text: "Use Node.js 20.19 or later and ES modules. Clone the repository, install its dependencies, and build the SDK. In your separate bot project, install that local package using the actual path to your checkout.",
        code: "git clone https://github.com/adrianeosyne/KyroFree.git\ncd KyroFree\nnpm ci\nnpm run build:sdk\n\n# In your separate bot project:\nnpm install /absolute/path/to/KyroFree/sdk/kyro.js",
        language: "sh",
      },
      {
        title: "4. Run your bot",
        text: "Save this as bot.mjs, configure KYRO_BOT_TOKEN on your host, and run node bot.mjs. Send !ping in a channel the bot can read and write. It should reply Pong! Keep the process running to receive events.",
        code: sdkSetup,
        language: "javascript",
      },
    ],
  },
  {
    slug: "authentication",
    title: "Authentication and tokens",
    group: "Getting started",
    summary: "Authenticate your bot and manage its credentials safely.",
    sections: [
      {
        title: "Bot authorization",
        text: "All REST endpoints except GET /webhook-key require the Bot authorization header. Replace the placeholder with your application's token. Tokens start with kyro_bot_ and contain 64 hexadecimal characters after the prefix. IDs are opaque strings; timestamps are Unix milliseconds.",
        code: "Authorization: Bot <your bot token>\nContent-Type: application/json",
        language: "http",
      },
      {
        title: "One-time credentials and rotation",
        text: "The portal displays a token only when creating or rotating it. Kyro stores its hash, so a lost token cannot be retrieved. Rotate it in Bot Token, update the host secret, and restart your bot. Rotation or revocation invalidates subsequent requests using the old token. Keep credentials out of source code, browser code, URLs, and logs.",
      },
      {
        title: "Installation authorization",
        text: "OAuth2 & Authorization in the portal is a server installation consent flow using a signed-in Kyro account. It does not provide third-party user login, authorization-code exchange, or access to a human account. A disabled, suspended, deleted, or revoked bot cannot authenticate.",
      },
    ],
  },
  {
    slug: "api",
    title: "REST API reference",
    group: "API",
    summary:
      "The current bot endpoints, request inputs, response fields, and required permissions.",
    sections: [
      {
        title: "Base URL and request format",
        text: "Use https://kyro-chat.cyou/api/bots/v1. Every endpoint below except /webhook-key requires Authorization: Bot <token>. Send JSON request bodies. Server and channel endpoints require a current installation and channel visibility. Replace path parameters with real IDs.",
        code: 'const response = await fetch("https://kyro-chat.cyou/api/bots/v1/me", {\n  headers: { Authorization: "Bot " + process.env.KYRO_BOT_TOKEN },\n});\nconsole.log(await response.json());',
        language: "javascript",
      },
      {
        title: "Responses, errors, and rate limits",
        text: "Success uses {ok:true,data:...}; errors use {ok:false,error:{code,message}}. Message and command creation return 201; other successful operations return 200. Common errors are 400 invalid input, 401 invalid token, 403 permission denied, 404 unavailable resource, 409 conflict, 410 expired interaction, 413 oversized body, and 429 rate limit. Honor Retry-After. Each application can make 120 requests/minute including polling, and send five messages/five seconds. Channel slow mode also applies. JSON bodies are limited to 64 KiB.",
      },
      {
        title: "Message, poll, and command objects",
        text: "See Messages for message and poll inputs, Files for uploads, and Slash commands for command options and replies. All endpoints below use the same authorization and response envelopes. Returned data and additional permissions are listed together.",
        link: {
          href: "/docs/messaging",
          label: "Read message and poll examples",
        },
      },
    ],
  },
  {
    slug: "gateway",
    title: "Connecting your bot",
    group: "Events",
    summary: "Choose SDK polling or HTTPS webhooks for event delivery.",
    sections: [
      {
        title: "SDK polling",
        text: "Select SDK polling under Webhooks & Events. client.login() authenticates, emits ready, and starts the polling loop. The default interval is 2500 ms, with a minimum of 2000 ms. client.destroy() stops polling and aborts requests. The current SDK uses HTTP polling rather than a WebSocket gateway.",
        code: sdkSetup,
        language: "javascript",
      },
      {
        title: "Handling events reliably",
        text: "The SDK awaits asynchronous handlers and acknowledges successful work. A failing handler leaves the event unacknowledged for redelivery. Revoked or disabled bots stop polling. Persist processed event IDs when side effects must survive restarts; use message nonces for repeat-safe replies.",
        link: { href: "/docs/events", label: "Understand event delivery" },
      },
      {
        title: "Webhook delivery",
        text: "Select webhook mode and set a public HTTPS endpoint. Verify signed requests and accept work durably before returning a 2xx response. Polling is unavailable while webhook mode is enabled. Switching modes migrates queued deliveries.",
        link: { href: "/docs/webhooks", label: "Set up signed webhooks" },
      },
    ],
  },
  {
    slug: "events",
    title: "Events and delivery",
    group: "Events",
    summary:
      "Subscribe to messages, memberships, server changes, and command interactions.",
    sections: [
      {
        title: "Available event names",
        text: "Enable subscriptions under Webhooks & Events. interactionCreate is always included. Event names are case-sensitive.",
        code: BOT_EVENTS.join("\n"),
      },
      {
        title: "Event envelope",
        text: "Every event includes id, type, serverId, channelId, timestamp, and data. Message create/update data is a message object; deletion events contain IDs only. Member events describe membership, role, or nickname changes. serverCreate means a server became available to this bot on installation. Interaction data includes the command ID, name, user, channel, server, typed options, and expiry.",
      },
      {
        title: "Polling and acknowledgements",
        text: "GET /events leases up to 25 events for 60 seconds. POST /events/ack with {ids:[...]} after handling them successfully. Delivery is at least once; events can repeat and ordering is not guaranteed across retries or consumers. Events expire after seven days with up to six attempts before a dead status. Owners can retry dead, unexpired deliveries from the portal.",
      },
      {
        title: "Visibility and deduplication",
        text: "Kyro rechecks subscriptions, application status, membership, and channel visibility before delivery. Message events also require Read Message History. The SDK remembers 10,000 processed event IDs in memory. Store IDs durably for work that must not repeat after a restart.",
      },
    ],
  },
  {
    slug: "webhooks",
    title: "Signed webhooks",
    group: "Events",
    summary: "Receive and verify event deliveries on your own HTTPS endpoint.",
    sections: [
      {
        title: "Configure a destination",
        text: "Set webhook mode and a public HTTPS URL on port 443 in Webhooks & Events. Private, loopback, credential-bearing, non-443, and redirecting destinations are rejected. The transport requires public IPv4. The worker runs every minute and accepts only 2xx responses; failures retry after 1 minute, 5 minutes, 15 minutes, 1 hour, and 6 hours.",
      },
      {
        title: "Verify before processing",
        text: "Retrieve and pin the platform Ed25519 key from GET /api/bots/v1/webhook-key. Verify the raw body with X-Kyro-Signature and X-Kyro-Timestamp before JSON parsing. Compare X-Kyro-Event-Id with the signed event ID. The timestamp window is five minutes; persist event IDs to reject replays inside that window. Return 2xx only after accepting work durably.",
        code: 'import { verifyWebhook } from "kyro.js";\n\n// rawBody and headers come from your HTTP server.\nconst valid = verifyWebhook(\n  rawBody,\n  headers["x-kyro-signature"],\n  headers["x-kyro-timestamp"],\n  process.env.KYRO_WEBHOOK_PUBLIC_KEY,\n);\nif (!valid) throw new Error("Invalid webhook signature");\nconst event = JSON.parse(rawBody);\nif (event.id !== headers["x-kyro-event-id"]) {\n  throw new Error("Event ID mismatch");\n}\n// Durably deduplicate and enqueue this event before returning 2xx.',
        language: "javascript",
        link: {
          href: "https://github.com/adrianeosyne/KyroFree/blob/main/sdk/kyro.js/examples/webhook.ts",
          label: "View the complete webhook server example",
        },
      },
    ],
  },
  {
    slug: "commands",
    title: "Slash commands",
    group: "Commands",
    summary:
      "Register typed commands and send public or private interaction replies.",
    sections: [
      {
        title: "Register a command",
        text: "Commands appear as /bot_username:command. Omit serverId for a global command or set it for a server override. Names start with a lowercase letter and use 1–32 lowercase letters, digits, underscores, or hyphens. Descriptions are 1–100 characters. Each command accepts up to ten uniquely named options of type string, integer, boolean, or user. String options may have up to 25 static choices.",
        code: 'await client.registerCommand({\n  name: "greet",\n  description: "Greet a member",\n  options: [{\n    name: "user", description: "Who to greet",\n    type: "user", required: true,\n  }],\n});\nclient.on("interactionCreate", async (interaction) => {\n  if (interaction.name === "greet") {\n    await interaction.reply("Hello, member " + interaction.options.user + "!", {\n      ephemeral: true,\n    });\n  }\n});',
        language: "javascript",
      },
      {
        title: "Respond once within 15 minutes",
        text: "interaction.reply(content,{ephemeral:true}) is visible only to the invoking user. Omit ephemeral for a public reply. Reply content is 1–2000 characters. A repeated response returns 409 and an expired interaction returns 410. Member permissions and current server membership are checked. Persist interaction IDs when your handler can restart.",
      },
    ],
  },
  {
    slug: "messaging",
    title: "Messages, embeds, and polls",
    group: "Messaging",
    summary: "Send, edit, reply, react, and create polls with the bot SDK.",
    sections: [
      {
        title: "Send and reply",
        text: "sendMessage accepts a string or an object with content, embeds, attachmentIds, replyToId, and nonce. Content is at most 2000 characters. Replies must reference a message in the same channel. A nonce of 1–100 characters makes retries idempotent for that application and channel while the message exists.",
        code: 'const message = await client.sendMessage(channelId, {\n  content: "Release is ready",\n  nonce: "release-42",\n  embeds: [{\n    title: "Build complete", description: "All checks passed",\n    url: "https://example.com/build/42", color: "#5865F2",\n    fields: [{ name: "Version", value: "1.0" }],\n  }],\n});\nawait message.edit("Release has shipped");\nawait message.react("👍");\nawait message.reply("Read the release notes above");',
        language: "javascript",
      },
      {
        title: "Embeds, edits, and permissions",
        text: "Messages allow three embeds and six attachments. Embed titles are limited to 256 characters, descriptions to 2000, and fields to ten name/value pairs. Bots can edit their own messages; edits replace content and embeds while preserving attachments. Deleting another author's message requires Manage Messages. Reactions require Add Reactions. Channel restrictions, slow mode, timeouts, and AutoMod apply.",
      },
      {
        title: "Create a poll",
        text: "Attach one poll to a message your bot owns. Grant Create Polls and Send Messages. Questions are at most 300 characters with 2–10 options of at most 100 characters. Optional durationMinutes is 1–10080.",
        code: 'const message = await client.sendMessage(channelId, "Choose our next event");\nawait client.createPoll(channelId, message.id, {\n  question: "Which event?",\n  options: ["Game night", "Movie night"],\n  multipleChoice: false,\n  durationMinutes: 60,\n});',
        language: "javascript",
      },
      {
        title: "Read message history",
        text: "GET /channels/:channelId/messages returns messages newest first and nextCursor. Supply limit (1–100, default 50) and reuse nextCursor as cursor for the next page, keeping other parameters fixed. before is an optional exclusive Unix-millisecond timestamp filter. Reading history requires Read Message History and channel visibility.",
      },
    ],
  },
  {
    slug: "files",
    title: "File uploads",
    group: "Messaging",
    summary: "Upload an attachment and include it in a bot message.",
    sections: [
      {
        title: "Upload using the SDK",
        text: "Grant Upload Attachments and Send Messages. client.upload(channelId,blob,name) obtains an upload URL, uploads the bytes, and registers the storage ID. Pass that ID in attachmentIds when sending. Each file is limited to 10 MiB and a message allows six attachments. File allowlists, ownership, and single-claim rules apply.",
        code: 'const storageId = await client.upload(\n  channelId,\n  new Blob(["Hello from Kyro!"], { type: "text/plain" }),\n  "hello.txt",\n);\nawait client.sendMessage(channelId, {\n  content: "Here is your file", attachmentIds: [storageId],\n});',
        language: "javascript",
      },
      {
        title: "REST upload flow",
        text: "POST {} to /channels/:channelId/uploads for uploadUrl and maximumBytes. POST file bytes to that URL with their actual content type. Read storageId from the upload response, then POST {storageId,name} to /channels/:channelId/uploads/register. Use the registered ID as an attachment. Do not reuse an attachment already claimed by another message.",
      },
    ],
  },
  {
    slug: "permissions",
    title: "Permissions and hierarchy",
    group: "Permissions",
    summary:
      "Understand installation grants, channel access, and role ordering.",
    sections: [
      {
        title: "Grants and channel overrides",
        text: "Effective permissions are the intersection of the installation grant, current server roles, and channel overrides. Changing default permissions does not expand existing grants. Bots cannot bypass channel denies with Administrator. Server settings → Bots lets managers edit grants or remove an installation.",
      },
      {
        title: "Role hierarchy",
        text: "Move the bot's role above roles and members it needs to manage. A bot cannot manage the server owner, itself, equal or higher roles, managed bot roles, or the default role. Installers and bots cannot delegate permissions they do not hold.",
      },
      ...BOT_PERMISSIONS.map((permission) => ({
        title: permission,
        text: `${PERMISSION_META[permission].label}: ${PERMISSION_META[permission].description}`,
      })),
    ],
  },
  {
    slug: "sdk",
    title: "kyro.js SDK",
    group: "SDK",
    summary: "The official Node.js and TypeScript client, version 0.1.0.",
    sections: [
      {
        title: "Installation and configuration",
        text: "Build sdk/kyro.js from the KyroFree repository and install that local package. It is not published to npm. Requires Node.js 20.19+ and ES modules. new KyroClient({token,baseUrl?,pollIntervalMs?,fetch?}) defaults to https://kyro-chat.cyou/api/bots/v1. Non-local connections require HTTPS.",
        link: {
          href: "/docs/getting-started",
          label: "Install and run your first bot",
        },
      },
      {
        title: "Lifecycle and helpers",
        text: "login authenticates and starts polling; destroy aborts requests and stops it. on/off manage typed asynchronous handlers. KyroMessage adds reply, edit, delete, and react. KyroInteraction exposes the command ID, name, user/server/channel IDs, options, and reply. Helpers cover messages, uploads, polls, servers, channels, roles, moderation, and commands. request(method,path,body) supports the full REST contract.",
      },
      {
        title: "Errors and retries",
        text: "KyroApiError contains status, code, retryAfter, and a safe server message. HTTP writes are not automatically retried. Honor 429 delays, use message nonces for repeated sends, and persist event IDs for durable deduplication. Register an error handler and avoid logging credentials.",
        link: {
          href: "https://github.com/adrianeosyne/KyroFree/blob/main/sdk/kyro.js/README.md",
          label: "Read the SDK source guide",
        },
      },
    ],
  },
  {
    slug: "examples",
    title: "Example bots",
    group: "SDK",
    summary: "Start with the runnable examples included in the repository.",
    sections: [
      {
        title: "Ping bot",
        text: "The polling example registers a ping command and responds to !ping. Build the SDK, set KYRO_BOT_TOKEN, enable messageCreate with SDK polling, and install the bot in a test server with View Channels, Read Message History, and Send Messages. Run npx tsx sdk/kyro.js/examples/ping.ts from the repository root.",
        link: {
          href: "https://github.com/adrianeosyne/KyroFree/blob/main/sdk/kyro.js/examples/ping.ts",
          label: "View the ping example",
        },
      },
      {
        title: "Webhook server",
        text: "The webhook example verifies signatures and routes events to the same SDK handlers. Set KYRO_BOT_TOKEN and the pinned KYRO_WEBHOOK_PUBLIC_KEY, expose the server behind HTTPS, and configure the /events destination in the portal. Replace its in-memory deduplication with durable storage before running multiple instances.",
        link: {
          href: "https://github.com/adrianeosyne/KyroFree/blob/main/sdk/kyro.js/examples/webhook.ts",
          label: "View the webhook example",
        },
      },
    ],
  },
  {
    slug: "deployment",
    title: "Hosting your bot",
    group: "Support",
    summary: "Keep your bot running on your own Node.js host.",
    sections: [
      {
        title: "Choose a host",
        text: "Use a host that supports a persistent Node.js 20.19+ process for polling. Configure KYRO_BOT_TOKEN as a secret, install the built SDK, and start your bot with a process manager that restarts it on failure. Kyro provides the API; your bot code runs on your infrastructure.",
      },
      {
        title: "Updates and shutdown",
        text: "Test changes in a private server before rollout. Keep event deduplication in durable storage. Call client.destroy() during a graceful shutdown. When rotating a token in Kyro, update the host secret and restart the process.",
      },
      {
        title: "Webhook hosting",
        text: "For webhook delivery, use a public HTTPS endpoint on port 443 with public IPv4. Store the pinned verification key alongside your host configuration and verify raw request bytes before processing. Accept work durably and respond promptly with 2xx.",
      },
    ],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    group: "Support",
    summary: "Fix token, permission, event, command, and upload errors.",
    sections: [
      {
        title: "401 or bot unavailable",
        text: "Check Authorization: Bot <token>, the host's KYRO_BOT_TOKEN, and the application's enabled status. A rotated or revoked token stops working immediately for new authentication. Restart the process after updating its secret.",
      },
      {
        title: "403 or missing permissions",
        text: "Install the bot in the target server. Review installation grants, server roles, and channel overrides. Move the bot role above members or roles it should manage. Timeouts, locked channels, slow mode, and AutoMod can still restrict posting.",
      },
      {
        title: "No events or no command replies",
        text: "Subscribe to the exact event name, such as messageCreate, under Webhooks & Events. Select SDK polling before calling login, and keep the process running. Message events require Read Message History. Check delivery logs and use /bot_username:command in the composer. Respond to each interaction only once, within 15 minutes.",
      },
      {
        title: "404, rate limits, or upload errors",
        text: "Use the full API base https://kyro-chat.cyou/api/bots/v1 and real resource IDs. Honor Retry-After for 429 responses. For uploads, check permissions, allowed file type, actual content type, the 10 MiB cap, registration, and ownership. Vite's development server alone does not provide the Vercel API proxy.",
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
    ? DOC_PAGES.filter((page) => {
        let text =
          `${page.title} ${page.summary} ${page.sections.map((section) => `${section.title} ${section.text} ${section.code ?? ""}`).join(" ")}`.toLowerCase();
        if (page.slug === "api") {
          text += API_ENDPOINTS.map((endpoint) =>
            ` ${endpoint.method} ${endpoint.path} ${endpoint.input} ${endpoint.result}`.toLowerCase(),
          ).join("");
        }
        return terms.every((term) => text.includes(term));
      })
    : [];
}
