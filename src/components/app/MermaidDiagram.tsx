import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { validateMermaidSource } from "@/lib/mermaid";
import { toast } from "sonner";

export default function MermaidDiagram({ source }: { source: string }) {
  const target = useRef<HTMLDivElement>(null);
  const themePreference = useUiStore((state) => state.theme);
  const [systemLight, setSystemLight] = useState(
    () => window.matchMedia("(prefers-color-scheme: light)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const changed = () => setSystemLight(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const resolvedTheme =
    themePreference === "system"
      ? systemLight
        ? "light"
        : "dark"
      : themePreference;
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState({
    source: "",
    theme: "",
    url: "",
    error: "",
  });
  let sourceError = "";
  try {
    validateMermaidSource(source);
  } catch (cause) {
    sourceError = cause instanceof Error ? cause.message : "Invalid diagram.";
  }
  const current =
    rendered.source === source && rendered.theme === resolvedTheme;
  const url = current && !sourceError ? rendered.url : "";
  const error = sourceError || (current ? rendered.error : "");
  const [showSource, setShowSource] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "150px" },
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || sourceError) return;
    let objectUrl = "";
    const nonce = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;width:1000px;height:800px;left:-2000px;visibility:hidden;pointer-events:none";
    const receive = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return;
      if (event.data?.kind === "kyro.diagram.ready")
        frame.contentWindow?.postMessage(
          { kind: "kyro.diagram.render", source, theme: resolvedTheme, nonce },
          "*",
        );
      if (
        event.data?.kind === "kyro.diagram.result" &&
        event.data.nonce === nonce
      ) {
        clearTimeout(timeout);
        if (typeof event.data.svg === "string")
          objectUrl = URL.createObjectURL(
            new Blob([event.data.svg], { type: "image/svg+xml" }),
          );
        setRendered({
          source,
          theme: resolvedTheme ?? "",
          url: objectUrl,
          error: objectUrl
            ? ""
            : String(event.data.error || "Rendering failed."),
        });
        frame?.remove();
      }
    };
    window.addEventListener("message", receive);
    frame.src = "/mermaid.html";
    document.body.append(frame);
    const timeout = setTimeout(() => {
      setRendered({
        source,
        theme: resolvedTheme ?? "",
        url: "",
        error: "Rendering took too long. Simplify this diagram.",
      });
      frame.remove();
    }, 10_000);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      frame.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, source, resolvedTheme, sourceError]);
  const controls = (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          void navigator.clipboard.writeText(source).then(
            () => toast.success("Source copied"),
            () => toast.error("Could not copy source"),
          )
        }
      >
        Copy source
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowSource(!showSource)}
      >
        {showSource ? "Hide source" : "View source"}
      </Button>
      {url && (
        <Button size="sm" variant="ghost" asChild>
          <a href={url} download="kyro-diagram.svg">
            Download SVG
          </a>
        </Button>
      )}
      {url && !expanded && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setExpanded(true);
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Expand diagram
        </Button>
      )}
    </div>
  );
  return (
    <div
      ref={target}
      className="my-2 min-w-0 max-w-full rounded-xl border border-border bg-surface p-2"
      aria-label="Mermaid diagram"
    >
      {controls}
      {error ? (
        <p role="alert" className="p-3 text-sm text-destructive">
          {error}
        </p>
      ) : url ? (
        <img
          src={url}
          alt="Mermaid diagram. Use View source for its text representation."
          className="mx-auto max-h-96 w-full object-contain"
        />
      ) : (
        <p role="status" className="p-4 text-xs text-muted-foreground">
          {visible ? "Rendering diagram…" : "Diagram preview"}
        </p>
      )}
      {(showSource || error) && (
        <pre className="max-h-64 overflow-auto p-3 text-xs">
          <code>{source}</code>
        </pre>
      )}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[95vh] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Diagram viewer</DialogTitle>
            <DialogDescription>
              Drag to pan, use arrow keys to move, and + or − to zoom.
            </DialogDescription>
          </DialogHeader>
          {controls}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}
            >
              −
            </Button>
            <span className="py-1 text-sm">{Math.round(zoom * 100)}%</span>
            <Button
              size="sm"
              variant="outline"
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(5, z * 1.25))}
            >
              +
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset
            </Button>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-label="Pan and zoom diagram"
            className="h-[60vh] touch-none overflow-hidden rounded border border-border bg-surface outline-none focus:ring-2 focus:ring-primary"
            onPointerDown={(e) => {
              drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current)
                setPan({
                  x: e.clientX - drag.current.x,
                  y: e.clientY - drag.current.y,
                });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "+",
                  "-",
                ].includes(e.key)
              )
                e.preventDefault();
              if (e.key === "+") setZoom((z) => Math.min(5, z * 1.25));
              if (e.key === "-") setZoom((z) => Math.max(0.25, z / 1.25));
              setPan((p) => ({
                x:
                  p.x +
                  (e.key === "ArrowLeft"
                    ? -30
                    : e.key === "ArrowRight"
                      ? 30
                      : 0),
                y:
                  p.y +
                  (e.key === "ArrowUp" ? -30 : e.key === "ArrowDown" ? 30 : 0),
              }));
            }}
          >
            <img
              src={url}
              alt="Expanded Mermaid diagram"
              draggable={false}
              className="h-full w-full object-contain"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
