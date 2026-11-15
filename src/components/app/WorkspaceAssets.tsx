import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { useSystemReducedMotion } from "@/hooks/use-system-reduced-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useUploadFile } from "@/lib/upload";
import { useUiStore } from "@/lib/store";
import { backgroundStill } from "@/lib/workspaceImages";
import { cursorPngSize } from "@/lib/cursorPng";
import {
  CURSOR_THEMES,
  cursorAssets,
  WORKSPACE_IMAGE_TYPES,
  WORKSPACE_BACKGROUND_BYTES,
  WORKSPACE_CURSOR_BYTES,
} from "@/lib/workspaceStyles";
import { toast } from "sonner";

type WorkspaceData = FunctionReturnType<typeof api.workspace.get>;
type PendingBackground = {
  file: File;
  poster: File;
  preview: string;
  still: string;
};

export function WorkspaceBackgroundEditor({
  data,
  disabled,
}: {
  data: WorkspaceData;
  disabled: boolean;
}) {
  const upload = useUploadFile({ requireRegistration: true });
  const background = useMutation(api.workspace.background);
  const discard = useMutation(api.files.discard);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const systemReducedMotion = useSystemReducedMotion();
  const [selected, setSelected] = useState<PendingBackground | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const mounted = useRef(true),
    selectionEpoch = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (selected) {
        URL.revokeObjectURL(selected.preview);
        URL.revokeObjectURL(selected.still);
      }
    },
    [selected],
  );
  const motionOff = reducedMotion || systemReducedMotion;
  const preview = selected
    ? motionOff
      ? selected.still
      : selected.preview
    : motionOff && data.backgroundMayAnimate
      ? data.backgroundPosterUrl
      : data.backgroundUrl;
  const choose = async (file: File) => {
    const epoch = ++selectionEpoch.current;
    if (
      !(WORKSPACE_IMAGE_TYPES as readonly string[]).includes(file.type) ||
      file.size > WORKSPACE_BACKGROUND_BYTES
    ) {
      toast.error("Choose a static or animated image up to 5 MB.");
      return;
    }
    setSelected(null);
    setPreparing(true);
    try {
      const poster = await backgroundStill(file);
      if (!mounted.current || epoch !== selectionEpoch.current) return;
      setSelected({
        file,
        poster,
        preview: URL.createObjectURL(file),
        still: URL.createObjectURL(poster),
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not preview this image.",
      );
    } finally {
      if (mounted.current && epoch === selectionEpoch.current)
        setPreparing(false);
    }
  };
  const apply = async () => {
    if (!selected) return;
    setBusy(true);
    const uploaded: Id<"_storage">[] = [];
    try {
      const original = await upload(selected.file);
      uploaded.push(original.storageId);
      const poster = await upload(selected.poster);
      uploaded.push(poster.storageId);
      await background({
        storageId: original.storageId,
        posterStorageId: poster.storageId,
      });
      if (mounted.current) setSelected(null);
      toast.success("Your background is ready.");
    } catch (e) {
      await Promise.allSettled(
        uploaded.map((storageId) => discard({ storageId })),
      );
      toast.error(
        e instanceof Error ? e.message : "Could not save background.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section className="space-y-4 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-surface p-5">
      <h3 className="font-semibold">Your own background</h3>
      <p className="text-xs text-muted-foreground">
        Static or animated PNG, APNG, JPEG, GIF, WebP and AVIF · up to 5 MB.
        Preview it here before applying.
      </p>
      <label className="block text-sm">
        Background image
        <input
          aria-label="Background image"
          type="file"
          accept={WORKSPACE_IMAGE_TYPES.join(",")}
          disabled={disabled || busy || preparing}
          className="mt-3 block w-full text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
            e.target.value = "";
          }}
        />
      </label>
      {preparing && (
        <p role="status" className="text-xs">
          Preparing your background preview…
        </p>
      )}
      {preview && (
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <img
            src={preview}
            alt={
              selected
                ? "Selected background preview"
                : "Current workspace background"
            }
            className="max-h-64 w-full object-contain"
          />
        </div>
      )}
      {motionOff && (
        <p className="text-xs text-muted-foreground">
          Reduced motion is on. Kyro uses a still frame of animated backgrounds.
        </p>
      )}
      {selected && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {selected.file.name} ·{" "}
            {(selected.file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <Button disabled={disabled || busy} onClick={() => void apply()}>
            {busy ? "Uploading background…" : "Apply background"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setSelected(null)}
          >
            Discard preview
          </Button>
        </div>
      )}
      {data.backgroundUrl && (
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await background({ storageId: null });
              toast.success("Background removed.");
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Could not remove background.",
              );
            } finally {
              if (mounted.current) setBusy(false);
            }
          }}
        >
          Remove background
        </Button>
      )}
    </section>
  );
}

type PendingCursor = {
  file: File;
  preview: string;
  width: number;
  height: number;
  x: number;
  y: number;
};
export function WorkspaceCursorEditor({
  data,
  selectedCursor,
  onCursorChange,
  disabled,
}: {
  data: WorkspaceData;
  selectedCursor: string;
  onCursorChange: (id: string) => void;
  disabled: boolean;
}) {
  const upload = useUploadFile({ requireRegistration: true });
  const setCursor = useAction(api.workspaceCursors.set);
  const discard = useMutation(api.files.discard);
  const enabled = useUiStore((state) => state.customCursor);
  const setPreference = useUiStore((state) => state.setPreference);
  const [selected, setSelected] = useState<PendingCursor | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    selectionEpoch = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const previewUrl = selected?.preview;
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  const choose = async (file: File) => {
    const epoch = ++selectionEpoch.current;
    if (file.type !== "image/png" || file.size > WORKSPACE_CURSOR_BYTES) {
      toast.error("Choose a static PNG cursor up to 128 KB.");
      return;
    }
    setSelected(null);
    try {
      const size = cursorPngSize(new Uint8Array(await file.arrayBuffer()));
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      if (!mounted.current || epoch !== selectionEpoch.current) return;
      setSelected({
        file,
        preview: URL.createObjectURL(file),
        ...size,
        x: Math.min(4, size.width - 1),
        y: Math.min(3, size.height - 1),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not preview cursor.");
    }
  };
  const apply = async () => {
    if (!selected) return;
    setBusy(true);
    let storageId: Id<"_storage"> | undefined;
    try {
      const asset = await upload(selected.file);
      storageId = asset.storageId;
      await setCursor({
        storageId,
        hotspotX: selected.x,
        hotspotY: selected.y,
      });
      onCursorChange("uploaded");
      if (mounted.current) setSelected(null);
      toast.success("Your custom cursor is ready.");
    } catch (e) {
      if (storageId) await discard({ storageId }).catch(() => {});
      toast.error(e instanceof Error ? e.message : "Could not save cursor.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <section className="space-y-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-surface p-5">
      <h3 className="font-semibold">Cursor collection</h3>
      <p className="text-xs text-muted-foreground">
        10 new gaming styles, the Kyro original, and your own artwork. Text
        inputs keep their familiar text cursor.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setPreference("customCursor", e.target.checked)}
        />{" "}
        Enable custom cursors
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CURSOR_THEMES.map((cursor) => {
          const assets = cursorAssets(cursor.id);
          return (
            <button
              key={cursor.id}
              type="button"
              aria-label={`${cursor.name} cursor`}
              aria-pressed={selectedCursor === cursor.id}
              disabled={disabled || busy}
              onClick={() => onCursorChange(cursor.id)}
              style={{
                cursor: enabled
                  ? `url(${JSON.stringify(assets.normal)}) 4 3, pointer`
                  : undefined,
              }}
              className="rounded-xl border border-border bg-panel p-4 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              <img src={assets.normal} alt="" className="size-8" />
              <span className="mt-2 block text-sm font-semibold">
                {cursor.name}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {cursor.description}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Choose a style, then save your workspace. Custom cursors appear on
        devices with a mouse or trackpad.
      </p>
      {data.cursorUrl && (
        <button
          type="button"
          aria-label="Use my uploaded cursor"
          aria-pressed={selectedCursor === "uploaded"}
          disabled={disabled || busy}
          onClick={() => onCursorChange("uploaded")}
          className="flex items-center gap-3 rounded-xl border border-border bg-panel p-4 text-sm aria-pressed:border-primary"
        >
          <img
            src={data.cursorUrl}
            alt="Your saved cursor"
            className="size-8 object-contain"
          />{" "}
          Your uploaded cursor
        </button>
      )}
      <label className="block text-sm">
        Your own cursor
        <input
          aria-label="Cursor image"
          type="file"
          accept="image/png"
          disabled={disabled || busy}
          className="mt-3 block w-full text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Static PNG · up to 64 × 64 pixels and 128 KB. Transparent 32 × 32
        artwork works well.
      </p>
      {selected && (
        <div className="space-y-3 rounded-xl border border-border bg-panel p-4">
          <div className="flex items-center gap-3">
            <img
              src={selected.preview}
              alt="Selected cursor preview"
              className="size-16 object-contain [image-rendering:pixelated]"
            />
            <p className="text-xs">
              {selected.file.name} · {selected.width} × {selected.height}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Set the click point to the tip of your cursor.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["x", "y"] as const).map((axis) => (
              <label key={axis} className="text-xs">
                Click point {axis.toUpperCase()}
                <input
                  aria-label={`Cursor click point ${axis.toUpperCase()}`}
                  type="number"
                  min={0}
                  max={(axis === "x" ? selected.width : selected.height) - 1}
                  step={1}
                  value={selected[axis]}
                  onChange={(e) =>
                    setSelected({ ...selected, [axis]: Number(e.target.value) })
                  }
                  className="mt-2 w-full rounded-md border border-input bg-background p-2"
                />
              </label>
            ))}
          </div>
          <Button disabled={disabled || busy} onClick={() => void apply()}>
            {busy ? "Uploading cursor…" : "Apply uploaded cursor"}
          </Button>
          <Button
            className="ml-2"
            variant="outline"
            disabled={busy}
            onClick={() => setSelected(null)}
          >
            Discard cursor preview
          </Button>
        </div>
      )}
      {data.cursorUrl && (
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setCursor({ storageId: null });
              if (selectedCursor === "uploaded") onCursorChange("kyro");
              toast.success("Uploaded cursor removed.");
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Could not remove cursor.",
              );
            } finally {
              if (mounted.current) setBusy(false);
            }
          }}
        >
          Remove uploaded cursor
        </Button>
      )}
    </section>
  );
}
