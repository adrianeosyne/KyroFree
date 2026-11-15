import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Image,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/lib/format";
import type { PendingFile } from "@/lib/usePendingAttachments";

function FilePreview({
  item,
  large = false,
}: {
  item: PendingFile;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!item.preview || failed)
    return (
      <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 text-muted-foreground">
        <FileText className={large ? "size-10" : "size-7"} />
        {item.preview && <span className="text-xs">Preview unavailable</span>}
      </div>
    );
  return (
    <img
      src={item.preview}
      alt={
        large
          ? `Full preview of ${item.file.name}`
          : `Preview of ${item.file.name}`
      }
      onError={() => setFailed(true)}
      className={
        large
          ? "max-h-[65dvh] w-full object-contain"
          : "kyro-attachment-image h-28 w-full object-contain"
      }
    />
  );
}

export function PendingAttachments({
  files,
  busy,
  onRemove,
  onRetry,
}: {
  files: PendingFile[];
  busy: boolean;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const images = files.filter((item) => item.preview);
  const selected = images.find((item) => item.id === selectedId);
  const selectedIndex = images.findIndex((item) => item.id === selectedId);
  const move = (offset: number) =>
    setSelectedId(
      images[(selectedIndex + offset + images.length) % images.length].id,
    );
  if (!files.length) return null;
  return (
    <>
      <section
        aria-label="Attachments to send"
        className="mb-2 rounded-2xl border border-border/70 bg-surface p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <Image className="size-3.5 text-primary" />
            {files.length} {files.length === 1 ? "attachment" : "attachments"}
          </p>
          <span className="text-[10px] text-muted-foreground">
            Review before sending
          </span>
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-3 lg:grid-cols-4">
          {files.map((item) => (
            <article
              key={item.id}
              aria-label={`Attachment ${item.file.name}`}
              className="kyro-attachment-card relative min-w-0 overflow-hidden rounded-xl border border-border/70 bg-panel"
            >
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                disabled={busy}
                onClick={() => onRemove(item.id)}
                className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-white"
              >
                <X className="size-3.5" />
              </button>
              {item.preview ? (
                <button
                  type="button"
                  aria-label={`Preview ${item.file.name}`}
                  onClick={() => setSelectedId(item.id)}
                  className="kyro-attachment-preview block w-full overflow-hidden bg-background/60 p-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <FilePreview item={item} />
                </button>
              ) : (
                <FilePreview item={item} />
              )}
              <div className="p-2.5">
                <p
                  className="truncate text-[11px] font-medium"
                  title={item.file.name}
                >
                  {item.file.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{formatBytes(item.file.size)}</span>
                  <span aria-hidden>·</span>
                  {item.status === "uploading" ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="size-2.5 animate-spin" />
                      Uploading…
                    </span>
                  ) : (
                    <span
                      className={
                        item.status === "ready"
                          ? "text-success"
                          : "text-destructive"
                      }
                    >
                      {item.status === "ready"
                        ? "Ready to send"
                        : "Upload failed"}
                    </span>
                  )}
                </div>
                {item.error && (
                  <p
                    role="alert"
                    className="mt-1 text-[10px] leading-relaxed text-destructive"
                  >
                    {item.error}
                  </p>
                )}
                {item.status === "failed" && (
                  <button
                    type="button"
                    aria-label={`Retry ${item.file.name}`}
                    onClick={() => onRetry(item.id)}
                    className="mt-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Retry upload
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent
          className="w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-4 sm:max-w-4xl sm:p-5"
          onKeyDown={(event) => {
            if (
              images.length > 1 &&
              (event.key === "ArrowLeft" || event.key === "ArrowRight")
            ) {
              event.preventDefault();
              move(event.key === "ArrowRight" ? 1 : -1);
            }
          }}
        >
          <DialogHeader className="pr-7 text-left">
            <DialogTitle className="break-all text-base">
              {selected?.file.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review your picture before sending it to this conversation.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="flex min-h-40 items-center justify-center overflow-hidden rounded-xl bg-background p-2">
              <FilePreview key={selected.id} item={selected} large />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {images.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Previous image"
                    onClick={() => move(-1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {selectedIndex + 1} / {images.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Next image"
                    onClick={() => move(1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {selected && formatBytes(selected.file.size)}
              </span>
            </div>
            <Button type="button" onClick={() => setSelectedId(null)}>
              Back to message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
