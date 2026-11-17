import { useSyncExternalStore } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Check,
  Headphones,
  MessageCircle,
  Smartphone,
} from "@/components/icons";
import { KyroMark, KyroWordmark } from "@/components/KyroMark";
import { IOSInstallGuide } from "@/components/app/IOSInstallGuide";
import { getInstallState, subscribeInstallState } from "@/lib/installApp";
import { isNativeMobileApp } from "@/lib/mobile";

export default function IOSInstallPage() {
  const { installed } = useSyncExternalStore(
    subscribeInstallState,
    getInstallState,
    getInstallState,
  );
  const usingApp = installed || isNativeMobileApp();
  return (
    <div className="dark min-h-screen overflow-x-clip bg-[#111318] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="Kyro home">
            <KyroWordmark />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold sm:text-sm"
          >
            Open Kyro <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_280px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">
              YOUR PEOPLE. ONE TAP AWAY.
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-[-.045em] sm:text-5xl">
              {usingApp ? "Kyro is ready on your " : "Install Kyro on your "}
              <span className="text-violet-300">iPhone.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
              Add Kyro to your Home Screen directly from Safari. Open your
              conversations in their own app window, with your existing account.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-slate-300">
              {["Free", "No computer needed", "Your existing account"].map(
                (text) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <Check className="size-4 text-violet-300" />
                    {text}
                  </span>
                ),
              )}
            </div>
            <a
              href={usingApp ? "/dashboard" : "#install-steps"}
              className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-violet-400 px-6 font-bold text-[#171320] transition hover:bg-violet-300 sm:w-auto"
            >
              <Smartphone className="size-5" />
              {usingApp ? "Open your conversations" : "Show install steps"}
            </a>
          </div>
          <div
            className="mx-auto w-full max-w-[240px] rounded-[36px] border border-white/15 bg-white/[.025] px-6 py-8 text-center"
            aria-label="Kyro Home Screen icon"
          >
            <KyroMark className="mx-auto size-20 rounded-[20px]" />
            <p className="mt-4 text-xl font-bold tracking-tight">Kyro</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Ready on your Home Screen.
            </p>
            <div className="mt-6 flex items-center justify-center gap-5 text-violet-300">
              <MessageCircle className="size-5" />
              <Headphones className="size-5" />
              <Smartphone className="size-5" />
            </div>
          </div>
        </div>
        <section
          id="install-steps"
          className="mt-12 scroll-mt-6 rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8"
          aria-labelledby="ios-install-heading"
        >
          <div className="mb-6">
            <h2
              id="ios-install-heading"
              className="text-2xl font-bold tracking-tight"
            >
              {usingApp ? "Your Kyro app is ready" : "Install from Safari"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {usingApp
                ? "Open Kyro from your Home Screen. It stays up to date automatically."
                : "Use Safari’s Share menu to add the Kyro web app. It stays up to date automatically."}
            </p>
          </div>
          <IOSInstallGuide buttonClassName="bg-violet-400 text-[#171320] hover:bg-violet-300" />
        </section>
        <p className="mt-6 text-sm leading-6 text-slate-400">
          You can also use these steps on an iPad. Internet access is needed for
          chats, uploads, and calls.
        </p>
      </main>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-slate-500">
        <Link to="/terms" className="inline-flex min-h-11 items-center">
          Terms
        </Link>
        <span className="px-3">·</span>
        <Link to="/privacy" className="inline-flex min-h-11 items-center">
          Privacy
        </Link>
        <span className="px-3">·</span>
        <Link to="/download" className="inline-flex min-h-11 items-center">
          Other Kyro apps
        </Link>
      </footer>
    </div>
  );
}
