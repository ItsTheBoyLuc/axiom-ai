/** Verification statuses (docs/PROMPT.md section 2). Ordered from highest to lowest trust. */
export const VERIFICATION_STATUSES = [
  'OFFICIALLY_VERIFIED',
  'INDEPENDENTLY_EVALUATED',
  'PROVIDER_REPORTED',
  'COMMUNITY_REPORTED',
  'UNVERIFIED',
  'NOT_PUBLICLY_DISCLOSED',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const verificationLabel: Record<VerificationStatus, string> = {
  OFFICIALLY_VERIFIED: 'Officially verified',
  INDEPENDENTLY_EVALUATED: 'Independently evaluated',
  PROVIDER_REPORTED: 'Provider reported',
  COMMUNITY_REPORTED: 'Community reported',
  UNVERIFIED: 'Unverified',
  NOT_PUBLICLY_DISCLOSED: 'Not publicly disclosed',
};

/** Higher number = more trusted. Used later to stop imports downgrading verified data. */
export const trustRank: Record<VerificationStatus, number> = {
  OFFICIALLY_VERIFIED: 5,
  INDEPENDENTLY_EVALUATED: 4,
  PROVIDER_REPORTED: 3,
  COMMUNITY_REPORTED: 2,
  UNVERIFIED: 1,
  NOT_PUBLICLY_DISCLOSED: 0,
};

export function outranks(a: VerificationStatus, b: VerificationStatus): boolean {
  return trustRank[a] > trustRank[b];
}

/** Render helper: null/undefined facts always show the same phrase. */
export const NOT_DISCLOSED = 'Not publicly disclosed';
export function orNotDisclosed(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? NOT_DISCLOSED : String(value);
}
