import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { hasPremium } from "@/lib/entitlements";
import { WORKSPACE_DEFAULTS, type WorkspaceTheme } from "@/lib/workspaceTheme";
import { Button } from "@/components/ui/button";
import {
  FONT_THEMES,
  cursorAssets,
  workspaceFont,
} from "@/lib/workspaceStyles";
import {
  WorkspaceBackgroundEditor,
  WorkspaceCursorEditor,
} from "./WorkspaceAssets";
import { useSystemReducedMotion } from "@/hooks/use-system-reduced-motion";
import { useUiStore } from "@/lib/store";
import { toast } from "sonner";
import { useNow } from "@/hooks/use-now";
import { PremiumPrice } from "@/components/PremiumPrice";

export function WorkspaceAppearance() {
  const data = useQuery(api.workspace.get);
  const now = useNow(30_000);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const systemReducedMotion = useSystemReducedMotion();
  useEffect(() => {
    const root = document.documentElement;
    const t = data?.theme;
    if (!t || !now || !hasPremium(data, now)) {
      root.removeAttribute("data-workspace");
      return;
    }
    root.dataset.workspace = "true";
    for (const [key, value] of Object.entries(t))
      root.style.setProperty(
        `--workspace-${key}`,
        typeof value === "number" ? String(value) : value,
      );
    const still = reducedMotion || systemReducedMotion;
    const backgroundUrl =
      still && data.backgroundMayAnimate
        ? data.backgroundPosterUrl
        : data.backgroundUrl;
    root.style.setProperty(
      "--workspace-image",
      backgroundUrl ? `url(${JSON.stringify(backgroundUrl)})` : "none",
    );
    root.style.setProperty("--workspace-font", workspaceFont(t.font));
    const assets = cursorAssets(t.cursor ?? "kyro");
    const uploaded = t.cursor === "uploaded" && data.cursorUrl;
    root.style.setProperty(
      "--kyro-cursor-default",
      uploaded
        ? `url(${JSON.stringify(data.cursorUrl)}) ${data.cursorHotspotX} ${data.cursorHotspotY}, auto`
        : `url(${JSON.stringify(assets.normal)}) 4 3, auto`,
    );
    root.style.setProperty(
      "--kyro-cursor-pointer",
      uploaded
        ? `url(${JSON.stringify(data.cursorUrl)}) ${data.cursorHotspotX} ${data.cursorHotspotY}, pointer`
        : `url(${JSON.stringify(assets.pointer)}) 4 3, pointer`,
    );
    return () => {
      root.removeAttribute("data-workspace");
      root.style.removeProperty("--kyro-cursor-default");
      root.style.removeProperty("--kyro-cursor-pointer");
    };
  }, [data, now, reducedMotion, systemReducedMotion]);
  return null;
}
const ranges = [
  ["radius", "Corner radius", 0, 32],
  ["sidebarWidth", "Sidebar width", 200, 320],
  ["panelOpacity", "Panel opacity", 70, 100],
  ["backgroundOpacity", "Background visibility", 0, 50],
  ["backgroundBlur", "Background blur", 0, 20],
  ["spacing", "Message spacing", 80, 120],
  ["borderWidth", "Panel border weight", 0, 2],
  ["shadow", "Panel shadow", 0, 40],
  ["contrast", "Workspace contrast", 90, 120],
] as const;
export function WorkspaceStudio() {
  const data = useQuery(api.workspace.get);
  const save = useMutation(api.workspace.save);

  const [draft, setDraft] = useState<WorkspaceTheme | null>(null);
  const [busy, setBusy] = useState(false);
  const t = { ...WORKSPACE_DEFAULTS, ...(draft ?? data?.theme) };
  const perform = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success("Workspace saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save workspace.");
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <p role="status">Loading studio…</p>;
  if (!hasPremium(data))
    return (
      <section className="rounded-3xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 to-panel p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-300">
          Premium studio
        </p>
        <h2 className="mt-3 text-2xl font-bold">Build your own Kyro.</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Unlock workspace colors, backgrounds, typography, panels and layout
          including animated images, font themes and your own cursor, for{" "}
          <PremiumPrice suffix=" per month" showOfferLabel />. Open Premium in
          settings to request activation.
        </p>
      </section>
    );
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">Your workspace. Your world.</h2>
      <div
        className="rounded-2xl p-5"
        style={{
          background: t.background,
          color: t.text,
          border: `${t.borderWidth}px solid ${t.accent}`,
          borderRadius: t.radius,
          fontFamily: workspaceFont(t.font),
        }}
      >
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: t.accent }}
        >
          Live studio preview
        </p>
        <div className="mt-3 rounded-xl p-4" style={{ background: t.panel }}>
          <p className="font-semibold">Welcome to your Kyro</p>
          <p className="mt-2 text-sm">
            A space that feels like you, from the first message.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["background", "panel", "accent", "text"] as const).map((key) => (
          <label
            key={key}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-sm capitalize"
          >
            {key} color
            <input
              type="color"
              aria-label={`Workspace ${key} color`}
              value={t[key]}
              onChange={(e) => setDraft({ ...t, [key]: e.target.value })}
            />
          </label>
        ))}
        {ranges.map(([key, label, min, max]) => (
          <label
            key={key}
            className="rounded-xl border border-border bg-surface p-4 text-sm"
          >
            {label}{" "}
            <span className="float-right text-muted-foreground">{t[key]}</span>
            <input
              aria-label={label}
              className="mt-3 w-full accent-primary"
              type="range"
              min={min}
              max={max}
              value={t[key]}
              onChange={(e) =>
                setDraft({ ...t, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        {(
          [
            ["backgroundPosition", ["center", "top", "bottom"]],
            ["backgroundFit", ["cover", "contain"]],
          ] as const
        ).map(([key, options]) => (
          <label
            key={key}
            className="rounded-xl border border-border bg-surface p-4 text-sm"
          >
            {key.replace(/([A-Z])/g, " $1")}
            <select
              aria-label={key}
              className="mt-2 w-full rounded-lg border border-input bg-background p-2"
              value={t[key]}
              onChange={(e) => setDraft({ ...t, [key]: e.target.value })}
            >
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h3 className="font-semibold">Font themes</h3>
        <p className="text-xs text-muted-foreground">
          Choose from 15 styles, including 12 new gaming and creator fonts.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FONT_THEMES.map((font) => (
            <button
              key={font.id}
              type="button"
              aria-label={`${font.name} font theme`}
              aria-pressed={t.font === font.id}
              disabled={busy}
              onClick={() => setDraft({ ...t, font: font.id })}
              className="rounded-xl border border-border bg-panel p-4 text-left aria-pressed:border-primary aria-pressed:bg-primary/10"
            >
              <span
                className="block text-lg"
                style={{ fontFamily: font.family }}
              >
                Aa · Kyro
              </span>
              <span className="mt-2 block text-sm font-semibold">
                {font.name}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {font.description}
              </span>
            </button>
          ))}
        </div>
      </section>
      <WorkspaceCursorEditor
        data={data}
        selectedCursor={t.cursor}
        disabled={busy}
        onCursorChange={(cursor) =>
          setDraft((current) => ({
            ...WORKSPACE_DEFAULTS,
            ...(current ?? data.theme),
            cursor,
          }))
        }
      />
      <div className="flex gap-3">
        <Button
          disabled={busy}
          onClick={() => void perform(() => save({ theme: t }))}
        >
          Save workspace
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setDraft(WORKSPACE_DEFAULTS);
            void perform(() => save({ theme: WORKSPACE_DEFAULTS }));
          }}
        >
          Reset studio
        </Button>
      </div>
      <WorkspaceBackgroundEditor data={data} disabled={busy} />
    </div>
  );
}
