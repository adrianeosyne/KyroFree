import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RequireAuth } from "@/components/RequireAuth";
import { KyroMark } from "@/components/KyroMark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { premiumDuration } from "@/lib/premiumGifts";
import { toast } from "sonner";

function GiftPage() {
  const { code = "" } = useParams();
  const preview = useQuery(api.premiumCodes.giftPreview, { code });
  const redeem = useMutation(api.premiumCodes.redeem);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await redeem({ code, fromGiftLink: true });
      if (!result.ok) throw new Error(result.error);
      if (!result.giftReceived)
        toast.success(`Premium activated: ${premiumDuration(result.days)}.`);
      navigate(
        result.giftReceived ? "/dashboard" : "/dashboard?settings=premium",
        { replace: true },
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not claim this gift.",
      );
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-5">
      <Link to="/" className="mb-6 flex items-center gap-2 text-lg font-bold">
        <KyroMark className="size-8" /> Kyro
      </Link>
      <Card className="w-full max-w-md border-fuchsia-400/25 bg-gradient-to-br from-violet-500/15 to-panel">
        <CardHeader className="text-center">
          <div aria-hidden="true" className="mb-3 text-5xl">
            🎁
          </div>
          <CardTitle>
            <h1>
              {preview?.valid
                ? "A Premium gift for you"
                : preview === undefined
                  ? "Opening your gift…"
                  : "This gift is unavailable"}
            </h1>
          </CardTitle>
          <CardDescription>
            {preview?.valid
              ? "Claim it for your Kyro account."
              : preview === undefined
                ? "Checking this gift link."
                : preview.reason}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          {preview?.valid && (
            <>
              <p className="text-3xl font-bold text-fuchsia-300">
                {premiumDuration(preview.days)} of Premium
              </p>
              <p className="break-words text-sm">
                From <strong>{preview.senderName}</strong>
                {preview.senderUsername && ` (@${preview.senderUsername})`}
              </p>
              <p className="text-sm text-muted-foreground">
                Your Premium starts when you claim. Any time you already have is
                kept.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard?settings=premium")}
          >
            Premium settings
          </Button>
          {preview?.valid && (
            <Button disabled={busy} onClick={() => void claim()}>
              {busy ? "Claiming…" : "Claim Premium gift"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

export default function GiftRoute() {
  return (
    <RequireAuth
      title="Sign in to claim your Premium gift"
      description="Sign in or create an account to receive this gift. You'll return to the gift after signing in."
    >
      <GiftPage />
    </RequireAuth>
  );
}
