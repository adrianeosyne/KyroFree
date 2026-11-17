import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Plus, Smartphone } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getInstallState, subscribeInstallState } from "@/lib/installApp";
import { isNativeMobileApp } from "@/lib/mobile";
import { cn } from "@/lib/utils";

function SafariShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M12 15V3m-4 4 4-4 4 4M7 10H5v11h14V10h-2" />
    </svg>
  );
}

function InstallationSteps() {
  const inAppBrowser =
    typeof navigator !== "undefined" &&
    /FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|TikTok/i.test(
      navigator.userAgent,
    );
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        {inAppBrowser
          ? "Open this page in Safari first. Use your browser menu to open Safari, or enter kyro-chat.cyou/install/ios in Safari."
          : "Open this page in Safari on your iPhone or iPad, then follow these steps."}
      </p>
      <ol className="space-y-5" aria-label="iPhone installation steps">
        <li className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <SafariShareIcon />
          </span>
          <div>
            <p className="font-semibold">1. Tap Safari’s Share button</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Look for the square with an upward arrow in Safari’s toolbar or
              menu.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Plus className="size-5" />
          </span>
          <div>
            <p className="font-semibold">2. Choose Add to Home Screen</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Scroll through the Share menu. If the action is hidden, check More
              or Edit Actions.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Smartphone className="size-5" />
          </span>
          <div>
            <p className="font-semibold">3. Tap Add</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Keep Open as Web App enabled if it appears. Open the Kyro icon on
              your Home Screen and sign in.
            </p>
          </div>
        </li>
      </ol>
      <p className="border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
        Safari completes the installation from its Share menu. Your chats and
        calls use your existing Kyro account and need an internet connection.
      </p>
    </div>
  );
}

export function IOSInstallGuide({
  compact = false,
  className,
  buttonClassName,
}: {
  compact?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const { installed } = useSyncExternalStore(
    subscribeInstallState,
    getInstallState,
    getInstallState,
  );
  const usingApp = installed || isNativeMobileApp();

  if (usingApp) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Check className="size-4 text-primary" />
          Kyro is installed
        </p>
        <Button
          asChild
          className={cn("min-h-12 cursor-pointer rounded-xl", buttonClassName)}
        >
          <Link to="/dashboard">
            Open Kyro <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  if (!compact) {
    return (
      <div className={cn("space-y-6", className)}>
        <InstallationSteps />
        <Button
          asChild
          className={cn("min-h-12 cursor-pointer rounded-xl", buttonClassName)}
        >
          <Link to="/dashboard">
            Open Kyro now <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("min-h-12 cursor-pointer rounded-xl", buttonClassName)}
      >
        <Smartphone className="size-4" />
        Show install steps
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-border/70 shadow-none">
          <DialogHeader>
            <DialogTitle className="pr-6 text-xl font-bold tracking-tight">
              Install Kyro on your iPhone
            </DialogTitle>
            <DialogDescription>
              Just your iPhone and Safari. No computer or developer account
              needed.
            </DialogDescription>
          </DialogHeader>
          <InstallationSteps />
          <Button asChild className="min-h-12 cursor-pointer rounded-xl">
            <Link to="/install/ios" onClick={() => setOpen(false)}>
              Open the installation page <ArrowRight className="size-4" />
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
