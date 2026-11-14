import { z } from "zod";
import { PERMISSIONS, type Permission } from "./permissions";

export const BOT_PERMISSIONS: Permission[] = [
  PERMISSIONS.VIEW_CHANNEL,
  PERMISSIONS.SEND_MESSAGES,
  PERMISSIONS.READ_MESSAGE_HISTORY,
  PERMISSIONS.MANAGE_MESSAGES,
  PERMISSIONS.MANAGE_CHANNELS,
  PERMISSIONS.MANAGE_ROLES,
  PERMISSIONS.KICK_MEMBERS,
  PERMISSIONS.BAN_MEMBERS,
  PERMISSIONS.TIMEOUT_MEMBERS,
  PERMISSIONS.VIEW_AUDIT_LOG,
  PERMISSIONS.MANAGE_SERVER,
  PERMISSIONS.MENTION_EVERYONE,
  PERMISSIONS.ADD_REACTIONS,
  PERMISSIONS.UPLOAD_ATTACHMENTS,
  PERMISSIONS.USE_EXTERNAL_EMOJIS,
  PERMISSIONS.CREATE_POLLS,
];
export const DEFAULT_BOT_PERMISSIONS = [
  "view_channel",
  "send_messages",
  "read_message_history",
];
export const BOT_EVENTS = [
  "messageCreate",
  "messageUpdate",
  "messageDelete",
  "memberJoin",
  "memberLeave",
  "memberUpdate",
  "serverCreate",
  "serverUpdate",
  "channelCreate",
  "channelDelete",
  "roleCreate",
  "roleUpdate",
  "interactionCreate",
  "message.created",
  "message.updated",
  "message.deleted",
  "message.reaction_added",
  "message.reaction_removed",
  "member.joined",
  "member.left",
  "member.updated",
  "member.banned",
  "member.unbanned",
  "member.timeout",
  "server.created",
  "server.updated",
  "server.deleted",
  "channel.created",
  "channel.updated",
  "channel.deleted",
  "role.created",
  "role.updated",
  "role.deleted",
  "interaction.created",
  "slash_command.executed",
  "button.clicked",
  "select_menu.selected",
  "modal.submitted",
  "attachment.created",
  "attachment.deleted",
] as const;
export const EVENT_NAMES: Record<string, string> = {
  messageCreate: "message.created",
  messageUpdate: "message.updated",
  messageDelete: "message.deleted",
  memberJoin: "member.joined",
  memberLeave: "member.left",
  memberUpdate: "member.updated",
  serverCreate: "server.created",
  serverUpdate: "server.updated",
  channelCreate: "channel.created",
  channelDelete: "channel.deleted",
  roleCreate: "role.created",
  roleUpdate: "role.updated",
  interactionCreate: "interaction.created",
};
export function subscribedEvent(events: readonly string[], type: string) {
  return events.includes(type) || events.includes(EVENT_NAMES[type] ?? type);
}
export const BOT_CATEGORIES = [
  "General",
  "Moderation",
  "Utilities",
  "Games",
  "Community",
  "Productivity",
] as const;
export const permissionSchema = z
  .array(
    z
      .string()
      .refine(
        (p) => BOT_PERMISSIONS.includes(p as Permission),
        "Unsupported bot permission",
      ),
  )
  .max(BOT_PERMISSIONS.length)
  .transform((p) => [...new Set(p)]);
export const commandOptionSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    description: z.string().trim().min(1).max(100),
    type: z.enum([
      "string",
      "integer",
      "number",
      "boolean",
      "user",
      "channel",
      "role",
    ]),
    required: z.boolean().default(false),
    choices: z.array(z.string().min(1).max(100)).max(25).optional(),
    autocomplete: z.boolean().optional(),
  })
  .strict()
  .refine(
    (o) => !o.autocomplete || (o.type === "string" && !o.choices?.length),
    "Autocomplete requires a string argument without static choices",
  );
export const commandSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
    description: z.string().trim().min(1).max(100),
    serverId: z.string().optional(),
    type: z.enum(["slash", "user", "message"]).default("slash"),
    subcommands: z
      .array(
        z
          .object({
            name: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/),
            description: z.string().min(1).max(100),
            group: z
              .string()
              .regex(/^[a-z][a-z0-9_-]{0,31}$/)
              .optional(),
            options: z.array(commandOptionSchema).max(10).default([]),
          })
          .strict(),
      )
      .max(25)
      .default([]),
    permissions: permissionSchema.default([]),
    options: z.array(commandOptionSchema).max(10).default([]),
  })
  .strict()
  .refine(
    (c) => new Set(c.options.map((o) => o.name)).size === c.options.length,
    "Option names must be unique",
  )
  .refine(
    (c) => !c.subcommands.length || !c.options.length,
    "Put arguments inside subcommands when subcommands exist",
  )
  .refine(
    (c) =>
      new Set(c.subcommands.map((s) => `${s.group ?? ""}:${s.name}`)).size ===
        c.subcommands.length &&
      c.subcommands.every(
        (s) => new Set(s.options.map((o) => o.name)).size === s.options.length,
      ),
    "Subcommand and argument names must be unique",
  );
export type BotCommand = z.infer<typeof commandSchema>;
export const componentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("button"),
      customId: z.string().min(1).max(100),
      label: z.string().min(1).max(80),
      style: z.enum(["primary", "secondary", "danger"]).default("secondary"),
      disabled: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("select"),
      customId: z.string().min(1).max(100),
      placeholder: z.string().max(100).optional(),
      options: z
        .array(
          z
            .object({
              label: z.string().min(1).max(100),
              value: z.string().min(1).max(100),
            })
            .strict(),
        )
        .min(1)
        .max(25),
      disabled: z.boolean().optional(),
    })
    .strict(),
]);
export type BotComponent = z.infer<typeof componentSchema>;
export const modalSchema = z
  .object({
    customId: z.string().min(1).max(100),
    title: z.string().min(1).max(80),
    fields: z
      .array(
        z
          .object({
            customId: z.string().min(1).max(100),
            label: z.string().min(1).max(80),
            required: z.boolean().default(false),
            multiline: z.boolean().default(false),
            maxLength: z.number().int().min(1).max(1000).default(1000),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict()
  .refine(
    (m) => new Set(m.fields.map((f) => f.customId)).size === m.fields.length,
    "Modal field IDs must be unique",
  );
const safeUrl = z
  .string()
  .url()
  .max(2000)
  .refine((value) => /^https:\/\//i.test(value), "Use an HTTPS URL");
export const embedSchema = z
  .object({
    title: z.string().max(256).optional(),
    description: z.string().max(2000).optional(),
    url: safeUrl.optional(),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    fields: z
      .array(
        z
          .object({
            name: z.string().min(1).max(100),
            value: z.string().max(1000),
          })
          .strict(),
      )
      .max(10)
      .optional(),
  })
  .strict();
export const messageSchema = z
  .object({
    content: z.string().max(2000).default(""),
    embeds: z.array(embedSchema).max(3).default([]),
    components: z.array(componentSchema).max(5).default([]),
    replyToId: z.string().optional(),
    attachmentIds: z.array(z.string()).max(6).default([]),
    nonce: z.string().min(1).max(100).optional(),
  })
  .strict()
  .refine(
    (m) => m.content.trim() || m.embeds.length || m.attachmentIds.length,
    "A message cannot be empty",
  )
  .refine(
    (m) =>
      new Set(m.components.map((c) => c.customId)).size === m.components.length,
    "Component IDs must be unique",
  );
export type BotMessageInput = z.infer<typeof messageSchema>;
export const pollSchema = z
  .object({
    question: z.string().trim().min(1).max(300),
    options: z.array(z.string().trim().min(1).max(100)).min(2).max(10),
    multipleChoice: z.boolean().default(false),
    durationMinutes: z.number().int().min(1).max(10080).optional(),
  })
  .strict();

/** Secrets are created in browser memory; only this digest is sent to Convex. */
export async function generateBotCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `kyro_bot_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return {
    token,
    tokenHash: Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
