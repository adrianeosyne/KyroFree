import { useAction, useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { ACCEPTED_FILES, allowedFilename } from "./filePolicy";
import { isManagedFileApi, legacyFileApi } from "./file-api";
export { MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";
export const MAX_ATTACHMENTS = 6;
export const ACCEPTED_UPLOAD = ACCEPTED_FILES;
export interface PendingAttachment {
  storageId: Id<"_storage">;
  name: string;
  size: number;
  mimeType: string;
}
export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

function directUpload(
  url: string,
  file: File,
  options: UploadOptions,
): Promise<string> {
  if (typeof url !== "string" || !url)
    return Promise.reject(new Error("The upload service is unavailable."));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = () => options.signal?.removeEventListener("abort", abort);
    xhr.open("POST", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        options.onProgress?.(Math.round((e.loaded / e.total) * 85));
    };
    xhr.onerror = () => {
      finish();
      reject(new Error("Upload failed. Check your connection and retry."));
    };
    xhr.ontimeout = () => {
      finish();
      reject(
        new Error("Upload timed out. Retry when your connection improves."),
      );
    };
    xhr.onabort = () => {
      finish();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    xhr.onload = () => {
      finish();
      try {
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error(`Upload failed (${xhr.status}).`);
        const storageId = JSON.parse(xhr.responseText).storageId;
        if (typeof storageId !== "string" || !storageId)
          throw new Error("Upload did not return a file identifier.");
        resolve(storageId);
      } catch (cause) {
        reject(cause);
      }
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      finish();
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    xhr.send(file);
  });
}
export function useUploadFile(
  options: {
    requireRegistration?: boolean;
    applicationId?: Id<"botApplications">;
    channelId?: Id<"channels">;
  } = {},
) {
  const reserve = useMutation(api.files.generateUploadUrl),
    register = useMutation(api.files.registerUpload),
    verify = useAction(api.files.verifyUpload),
    cancel = useMutation(api.files.cancel);
  const generateLegacyUploadUrl = useMutation(legacyFileApi.generateUploadUrl);
  const registerLegacyUpload = useMutation(legacyFileApi.registerUpload);
  const discardLegacyUpload = useMutation(legacyFileApi.discard);
  return useCallback(
    async (
      file: File,
      transfer: UploadOptions = {},
    ): Promise<PendingAttachment> => {
      if (!file.size || file.size > MAX_UPLOAD_BYTES)
        throw new Error(`"${file.name}" must be between 1 byte and 10 MiB.`);
      if (!allowedFilename(file.name))
        throw new Error(
          "This file format is not supported. Choose an image, media file, document or ZIP archive.",
        );
      transfer.signal?.throwIfAborted();
      if (!isManagedFileApi) {
        if (options.applicationId)
          throw new Error("File assets are unavailable for this application.");
        const uploadUrl = await generateLegacyUploadUrl({});
        transfer.signal?.throwIfAborted();
        const storageId = (await directUpload(
          uploadUrl,
          file,
          transfer,
        )) as Id<"_storage">;
        try {
          transfer.onProgress?.(90);
          // Establish ownership even if cancellation arrived after storage
          // accepted the file, so discard can safely remove our own upload.
          const result = await registerLegacyUpload({
            storageId,
            name: file.name,
            ...(options.channelId ? { channelId: options.channelId } : {}),
          });
          transfer.signal?.throwIfAborted();
          transfer.onProgress?.(100);
          return result;
        } catch (cause) {
          await discardLegacyUpload({ storageId }).catch(() => undefined);
          throw cause;
        }
      }
      const bytes = await file.arrayBuffer();
      const sha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      transfer.signal?.throwIfAborted();
      const ticket = await reserve({
        name: file.name,
        size: file.size,
        sha256,
        ...(options.applicationId
          ? { applicationId: options.applicationId }
          : {}),
      });
      try {
        transfer.signal?.throwIfAborted();
        const storageId = (await directUpload(
          ticket.uploadUrl,
          file,
          transfer,
        )) as Id<"_storage">;
        transfer.signal?.throwIfAborted();
        transfer.onProgress?.(90);
        await register({
          storageId,
          name: file.name,
          uploadId: ticket.uploadId,
        });
        const result = await verify({ uploadId: ticket.uploadId });
        transfer.signal?.throwIfAborted();
        transfer.onProgress?.(100);
        return result;
      } catch (cause) {
        await cancel({ uploadId: ticket.uploadId }).catch(() => undefined);
        throw cause;
      }
    },
    [
      reserve,
      register,
      verify,
      cancel,
      generateLegacyUploadUrl,
      registerLegacyUpload,
      discardLegacyUpload,
      options.applicationId,
      options.channelId,
    ],
  );
}
