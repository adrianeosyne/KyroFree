// Enable member.joined; grant view_channel and send_messages.
// Configure KYRO_WELCOME_CHANNEL_ID for a channel in the installed server.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("event", async (event) => {
  if ((event.name ?? event.type) !== "member.joined") return;
  const member = event.data as { id: string; bot: boolean };
  if (member.bot) return;
  const channelId = process.env.KYRO_WELCOME_CHANNEL_ID;
  if (channelId)
    await client.sendMessage(channelId, {
      content: `Welcome, <@${member.id}>!`,
      nonce: `welcome:${event.id}`,
    });
});
await client.login();
