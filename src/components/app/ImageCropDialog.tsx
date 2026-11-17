import { useCallback, useRef, useState, type PointerEvent } from "react";
import { Crop, Loader2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { readableError } from "@/lib/errors";
import { toast } from "sonner";
import { clampCrop, getCropGeometry } from "@/lib/image-crop";

export function ImageCropDialog({
  file,
  title,
  aspect,
  outputWidth,
  outputHeight,
  rounded = false,
  onCancel,
  onComplete,
}: {
  file: File;
  title: string;
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  rounded?: boolean;
  onCancel: () => void;
  onComplete: (file: File) => Promise<void> | void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{
    x: number;
    y: number;
    distance: number;
    zoom: number;
    shiftX: number;
    shiftY: number;
    rect: DOMRect;
  } | null>(null);

  // The dialog's portal mounts after its parent. Attach resources when the
  // actual preview elements mount, including React's development remounts.
  const mountImage = useCallback(
    (image: HTMLImageElement | null) => {
      imageRef.current = image;
      if (!image) return;
      const sourceUrl = URL.createObjectURL(file);
      image.src = sourceUrl;
      return () => {
        URL.revokeObjectURL(sourceUrl);
        imageRef.current = null;
      };
    },
    [file],
  );

  const mountFrame = useCallback((frame: HTMLDivElement | null) => {
    frameRef.current = frame;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setFrameSize({ width: rect.width, height: rect.height });
      pointersRef.current.clear();
      dragRef.current = null;
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
      frameRef.current = null;
      pointersRef.current.clear();
      dragRef.current = null;
    };
  }, []);

  const ready = imageSize.width > 0 && frameSize.width > 0 && !imageError;
  const geometry = ready
    ? getCropGeometry(
        imageSize.width,
        imageSize.height,
        frameSize.width,
        frameSize.height,
        { zoom, offsetX, offsetY },
      )
    : null;

  const pointerPosition = () => {
    const [first, second] = [...pointersRef.current.values()];
    if (!first) return null;
    return {
      x: second ? (first.x + second.x) / 2 : first.x,
      y: second ? (first.y + second.y) / 2 : first.y,
      distance: second ? Math.hypot(second.x - first.x, second.y - first.y) : 0,
    };
  };

  const beginDrag = () => {
    const point = pointerPosition();
    const frame = frameRef.current;
    if (!point || !frame || !geometry) return;
    dragRef.current = {
      ...point,
      zoom,
      shiftX: geometry.x + geometry.maxShiftX,
      shiftY: geometry.y + geometry.maxShiftY,
      rect: frame.getBoundingClientRect(),
    };
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    dragRef.current = null;
    if (pointersRef.current.size) beginDrag();
  };

  const crop = async () => {
    const image = imageRef.current;
    if (!ready || busy || !image) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser could not crop this image.");

      const { width, height, x, y } = getCropGeometry(
        image.naturalWidth,
        image.naturalHeight,
        outputWidth,
        outputHeight,
        { zoom, offsetX, offsetY },
      );
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, x, y, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("Image crop failed.")),
          "image/webp",
          0.92,
        );
      });
      const extension = blob.type === "image/webp" ? "webp" : "png";
      const name = `${file.name.replace(/\.[^.]+$/, "")}-cropped.${extension}`;
      await onComplete(new File([blob], name, { type: blob.type }));
    } catch (error) {
      toast.error(readableError(error, "Could not crop that image."));
    } finally {
      setBusy(false);
    }
  };

  const uploadOriginal = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onComplete(file);
    } catch (error) {
      toast.error(readableError(error, "Could not use that image."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent
        className="flex max-h-[92dvh] flex-col overflow-hidden p-4 sm:max-w-2xl sm:p-6"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Drag to position your image. Pinch or use the zoom slider to resize
            it. The preview matches the saved crop.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div
            ref={mountFrame}
            aria-label="Image crop preview"
            className={cn(
              "relative mx-auto w-full max-w-xl touch-none cursor-grab overflow-hidden bg-black/70 ring-1 ring-border active:cursor-grabbing",
              rounded ? "rounded-full" : "rounded-xl",
            )}
            style={{
              aspectRatio: outputWidth / outputHeight,
              maxWidth: aspect <= 1 ? "min(36rem, 42dvh)" : "36rem",
            }}
            onPointerDown={(event) => {
              if (
                !ready ||
                busy ||
                (event.pointerType === "mouse" && event.button !== 0)
              )
                return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pointersRef.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              beginDrag();
            }}
            onPointerMove={(event) => {
              if (!pointersRef.current.has(event.pointerId) || busy) return;
              pointersRef.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              const drag = dragRef.current;
              const point = pointerPosition();
              if (!drag || !point) return;
              const nextZoom = clampCrop(
                drag.distance && point.distance
                  ? (drag.zoom * point.distance) / drag.distance
                  : drag.zoom,
                1,
                4,
              );
              const next = getCropGeometry(
                imageSize.width,
                imageSize.height,
                frameSize.width,
                frameSize.height,
                { zoom: nextZoom, offsetX: 0, offsetY: 0 },
              );
              const ratio = nextZoom / drag.zoom;
              // Keep the image point between the fingers anchored while zooming.
              const anchorX = drag.x - drag.rect.left - drag.rect.width / 2;
              const anchorY = drag.y - drag.rect.top - drag.rect.height / 2;
              const shiftX =
                point.x -
                drag.rect.left -
                drag.rect.width / 2 -
                (anchorX - drag.shiftX) * ratio;
              const shiftY =
                point.y -
                drag.rect.top -
                drag.rect.height / 2 -
                (anchorY - drag.shiftY) * ratio;
              setZoom(nextZoom);
              setOffsetX(
                next.maxShiftX > 0
                  ? clampCrop((shiftX / next.maxShiftX) * 100)
                  : 0,
              );
              setOffsetY(
                next.maxShiftY > 0
                  ? clampCrop((shiftY / next.maxShiftY) * 100)
                  : 0,
              );
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          >
            <img
              ref={mountImage}
              alt="Crop preview"
              draggable={false}
              onLoad={(event) =>
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setImageError(true)}
              className="pointer-events-none absolute max-w-none select-none"
              style={
                geometry
                  ? {
                      width: geometry.width,
                      height: geometry.height,
                      left: geometry.x,
                      top: geometry.y,
                    }
                  : { visibility: "hidden" }
              }
            />
            {!ready && (
              <div
                className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white"
                role="status"
              >
                {imageError ? (
                  "This image could not be opened. Try a different image."
                ) : (
                  <Loader2
                    aria-label="Loading image"
                    className="size-6 animate-spin"
                  />
                )}
              </div>
            )}
            <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25" />
            <span className="pointer-events-none absolute inset-x-1/3 inset-y-0 border-x border-white/25" />
            <span className="pointer-events-none absolute inset-x-0 inset-y-1/3 border-y border-white/25" />
          </div>

          <div className="grid gap-4 rounded-xl border border-border/70 bg-surface p-4">
            <label className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm">
              <span>Zoom</span>
              <Slider
                aria-label="Zoom"
                disabled={!ready || busy}
                min={100}
                max={400}
                step={1}
                value={[Math.round(zoom * 100)]}
                onValueChange={(values) => setZoom((values[0] ?? 100) / 100)}
              />
              <span className="text-right text-xs text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
            </label>
            <label className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm">
              <span>Horizontal</span>
              <Slider
                aria-label="Horizontal position"
                disabled={!ready || busy || !geometry?.maxShiftX}
                min={-100}
                max={100}
                step={1}
                value={[offsetX]}
                onValueChange={(values) => setOffsetX(values[0] ?? 0)}
              />
              <span className="text-right text-xs text-muted-foreground">
                {Math.round(offsetX)}
              </span>
            </label>
            <label className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm">
              <span>Vertical</span>
              <Slider
                aria-label="Vertical position"
                disabled={!ready || busy || !geometry?.maxShiftY}
                min={-100}
                max={100}
                step={1}
                value={[offsetY]}
                onValueChange={(values) => setOffsetY(values[0] ?? 0)}
              />
              <span className="text-right text-xs text-muted-foreground">
                {Math.round(offsetY)}
              </span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!ready || busy}
              onClick={() => {
                setZoom(1);
                setOffsetX(0);
                setOffsetY(0);
              }}
            >
              Reset crop
            </Button>
          </div>

          {(file.type === "image/gif" || file.type === "image/apng") && (
            <p className="text-xs text-warning">
              Cropping exports a high-quality static WebP. Choose “Use original”
              to keep this image animated.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void uploadOriginal()}
          >
            Use original
          </Button>
          <Button
            type="button"
            disabled={busy || !ready}
            onClick={() => void crop()}
          >
            {busy ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Crop className="mr-1.5 size-4" />
            )}
            Crop and use
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
