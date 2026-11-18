import { useState } from "react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingRows } from "./AdvancedShared";
import { displayInstant } from "@/lib/zonedTime";
import { toast } from "sonner";

export function AccountFreeze() {
  const state = useQuery(api.privacyControls.status, {});
  const freeze = useAction(api.privacyControls.setFreeze);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-sm font-semibold">Account freeze</h3>
      <p className="text-sm text-muted-foreground">
        Pause new account contributions without deleting your data. Scheduled
        messages and new calls are blocked while frozen. Leave active calls
        before freezing. Sign-in and read access stay available so you can
        unfreeze with your password.
      </p>
      {state === undefined ? (
        <LoadingRows />
      ) : (
        <>
          <p className="text-sm">
            Your account is {state.frozen ? "frozen" : "active"}.
          </p>
          <Label className="block space-y-2">
            <span>Current password</span>
            <Input
              aria-label="Account freeze password"
              type="password"
              autoComplete="current-password"
              value={password}
              maxLength={200}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Label>
          <Button
            variant={state.frozen ? "default" : "outline"}
            disabled={busy || !password}
            onClick={async () => {
              if (
                !state.frozen &&
                !window.confirm(
                  "Freeze new account contributions? You can unfreeze with your password.",
                )
              )
                return;
              setBusy(true);
              try {
                await freeze({ frozen: !state.frozen, password });
                setPassword("");
                toast.success(
                  state.frozen ? "Account unfrozen." : "Account frozen.",
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not update account freeze.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Checking password…"
              : state.frozen
                ? "Unfreeze account"
                : "Freeze account"}
          </Button>
        </>
      )}
    </section>
  );
}
type Days = 0 | 7 | 30 | 90 | 365;
export function RetentionSettings() {
  const state = useQuery(api.privacyControls.status, {});
  const save = useMutation(api.privacyControls.saveRetention);
  const [draft, setDraft] = useState<{
    notificationDays: Days;
    draftDays: Days;
    scheduleHistoryDays: Days;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state) return <LoadingRows />;
  const value = draft ?? {
    notificationDays: (state.policy?.notificationDays ?? 0) as Days,
    draftDays: (state.policy?.draftDays ?? 0) as Days,
    scheduleHistoryDays: (state.policy?.scheduleHistoryDays ?? 0) as Days,
  };
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-sm font-semibold">Data retention</h3>
      <p className="text-sm text-muted-foreground">
        Automatically remove old inbox notifications, synchronized drafts and
        completed schedule history. An hourly job removes records in bounded
        batches. Pending schedules and message content are unaffected. Offline
        drafts on your device remain available until synchronized.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["notificationDays", "Notifications"],
            ["draftDays", "Cloud drafts"],
            ["scheduleHistoryDays", "Schedule history"],
          ] as const
        ).map(([key, label]) => (
          <Label key={key} className="space-y-2">
            <span>{label}</span>
            <select
              aria-label={`${label} retention`}
              value={value[key]}
              className="h-10 w-full rounded-md border bg-background px-2 text-sm"
              onChange={(e) =>
                setDraft({ ...value, [key]: Number(e.target.value) as Days })
              }
            >
              <option value="0">Keep until deleted</option>
              {[7, 30, 90, 365].map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </Label>
        ))}
      </div>
      <Button
        disabled={busy || !draft || state.frozen}
        onClick={async () => {
          if (
            !window.confirm(
              "Apply these retention settings? Records older than the chosen limits will be permanently removed.",
            )
          )
            return;
          setBusy(true);
          try {
            await save(value);
            setDraft(null);
            toast.success("Retention settings saved.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not save retention settings.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Save retention
      </Button>
    </section>
  );
}
export function SecurityActivity() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.privacyControls.activity,
    {},
    { initialNumItems: 15 },
  );
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-sm font-semibold">Security and privacy activity</h3>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Account freeze and retention changes will appear here.
        </p>
      ) : (
        results.map((row) => (
          <div
            key={row._id}
            className="flex justify-between gap-3 border-b py-2 text-xs"
          >
            <span>
              {row.action === "account.frozen"
                ? "Account frozen"
                : row.action === "account.unfrozen"
                  ? "Account unfrozen"
                  : "Data retention changed"}
            </span>
            <time>{displayInstant(row.createdAt)}</time>
          </div>
        ))
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" size="sm" onClick={() => loadMore(15)}>
          More activity
        </Button>
      )}
    </section>
  );
}
