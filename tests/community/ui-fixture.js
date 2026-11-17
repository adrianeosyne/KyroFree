import { useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
const listeners = new Set();
let state = {
  authenticated: true,
  connected: true,
  canVerify: true,
  server: {
    id: "server",
    name: "Private community",
    description: "A community awaiting verification.",
    isPublic: false,
    verified: false,
    isPlatformHome: false,
    memberCount: 10,
    ownerName: "Jordan",
    ownerUsername: "jordan",
  },
};
function update(patch) {
  state = { ...state, ...patch };
  for (const callback of listeners) callback();
}
export function useFixture() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => state,
  );
}
window.communityFixture = { calls: [], update };
export const useConvexAuth = () => ({
  isAuthenticated: useFixture().authenticated,
});
export const useConvexConnectionState = () => ({
  isWebSocketConnected: useFixture().connected,
});
export function usePaginatedQuery() {
  const data = useFixture();
  return { results: [data.server], status: "Exhausted", loadMore() {} };
}
const mutations = new Map();
export function useMutation(reference) {
  const name = getFunctionName(reference);
  if (!mutations.has(name))
    mutations.set(name, async (args) => {
      window.communityFixture.calls.push({ name, args });
      if (name === "admin:setServerVerified")
        update({ server: { ...state.server, verified: args.verified } });
    });
  return mutations.get(name);
}
