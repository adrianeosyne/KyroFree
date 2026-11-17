import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useNow } from "@/hooks/use-now";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatBytes } from "@/lib/format";
import { isManagedFileApi } from "@/lib/file-api";
export function FileAttachment({
  attachment,
  messageId,
  onOpenMedia,
  canRemove = false,
  ownerName,
  createdAt,
}: {
  attachment: {
    storageId: string;
    name: string;
    size: number;
    mimeType: string;
    url?: string | null;
  };
  messageId: string;
  onOpenMedia: (url: string, name: string) => void;
  canRemove?: boolean;
  ownerName?: string;
  createdAt?: number;
}) {
  const now = useNow();
  const remove = useMutation(api.files.removeAttachment);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const download = useQuery(
    api.files.download,
    isManagedFileApi
      ? {
          storageId: attachment.storageId as Id<"_storage">,
          messageId: messageId as Id<"messages">,
          refresh: Math.floor(now / 600000),
        }
      : "skip",
  );
  // Message URLs are already authorized for the viewer. Legacy deployments
  // return them directly and do not expose a separate download query.
  const url =
    isManagedFileApi && download !== undefined ? download?.url : attachment.url;
  const sharedDate =
    typeof createdAt === "number" && Number.isFinite(createdAt)
      ? new Date(createdAt)
      : null;
  const validSharedDate =
    sharedDate && Number.isFinite(sharedDate.getTime()) ? sharedDate : null;
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-border bg-surface p-2 sm:max-w-sm">
      {url && attachment.mimeType.startsWith("image/") && (
        <button
          type="button"
          className="block max-w-full"
          aria-label={`Expand ${attachment.name}`}
          onClick={() => onOpenMedia(url, attachment.name)}
        >
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            className="max-h-72 max-w-full rounded object-contain"
          />
        </button>
      )}
      {url && attachment.mimeType.startsWith("audio/") && (
        <audio src={url} controls preload="metadata" className="max-w-full" />
      )}
      {url && attachment.mimeType.startsWith("video/") && (
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          className="max-h-72 max-w-full rounded"
        />
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="min-w-0 max-w-40 truncate" title={attachment.name}>
          {attachment.name}
        </span>
        <span className="text-muted-foreground">
          {formatBytes(attachment.size)}
        </span>
        {url ? (
          <a
            className="text-primary underline"
            href={url}
            download={attachment.name}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
        ) : (
          <span className="text-muted-foreground">
            {isManagedFileApi && download === undefined
              ? "Loading…"
              : "Unavailable"}
          </span>
        )}
      </div>
      {url &&
        (attachment.mimeType.startsWith("text/") ||
          attachment.mimeType === "application/json") && (
          <div className="mt-2 text-xs">
            <button
              type="button"
              disabled={loadingPreview}
              className="text-primary underline"
              aria-label={`Preview ${attachment.name}`}
              onClick={() => {
                if (preview !== null) {
                  setPreview(null);
                  return;
                }
                setLoadingPreview(true);
                void (async () => {
                  const response = await fetch(url, {
                    redirect: "error",
                    signal: AbortSignal.timeout(15000),
                  });
                  if (!response.ok || !response.body)
                    throw new Error(
                      "Preview unavailable. Refresh the download link and try again.",
                    );
                  const reader = response.body.getReader(),
                    decoder = new TextDecoder();
                  let bytes = 0,
                    text = "";
                  try {
                    while (bytes < 65536) {
                      const chunk = await reader.read();
                      if (chunk.done) break;
                      const part = chunk.value.subarray(0, 65536 - bytes);
                      bytes += part.length;
                      text += decoder.decode(part, { stream: true });
                    }
                    text += decoder.decode();
                  } finally {
                    await reader.cancel();
                  }
                  setPreview(
                    text +
                      (attachment.size > 65536
                        ? "\n… Preview limited to 64 KiB. Download the full file."
                        : ""),
                  );
                })()
                  .catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Preview unavailable",
                    ),
                  )
                  .finally(() => setLoadingPreview(false));
              }}
            >
              {loadingPreview
                ? "Loading preview…"
                : preview !== null
                  ? "Hide preview"
                  : "Preview document"}
            </button>
            {preview !== null && (
              <pre
                aria-label={`Contents of ${attachment.name}`}
                className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-foreground"
              >
                {preview}
              </pre>
            )}
          </div>
        )}
      <details className="mt-1 text-xs text-muted-foreground">
        <summary className="cursor-pointer">File information</summary>
        <p className="mt-1 break-all">
          {attachment.mimeType} · {attachment.size.toLocaleString()} bytes
        </p>
        {ownerName && <p>Shared by {ownerName}</p>}
        {validSharedDate && (
          <time dateTime={validSharedDate.toISOString()}>
            {validSharedDate.toLocaleString()}
          </time>
        )}
        {canRemove && isManagedFileApi && (
          <button
            disabled={busy}
            className="mt-2 block text-destructive underline"
            onClick={() => {
              setBusy(true);
              void remove({
                storageId: attachment.storageId as Id<"_storage">,
                messageId: messageId as Id<"messages">,
              })
                .catch((error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not remove attachment",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            Remove attachment
          </button>
        )}
      </details>
    </div>
  );
}
