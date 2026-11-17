import { makeFunctionReference } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";

/** Match the file protocol exposed by the configured Convex deployment. */
export const isManagedFileApi = import.meta.env.VITE_FILE_API_MODE !== "legacy";

// Older deployments register uploads directly instead of reserving tickets.
// Explicit references keep their verified contract separate from local types.
export const legacyFileApi = {
  generateUploadUrl: makeFunctionReference<
    "mutation",
    Record<string, never>,
    string
  >("files:generateUploadUrl"),
  registerUpload: makeFunctionReference<
    "mutation",
    {
      storageId: Id<"_storage">;
      name: string;
      channelId?: Id<"channels">;
    },
    {
      storageId: Id<"_storage">;
      name: string;
      size: number;
      mimeType: string;
    }
  >("files:registerUpload"),
  discard: makeFunctionReference<
    "mutation",
    { storageId: Id<"_storage"> },
    null
  >("files:discard"),
};
