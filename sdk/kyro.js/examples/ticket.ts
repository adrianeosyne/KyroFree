// Enable interaction.created; grant view_channel and send_messages.
// Set KYRO_TICKET_PANEL_CHANNEL_ID and KYRO_TICKET_STAFF_CHANNEL_ID (a channel
// whose existing permissions restrict access to staff). KYRO_TICKET_DATA_DIR
// must point to persistent disk on the bot host. Run one instance per data dir.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { KyroClient } from "../src/index";
const client = new KyroClient({ token: process.env.KYRO_BOT_TOKEN });
const panel = process.env.KYRO_TICKET_PANEL_CHANNEL_ID;
const staff = process.env.KYRO_TICKET_STAFF_CHANNEL_ID;
const directory = process.env.KYRO_TICKET_DATA_DIR;
if (!panel || !staff || !directory)
  throw new Error(
    "Configure the ticket panel, staff channel and persistent data directory.",
  );
const root = resolve(directory);
await mkdir(root, { recursive: true, mode: 0o700 });
type Ticket = {
  id: string;
  userId: string;
  subject: string;
  status: "open" | "closed";
  createdAt: number;
  messageId?: string;
};
const path = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid ticket ID");
  return join(root, `${id}.json`);
};
const save = async (ticket: Ticket) => {
  await writeFile(path(ticket.id) + ".tmp", JSON.stringify(ticket), {
    mode: 0o600,
  });
  await rename(path(ticket.id) + ".tmp", path(ticket.id));
};
client.on("error", (error) => console.error(error.message));
process.on("SIGINT", () => void client.destroy());
client.on("interaction.created", async (interaction) => {
  if (
    interaction.customId === "ticket:create" &&
    interaction.kind === "button"
  ) {
    await interaction.showModal({
      customId: "ticket",
      title: "Support request",
      fields: [
        {
          customId: "subject",
          label: "Subject",
          required: true,
          maxLength: 100,
        },
      ],
    });
  } else if (
    interaction.customId === "ticket" &&
    interaction.kind === "modal"
  ) {
    let ticket: Ticket;
    try {
      ticket = JSON.parse(await readFile(path(interaction.id), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      ticket = {
        id: interaction.id,
        userId: interaction.userId,
        subject: String(interaction.options.subject),
        status: "open",
        createdAt: Date.now(),
      };
      await save(ticket);
    }
    const message = await client.sendMessage(staff, {
      content: `Support ticket ${ticket.id}`,
      embeds: [
        {
          title: "New support request",
          description: ticket.subject,
          fields: [{ name: "Member ID", value: ticket.userId }],
        },
      ],
      nonce: `ticket:${ticket.id}`,
    });
    ticket.messageId = message.id;
    await save(ticket);
    await interaction.reply(
      `Ticket ${ticket.id} received. Staff can now review it.`,
      { ephemeral: true },
    );
  } else if (
    interaction.kind === "command" &&
    interaction.name === "close_ticket"
  ) {
    if (interaction.channelId !== staff) {
      await interaction.reply("Close tickets in the staff channel.", {
        ephemeral: true,
      });
      return;
    }
    const ticket: Ticket = JSON.parse(
      await readFile(path(String(interaction.options.id)), "utf8"),
    );
    if (ticket.messageId)
      await client.editMessage(
        staff,
        ticket.messageId,
        `Support ticket ${ticket.id} closed by member ${interaction.userId}.`,
      );
    ticket.status = "closed";
    await save(ticket);
    await interaction.reply(`Ticket ${ticket.id} closed.`, { ephemeral: true });
  }
});
await client.registerCommand({
  name: "close_ticket",
  description: "Close a support ticket",
  permissions: ["manage_messages"],
  options: [
    { name: "id", description: "Ticket ID", type: "string", required: true },
  ],
});
await client.sendMessage(panel, {
  content: "Need help? Open a support request. Its subject is sent to staff.",
  components: [
    { type: "button", customId: "ticket:create", label: "Open support form" },
  ],
  nonce: "ticket-panel-v1",
});
await client.login();
