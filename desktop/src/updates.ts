import { dialog } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateInfo } from "builder-util-runtime";

function updateDetails(info?: UpdateInfo): string {
  const installer =
    info?.files?.find((file) => /x64.*\.exe$/i.test(file.url)) ??
    info?.files?.find((file) => /\.exe$/i.test(file.url)) ??
    info?.files?.[0];
  const size = installer?.size;
  const sizeLabel =
    size && Number.isFinite(size) && size > 0
      ? `${(size / 1024 / 1024).toFixed(1)} MB`
      : "Not provided by this release";
  const rawNotes = Array.isArray(info?.releaseNotes)
    ? info.releaseNotes
        .map((entry) => `${entry.version}\n${entry.note ?? ""}`)
        .join("\n\n")
    : (info?.releaseNotes ?? "");
  const notes = rawNotes
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/?(?:p|div|h[1-6]|br)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|#39|nbsp);/g,
      (entity) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'",
          "&nbsp;": " ",
        })[entity] ?? entity,
    )
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 6000);
  return `Version: ${info?.version ?? "Latest"}\nUpdate size: ${sizeLabel}\n\nWhat's new\n${notes || "Release notes were not included."}`;
}

/** Native releases prompt before downloading and again before restarting. */
export class DesktopUpdates {
  private timer?: ReturnType<typeof setInterval>;
  private checking = false;
  private downloaded = false;
  private downloading = false;
  private available = false;
  private prompting = false;
  private promptedVersion?: string;
  private info?: UpdateInfo;

  constructor(
    private readonly options: {
      enabled: boolean;
      beforeInstall: () => void;
      beforePrompt?: () => void;
      notify: () => void;
    },
  ) {}

  start() {
    if (!this.options.enabled) return;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "adrianeosyne",
      repo: "KyroFree",
    });
    autoUpdater.on("error", () => {
      /* Retry on the next scheduled check. */
    });
    autoUpdater.on("update-available", (info) => {
      this.available = true;
      this.info = info;
    });
    autoUpdater.on("update-not-available", () => {
      this.available = false;
    });
    autoUpdater.on("update-downloaded", (info) => {
      this.downloaded = true;
      this.downloading = false;
      this.info = info ?? this.info;
      this.options.notify();
      void this.install().catch(() => undefined);
    });
    void this.check();
    this.timer = setInterval(() => void this.check(), 4 * 60 * 60 * 1000);
    this.timer.unref();
  }

  async check(manual = false) {
    if (!this.options.enabled) {
      if (manual)
        await dialog.showMessageBox({
          type: "info",
          message: "Update checks are available in the installed Kyro app.",
        });
      return;
    }
    if (this.downloaded) {
      if (manual) await this.install();
      return;
    }
    if (this.checking || this.prompting) return;
    if (this.downloading) {
      if (manual)
        await dialog.showMessageBox({
          type: "info",
          message: "A Kyro update is downloading.",
          detail: updateDetails(this.info),
        });
      return;
    }
    this.checking = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      void result?.downloadPromise?.catch(() => {
        this.available = false;
      });
      if (this.available) await this.offerDownload(manual);
      else if (manual)
        await dialog.showMessageBox({
          type: "info",
          message: "Kyro is up to date.",
        });
    } catch {
      if (manual)
        await dialog.showMessageBox({
          type: "warning",
          message: "Couldn't check for updates.",
          detail:
            "Check your connection and try again. Kyro will also retry automatically.",
        });
    } finally {
      this.checking = false;
    }
  }

  private async offerDownload(manual: boolean) {
    if (
      this.prompting ||
      (!manual && this.promptedVersion === this.info?.version)
    )
      return;
    this.promptedVersion = this.info?.version;
    this.prompting = true;
    let accepted = false;
    try {
      this.options.beforePrompt?.();
      const result = await dialog.showMessageBox({
        type: "question",
        title: "Kyro update available",
        message: `Kyro ${this.info?.version ?? "update"} is available.`,
        detail: updateDetails(this.info),
        buttons: ["Later", "Download update"],
        defaultId: 1,
        cancelId: 0,
      });
      accepted = result.response === 1;
    } finally {
      this.prompting = false;
    }
    if (accepted) void this.download();
  }

  private async download() {
    this.downloading = true;
    try {
      await autoUpdater.downloadUpdate();
    } catch {
      this.promptedVersion = undefined;
      await dialog
        .showMessageBox({
          type: "warning",
          message: "Couldn't download the Kyro update.",
          detail:
            "Check your connection and use Kyro > Check for updates to retry.",
        })
        .catch(() => undefined);
    } finally {
      this.downloading = false;
    }
  }

  async install() {
    if (this.prompting) return;
    if (!this.downloaded) return this.check(true);
    this.prompting = true;
    try {
      this.options.beforePrompt?.();
      const result = await dialog.showMessageBox({
        type: "question",
        title: "Kyro update ready",
        message: `Restart Kyro to install ${this.info?.version ?? "the update"}?`,
        detail: `${updateDetails(this.info)}\n\nRestarting ends active calls. Your account stays signed in. You can also install later by quitting Kyro.`,
        buttons: ["Later", "Restart and update"],
        defaultId: 0,
        cancelId: 0,
      });
      if (result.response !== 1) return;
      this.options.beforeInstall();
      autoUpdater.quitAndInstall(false, true);
    } finally {
      this.prompting = false;
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}
