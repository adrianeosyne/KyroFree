import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Check,
  Code,
  Headphones,
  Mic,
  Monitor,
  Volume2,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { audioCapturePreferences } from "@/lib/audioPreferences";
import { playNotificationPing } from "@/lib/sound";
import { useUiStore, type Preferences } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-7 last:mb-0">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
        {children}
      </div>
    </section>
  );
}

type BooleanPreference = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

function PreferenceToggle({
  preference,
  title,
  description,
}: {
  preference: BooleanPreference;
  title: string;
  description: string;
}) {
  const checked = useUiStore((state) => state[preference]);
  const setPreference = useUiStore((state) => state.setPreference);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 p-4 sm:p-5">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={(value) => setPreference(preference, value)}
        aria-label={title}
        className="shrink-0"
      />
    </label>
  );
}

export function ChatSettings() {
  const sendOnEnter = useUiStore((state) => state.sendOnEnter);
  const chatFontSize = useUiStore((state) => state.chatFontSize);
  const setPreference = useUiStore((state) => state.setPreference);
  return (
    <>
      <SettingsGroup
        title="Writing messages"
        description="Make conversations work the way you do."
      >
        <PreferenceToggle
          preference="sendOnEnter"
          title="Send messages with Enter"
          description="Turn off to write a new line with Enter and send with Ctrl or ⌘ + Enter."
        />
        <PreferenceToggle
          preference="showTyping"
          title="Show when I’m typing"
          description="Let people in the conversation see when you are writing a message."
        />
      </SettingsGroup>
      <SettingsGroup title="Media & previews">
        <PreferenceToggle
          preference="mediaPreviews"
          title="Show image and GIF previews"
          description="Display images from direct links in chat. Turn off to show the links instead."
        />
      </SettingsGroup>
      <SettingsGroup
        title="Message text size"
        description="Adjust message text and the composer. The rest of the interface keeps its size."
      >
        <div className="p-5">
          <div className="mb-5 flex items-center gap-4">
            <span className="text-xs text-muted-foreground" aria-hidden>
              Aa
            </span>
            <Slider
              min={12}
              max={20}
              step={1}
              value={[chatFontSize]}
              onValueChange={([value]) => setPreference("chatFontSize", value)}
              aria-label="Message text size"
            />
            <span className="w-12 shrink-0 text-right text-sm tabular-nums">
              {chatFontSize}px
            </span>
          </div>
          <div className="flex gap-3 rounded-lg bg-background/70 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Headphones className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold">
                Kyro{" "}
                <span className="ml-2 font-normal text-muted-foreground">
                  Today at 12:30
                </span>
              </p>
              <p style={{ fontSize: `${chatFontSize}px`, lineHeight: 1.6 }}>
                A little conversation, a lot of good ideas. ✨
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {sendOnEnter
              ? "Enter to send · Shift + Enter for a new line"
              : "Ctrl / ⌘ + Enter to send · Enter for a new line"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            disabled={chatFontSize === 14}
            onClick={() => setPreference("chatFontSize", 14)}
          >
            Reset text size
          </Button>
        </div>
      </SettingsGroup>
    </>
  );
}

export function NotificationSettings() {
  const volume = useUiStore((state) => state.notificationVolume);
  const setPreference = useUiStore((state) => state.setPreference);
  return (
    <>
      <SettingsGroup
        title="Stay in the loop"
        description="Choose what makes a sound. These preferences are saved on this device."
      >
        <PreferenceToggle
          preference="notificationSounds"
          title="Mention & reply sounds"
          description="Play a soft ping when a new mention or reply arrives."
        />
        <PreferenceToggle
          preference="callSounds"
          title="Incoming call sounds"
          description="Play a sound when someone starts a call with you."
        />
        <PreferenceToggle
          preference="unreadDmBubbles"
          title="Unread DM bubbles"
          description="Show people with unread messages below Home in the community sidebar."
        />
      </SettingsGroup>
      <SettingsGroup title="Sound volume">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <Volume2 className="size-5 shrink-0 text-muted-foreground" />
            <Slider
              min={0}
              max={100}
              step={5}
              value={[volume]}
              onValueChange={([value]) =>
                setPreference("notificationVolume", value)
              }
              aria-label="Notification volume"
            />
            <span className="w-12 shrink-0 text-right text-sm tabular-nums">
              {volume}%
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            disabled={volume === 0}
            onClick={() => playNotificationPing()}
          >
            <Bell className="mr-2 size-4" />
            Preview sound
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Preview plays at this volume. Call audio has its own controls inside
            the call.
          </p>
        </div>
      </SettingsGroup>
    </>
  );
}

export function AccessibilitySettings() {
  return (
    <>
      <SettingsGroup
        title="A more comfortable space"
        description="Small adjustments that make Kyro easier to use."
      >
        <PreferenceToggle
          preference="reducedMotion"
          title="Reduce motion"
          description="Minimize interface animations and transitions. Your system’s reduced motion preference is also respected."
        />
        <PreferenceToggle
          preference="underlineLinks"
          title="Always underline links"
          description="Make links easier to identify without relying on colour."
        />
      </SettingsGroup>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm font-medium">
          Find your comfortable reading size
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Message text size is in Chat. You can also use your browser’s zoom
          controls to resize the whole interface.
        </p>
      </div>
    </>
  );
}

export function VoiceSettings() {
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [deviceName, setDeviceName] = useState("");
  const resources = useRef<{
    stream: MediaStream;
    context: AudioContext;
    frame: number;
  } | null>(null);
  const mounted = useRef(true);

  const stop = () => {
    const current = resources.current;
    if (current) {
      cancelAnimationFrame(current.frame);
      current.stream.getTracks().forEach((track) => track.stop());
      void current.context.close();
      resources.current = null;
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);

  const testMicrophone = async () => {
    if (testing) {
      stop();
      setTesting(false);
      setLevel(0);
      return;
    }
    setBusy(true);
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Microphone testing is unavailable in this browser.");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioCapturePreferences(),
      });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const current = { stream, context, frame: 0 };
      resources.current = current;
      const measure = () => {
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
            samples.length,
        );
        setLevel(Math.min(100, Math.round(rms * 350)));
        current.frame = requestAnimationFrame(measure);
      };
      measure();
      setDeviceName(
        stream.getAudioTracks()[0]?.label || "System default microphone",
      );
      setTesting(true);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") void context.close();
      if (mounted.current)
        toast.error(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Allow microphone access in your browser to test your microphone."
            : "Could not start the microphone. Check your device and try again.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <>
      <SettingsGroup
        title="Microphone check"
        description="Check your input before joining a call. Your audio stays on this device."
      >
        <div className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mic className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {deviceName || "System default microphone"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground" role="status">
                {testing
                  ? "Listening — say something to see your input level."
                  : "Ready when you are."}
              </p>
            </div>
          </div>
          <div
            role="meter"
            aria-label="Microphone input level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={level}
            className="h-2 overflow-hidden rounded-full bg-background"
          >
            <div
              className="h-full rounded-full bg-success transition-[width]"
              style={{ width: `${level}%` }}
            />
          </div>
          <Button
            variant={testing ? "secondary" : "default"}
            className="mt-5"
            disabled={busy}
            onClick={() => void testMicrophone()}
          >
            {busy ? "Starting…" : testing ? "Stop test" : "Test microphone"}
          </Button>
        </div>
      </SettingsGroup>
      <SettingsGroup
        title="Voice processing"
        description="Applied the next time your microphone starts in a call or voice message."
      >
        <PreferenceToggle
          preference="noiseSuppression"
          title="Noise suppression"
          description="Ask your browser to reduce background noise picked up by your microphone."
        />
        <PreferenceToggle
          preference="autoGainControl"
          title="Automatic input level"
          description="Ask your browser to balance your microphone volume as you speak."
        />
      </SettingsGroup>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Choose your microphone, speakers and camera inside an active call.
        Processing support depends on your browser and microphone.
      </p>
    </>
  );
}

export function KeybindSettings() {
  const sendOnEnter = useUiStore((state) => state.sendOnEnter);
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const shortcuts = [
    { action: "Jump to a conversation or community", keys: [modifier, "K"] },
    { action: "Close a dialog or overlay", keys: ["Esc"] },
    {
      action: "Send a message",
      keys: sendOnEnter ? ["Enter"] : [modifier, "Enter"],
    },
    {
      action: "Write a new line",
      keys: sendOnEnter ? ["Shift", "Enter"] : ["Enter"],
    },
    { action: "Save a message edit", keys: ["Enter"] },
    { action: "Choose a mention or command", keys: ["Tab"] },
    { action: "Navigate suggestions", keys: ["↑", "↓"] },
  ];
  return (
    <SettingsGroup
      title="Your keyboard, a little faster"
      description="Built-in shortcuts. Change how Enter behaves in Chat settings."
    >
      {shortcuts.map(({ action, keys }) => (
        <div
          key={action}
          className="flex items-center justify-between gap-4 p-4 sm:p-5"
        >
          <span className="text-sm">{action}</span>
          <span className="flex shrink-0 gap-1.5">
            {keys.map((key) => (
              <kbd
                key={key}
                className="min-w-8 rounded-md border border-border bg-background px-2 py-1 text-center font-mono text-xs text-muted-foreground shadow-sm"
              >
                {key}
              </kbd>
            ))}
          </span>
        </div>
      ))}
    </SettingsGroup>
  );
}

export function SettingsHelp({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mb-7 grid gap-3 sm:grid-cols-2">
        {[
          {
            icon: Code,
            title: "Build with Kyro",
            description: "Explore bot APIs, guides and developer tools.",
            href: "/docs",
          },
          {
            icon: Monitor,
            title: "Take Kyro with you",
            description: "Find the app for your desktop and devices.",
            href: "/download",
          },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "group rounded-xl border border-border/70 bg-surface p-5 transition-colors hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            <item.icon className="mb-4 size-5 text-primary" />
            <p className="text-sm font-semibold">{item.title} ↗</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </a>
        ))}
      </div>
      <div className="mb-7 flex gap-3 rounded-xl border border-border/70 bg-surface p-5">
        <Check className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          App preferences save automatically on this device. Profile and account
          changes are saved to your account.
        </p>
      </div>
      {children}
    </>
  );
}
