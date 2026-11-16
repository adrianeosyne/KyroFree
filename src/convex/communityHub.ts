import { v } from "convex/values";
import { query, mutation } from "./functions";
import { requireActiveUser, requireServerAccess } from "./lib";
import { PERMISSIONS, hasPermission } from "../lib/permissions";

import type { Ctx } from "./lib";
import type { Id } from "./_generated/dataModel";
async function access(ctx: Ctx, serverId: Id<"servers">) {
  const { id, user } = await requireActiveUser(ctx);
  const server = await requireServerAccess(ctx, serverId, id);
  return {
    id,
    user,
    canManage: hasPermission(server.permissions, PERMISSIONS.MANAGE_SERVER),
    canSupport: hasPermission(server.permissions, PERMISSIONS.MANAGE_MESSAGES),
    ...server,
  };
}
export const events = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { id } = await access(ctx, serverId);
    const events = await ctx.db
      .query("communityEvents")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .order("desc")
      .take(100);
    return await Promise.all(
      events.map(async (e) => {
        const attendees = await ctx.db
          .query("eventAttendees")
          .withIndex("by_event", (q) => q.eq("eventId", e._id))
          .collect();
        return {
          ...e,
          attendeeCount: attendees.length,
          attending: attendees.some((a) => a.userId === id),
        };
      }),
    );
  },
});
export const createEvent = mutation({
  args: {
    serverId: v.id("servers"),
    title: v.string(),
    description: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    location: v.string(),
    capacity: v.number(),
  },
  handler: async (ctx, args) => {
    const a = await access(ctx, args.serverId);
    if (!a.canManage) throw new Error("Manage Server permission required.");
    if (
      args.title.trim().length < 3 ||
      args.title.length > 80 ||
      args.description.length > 1500 ||
      args.location.length > 120 ||
      args.startsAt < Date.now() ||
      args.endsAt <= args.startsAt ||
      args.endsAt - args.startsAt > 7 * 86400000 ||
      !Number.isInteger(args.capacity) ||
      args.capacity < 2 ||
      args.capacity > 1000
    )
      throw new Error(
        "Choose a future event, a valid title and capacity of 2–1,000.",
      );
    const existing = await ctx.db
      .query("communityEvents")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    if (
      existing.filter((e) => !e.cancelled && e.endsAt > Date.now()).length >= 30
    )
      throw new Error("This server already has 30 upcoming events.");
    await ctx.db.insert("communityEvents", {
      ...args,
      title: args.title.trim(),
      createdBy: a.id,
      createdAt: Date.now(),
      cancelled: false,
    });
  },
});
export const cancelEvent = mutation({
  args: { id: v.id("communityEvents") },
  handler: async (ctx, { id }) => {
    const event = await ctx.db.get(id);
    if (!event) throw new Error("Event unavailable.");
    const a = await access(ctx, event.serverId);
    if (!a.canManage) throw new Error("Manage Server permission required.");
    await ctx.db.patch(id, { cancelled: true });
  },
});
export const rsvp = mutation({
  args: { id: v.id("communityEvents"), attending: v.boolean() },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Event unavailable.");
    const a = await access(ctx, event.serverId);
    const rows = await ctx.db
      .query("eventAttendees")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    const own = rows.find((x) => x.userId === a.id);
    if (!args.attending) {
      if (own) await ctx.db.delete(own._id);
      return;
    }
    if (event.cancelled || event.endsAt < Date.now())
      throw new Error("This event has ended or was cancelled.");
    if (own) return;
    if (rows.length >= event.capacity) throw new Error("This event is full.");
    await ctx.db.insert("eventAttendees", { eventId: event._id, userId: a.id });
  },
});
export const tickets = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const a = await access(ctx, serverId);
    const source =
      a.canSupport || a.canManage
        ? ctx.db
            .query("supportTickets")
            .withIndex("by_server", (q) => q.eq("serverId", serverId))
        : ctx.db
            .query("supportTickets")
            .withIndex("by_server_owner", (q) =>
              q.eq("serverId", serverId).eq("ownerId", a.id),
            );
    const rows = await source.order("desc").take(300);
    return rows.filter(
      (r) => a.canSupport || a.canManage || r.ownerId === a.id,
    );
  },
});
export const openTicket = mutation({
  args: {
    serverId: v.id("servers"),
    title: v.string(),
    details: v.string(),
    category: v.union(
      v.literal("help"),
      v.literal("report"),
      v.literal("idea"),
    ),
  },
  handler: async (ctx, args) => {
    const a = await access(ctx, args.serverId);
    if (
      args.title.trim().length < 3 ||
      args.title.length > 100 ||
      args.details.trim().length < 10 ||
      args.details.length > 2000
    )
      throw new Error(
        "Use a title of 3–100 characters and details of 10–2,000 characters.",
      );
    const own = await ctx.db
      .query("supportTickets")
      .withIndex("by_owner", (q) => q.eq("ownerId", a.id))
      .collect();
    if (own.filter((r) => r.status !== "closed").length >= 5)
      throw new Error("You already have five open tickets.");
    await ctx.db.insert("supportTickets", {
      ...args,
      ownerId: a.id,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      responses: [],
    });
  },
});
export const reply = mutation({
  args: { id: v.id("supportTickets"), text: v.string() },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id);
    if (!ticket) throw new Error("Ticket unavailable.");
    const a = await access(ctx, ticket.serverId);
    if (!a.canSupport && !a.canManage && ticket.ownerId !== a.id)
      throw new Error("This ticket is private.");
    if (ticket.status === "closed")
      throw new Error("Reopen the ticket before replying.");
    if (
      !args.text.trim() ||
      args.text.length > 1500 ||
      ticket.responses.length >= 100
    )
      throw new Error(
        "Replies must be 1–1,500 characters; tickets support 100 replies.",
      );
    await ctx.db.patch(ticket._id, {
      responses: [
        ...ticket.responses,
        {
          userId: a.id,
          name: a.user.name ?? "Member",
          text: args.text.trim(),
          at: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    });
  },
});
export const setTicketStatus = mutation({
  args: {
    id: v.id("supportTickets"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("closed"),
    ),
    claim: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id);
    if (!ticket) throw new Error("Ticket unavailable.");
    const a = await access(ctx, ticket.serverId);
    if (!a.canSupport && !a.canManage)
      throw new Error("Moderation permission required.");
    await ctx.db.patch(ticket._id, {
      status: args.status,
      ...(args.claim ? { assignedTo: a.id } : {}),
      updatedAt: Date.now(),
    });
  },
});
