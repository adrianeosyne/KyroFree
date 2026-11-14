// Enable interaction.created; grant view_channel, send_messages, create_polls.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("interaction.created", async (interaction) => {
  if (interaction.data.name !== "poll") return;
  const channel = interaction.data.channelId;
  const message = await client.sendMessage(channel, {
    content: String(interaction.data.options.question),
    nonce: interaction.data.id,
  });
  await client.createPoll(channel, message.id, {
    question: String(interaction.data.options.question),
    options: ["Yes", "No"],
    durationMinutes: 60,
  });
  await interaction.reply("Poll created.", { ephemeral: true });
});
await client.registerCommand({
  name: "poll",
  description: "Create a yes/no poll",
  options: [
    {
      name: "question",
      description: "Poll question",
      type: "string",
      required: true,
    },
  ],
});
await client.login();
