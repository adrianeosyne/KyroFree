import type { LegalPolicy } from "./legalContent";

export type RegistrationPolicies = {
  policies: LegalPolicy[];
  versions: Record<LegalPolicy["slug"], string>;
  updated: Record<LegalPolicy["slug"], { date: string; label: string }>;
};

// These versions are stored with registration acceptance. Bump when policies change.
export const LEGAL_POLICY_VERSIONS = {
  terms: "2026-11-16-r2",
  privacy: "2026-11-16-r1",
  copyright: "2026-11-14-r2",
} as const;

export const COPYRIGHT_OWNER = "Adrian Eosyne";
export const LEGAL_POLICY_UPDATED = {
  terms: { date: "2026-11-16", label: "November 16, 2026" },
  privacy: { date: "2026-11-16", label: "November 16, 2026" },
  copyright: { date: "2026-11-14", label: "November 14, 2026" },
} as const;
