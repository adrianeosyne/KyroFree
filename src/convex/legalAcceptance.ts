import { v } from "convex/values";
import { LEGAL_POLICY_VERSIONS } from "../lib/legalPolicies";

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
