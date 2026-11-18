import { useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function LoadingRows() {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 py-4">
      {[1, 2, 3].map((n) => (
        <Skeleton key={n} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
export function TimeFields({
  value,
  onChange,
  timezone,
  onTimezone,
}: {
  value: string;
  onChange: (s: string) => void;
  timezone: string;
  onTimezone: (s: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Label className="space-y-2">
        <span>Date and time</span>
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Date and time"
          required
        />
      </Label>
      <Label className="space-y-2">
        <span>Timezone</span>
        <Input
          value={timezone}
          onChange={(e) => onTimezone(e.target.value)}
          list="kyro-timezones"
          aria-label="Timezone"
          required
        />
        <datalist id="kyro-timezones">
          {[
            "UTC",
            "Asia/Colombo",
            "Asia/Kolkata",
            "Asia/Tokyo",
            "Europe/London",
            "Europe/Berlin",
            "America/New_York",
            "America/Los_Angeles",
            "Australia/Sydney",
          ].map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </Label>
    </div>
  );
}
export function ConfirmDelete({
  title,
  description,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<unknown>;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive">
          {children ?? "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not complete this action.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
