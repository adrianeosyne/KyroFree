// Grant view_channel, send_messages, upload_attachments.
// Configure KYRO_ANNOUNCEMENT_CHANNEL_ID; optionally KYRO_REPORT_PATH.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
const channel = process.env.KYRO_ANNOUNCEMENT_CHANNEL_ID;
if (!channel) throw new Error("KYRO_ANNOUNCEMENT_CHANNEL_ID is required");
await client.sendMessage(channel, {
  content: "Community announcement",
  embeds: [
    {
      title: "What's new",
      description: "Our next community event is ready!",
      color: "#5865F2",
    },
  ],
  files: process.env.KYRO_REPORT_PATH ? [process.env.KYRO_REPORT_PATH] : [],
});
await client.destroy();
