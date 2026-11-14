import { v } from "convex/values";
import { mutation, query } from "./functions";
import type { MutationCtx } from "./functions";
import type { Doc, Id } from "./_generated/dataModel";
import { componentSchema, modalSchema } from "../lib/botContract";
import { activeBot, botChannel, botError, limit } from "./botLib";
import { humanChannel } from "./botCommands";
import { queueBotEvent } from "./botEvents";
import { hasPermission } from "../lib/permissions";
import { restrictionLevel } from "./lib";
import { parseRequest } from "./botApiExtra";
import { z } from "zod";

async function interactiveAccess(ctx: MutationCtx, channelId: Id<"channels">) {
  const access = await humanChannel(ctx, channelId);
  if (
    !hasPermission(access.permissions, "send_messages") ||
    (access.member.communicationDisabledUntil ?? 0) > Date.now() ||
    (await restrictionLevel(ctx, access.id)) >= 2
  )
    botError(403, "FORBIDDEN", "You cannot use interactions while restricted.");
  if (
    (access.channel.readOnly ||
      (access.server.locked &&
        (!access.server.lockedUntil ||
          access.server.lockedUntil > Date.now()))) &&
    !hasPermission(access.permissions, "manage_messages")
  )
    botError(
      403,
      "CHANNEL_LOCKED",
      "Interactions are disabled in this channel.",
    );
  if (!(await limit(ctx, `components:${access.id}`, 20)))
    botError(429, "RATE_LIMITED", "Wait before using more components.");
  return access;
}
async function createInteraction(
  ctx: MutationCtx,
  app: Doc<"botApplications">,
  access: Awaited<ReturnType<typeof humanChannel>>,
  kind: string,
  customId: string,
  options: unknown,
  messageId?: Id<"messages">,
) {
  const now = Date.now();
  const id = await ctx.db.insert("botInteractions", {
    applicationId: app._id,
    userId: access.id,
    serverId: access.channel.serverId,
    channelId: access.channel._id,
    kind,
    customId,
    sourceMessageId: messageId,
    options: JSON.stringify(options),
    createdAt: now,
    acknowledgeBy: now + 15000,
    expiresAt: now + 15 * 60000,
  });
  const data = {
    id,
    kind,
    customId,
    userId: access.id,
    serverId: access.channel.serverId,
    channelId: access.channel._id,
    messageId: messageId ?? null,
    options,
    acknowledgeBy: now + 15000,
    expiresAt: now + 15 * 60000,
  };
  await queueBotEvent(
    ctx,
    access.channel.serverId,
    "interactionCreate",
    data,
    access.channel._id,
    app._id,
  );
  await queueBotEvent(
    ctx,
    access.channel.serverId,
    kind === "button"
      ? "button.clicked"
      : kind === "select"
        ? "select_menu.selected"
        : "modal.submitted",
    data,
    access.channel._id,
    app._id,
  );
  return id;
}
export const click = mutation({
  args: {
    channelId: v.id("channels"),
    messageId: v.id("messages"),
    customId: v.string(),
    value: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await interactiveAccess(ctx, args.channelId),
      message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.containerType !== "channel" ||
      message.containerId !== args.channelId
    )
      botError(404, "NOT_FOUND", "Message unavailable.");
    const author = await ctx.db.get(message.authorId),
      app = author?.botApplicationId
        ? await ctx.db.get(author.botApplicationId)
        : null;
    if (!app) botError(404, "NOT_FOUND", "Bot unavailable.");
    await activeBot(ctx, app.tokenHash ?? "");
    await botChannel(ctx, app, args.channelId);
    const components = z
      .array(componentSchema)
      .safeParse(message.components ?? []);
    if (!components.success)
      botError(400, "INVALID_COMPONENT", "Invalid message component.");
    const component = components.data.find((c) => c.customId === args.customId);
    if (!component || component.disabled)
      botError(400, "INVALID_COMPONENT", "Component unavailable.");
    if (
      component.type === "select" &&
      !component.options.some((o) => o.value === args.value)
    )
      botError(400, "INVALID_SELECTION", "Select a registered value.");
    if (component.type === "button" && args.value !== undefined)
      botError(400, "INVALID_SELECTION", "Buttons do not accept values.");
    return createInteraction(
      ctx,
      app,
      access,
      component.type,
      component.customId,
      component.type === "select" ? { value: args.value } : {},
      message._id,
    );
  },
});
export const submitModal = mutation({
  args: { interactionId: v.id("botInteractions"), values: v.any() },
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.interactionId);
    if (
      !original?.modal ||
      original.modalSubmittedAt ||
      original.expiresAt < Date.now()
    )
      botError(410, "MODAL_EXPIRED", "Modal expired or already submitted.");
    const access = await interactiveAccess(ctx, original.channelId);
    if (original.userId !== access.id)
      botError(403, "FORBIDDEN", "This modal belongs to another user.");
    const modal = modalSchema.parse(JSON.parse(original.modal));
    const values = parseRequest(
      z.record(z.string(), z.string().max(1000)),
      args.values,
    );
    if (
      Object.keys(values).some(
        (k) => !modal.fields.some((f) => f.customId === k),
      )
    )
      botError(400, "INVALID_FIELDS", "Unknown modal field.");
    for (const field of modal.fields)
      if (
        (field.required && !values[field.customId]?.trim()) ||
        (values[field.customId]?.length ?? 0) > field.maxLength
      )
        botError(400, "INVALID_FIELDS", `Check ${field.label}.`);
    const app = await ctx.db.get(original.applicationId);
    if (!app) botError(404, "NOT_FOUND", "Bot unavailable.");
    await activeBot(ctx, app.tokenHash ?? "");
    await botChannel(ctx, app, original.channelId);
    await ctx.db.patch(original._id, { modalSubmittedAt: Date.now() });
    return createInteraction(
      ctx,
      app,
      access,
      "modal",
      modal.customId,
      values,
      original.sourceMessageId,
    );
  },
});
export async function interactionApi(
  ctx: MutationCtx,
  app: Doc<"botApplications">,
  method: string,
  p: string[],
  body: unknown,
) {
  if (
    p.length !== 3 ||
    method !== "POST" ||
    !["ack", "modal", "choices"].includes(p[2])
  )
    return { handled: false };
  const id = ctx.db.normalizeId("botInteractions", p[1]),
    row = id ? await ctx.db.get(id) : null;
  if (!row || row.applicationId !== app._id)
    botError(404, "NOT_FOUND", "Interaction unavailable.");
  await botChannel(ctx, app, row.channelId);
  if (
    row.expiresAt < Date.now() ||
    (row.acknowledgeBy && !row.acknowledgedAt && row.acknowledgeBy < Date.now())
  )
    botError(
      410,
      "INTERACTION_EXPIRED",
      "Acknowledge interactions within 15 seconds.",
    );
  if (p[2] === "ack") {
    if (!row.acknowledgedAt)
      await ctx.db.patch(row._id, { acknowledgedAt: Date.now() });
    return {
      handled: true,
      data: { acknowledged: true, expiresAt: row.expiresAt },
    };
  }
  if (p[2] === "choices") {
    if (row.kind !== "autocomplete" || row.respondedAt)
      botError(
        409,
        "INVALID_INTERACTION",
        "Choices require an unanswered autocomplete interaction.",
      );
    const choices = parseRequest(
      z
        .object({
          choices: z
            .array(
              z
                .object({
                  label: z.string().min(1).max(100),
                  value: z.string().max(100),
                })
                .strict(),
            )
            .max(25),
        })
        .strict(),
      body,
    );
    await ctx.db.patch(row._id, {
      choices: JSON.stringify(choices.choices),
      acknowledgedAt: Date.now(),
      respondedAt: Date.now(),
    });
    return { handled: true, data: { accepted: true } };
  }
  if (row.kind === "autocomplete")
    botError(
      400,
      "INVALID_INTERACTION",
      "Autocomplete interactions accept choices only.",
    );
  if (row.respondedAt || row.modal)
    botError(409, "ALREADY_RESPONDED", "Interaction already has a response.");
  const modal = parseRequest(modalSchema, body);
  await ctx.db.patch(row._id, {
    modal: JSON.stringify(modal),
    acknowledgedAt: Date.now(),
    respondedAt: Date.now(),
  });
  return { handled: true, data: { id: row._id, modal: true } };
}

export const autocomplete = mutation({
  args: {
    channelId: v.id("channels"),
    commandId: v.id("botCommands"),
    option: v.string(),
    value: v.string(),
    subcommand: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await interactiveAccess(ctx, args.channelId);
    const command = await ctx.db.get(args.commandId);
    if (
      !command ||
      (command.serverId && command.serverId !== access.channel.serverId) ||
      args.value.length > 100
    )
      botError(400, "INVALID_COMMAND", "Command unavailable.");
    const app = await ctx.db.get(command.applicationId);
    if (!app) botError(404, "NOT_FOUND", "Bot unavailable.");
    await activeBot(ctx, app.tokenHash ?? "");
    await botChannel(ctx, app, args.channelId);
    if (
      !command.permissions.every((p) =>
        hasPermission(
          access.permissions,
          p as import("../lib/permissions").Permission,
        ),
      )
    )
      botError(403, "MISSING_PERMISSION", "Command access denied.");
    const variant = command.subcommands?.find(
      (s) => `${s.group ? s.group + " " : ""}${s.name}` === args.subcommand,
    );
    const option = (variant?.options ?? command.options).find(
      (o) => o.name === args.option,
    );
    if (!option?.autocomplete || option.type !== "string")
      botError(
        400,
        "INVALID_OPTION",
        "This argument does not support autocomplete.",
      );
    const now = Date.now();
    const id = await ctx.db.insert("botInteractions", {
      applicationId: app._id,
      commandId: command._id,
      kind: "autocomplete",
      customId: args.option,
      userId: access.id,
      serverId: access.channel.serverId,
      channelId: args.channelId,
      options: JSON.stringify({ value: args.value }),
      createdAt: now,
      acknowledgeBy: now + 15000,
      expiresAt: now + 30000,
    });
    await queueBotEvent(
      ctx,
      access.channel.serverId,
      "interactionCreate",
      {
        id,
        commandId: command._id,
        kind: "autocomplete",
        name: command.name,
        customId: args.option,
        options: { value: args.value },
        subcommand: args.subcommand ?? null,
        userId: access.id,
        channelId: args.channelId,
        serverId: access.channel.serverId,
        acknowledgeBy: now + 15000,
        expiresAt: now + 30000,
      },
      args.channelId,
      app._id,
    );
    return id;
  },
});
export const autocompleteResult = query({
  args: { interactionId: v.id("botInteractions") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.interactionId);
    if (!row || row.kind !== "autocomplete") return [];
    const access = await humanChannel(ctx, row.channelId);
    if (access.id !== row.userId)
      botError(403, "FORBIDDEN", "This interaction belongs to another user.");
    return row.expiresAt > Date.now() && row.choices
      ? (JSON.parse(row.choices) as { label: string; value: string }[])
      : [];
  },
});
