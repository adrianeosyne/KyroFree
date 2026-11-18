import { z } from "zod";
import { ALL_PERMISSIONS } from "./permissions";
const key = z.string().min(1).max(100);
const permission = z.enum(ALL_PERMISSIONS as [string, ...string[]]);
const https = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Use HTTPS links without credentials.");
const position = z.number().finite().min(0).max(100000);
export const communityBackupSchema = z
  .object({
    format: z.literal("kyro-community-backup"),
    version: z.literal(1),
    serverId: key,
    community: z
      .object({
        name: z.string().min(2).max(64),
        description: z.string().max(400),
        rules: z.string().max(2000),
        welcomeMessage: z.string().max(2000),
        isPublic: z.boolean(),
        tags: z.array(z.string().max(40)).max(10),
        tag: z.string().max(4).nullable(),
        links: z
          .array(z.object({ label: z.string().max(60), url: https }).strict())
          .max(10),
        verificationLevel: z.enum(["none", "low", "medium", "high"]),
        minAccountAgeMs: z
          .number()
          .int()
          .min(0)
          .max(31 * 86400000),
        applyToJoin: z.boolean(),
        applicationQuestions: z.array(z.string().max(200)).max(10),
        themeAccent: z.string().max(100).nullable(),
        themeTint: z.string().max(100).nullable(),
        rulesChannelKey: key.nullable(),
      })
      .strict(),
    roles: z
      .array(
        z
          .object({
            key,
            name: z.string().min(1).max(60),
            color: z.string().max(30).nullable(),
            position,
            permissions: z.array(permission).max(50),
            isDefault: z.boolean(),
            hoist: z.boolean(),
            mentionable: z.boolean(),
            protected: z.boolean(),
          })
          .strict(),
      )
      .max(200),
    categories: z
      .array(
        z.object({ key, name: z.string().min(1).max(60), position }).strict(),
      )
      .max(100),
    channels: z
      .array(
        z
          .object({
            key,
            categoryKey: key.nullable(),
            name: z.string().min(1).max(100),
            topic: z.string().max(1024),
            kind: z.enum(["text", "voice", "forum"]),
            position,
            slowMode: z.number().int().min(0).max(21600),
            readOnly: z.boolean(),
            premiumOnly: z.boolean(),
            permissionOverwrites: z
              .array(
                z
                  .object({
                    roleKey: key,
                    allow: z.array(permission).max(50),
                    deny: z.array(permission).max(50),
                  })
                  .strict(),
              )
              .max(100),
          })
          .strict(),
      )
      .max(200),
    automod: z
      .object({
        enabled: z.boolean(),
        blockedWords: z.array(z.string().max(100)).max(100),
        blockInvites: z.boolean(),
        blockLinks: z.boolean(),
        maxMentions: z.number().int().min(0).max(100),
        blockCaps: z.boolean(),
        blockSpam: z.boolean(),
        exemptRoleKeys: z.array(key).max(200),
        exemptChannelKeys: z.array(key).max(200),
      })
      .strict()
      .nullable(),
    lobby: z
      .object({
        enabled: z.boolean(),
        title: z.string().max(120),
        intro: z.string().max(5000),
        layout: z.string().max(60),
        background: z.string().max(30),
        panel: z.string().max(30),
        accent: z.string().max(30),
        sections: z
          .array(
            z
              .object({
                id: key,
                type: z.string().max(50),
                title: z.string().max(120),
                text: z.string().max(5000).optional(),
              })
              .strict(),
          )
          .max(30),
        buttons: z
          .array(
            z
              .object({ id: key, label: z.string().max(100), url: https })
              .strict(),
          )
          .max(20),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((backup, ctx) => {
    for (const [name, rows] of [
      ["roles", backup.roles],
      ["categories", backup.categories],
      ["channels", backup.channels],
    ] as const)
      if (new Set(rows.map((row) => row.key)).size !== rows.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${name} keys.` });
    if (backup.roles.filter((row) => row.isDefault).length !== 1)
      ctx.addIssue({
        code: "custom",
        message: "Exactly one default role is required.",
      });
    const roles = new Set(backup.roles.map((r) => r.key)),
      categories = new Set(backup.categories.map((r) => r.key)),
      channels = new Set(backup.channels.map((r) => r.key));
    if (
      backup.channels.some(
        (c) =>
          (c.categoryKey !== null && !categories.has(c.categoryKey)) ||
          c.permissionOverwrites.some((o) => !roles.has(o.roleKey)),
      ) ||
      (backup.community.rulesChannelKey !== null &&
        !channels.has(backup.community.rulesChannelKey)) ||
      backup.automod?.exemptRoleKeys.some((k) => !roles.has(k)) ||
      backup.automod?.exemptChannelKeys.some((k) => !channels.has(k))
    )
      ctx.addIssue({
        code: "custom",
        message: "Backup references are incomplete.",
      });
  });
export type CommunityBackup = z.infer<typeof communityBackupSchema>;
export function parseCommunityBackup(content: string) {
  if (new TextEncoder().encode(content).byteLength > 450000)
    throw new Error("Backup is too large. Use a file below 450 KB.");
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("Choose a valid JSON backup.");
  }
  const result = communityBackupSchema.safeParse(value);
  if (!result.success)
    throw new Error(result.error.issues[0]?.message ?? "Invalid backup.");
  return result.data;
}
