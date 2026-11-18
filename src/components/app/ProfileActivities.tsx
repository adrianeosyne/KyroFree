import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Gamepad2 } from "lucide-react";
import { toast } from "sonner";

export function FollowUserButton({ userId }: { userId: string }) {
  const state = useQuery(api.socialFeed.following, {
    userId: userId as Id<"users">,
  });
  const follow = useMutation(api.socialFeed.follow);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={state?.following ? "outline" : "default"}
      disabled={busy || !state}
      onClick={async () => {
        setBusy(true);
        try {
          await follow({
            userId: userId as Id<"users">,
            following: !state?.following,
          });
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Could not update follow.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {state?.following ? "Unfollow" : "Follow"}
    </Button>
  );
}
export function GameActivity({ userId }: { userId: string }) {
  const activity = useQuery(api.gaming.activity, {
    userId: userId as Id<"users">,
  });
  if (!activity) return null;
  return (
    <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Gamepad2 className="size-4" />
        Playing {activity.game}
      </p>
      {activity.details && (
        <p className="text-xs text-muted-foreground">{activity.details}</p>
      )}
      {activity.inviteUrl && (
        <a
          href={activity.inviteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
        >
          Open game invitation
        </a>
      )}
    </div>
  );
}
