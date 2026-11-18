import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./functions";
import type { MutationCtx } from "./functions";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { deleteMessageData } from "./cleanup";

const cleanupArgs = {
  kind: v.union(
    v.literal("container"),
    v.literal("server"),
    v.literal("user"),
    v.literal("document"),
    v.literal("page"),
    v.literal("party"),
    v.literal("message"),
  ),
  id: v.string(),
  containerType: v.optional(
    v.union(v.literal("channel"), v.literal("conversation")),
  ),
  stage: v.optional(v.number()),
};
type Job = {
  kind:
    | "container"
    | "server"
    | "user"
    | "document"
    | "page"
    | "party"
    | "message";
  id: string;
  containerType?: "channel" | "conversation";
  stage?: number;
};
const worker = makeFunctionReference<"mutation">("advancedLifecycle:cleanup");
const batch = 50;

async function cancelPending(ctx: MutationCtx, id: Id<"_scheduled_functions">) {
  const job = await ctx.db.system.get(id);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(id);
}

/** Parents are removed first; every product read rechecks the parent or owner. */
export async function queueCleanup(ctx: MutationCtx, job: Job) {
  if ((job.kind === "user" || job.kind === "server") && job.stage === undefined)
    await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("expansionLifecycle:cleanup"), { kind: job.kind, id: job.id });
  await ctx.scheduler.runAfter(0, worker, job);
}

export const cleanup = internalMutation({
  args: cleanupArgs,
  handler: async (ctx, args) => {
    const stage = args.stage ?? 0;
    let rows: Doc<TableNames>[] = [];
    let stages = 1;
    if (args.kind === "message") {
      stages = 4;
      const messageId = args.id as Id<"messages">;
      switch (stage) {
        case 0:
          rows = await ctx.db
            .query("messageVersions")
            .withIndex("by_message", (q) => q.eq("messageId", messageId))
            .take(batch);
          break;
        case 1:
          rows = await ctx.db
            .query("savedMessages")
            .withIndex("by_message", (q) => q.eq("messageId", messageId))
            .take(batch);
          break;
        case 2:
          rows = await ctx.db
            .query("messageReminders")
            .withIndex("by_message", (q) => q.eq("messageId", messageId))
            .take(batch);
          break;
        case 3:
          rows = await ctx.db
            .query("notifications")
            .withIndex("by_message", (q) => q.eq("messageId", messageId))
            .take(batch);
          break;
      }
    }
    if (args.kind === "document")
      rows = await ctx.db
        .query("documentVersions")
        .withIndex("by_document", (q) =>
          q.eq("documentId", args.id as Id<"sharedDocuments">),
        )
        .take(batch);
    if (args.kind === "page") {
      stages = 2;
      if (stage === 0)
        rows = await ctx.db
          .query("communityPageVersions")
          .withIndex("by_page", (q) =>
            q.eq("pageId", args.id as Id<"communityPages">),
          )
          .take(batch);
      else
        rows = await ctx.db
          .query("suggestionVotes")
          .withIndex("by_page", (q) =>
            q.eq("pageId", args.id as Id<"communityPages">),
          )
          .take(batch);
    }
    if (args.kind === "party")
      rows = await ctx.db
        .query("partyMembers")
        .withIndex("by_party", (q) =>
          q.eq("partyId", args.id as Id<"partyPosts">),
        )
        .take(batch);
    if (args.kind === "container") {
      stages = 6;
      const type = args.containerType!;
      switch (stage) {
        case 0:
          rows = await ctx.db
            .query("scheduledMessages")
            .withIndex("by_container", (q) =>
              q.eq("containerType", type).eq("containerId", args.id),
            )
            .take(batch);
          break;
        case 1:
          rows = await ctx.db
            .query("conversationNotes")
            .withIndex("by_container", (q) =>
              q.eq("containerType", type).eq("containerId", args.id),
            )
            .take(batch);
          break;
        case 2:
          rows = await ctx.db
            .query("messageDrafts")
            .withIndex("by_container", (q) =>
              q.eq("containerType", type).eq("containerId", args.id),
            )
            .take(batch);
          break;
        case 3:
          rows = await ctx.db
            .query("conversationFolderItems")
            .withIndex("by_container", (q) =>
              q.eq("containerType", type).eq("containerId", args.id),
            )
            .take(batch);
          break;
        case 4:
          rows = await ctx.db
            .query("sharedDocuments")
            .withIndex("by_container", (q) =>
              q.eq("containerType", type).eq("containerId", args.id),
            )
            .take(batch);
          break;
        case 5:
          rows = await ctx.db
            .query("workTasks")
            .withIndex("by_container", (q) =>
              q.eq("containerType", type).eq("containerId", args.id),
            )
            .take(batch);
          break;
      }
    }
    if (args.kind === "server") {
      stages = 2;
      if (stage === 0)
        rows = await ctx.db
          .query("communityPages")
          .withIndex("by_server_kind", (q) =>
            q.eq("serverId", args.id as Id<"servers">),
          )
          .take(batch);
      else
        rows = await ctx.db
          .query("partyPosts")
          .withIndex("by_server", (q) =>
            q.eq("serverId", args.id as Id<"servers">),
          )
          .take(batch);
    }
    if (args.kind === "user") {
      const userId = args.id as Id<"users">;
      stages = 22;
      switch (stage) {
        case 0:
          rows = await ctx.db
            .query("messages")
            .withIndex("by_author", (q) => q.eq("authorId", userId))
            .take(10);
          break;
        case 1:
          rows = await ctx.db
            .query("socialPosts")
            .withIndex("by_author", (q) => q.eq("authorId", userId))
            .take(batch);
          break;
        case 2:
          rows = await ctx.db
            .query("socialFollows")
            .withIndex("by_follower", (q) => q.eq("followerId", userId))
            .take(batch);
          break;
        case 3:
          rows = await ctx.db
            .query("socialFollows")
            .withIndex("by_following", (q) => q.eq("followingId", userId))
            .take(batch);
          break;
        case 4:
          rows = await ctx.db
            .query("sharedDocuments")
            .withIndex("by_creator", (q) => q.eq("creatorId", userId))
            .take(batch);
          break;
        case 5:
          rows = await ctx.db
            .query("communityPages")
            .withIndex("by_author", (q) => q.eq("authorId", userId))
            .take(batch);
          break;
        case 6:
          rows = await ctx.db
            .query("partyPosts")
            .withIndex("by_host", (q) => q.eq("hostId", userId))
            .take(batch);
          break;
        case 7:
          rows = await ctx.db
            .query("partyMembers")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(batch);
          break;
        case 8:
          rows = await ctx.db
            .query("suggestionVotes")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(batch);
          break;
        case 9:
          rows = await ctx.db
            .query("workTasks")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(batch);
          break;
        case 10:
          rows = await ctx.db
            .query("workTasks")
            .withIndex("by_assignee", (q) => q.eq("assigneeId", userId))
            .take(batch);
          break;
        case 11:
          rows = await ctx.db
            .query("conversationFolderItems")
            .withIndex("by_user_container", (q) => q.eq("userId", userId))
            .take(batch);
          break;
        default: {
          const table = (
            [
              "retentionPolicies",
              "securityActivity",
              "savedCollections",
              "savedMessages",
              "scheduledMessages",
              "messageReminders",
              "conversationFolders",
              "conversationNotes",
              "messageDrafts",
              "attentionSettings",
            ] as const
          )[stage - 12];
          rows = await ctx.db
            .query(table)
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(batch);
        }
      }
      // These rows have a unique owner and cannot grow without a bound.
      if (stage === 0)
        for (const table of [
          "interestProfiles",
          "interestMembers",
          "gameActivities",
        ] as const) {
          for (const row of await ctx.db
            .query(table)
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(12))
            await ctx.db.delete(row._id);
        }
    }
    for (const row of rows) {
      // Narrow through persisted fields rather than trusting a client table name.
      if (
        "jobId" in row &&
        row.jobId &&
        "status" in row &&
        row.status === "pending"
      )
        await cancelPending(ctx, row.jobId);
      if ("reminderJobId" in row && row.reminderJobId)
        await cancelPending(ctx, row.reminderJobId);
      if (args.kind === "user" && stage === 0) {
        await deleteMessageData(ctx, row as Doc<"messages">);
        continue;
      }
      if (
        "editors" in row ||
        ("creatorId" in row && "revision" in row && "containerId" in row)
      )
        await queueCleanup(ctx, { kind: "document", id: row._id });
      if ("votes" in row && "kind" in row)
        await queueCleanup(ctx, { kind: "page", id: row._id });
      if ("memberCount" in row && "hostId" in row)
        await queueCleanup(ctx, { kind: "party", id: row._id });
      if (args.kind === "user" && stage === 7) {
        const membership = row as Doc<"partyMembers">;
        const party = await ctx.db.get(membership.partyId);
        if (party)
          await ctx.db.patch(party._id, {
            memberCount: Math.max(1, party.memberCount - 1),
          });
      }
      if (args.kind === "user" && stage === 8) {
        const vote = row as Doc<"suggestionVotes">;
        const page = await ctx.db.get(vote.pageId);
        if (page)
          await ctx.db.patch(page._id, { votes: Math.max(0, page.votes - 1) });
      }
      if (args.kind === "user" && stage === 10) {
        const task = row as Doc<"workTasks">;
        await ctx.db.patch(task._id, {
          assigneeId: undefined,
          reminderJobId: undefined,
          revision: task.revision + 1,
        });
      } else await ctx.db.delete(row._id);
    }
    const limit = args.kind === "user" && stage === 0 ? 10 : batch;
    if (rows.length === limit) await queueCleanup(ctx, { ...args, stage });
    else if (stage + 1 < stages)
      await queueCleanup(ctx, { ...args, stage: stage + 1 });
  },
});
