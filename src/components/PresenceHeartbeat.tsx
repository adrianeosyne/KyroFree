import { useEffect } from "react";
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  detectPresenceDevice,
  startPresenceHeartbeat,
} from "@/lib/presenceHeartbeat";

/** Keep authenticated accounts present on every page, including the admin portal. */
export function PresenceHeartbeat() {
  const { isAuthenticated } = useConvexAuth();
  const { isWebSocketConnected } = useConvexConnectionState();
  const heartbeat = useMutation(api.users.heartbeat);
  useEffect(() => {
    if (!isAuthenticated || !isWebSocketConnected) return;
    return startPresenceHeartbeat(() =>
      heartbeat({ device: detectPresenceDevice() }),
    );
  }, [heartbeat, isAuthenticated, isWebSocketConnected]);
  return null;
}
