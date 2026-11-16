import { useSyncExternalStore } from "react";
import { getFunctionName } from "convex/server";
import { LEGAL_POLICIES } from "@/lib/legalContent";
import {
  LEGAL_POLICY_UPDATED,
  LEGAL_POLICY_VERSIONS,
} from "@/lib/legalPolicies";

// Only the smoke server loads this fixture. No requests reach a deployment.
let snapshot;
const subscribers = new Set();
function publish(value) {
  snapshot = value;
  for (const callback of subscribers) callback();
}
const current = () => ({
  policies: structuredClone(LEGAL_POLICIES),
  versions: { ...LEGAL_POLICY_VERSIONS },
  updated: structuredClone(LEGAL_POLICY_UPDATED),
});
window.signupFixture = {
  calls: [],
  rejectNext: false,
  load() {
    publish(current());
  },
  updateTerms() {
    const next = structuredClone(snapshot);
    next.versions.terms += "-updated";
    next.policies[0].intro = "Updated terms served by the backend.";
    publish(next);
  },
};
export function useQuery(_reference, args) {
  const result = useSyncExternalStore(
    (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    () => snapshot,
  );
  return args === "skip" ? undefined : result;
}
export function useAction(reference) {
  return async (args) => {
    window.signupFixture.calls.push({ name: getFunctionName(reference), args });
    if (window.signupFixture.rejectNext) {
      window.signupFixture.rejectNext = false;
      window.signupFixture.updateTerms();
      throw new Error(
        "[CONVEX A(users/createAccount:createAccount)] [Request ID: test] Server Error Uncaught Error: LEGAL_POLICY_UPDATED: Reload this page and review the current policies before creating an account. Called by client",
      );
    }
    return { verificationRequired: true, verificationQueued: true };
  };
}
export const useMutation = () => async () => {};
export const useAuth = () => ({
  isLoading: false,
  isAuthenticated: false,
  signIn: async () => {},
});
