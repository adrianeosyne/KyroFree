import { useUiStore } from "./store";

declare const __KYRO_WEB_BUILD__: string;

/** No native bridge: desktop refreshes use only the site's public build ID. */
export function startDesktopWebUpdates() {
  if (
    !import.meta.env.PROD ||
    !/Electron\/|KyroAndroid\//.test(navigator.userAgent)
  )
    return;
  let lastActivity = Date.now();
  let pendingBuild: string | null = null;
  let checking = false;
  let refreshing = false;
  const activity = () => {
    lastActivity = Date.now();
  };
  for (const event of ["pointerdown", "keydown", "input", "wheel"])
    window.addEventListener(event, activity, { passive: true });

  const safeToRefresh = () => {
    if (Date.now() - lastActivity < 60_000) return false;
    if (Object.values(useUiStore.getState().drafts).some(Boolean)) return false;
    if (
      document.querySelector(
        '[data-kyro-update-blocked="true"], [role="dialog"], [role="alertdialog"]',
      )
    )
      return false;
    for (const input of document.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("input, textarea")) {
      if (
        input instanceof HTMLInputElement &&
        ["hidden", "checkbox", "radio", "range", "button", "submit"].includes(
          input.type,
        )
      )
        continue;
      if (input.value) return false;
    }
    for (const editor of document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"]',
    ))
      if (editor.textContent?.trim()) return false;
    for (const media of document.querySelectorAll<HTMLMediaElement>(
      "video, audio",
    ))
      if (!media.paused && !media.ended) return false;
    return true;
  };

  const check = async () => {
    if (checking || refreshing || !navigator.onLine) return;
    checking = true;
    try {
      const response = await fetch("/desktop-version.json", {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return;
      const value: unknown = await response.json();
      if (
        !value ||
        typeof value !== "object" ||
        !("build" in value) ||
        typeof value.build !== "string" ||
        !/^[a-zA-Z0-9-]{8,100}$/.test(value.build)
      )
        return;
      pendingBuild = value.build === __KYRO_WEB_BUILD__ ? null : value.build;
      // Recheck activity after the network request, immediately before reloading.
      if (pendingBuild && safeToRefresh()) {
        refreshing = true;
        window.location.reload();
      }
    } catch {
      // Offline, a failed deployment, or an older server must not break the app.
    } finally {
      checking = false;
    }
  };
  window.setTimeout(() => void check(), 60_000);
  window.setInterval(() => void check(), 5 * 60_000);
  window.setInterval(() => {
    if (pendingBuild && safeToRefresh()) void check();
  }, 15_000);
  window.addEventListener("online", () => void check());
}
