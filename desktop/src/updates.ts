import { dialog } from "electron";
import { autoUpdater } from "electron-updater";

/** Native updates download in the background and install only on a real quit. */
export class DesktopUpdates {
  private timer?: ReturnType<typeof setInterval>;
  private checking = false;
  private downloaded = false;
  private available = false;

  constructor(
    private readonly options: {
      enabled: boolean;
      beforeInstall: () => void;
      notify: () => void;
    },
  ) {}

  start() {
    if (!this.options.enabled) return;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    // Updates come only from this app's public GitHub release feed.
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "adrianeosyne",
      repo: "KyroFree",
    });
    autoUpdater.on("error", () => {
      /* Retry on the next scheduled check. */
    });
    autoUpdater.on("update-available", () => {
      this.available = true;
    });
    autoUpdater.on("update-not-available", () => {
      this.available = false;
    });
    autoUpdater.on("update-downloaded", () => {
      this.downloaded = true;
      this.options.notify();
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
    if (this.checking) return;
    this.checking = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      // The download outlives the metadata request. Handle its separate failure
      // promise so a lost connection cannot crash a background tray process.
      void result?.downloadPromise?.catch(() => {
        this.available = false;
      });
      if (manual)
        await dialog.showMessageBox({
          type: "info",
          message: this.available
            ? "A Kyro update is downloading."
            : "Kyro is up to date.",
          detail: this.available
            ? "It will install when you quit Kyro from the app menu or tray."
            : undefined,
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

  async install() {
    if (!this.downloaded) return this.check(true);
    const result = await dialog.showMessageBox({
      type: "question",
      title: "Update Kyro",
      message: "Restart Kyro to install the update?",
      detail: "Restarting ends active calls. Your account stays signed in.",
      buttons: ["Later", "Restart and update"],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return;
    this.options.beforeInstall();
    autoUpdater.quitAndInstall(false, true);
  }

  stop() {
    clearInterval(this.timer);
  }
}
