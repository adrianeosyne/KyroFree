import { useAction } from "convex/react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { KyroMark } from "@/components/KyroMark";
export default function AccountRecovery() {
  const finish = useAction(api.accountRecovery.finish),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <section className="max-w-md space-y-5 rounded-3xl border border-primary/25 bg-panel p-8">
        <KyroMark className="size-12" />
        <h1 className="text-2xl font-bold">Recover your account</h1>
        <p className="text-sm text-muted-foreground">
          {done
            ? "Two-factor authentication is now off. Sign in with your password, then enable a new authenticator and save your backup codes."
            : "Confirm to remove your lost authenticator. This one-time link expires after 15 minutes. All existing sessions will be signed out."}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {!done && (
          <Button
            disabled={busy || !token}
            onClick={async () => {
              setBusy(true);
              try {
                await finish({ token });
                window.history.replaceState(null, "", window.location.pathname);
                setDone(true);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not recover account.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Recovering…" : "Turn off lost authenticator"}
          </Button>
        )}
        <Link className="block text-sm text-primary underline" to="/auth">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
