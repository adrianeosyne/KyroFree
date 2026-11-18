import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { uploadLimit } from "./entitlements";
import { useEffect, useMemo, useState } from "react";
import {
  MAX_ATTACHMENTS,
  useUploadFile,
  type PendingAttachment,
} from "./upload";
import { readableError } from "./errors";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export type PendingFile = {
  id: string;
  file: File;
  preview?: string;
  status: "uploading" | "ready" | "failed";
  error?: string;
  progress?: number;
  attachment?: PendingAttachment;
  controller: AbortController;
};

class AttachmentSession {
  active = true;
  files = new Map<string, PendingFile>();
  scope: string;
  constructor(scope: string) {
    this.scope = scope;
  }
  activate() {
    this.active = true;
  }
  deactivate() {
    this.active = false;
  }
}

/** Reserve slots before uploading, and keep local previews alive until send/removal. */
export function usePendingAttachments(scope: string) {
  const channelId = scope.startsWith("channel:")
    ? (scope.slice(8) as Id<"channels">)
    : undefined;
  const upload = useUploadFile({ requireRegistration: true, channelId });
  const discard = useMutation(api.files.discard);
  const me = useQuery(api.users.me);
  const benefits = useQuery(
    api.premium.communityBenefits,
    channelId ? { channelId } : "skip",
  );
  const limit = Math.max(uploadLimit(me), benefits?.uploadBytes ?? 0);
  const session = useMemo(() => new AttachmentSession(scope), [scope]);
  const [snapshot, setSnapshot] = useState({
    session,
    files: [] as PendingFile[],
  });
  const publish = () =>
    setSnapshot({
      session,
      files: [...session.files.values()].map((item) => ({ ...item })),
    });

  useEffect(() => {
    session.activate();
    return () => {
      session.deactivate();
      for (const item of session.files.values()) {
        item.controller.abort();
        if (item.attachment)
          void discard({ storageId: item.attachment.storageId }).catch(
            () => {},
          );
        if (item.preview) URL.revokeObjectURL(item.preview);
      }
      session.files.clear();
    };
  }, [session, discard]);

  const run = async (item: PendingFile) => {
    item.status = "uploading";
    item.error = undefined;
    item.controller = new AbortController();
    publish();
    try {
      const attachment = await upload(item.file, {
        signal: item.controller.signal,
      });
      if (!session.active || !session.files.has(item.id)) {
        void discard({ storageId: attachment.storageId }).catch(() => {});
        return;
      }
      item.attachment = attachment;
      item.status = "ready";
    } catch (error) {
      if (!session.active || !session.files.has(item.id)) return;
      item.status = "failed";
      item.error = readableError(
        error,
        "Upload failed. Retry or remove this file.",
      );
    }
    publish();
  };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files || !session.active) return;
    const room = MAX_ATTACHMENTS - session.files.size;
    if (files.length > room)
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files at a time.`);
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      if (file.size > limit) {
        toast.error(
          `"${file.name}" is larger than the ${limit / 1024 / 1024} MB upload limit.`,
        );
        continue;
      }
      const item: PendingFile = {
        id: crypto.randomUUID(),
        file,
        status: "uploading",
        controller: new AbortController(),
        ...(file.type.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)
          ? { preview: URL.createObjectURL(file) }
          : {}),
      };
      session.files.set(item.id, item);
      void run(item);
    }
  };
  const remove = (id: string) => {
    const item = session.files.get(id);
    if (!item) return;
    session.files.delete(id);
    item.controller.abort();
    if (item.attachment)
      void discard({ storageId: item.attachment.storageId }).catch(() => {});
    if (item.preview) URL.revokeObjectURL(item.preview);
    publish();
  };
  const clear = () => {
    for (const item of session.files.values()) {
      item.controller.abort();
      if (item.preview) URL.revokeObjectURL(item.preview);
    }
    session.files.clear();
    publish();
  };
  const files = snapshot.session === session ? snapshot.files : [];
  return {
    files,
    addFiles,
    remove,
    clear,
    retry: (id: string) => {
      const item = session.files.get(id);
      if (item?.status === "failed") void run(item);
    },
    attachments: files.flatMap((item) =>
      item.attachment ? [item.attachment] : [],
    ),
    pending: files.some((item) => item.status !== "ready"),
  };
}
