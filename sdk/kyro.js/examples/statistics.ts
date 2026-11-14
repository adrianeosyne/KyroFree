// Enable interaction.created; grant view_channel and send_messages.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("interaction.created", async (interaction) => {
  if (interaction.data.name !== "stats") return;
  const serverId = interaction.data.serverId;
  const [server, channels] = await Promise.all([
    client.server(serverId),
    client.channels(serverId),
  ]);
  let members = 0,
    cursor: string | null = null;
  do {
    const page: { members: unknown[]; nextCursor: string | null } =
      await client.request(
        "GET",
        `/servers/${serverId}/members?limit=100${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      );
    members += page.members.length;
    cursor = page.nextCursor;
  } while (cursor);
  await interaction.reply(
    `${server.name}: ${members} members, ${channels.channels.length} visible channels.`,
    { ephemeral: true },
  );
});
await client.registerCommand({
  name: "stats",
  description: "Show this server's statistics",
});
await client.login();
