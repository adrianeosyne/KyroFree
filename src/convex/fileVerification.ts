"use node";
import { createHash } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./functions";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { inspectFile } from "../../server/files/validation";
export const verify = internalAction({
  args: { uploadId: v.id("uploadTickets") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    storageId: Id<"_storage">;
    name: string;
    size: number;
    mimeType: string;
  }> => {
    const ticket = await ctx.runQuery(internal.files.verificationJob, args);
    const blob = await ctx.storage.get(ticket.storageId!);
    let error: string | undefined, mimeType: string | undefined;
    try {
      if (!blob || blob.size !== ticket.size)
        throw new Error("FILE_SIZE_MISMATCH");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (createHash("sha256").update(bytes).digest("hex") !== ticket.sha256)
        throw new Error("FILE_HASH_MISMATCH");
      mimeType = await inspectFile(
        bytes,
        ticket.name,
        blob.type,
        process.env.KYRO_UPLOAD_EXTENSIONS,
      );
    } catch (cause) {
      error =
        cause instanceof Error && /^[A-Z_]+$/.test(cause.message)
          ? cause.message
          : "INVALID_FILE";
    }
    const result = await ctx.runMutation(internal.files.finishVerification, {
      uploadId: args.uploadId,
      ...(error ? { error } : { mimeType }),
    });
    if (error)
      throw new Error(
        `Upload rejected: ${error}. Choose a supported file with matching content.`,
      );
    return result;
  },
});
