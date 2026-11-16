import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Download as ArrowDownToLine, X } from "@/components/icons";
import { KyroMark } from "@/components/KyroMark";
import { isAndroidApp, mobilePlatform } from "@/lib/mobile";

const DISMISS_KEY = "kyro.mobileDownload.dismissedUntil";

export function MobileDownloadBanner({
  floating = false,
}: {
  floating?: boolean;
}) {
  const { pathname } = useLocation();
  const platform = mobilePlatform();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Number(localStorage.getItem(DISMISS_KEY)) > Date.now();
    } catch {
      return false;
    }
  });
  if (
    !platform ||
    isAndroidApp() ||
    dismissed ||
    pathname === "/download" ||
    floating === pathname.startsWith("/dashboard")
  )
    return null;

  return (
    <aside
      aria-label={
        platform === "android"
          ? "Download Kyro for Android"
          : "Install Kyro on your phone"
      }
      className={
        floating ? "mobile-download-floating" : "mobile-download-inline"
      }
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15">
        <KyroMark className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Kyro, in your pocket</p>
        <p className="text-[11px] text-muted-foreground">
          {platform === "android"
            ? "Get the Android app."
            : "Add Kyro to your home screen."}
        </p>
      </div>
      <Link
        to={platform === "android" ? "/download#android" : "/download#web-app"}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground"
      >
        <ArrowDownToLine className="size-4" />
        {platform === "android" ? "Download" : "Install"}
      </Link>
      <button
        type="button"
        aria-label="Dismiss app download prompt"
        className="grid min-h-11 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(
              DISMISS_KEY,
              String(Date.now() + 7 * 86400000),
            );
          } catch {
            /* Dismissal still applies for this visit. */
          }
        }}
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}
