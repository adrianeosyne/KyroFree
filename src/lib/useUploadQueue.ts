import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MAX_ATTACHMENTS,
  useUploadFile,
  type PendingAttachment,
} from "./upload";
import { readableError } from "./errors";
import { toast } from "sonner";
import { isManagedFileApi, legacyFileApi } from "./file-api";

type UploadJob = {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: "uploading" | "failed" | "complete";
  error?: string;
  attachment?: PendingAttachment;
  controller: AbortController;
};

class UploadSession {
  active = true;
  readonly jobs = new Map<string, UploadJob>();
  readonly scope: string;
  constructor(scope: string) {
    this.scope = scope;
  }
  activate() {
    this.active = true;
  }
  close() {
    this.active = false;
  }
}

/** A bounded queue tied to one conversation or asset browser. */
export function useUploadQueue(
  scope: string,
  applicationId?: Id<"botApplications">,
  retainCompleted = false,
) {
  const upload = useUploadFile({ applicationId });
  const removeManagedFile = useMutation(api.files.remove);
  const discardLegacyFile = useMutation(legacyFileApi.discard);
  const removeFile = isManagedFileApi ? removeManagedFile : discardLegacyFile;
  const session = useMemo(() => new UploadSession(scope), [scope]);
  const [snapshot, setSnapshot] = useState<{
    session: typeof session;
    jobs: UploadJob[];
  }>({ session, jobs: [] });
  const publish = () =>
    setSnapshot({
      session,
      jobs: [...session.jobs.values()].map((job) => ({ ...job })),
    });
  const discardFile = (attachment?: PendingAttachment) => {
    if (attachment)
      void removeFile({ storageId: attachment.storageId }).catch(
        () => undefined,
      );
  };
  useEffect(() => {
    session.activate();
    return () => {
      session.close();
      for (const job of session.jobs.values()) {
        job.controller.abort();
        if (job.preview) URL.revokeObjectURL(job.preview);
        if (job.attachment && !retainCompleted)
          void removeFile({ storageId: job.attachment.storageId }).catch(
            () => undefined,
          );
      }
      session.jobs.clear();
    };
  }, [session, removeFile, retainCompleted]);

  const run = async (job: UploadJob) => {
    job.status = "uploading";
    job.error = undefined;
    job.progress = 0;
    job.controller = new AbortController();
    publish();
    try {
      const attachment = await upload(job.file, {
        signal: job.controller.signal,
        onProgress: (value) => {
          if (session.active && session.jobs.has(job.id)) {
            job.progress = value;
            publish();
          }
        },
      });
      if (!session.active || !session.jobs.has(job.id)) {
        discardFile(attachment);
        return;
      }
      job.attachment = attachment;
      job.status = "complete";
    } catch (error) {
      if (!session.active || !session.jobs.has(job.id)) return;
      job.status = "failed";
      job.error = readableError(
        error,
        "Upload failed. Retry or remove the file.",
      );
    }
    publish();
  };
  const addFiles = (files: FileList | File[] | null) => {
    if (!files || !session.active) return;
    const room = MAX_ATTACHMENTS - session.jobs.size;
    if (files.length > room)
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files at a time.`);
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const job: UploadJob = {
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: "uploading",
        controller: new AbortController(),
        ...(file.type.startsWith("image/") && file.type !== "image/svg+xml"
          ? { preview: URL.createObjectURL(file) }
          : {}),
      };
      session.jobs.set(job.id, job);
      void run(job);
    }
  };
  const remove = (id: string) => {
    const job = session.jobs.get(id);
    if (!job) return;
    session.jobs.delete(id);
    job.controller.abort();
    if (job.preview) URL.revokeObjectURL(job.preview);
    discardFile(job.attachment);
    publish();
  };
  const clear = () => {
    // Called only after the message claims these uploads. Keep its storage intact.
    for (const job of session.jobs.values()) {
      job.controller.abort();
      if (job.preview) URL.revokeObjectURL(job.preview);
    }
    session.jobs.clear();
    publish();
  };
  const jobs = snapshot.session === session ? snapshot.jobs : [];
  return {
    jobs,
    addFiles,
    remove,
    clear,
    retry: (id: string) => {
      const job = session.jobs.get(id);
      if (job?.status === "failed") void run(job);
    },
    attachments: jobs.flatMap((job) =>
      job.attachment ? [job.attachment] : [],
    ),
    pending: jobs.some((job) => job.status !== "complete"),
  };
}
