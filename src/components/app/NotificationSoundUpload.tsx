import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useUploadFile } from "@/lib/upload";
import { toast } from "sonner";

export function NotificationSoundUpload() {
  const me = useQuery(api.users.me);
  const save = useMutation(api.notificationSounds.set);
  const upload = useUploadFile({ requireRegistration: true });
  const [busy, setBusy] = useState(false);
  return (
    <section className="mb-7 rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-semibold">Your notification sound</h3>
      <p className="my-2 text-xs text-muted-foreground">
        Upload a short MP3, WAV, OGG, M4A or WebM sound under 2 MB. It follows
        your notification volume and mute setting.
      </p>
      {me?.notificationSoundUrl && (
        <audio
          aria-label="Preview your notification sound"
          controls
          src={me.notificationSoundUrl}
          className="my-3 w-full"
        />
      )}
      <label className="block text-sm">
        Choose a sound
        <input
          className="mt-2 block w-full text-xs"
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
              toast.error("Choose an audio file under 2 MB.");
              return;
            }
            setBusy(true);
            try {
              const result = await upload(file);
              await save({ storageId: result.storageId });
              toast.success("Notification sound saved.");
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Could not save sound.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && (
        <p className="mt-2 text-xs" role="status">
          Uploading sound…
        </p>
      )}
      {me?.notificationSoundUrl && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({ storageId: null });
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Could not remove sound.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Restore Kyro sound
        </Button>
      )}
    </section>
  );
}
