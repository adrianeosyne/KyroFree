// Correct adrianeosyne's Member Since date without deploying backend code.
// Preview: node scripts/correct-founder-member-since.mjs <deployment>
// Apply:   node scripts/correct-founder-member-since.mjs <deployment> --apply
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const [deployment, ...flags] = process.argv.slice(2);
if (!deployment || flags.some((flag) => flag !== "--apply")) {
  throw new Error(
    "Usage: node scripts/correct-founder-member-since.mjs <deployment> [--apply]",
  );
}
const require = createRequire(import.meta.url);
const convex = path.join(
  path.dirname(require.resolve("convex/package.json")),
  "bin/main.js",
);
function cli(args) {
  try {
    return execFileSync(
      process.execPath,
      [convex, ...args, "--deployment", deployment],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 },
    ).trim();
  } catch (cause) {
    throw new Error(
      String(cause.stderr ?? cause.message)
        .split("Available functions:")[0]
        .trim(),
    );
  }
}
const founderId = cli(["env", "get", "KYRO_FOUNDER_USER_ID"]);
if (!/^[a-zA-Z0-9]+$/.test(founderId)) {
  throw new Error("The founder account is not configured.");
}
function state() {
  return JSON.parse(
    cli([
      "run",
      "--inline-query",
      `const user = await ctx.db.get(${JSON.stringify(founderId)});
      if (!user || user.username !== "adrianeosyne" || user.deletedAt) {
        throw new Error("The configured founder is not the active adrianeosyne account.");
      }
      return { username: user.username, createdAt: user.createdAt ?? null };`,
    ]),
  );
}
const before = state();
const original = new Date(before.createdAt ?? NaN);
if (!Number.isFinite(original.getTime())) {
  throw new Error("The founder account has no valid Member Since date.");
}
const originalDay = original.toISOString().slice(0, 10);
if (originalDay !== "2026-11-01" && originalDay !== "2026-10-15") {
  throw new Error(
    `Expected Nov 1, 2026 or Oct 15, 2026; found ${originalDay}.`,
  );
}
// Preserve the account's time of day while correcting its calendar date.
const corrected = new Date(original);
corrected.setUTCFullYear(2026, 9, 15);
const createdAt = corrected.getTime();
const changed = before.createdAt !== createdAt;
if (!flags.includes("--apply")) {
  console.log(
    JSON.stringify(
      {
        deployment,
        dryRun: true,
        username: before.username,
        before: original.toISOString(),
        after: corrected.toISOString(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (changed) {
  const { accessToken } = JSON.parse(
    readFileSync(path.join(homedir(), ".convex/config.json"), "utf8"),
  );
  if (!accessToken) throw new Error("Log in with the Convex CLI first.");
  const response = await fetch(
    "https://api.convex.dev/api/deployment/authorize_within_current_project",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selectedDeploymentName: deployment,
        projectSelection: {
          kind: "deploymentName",
          deploymentName: deployment,
        },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) {
    throw new Error(`Convex authorization failed (${response.status}).`);
  }
  const credentials = await response.json();
  if (credentials.url !== `https://${deployment}.convex.cloud`) {
    throw new Error("The authorized deployment does not match the target.");
  }
  const client = new ConvexHttpClient(credentials.url);
  client.setAdminAuth(credentials.adminKey);
  // Dashboard system mutations must use the mutation endpoint, not CLI run.
  const result = await client.mutation(
    makeFunctionReference("_system/frontend/patchDocumentsFields"),
    { table: "users", ids: [founderId], fields: { createdAt } },
  );
  if (result?.success !== true) {
    throw new Error(result?.error ?? "The Member Since correction failed.");
  }
}
const after = state();
const profile = JSON.parse(
  cli([
    "run",
    "users:me",
    "{}",
    "--identity",
    JSON.stringify({ subject: founderId }),
  ]),
);
const publicProfile = JSON.parse(
  cli([
    "run",
    "users:profile",
    JSON.stringify({ userId: founderId }),
    "--identity",
    JSON.stringify({ subject: founderId }),
  ]),
);
if (
  after.createdAt !== createdAt ||
  profile?.id !== founderId ||
  profile.memberSince !== createdAt ||
  profile.createdAt !== createdAt ||
  publicProfile?.user?.id !== founderId ||
  publicProfile.user.memberSince !== createdAt
) {
  throw new Error("Could not verify the corrected Member Since date.");
}
console.log(
  JSON.stringify(
    {
      deployment,
      changed,
      verified: true,
      username: after.username,
      memberSince: corrected.toISOString(),
    },
    null,
    2,
  ),
);
