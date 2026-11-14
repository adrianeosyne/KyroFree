# kyro.js 0.2.0

TypeScript SDK for externally hosted Kyro bots. This package is distributed from the KyroFree repository; **it is not published to npm**.

Requires Node.js 20.19+ and ES modules. Build from the repository root with `npm ci` and `npm run build:sdk`, then run `npm install /absolute/path/to/KyroFree/sdk/kyro.js` in your bot project. Root dependencies supply the build toolchain; this SDK has no runtime package dependencies.

```ts
import { KyroClient } from "kyro.js";

const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("ready", () => console.log("Bot is online!"));
client.on("messageCreate", async (message) => {
  if (!message.author.bot && message.content === "!ping") {
    await message.reply({ content: "Pong!", nonce: `pong:${message.id}` });
  }
});
client.on("error", (error) => console.error(error.message));
await client.login();
```

Create the application in Kyro's Developer portal, save its one-time token in your host's secret environment, enable `message.created` under Webhooks & Events, select polling, and install it with View Channels, Read Message History and Send Messages.

## Client

`new KyroClient({token, baseUrl?, pollIntervalMs?, fetch?})` defaults to `https://kyro-chat.cyou/api/v1` and polls every 2500 ms (minimum 2000 ms). Local testing can use `baseUrl: "http://127.0.0.1:3211/api/v1"`. Non-local connections require HTTPS.

`login()` authenticates, emits `ready`, and starts the event loop; it returns the bot identity. `destroy()` stops polling, aborts requests and closes the gateway session. Sessions heartbeat every 30 seconds and expire after 90 seconds. `on()` / `off()` manage typed async handlers. A failing event handler is not acknowledged; the backend redelivers after its lease. A revoked/disabled bot stops the loop. Start the bot only after changing delivery mode to polling.

Dotted event names include all message/reaction, member/moderation, server/channel/role, interaction and attachment events listed in `/docs/events`. `reconnecting` reports retry attempts. Compatibility events: `ready`, `error`, `event` (full envelope), `messageCreate`, `messageUpdate`, `messageDelete`, `memberJoin`, `memberLeave`, `memberUpdate`, `serverCreate`, `serverUpdate`, `channelCreate`, `channelDelete`, `roleCreate`, `roleUpdate`, `interactionCreate`.

## API helpers

- Messages: `sendMessage`, `editMessage`, `deleteMessage`, `messages`, `addReaction`, `createPoll`, `upload`. `KyroMessage` adds `reply`, `edit`, `delete`, `react`.
- Communities: `servers`, `server`, `channels`, `channel`, `member`, `editServer`, `createChannel`, `editChannel`, `deleteChannel`.
- Roles/moderation: `roles`, `createRole`, `editRole`, `deleteRole`, `assignRole`, `removeRole`, `kick`, `ban`.
- Commands: `registerCommand`, `deleteCommand`, `respond`. `KyroInteraction` exposes ID, name, user/server/channel IDs, typed options and `reply(content,{ephemeral?})`.
- `request<T>(method,path,body?)` supports the full REST contract. It throws `KyroApiError` with `status`, `code`, `retryAfter` and a safe server message.

HTTP writes are not automatically retried. Honor 429 delays and use message nonces for operations you repeat. Event delivery is at least once: the SDK's processed-ID cache is in memory; persist deduplication records when work must survive restarts. Do not log credentials or whole request options.

## Slash commands

```ts
await client.registerCommand({
  name: "greet",
  description: "Greet a member",
  options: [
    { name: "user", description: "Who to greet", type: "user", required: true },
  ],
});
client.on("interactionCreate", async (interaction) => {
  if (interaction.name === "greet") {
    await interaction.reply(`Hello, member ${interaction.options.user}!`, {
      ephemeral: true,
    });
  }
});
```

An optional `serverId` creates a server override; absent means global. The composer uses `/bot_username:command`, displays typed options and static choices, and enforces required member permissions. Acknowledge within 15 seconds (automatic in SDK handlers), then respond once within 15 minutes.

## Webhooks

`verifyWebhook(rawBody, signature, timestamp, pinnedPublicKey)` verifies Ed25519 signatures and a five-minute timestamp window. Fetch/pin the platform key from `/webhook-key`. Verify raw bytes before parsing; store event IDs durably to reject replays. `client.handleEvent(verifiedEnvelope)` dispatches to the same handlers without starting polling.

See [the webhook example](examples/webhook.ts), [ping example](examples/ping.ts), and [complete API/setup guide](../../docs/bot-platform.md) for permissions, payloads, endpoint responses, deployment configuration, limits and retry semantics.

## Components, autocomplete and files

Commands support `type: "slash" | "user" | "message"`, subcommands/groups and
string, integer, number, boolean, user, channel and role options. String options
may set `autocomplete: true`; handle `interaction.kind === "autocomplete"`
and call `interaction.autocomplete([{label:"General",value:"general"}])` within
30 seconds. Buttons/selects use persisted component IDs; `showModal` opens text
fields, and submitted values arrive in `interaction.options`.

```ts
await client.sendMessage(channelId, {
  content: "Your report",
  files: ["./report.pdf"],
  components: [{ type: "button", customId: "report:help", label: "Help" }],
});
```

Uploads go directly to Convex object storage and require `upload_attachments`.
The SDK reserves quota, hashes and uploads bytes, and requests server verification.
Limits are 10 MiB per file and six attachments per message; default identity
quota is 250 MiB. `file(id)`, `deleteFile(id)`, `removeReaction`, `timeout`,
`clearTimeout`, and `unban` cover the additional v1 operations.

Webhook consumers must also compare the verified envelope's `applicationId`
with their expected application ID; the signing key is shared by the platform.
Enable only one spelling of an event subscription to avoid redundant work.

Eight complete examples are in `examples/`; use their listed environment
variables and grants. Build with `npm run build:sdk`; run an example from the
repository root using `npx tsx sdk/kyro.js/examples/utility.ts`.

## Upgrading from 0.1

Both API prefixes remain available. Uploads now require owner-bound reservations
with byte length and SHA-256, followed by registration with the reservation ID.
Upgrade to SDK 0.2.0 before using uploads against the new backend. Old unbound
upload registration is rejected for security. Other existing API routes and
camelCase event listeners remain supported.
