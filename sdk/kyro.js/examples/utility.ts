// Enable interaction.created; grant view_channel and send_messages.
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("interaction.created", async (interaction) => {
  if (interaction.data.name === "echo")
    await interaction.reply(String(interaction.data.options.text), {
      ephemeral: true,
    });
});
await client.registerCommand({
  name: "echo",
  description: "Echo your text privately",
  options: [
    { name: "text", description: "Text", type: "string", required: true },
  ],
});
await client.login();
