import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VerifiedCommunityBadge } from "./VerifiedCommunityBadge";

export function ServerVerificationAdmin({ canVerify }: { canVerify: boolean }) {
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.servers,
    { term },
    { initialNumItems: 30 },
  );
  const setVerified = useMutation(api.admin.setServerVerified);
  const toggle = async (serverId: string, verified: boolean) => {
    if (busy) return;
    setBusy(serverId);
    try {
      await setVerified({ serverId: serverId as Id<"servers">, verified });
      toast.success(
        verified
          ? "Server verified. Its owner now has the Verified Server Owner badge."
          : "Server verification removed.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update verification.",
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Server verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified servers display a blue tick. Their current owners receive the
          Verified Server Owner badge.
        </p>
        {!canVerify && (
          <p className="mt-1 text-xs text-muted-foreground">
            Only adrianeosyne can change server verification.
          </p>
        )}
      </div>
      <Input
        aria-label="Search servers"
        placeholder="Search public and private servers"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      {status === "LoadingFirstPage" ? (
        <p role="status">Loading servers…</p>
      ) : results.length === 0 ? (
        <p>No servers found.</p>
      ) : (
        results.map((server) => (
          <article
            key={server.id}
            aria-label={server.name}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold">{server.name}</h3>
                {server.verified && (
                  <VerifiedCommunityBadge className="size-5" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Owned by {server.ownerName}
                {server.ownerUsername
                  ? ` (@${server.ownerUsername})`
                  : ""} · {server.isPublic ? "Public" : "Private"} ·{" "}
                {server.memberCount} members
              </p>
              {server.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {server.description}
                </p>
              )}
            </div>
            {canVerify && (
              <Button
                variant={server.verified ? "outline" : "default"}
                disabled={busy !== null || server.isPlatformHome}
                onClick={() => void toggle(server.id, !server.verified)}
              >
                {busy === server.id
                  ? "Saving…"
                  : server.isPlatformHome
                    ? "Official server"
                    : server.verified
                      ? "Remove verification"
                      : "Verify server"}
              </Button>
            )}
          </article>
        ))
      )}
      {status !== "Exhausted" && status !== "LoadingFirstPage" && (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(30)}
        >
          {status === "LoadingMore" ? "Loading…" : "Load more servers"}
        </Button>
      )}
    </div>
  );
}
