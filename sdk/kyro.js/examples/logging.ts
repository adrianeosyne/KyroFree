// Enable member.joined and member.left; grant view_channel and send_messages.
// Configure KYRO_LOG_CHANNEL_ID. This logs membership without reading private messages.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("event", async (event) => {
  if (!["member.joined", "member.left"].includes(event.name ?? event.type))
    return;
  const channel = process.env.KYRO_LOG_CHANNEL_ID;
  if (channel)
    await client.sendMessage(channel, {
      content: `${event.name ?? event.type}: ${JSON.stringify(event.data)}`,
      nonce: event.id,
    });
});
await client.login();
