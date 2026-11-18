import { v } from "convex/values";
import { mutation } from "./functions";
import { requireActiveUser } from "./lib";
import {
  claimUpload,
  deleteClaimedUpload,
  requireOwnedUpload,
} from "./uploadSecurity";
export const set = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { storageId }) => {
    const { id, user } = await requireActiveUser(ctx);
    if (storageId) {
      const upload = await requireOwnedUpload(ctx, id, storageId);
      if (
        ![
          "audio/mpeg",
          "audio/wav",
          "audio/x-wav",
          "audio/ogg",
          "audio/webm",
          "audio/mp4",
        ].includes(upload.mimeType) ||
        upload.size > 2 * 1024 * 1024
      )
        throw new Error("Choose an audio file under 2 MB.");
      await claimUpload(ctx, id, storageId, "notification_sound", id);
    }
    if (user.notificationSoundStorageId !== storageId)
      await deleteClaimedUpload(
        ctx,
        user.notificationSoundStorageId,
        "notification_sound",
        id,
      );
    await ctx.db.patch(id, {
      notificationSoundStorageId: storageId ?? undefined,
    });
  },
});
