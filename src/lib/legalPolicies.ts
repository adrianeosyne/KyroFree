// These versions are stored with registration acceptance. Bump when policies change.
export const LEGAL_POLICY_VERSIONS = {
  terms: "2026-11-15-r1",
  privacy: "2026-11-15-r1",
  copyright: "2026-11-14-r2",
} as const;

export const COPYRIGHT_OWNER = "Adrian Eosyne";
export const LEGAL_POLICY_UPDATED = {
  terms: { date: "2026-11-15", label: "November 15, 2026" },
  privacy: { date: "2026-11-15", label: "November 15, 2026" },
  copyright: { date: "2026-11-14", label: "November 14, 2026" },
} as const;
