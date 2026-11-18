// Remove Premium from the configured adrianeosyne account without deploying code.
// Preview: node scripts/remove-founder-premium.mjs <deployment>
// Apply:   node scripts/remove-founder-premium.mjs <deployment> --apply
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const [deployment, ...flags] = process.argv.slice(2);
if (!deployment || flags.some((flag) => flag !== "--apply")) {
  throw new Error(
    "Usage: node scripts/remove-founder-premium.mjs <deployment> [--apply]",
  );
}
const require = createRequire(import.meta.url);
const convexRoot = path.dirname(require.resolve("convex/package.json"));
const convex = path.join(convexRoot, "bin/main.js");
const apply = flags.includes("--apply");
function cli(args) {
  try {
    return execFileSync(
      process.execPath,
      [convex, ...args, "--deployment", deployment],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60000,
      },
    ).trim();
  } catch (cause) {
    const error = new Error(
      String(cause.stderr ?? cause.message)
        .split("Available functions:")[0]
        .trim(),
    );
    error.stderr = error.message;
    throw error;
  }
}
function run(name, args, identity) {
  const output = cli([
    "run",
    name,
    JSON.stringify(args),
    ...(identity ? ["--identity", JSON.stringify(identity)] : []),
  ]);
  const result = output ? JSON.parse(output) : null;
  if (result?.success === false)
    throw new Error(result.error ?? `${name} failed.`);
  return result;
}
const founderId = cli(["env", "get", "KYRO_FOUNDER_USER_ID"]);
if (!/^[a-zA-Z0-9]+$/.test(founderId))
  throw new Error("The founder account is not configured.");
function state() {
  return JSON.parse(
    cli([
      "run",
      "--inline-query",
      `
    const user = await ctx.db.get(${JSON.stringify(founderId)});
    if (!user || user.username !== "adrianeosyne" || user.deletedAt) {
      throw new Error("The configured founder is not the active adrianeosyne account.");
    }
    const memberships = await ctx.db.query("serverMembers").withIndex("by_user", q => q.eq("userId", user._id)).collect();
    let premiumHqRole = false;
    for (const membership of memberships) {
      const server = await ctx.db.get(membership.serverId);
      if (!server?.isPlatformHome) continue;
      for (const roleId of membership.roleIds) {
        const role = await ctx.db.get(roleId);
        if (role?.name.trim().toLowerCase() === "premium") premiumHqRole = true;
      }
    }
    return {
      username: user.username,
      activePremium: (user.premiumUntil ?? 0) > Date.now(),
      premiumUntil: user.premiumUntil ?? null,
      premiumStreakSince: user.premiumStreakSince ?? null,
      premiumBadgeTier: user.premiumBadgeTier ?? null,
      premiumHqRole,
    };
  `,
    ]),
  );
}
const before = state();
if (!apply) {
  console.log(JSON.stringify({ deployment, dryRun: true, ...before }, null, 2));
  process.exit(0);
}
const needsRemoval =
  before.premiumUntil !== null ||
  before.premiumStreakSince !== null ||
  before.premiumBadgeTier !== null ||
  before.premiumHqRole;
if (needsRemoval) {
  run(
    "premium:grant",
    { userId: founderId, revoke: true },
    { subject: founderId },
  );
}
const after = state();
const profile = run("users:me", {}, { subject: founderId });
if (!profile || profile.id !== founderId) {
  throw new Error("Could not verify the founder's public profile.");
}
if (
  after.activePremium ||
  after.premiumUntil !== null ||
  after.premiumStreakSince !== null ||
  after.premiumBadgeTier !== null ||
  after.premiumHqRole ||
  profile?.badges?.includes("premium")
) {
  throw new Error(
    "Premium removal did not finish. Inspect the account before retrying.",
  );
}
console.log(
  JSON.stringify(
    {
      deployment,
      removed: needsRemoval,
      verified: true,
      username: after.username,
      activePremium: false,
      premiumBadge: false,
      premiumHqRole: false,
    },
    null,
    2,
  ),
);
