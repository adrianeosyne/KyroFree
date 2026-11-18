import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingRows } from "./AdvancedShared";
import { toast } from "sonner";
import {
  type AttentionPolicy,
  setAttentionPolicy,
  scheduledTheme,
  minuteText,
  parseMinute,
} from "@/lib/attention";
import { applyPreferences, useUiStore } from "@/lib/store";
export function AttentionRuntime() {
  const policy = useQuery(api.attentionSettings.get, {});
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    setAttentionPolicy(policy ?? null);
    const apply = () => {
      const scheduled = policy ? scheduledTheme(policy) : null;
      if (scheduled)
        document.documentElement.classList.toggle("dark", scheduled === "dark");
      else applyPreferences(useUiStore.getState());
    };
    apply();
    const timer = window.setInterval(apply, 15_000);
    const onVisible = () => {
      if (!document.hidden) apply();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      setAttentionPolicy(null);
      applyPreferences(useUiStore.getState());
    };
  }, [policy, theme]);
  return null;
}
export function AttentionSettings() {
  const saved = useQuery(api.attentionSettings.get, {});
  const save = useMutation(api.attentionSettings.save);
  const [draft, setDraft] = useState<
    (AttentionPolicy & { revision: number }) | null
  >(null);
  const [busy, setBusy] = useState(false);
  if (!saved) return <LoadingRows />;
  const value = draft ?? saved;
  const change = (patch: Partial<AttentionPolicy>) =>
    setDraft({ ...value, ...patch });
  const conflict = draft && draft.revision !== saved.revision;
  return (
    <section className="space-y-4 border-t pt-5">
      <h3 className="font-semibold">Notification profiles and schedules</h3>
      <p className="text-sm text-muted-foreground">
        Saved to your account across devices. Profiles and quiet hours control
        mention and call sounds; messages and inbox notifications still arrive.
        Device sound switches also apply.
      </p>
      {conflict && (
        <p role="alert" className="text-sm text-destructive">
          Settings changed on another device. Copy your edits, then load the
          latest settings.
        </p>
      )}
      <Label className="block space-y-2">
        <span>Active notification profile</span>
        <select
          aria-label="Active notification profile"
          className="h-10 w-full rounded-md border bg-background px-3"
          value={value.activeProfile}
          onChange={(e) => change({ activeProfile: e.target.value })}
        >
          {value.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Label>
      <div className="space-y-3">
        {value.profiles.map((profile) => (
          <div key={profile.id} className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-48"
              aria-label={`Name of ${profile.name} profile`}
              maxLength={60}
              value={profile.name}
              onChange={(e) =>
                change({
                  profiles: value.profiles.map((p) =>
                    p.id === profile.id ? { ...p, name: e.target.value } : p,
                  ),
                })
              }
            />
            {(["mentions", "calls"] as const).map((key) => (
              <Label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile[key]}
                  onChange={(e) =>
                    change({
                      profiles: value.profiles.map((p) =>
                        p.id === profile.id
                          ? { ...p, [key]: e.target.checked }
                          : p,
                      ),
                    })
                  }
                />
                {key === "mentions" ? "Mention sounds" : "Call sounds"}
              </Label>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={value.profiles.length <= 1}
              onClick={() => {
                const profiles = value.profiles.filter(
                  (p) => p.id !== profile.id,
                );
                change({
                  profiles,
                  activeProfile:
                    value.activeProfile === profile.id
                      ? profiles[0].id
                      : value.activeProfile,
                });
              }}
            >
              Remove profile
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={value.profiles.length >= 10}
        onClick={() =>
          change({
            profiles: [
              ...value.profiles,
              {
                id: crypto.randomUUID(),
                name: "New profile",
                mentions: true,
                calls: true,
              },
            ],
          })
        }
      >
        Add profile
      </Button>
      <Label className="block space-y-2">
        <span>Schedule timezone</span>
        <Input
          aria-label="Schedule timezone"
          value={value.timezone}
          onChange={(e) => change({ timezone: e.target.value })}
          placeholder="Asia/Colombo"
        />
      </Label>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.quietEnabled}
          onChange={(e) => change({ quietEnabled: e.target.checked })}
        />
        Enable quiet hours
      </Label>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["quietStart", "Quiet hours start"],
            ["quietEnd", "Quiet hours end"],
          ] as const
        ).map(([key, label]) => (
          <Label key={key} className="space-y-2">
            <span>{label}</span>
            <Input
              type="time"
              aria-label={label}
              value={minuteText(value[key])}
              onChange={(e) => change({ [key]: parseMinute(e.target.value) })}
            />
          </Label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
          <Label key={day} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={value.quietDays.includes(index)}
              onChange={(e) =>
                change({
                  quietDays: e.target.checked
                    ? [...value.quietDays, index].sort()
                    : value.quietDays.filter((d) => d !== index),
                })
              }
            />
            {day}
          </Label>
        ))}
      </div>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.themeEnabled}
          onChange={(e) => change({ themeEnabled: e.target.checked })}
        />
        Schedule light and dark themes
      </Label>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["lightStart", "Light theme starts"],
            ["darkStart", "Dark theme starts"],
          ] as const
        ).map(([key, label]) => (
          <Label key={key} className="space-y-2">
            <span>{label}</span>
            <Input
              type="time"
              aria-label={label}
              value={minuteText(value[key])}
              onChange={(e) => change({ [key]: parseMinute(e.target.value) })}
            />
          </Label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={busy || !draft || !!conflict}
          onClick={async () => {
            setBusy(true);
            try {
              const { revision, ...policy } = value;
              await save({ ...policy, expectedRevision: revision });
              setDraft(null);
              toast.success("Profiles and schedules saved.");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save settings.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Save profiles and schedules
        </Button>
        {draft && (
          <Button variant="outline" onClick={() => setDraft(null)}>
            Load latest
          </Button>
        )}
      </div>
    </section>
  );
}
