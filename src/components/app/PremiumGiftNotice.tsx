import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { premiumDuration } from "@/lib/premiumGifts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PremiumGiftNotice({ defer = false }: { defer?: boolean }) {
  const gifts = useQuery(api.notifications.pendingPremiumGifts);
  const markRead = useMutation(api.notifications.markRead);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const gift = gifts?.[0];
  if (!gift || defer) return null;

  const dismiss = async (openSettings = false) => {
    if (busy) return;
    setBusy(true);
    try {
      await markRead({ ids: [gift.id] });
      if (openSettings) navigate("/dashboard?settings=premium");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not dismiss this gift.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void dismiss();
      }}
    >
      <DialogContent className="border-fuchsia-400/30 bg-gradient-to-br from-violet-950 via-background to-background sm:max-w-md">
        <div aria-hidden="true" className="text-center text-5xl">
          🎁
        </div>
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl">You received Premium!</DialogTitle>
          <DialogDescription className="text-base">
            <span className="font-semibold text-foreground">
              {gift.senderName}
            </span>
            {gift.senderUsername && <span> (@{gift.senderUsername})</span>} sent
            you{" "}
            <strong className="text-fuchsia-300">
              {premiumDuration(gift.days)}
            </strong>{" "}
            of Premium.
          </DialogDescription>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">
          Your gift is active now and adds to your existing Premium time.
          {gift.premiumUntil && (
            <>
              {" "}
              Premium ends {new Date(gift.premiumUntil).toLocaleDateString()}.
            </>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void dismiss(true)}
          >
            Open Premium settings
          </Button>
          <Button disabled={busy} onClick={() => void dismiss()}>
            Enjoy Premium
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
