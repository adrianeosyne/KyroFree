import { v } from "convex/values";
import { query } from "./functions";
import { LEGAL_POLICIES } from "../lib/legalContent";
import {
  LEGAL_POLICY_UPDATED,
  LEGAL_POLICY_VERSIONS,
} from "../lib/legalPolicies";

/** Content and versions travel together so cached clients review what they accept. */
export const currentPolicies = query({
  args: {},
  handler: async () => ({
    policies: LEGAL_POLICIES,
    versions: LEGAL_POLICY_VERSIONS,
    updated: LEGAL_POLICY_UPDATED,
  }),
});

export const legalAcceptanceInput = v.object({
  termsAccepted: v.boolean(),
  privacyAccepted: v.boolean(),
  copyrightAccepted: v.boolean(),
  termsVersion: v.string(),
  privacyVersion: v.string(),
  copyrightVersion: v.string(),
});

/** All signup paths validate before creating credentials or any user record. */
export function requireLegalAcceptance(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "LEGAL_ACCEPTANCE_REQUIRED: Accept the Terms of Service, Privacy Policy and Copyright Policy before creating an account.",
    );
  }
  const input = value as Record<string, unknown>;
  if (
    input.termsAccepted !== true ||
    input.privacyAccepted !== true ||
    input.copyrightAccepted !== true
  ) {
    throw new Error(
      "LEGAL_ACCEPTANCE_REQUIRED: Accept all three policies before creating an account.",
    );
  }
  if (
    input.termsVersion !== LEGAL_POLICY_VERSIONS.terms ||
    input.privacyVersion !== LEGAL_POLICY_VERSIONS.privacy ||
    input.copyrightVersion !== LEGAL_POLICY_VERSIONS.copyright
  ) {
    throw new Error(
      "LEGAL_POLICY_UPDATED: Reload this page and review the current policies before creating an account.",
    );
  }
  return {
    acceptedAt: Date.now(),
    termsVersion: LEGAL_POLICY_VERSIONS.terms,
    privacyVersion: LEGAL_POLICY_VERSIONS.privacy,
    copyrightVersion: LEGAL_POLICY_VERSIONS.copyright,
  };
}
