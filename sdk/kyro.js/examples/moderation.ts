// Enable interaction.created; grant view_channel, send_messages, timeout_members.
// The invoking member must also have timeout_members; targets must be below the bot.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("interaction.created", async (interaction) => {
  if (interaction.data.name !== "timeout" || interaction.kind !== "command")
    return;
  await client.request(
    "PUT",
    `/servers/${interaction.data.serverId}/members/${interaction.data.options.user}/timeout`,
    {
      durationMinutes: interaction.data.options.minutes,
      reason: "Moderator requested timeout",
    },
  );
  await interaction.reply("Member timed out.", { ephemeral: true });
});
await client.registerCommand({
  name: "timeout",
  description: "Timeout a member",
  permissions: ["timeout_members"],
  options: [
    { name: "user", description: "Member", type: "user", required: true },
    {
      name: "minutes",
      description: "Minutes (1–10080)",
      type: "integer",
      required: true,
    },
  ],
});
await client.login();
