import { useSyncExternalStore } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Download,
  Check,
  MessageCircle,
  Headphones,
  Smartphone,
  Monitor,
  Code,
} from "@/components/icons";
import { KyroMark, KyroWordmark } from "@/components/KyroMark";
import {
  ANDROID_DOWNLOAD_URL,
  ANDROID_SOURCE_URL,
  ANDROID_VERSION,
  IOS_BUILD_GUIDE_URL,
  IOS_DOWNLOAD_URL,
  IOS_SOURCE_URL,
  IOS_VERSION,
  mobilePlatform,
} from "@/lib/mobile";
import {
  DESKTOP_SOURCE_URL,
  DESKTOP_VERSION,
  WINDOWS_DOWNLOAD_URL,
} from "@/lib/desktop";
import {
  getInstallState,
  requestAppInstall,
  subscribeInstallState,
} from "@/lib/installApp";

export default function DownloadPage() {
  const platform = mobilePlatform();
  const { installed, prompt } = useSyncExternalStore(
    subscribeInstallState,
    getInstallState,
    getInstallState,
  );
  return (
    <div className="min-h-screen overflow-x-clip bg-[#111318] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="Kyro home">
            <KyroWordmark />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-xs font-semibold sm:text-sm"
          >
            Open in browser <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-violet-300">
              YOUR PEOPLE. WITH YOU.
            </p>
            <h1 className="text-5xl font-extrabold leading-[1.04] tracking-[-.05em] sm:text-6xl">
              Good company.
              <br />
              <span className="text-violet-300">Anywhere.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
              Keep your conversations close. Pick up a chat, drop into your
              community, and meet your people in voice.
            </p>
            <a
              href={
                platform === "android"
                  ? ANDROID_DOWNLOAD_URL
                  : platform === "ios"
                    ? IOS_DOWNLOAD_URL
                    : WINDOWS_DOWNLOAD_URL
              }
              className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-violet-400 px-6 font-bold text-[#171320] transition hover:bg-violet-300 sm:w-auto"
            >
              <Download className="size-5" />
              {platform === "android"
                ? "Download Kyro for Android"
                : platform === "ios"
                  ? "Download iOS project"
                  : "Download for Windows"}
            </a>
            <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-400">
              {[
                "Free to download",
                "Your existing account",
                "Public source code",
              ].map((text) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Check className="size-4 text-violet-300" />
                  {text}
                </span>
              ))}
            </div>
          </div>
          <div
            className="relative mx-auto w-full max-w-[310px]"
            aria-label="Preview of Kyro on your phone"
          >
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-violet-400/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[40px] border-[7px] border-[#292933] bg-[#17171f] p-5 shadow-2xl shadow-black/40">
              <div className="mx-auto mb-7 h-2 w-20 rounded-full bg-[#09090e]" />
              <div className="flex items-center gap-2 text-xl font-extrabold">
                <KyroMark className="size-7" />
                kyro<span className="text-violet-300">.</span>
              </div>
              <p className="mt-6 text-[9px] font-bold uppercase tracking-[.2em] text-violet-300">
                Pick up where you left off
              </p>
              <p className="mt-1 text-[30px] font-extrabold tracking-tight">
                Messages<span className="text-violet-300">.</span>
              </p>
              <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-[11px] text-slate-500">
                Find a conversation
              </div>
              <div className="mt-5 flex gap-4">
                {["M", "L", "S"].map((initial, index) => (
                  <span
                    key={initial}
                    className="grid size-11 place-items-center rounded-full border border-violet-300/25 bg-violet-300/10 text-sm font-bold"
                    style={{ color: ["#d8b4fe", "#6ee7b7", "#f9a8d4"][index] }}
                  >
                    {initial}
                  </span>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                {[
                  { name: "Maya", text: "See you in a bit!", initial: "M" },
                  { name: "Leo", text: "Anyone up for a game?", initial: "L" },
                  {
                    name: "Your people",
                    text: "3 friends are around now",
                    initial: "✦",
                  },
                ].map((chat) => (
                  <div
                    key={chat.name}
                    className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"
                  >
                    <span className="grid size-9 place-items-center rounded-xl bg-violet-300/10 text-xs text-violet-200">
                      {chat.initial}
                    </span>
                    <span>
                      <strong className="text-xs">{chat.name}</strong>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {chat.text}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-around rounded-2xl bg-[#242430] px-2 py-3 text-[9px] text-slate-400">
                <span>Home</span>
                <span className="font-bold text-violet-300">Chats</span>
                <span>Servers</span>
                <span>Inbox</span>
                <span>You</span>
              </div>
            </div>
          </div>
        </div>
        <section
          className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Choose your Kyro app"
        >
          <article
            id="android"
            className="scroll-mt-6 rounded-3xl border border-violet-300/25 bg-violet-300/5 p-6"
          >
            <Smartphone className="mb-5 size-7 text-violet-300" />
            <h2 className="text-xl font-bold">Kyro for Android</h2>
            <p className="mt-2 text-xs text-slate-400">
              Android 10+ · Version {ANDROID_VERSION}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Your chats and communities, with Android navigation, file uploads,
              voice and camera access.
            </p>
            <a
              href={ANDROID_DOWNLOAD_URL}
              className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 text-sm font-bold text-[#171320]"
            >
              <Download className="size-4" />
              Download Android APK
            </a>
            <a
              href={ANDROID_SOURCE_URL}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-violet-300"
            >
              <Code className="size-4" />
              View Android source
            </a>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Open the APK and allow your browser to install Kyro when Android
              asks. Downloaded from our GitHub release.
            </p>
          </article>
          <article
            id="ios"
            className="scroll-mt-6 rounded-3xl border border-white/10 bg-white/[.025] p-6"
          >
            <Smartphone className="mb-5 size-7 text-violet-300" />
            <h2 className="text-xl font-bold">Kyro for iOS</h2>
            <p className="mt-2 text-xs text-slate-400">
              iPhone and iPad · iOS 16+ · Version {IOS_VERSION}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Your existing chats, with native navigation, file sharing and
              camera and microphone access.
            </p>
            <a
              href={IOS_DOWNLOAD_URL}
              className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold"
            >
              <Download className="size-4" />
              Download iOS project
            </a>
            <a
              href={IOS_SOURCE_URL}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-violet-300"
            >
              <Code className="size-4" />
              View iOS source
            </a>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Free Apple ID and Xcode Personal Team. Build on a Mac and install
              on your own iPhone or iPad. This ZIP contains source code.
            </p>
            <a
              href={IOS_BUILD_GUIDE_URL}
              className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-violet-300"
            >
              Install with Xcode
            </a>
            <a
              href="#web-app"
              className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-violet-300"
            >
              Add the web app to your home screen
            </a>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[.025] p-6">
            <Monitor className="mb-5 size-7 text-violet-300" />
            <h2 className="text-xl font-bold">Kyro for Windows</h2>
            <p className="mt-2 text-xs text-slate-400">
              Windows 10 / 11 · x64 · Version {DESKTOP_VERSION}
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              A dedicated window for your people. Automatic updates and a place
              in your system tray.
            </p>
            <a
              href={WINDOWS_DOWNLOAD_URL}
              className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold"
            >
              <Download className="size-4" />
              Download for Windows
            </a>
            <a
              href={DESKTOP_SOURCE_URL}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-violet-300"
            >
              <Code className="size-4" />
              View Windows source
            </a>
          </article>
          <article
            id="web-app"
            className="scroll-mt-6 rounded-3xl border border-white/10 bg-white/[.025] p-6"
          >
            <MessageCircle className="mb-5 size-7 text-violet-300" />
            <h2 className="text-xl font-bold">Kyro in your browser</h2>
            <p className="mt-2 text-xs text-slate-400">
              Phones, tablets and computers
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              {installed
                ? "Your Kyro web app is installed. Open it from your home screen."
                : platform === "ios"
                  ? "In Safari, tap Share, then Add to Home Screen. Kyro opens in its own window."
                  : "Use your browser's Install app or Add to Home Screen action for a home-screen shortcut."}
            </p>
            {prompt && !installed ? (
              <button
                type="button"
                onClick={() => void requestAppInstall()}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold"
              >
                <Download className="size-4" />
                Install web app
              </button>
            ) : (
              <Link
                to="/dashboard"
                className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold"
              >
                Open Kyro
                <ArrowRight className="size-4" />
              </Link>
            )}
          </article>
        </section>
        <section className="mt-12 grid gap-6 border-t border-white/10 pt-9 sm:grid-cols-2">
          <div className="flex gap-4">
            <Headphones className="size-6 shrink-0 text-violet-300" />
            <div>
              <h2 className="font-semibold">Meet in voice</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Allow microphone or camera access when you start a call. Keep
                the mobile app open while you're talking.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Code className="size-6 shrink-0 text-violet-300" />
            <div>
              <h2 className="font-semibold">Source you can inspect</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The app, web interface and backend source live together in{" "}
                <a
                  href="https://github.com/adrianeosyne/KyroFree"
                  className="text-violet-300 underline underline-offset-4"
                >
                  our public GitHub repository
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-slate-500">
        <Link to="/terms">Terms</Link>
        <span className="px-3">·</span>
        <Link to="/privacy">Privacy</Link>
        <span className="px-3">·</span>
        <Link to="/">Kyro home</Link>
      </footer>
    </div>
  );
}
