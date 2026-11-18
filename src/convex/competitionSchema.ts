import { defineTable } from "convex/server";
import { v } from "convex/values";
export const matchValidator = v.object({
  round: v.number(),
  slot: v.number(),
  a: v.union(v.string(), v.null()),
  b: v.union(v.string(), v.null()),
  winner: v.union(v.string(), v.null()),
  state: v.union(
    v.literal("pending"),
    v.literal("ready"),
    v.literal("complete"),
  ),
  scoreA: v.optional(v.number()),
  scoreB: v.optional(v.number()),
});
export const competitionTables = {
  gamingClans: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    name: v.string(),
    tag: v.string(),
    game: v.string(),
    description: v.string(),
    approvalRequired: v.boolean(),
    memberCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_tag", ["serverId", "tag"]),
  clanMemberships: defineTable({
    clanId: v.id("gamingClans"),
    userId: v.id("users"),
    accepted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_clan_user", ["clanId", "userId"])
    .index("by_clan", ["clanId"])
    .index("by_user", ["userId"]),
  gamingTournaments: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    game: v.string(),
    title: v.string(),
    description: v.string(),
    capacity: v.number(),
    startsAt: v.number(),
    timezone: v.string(),
    status: v.union(
      v.literal("registration"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    entrantCount: v.number(),
    entrants: v.array(v.id("users")),
    matches: v.array(matchValidator),
    winnerId: v.optional(v.id("users")),
    revision: v.number(),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),
  tournamentRegistrations: defineTable({
    tournamentId: v.id("gamingTournaments"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_tournament_user", ["tournamentId", "userId"])
    .index("by_tournament", ["tournamentId"])
    .index("by_user", ["userId"]),
  competitionStats: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    game: v.string(),
    tournaments: v.number(),
    wins: v.number(),
    updatedAt: v.number(),
  })
    .index("by_server_game_wins", ["serverId", "game", "wins"])
    .index("by_server_user_game", ["serverId", "userId", "game"])
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"]),
};
