/** Suggested values for the user-journey lane when editing at L1 lifecycle (stored in `productTeam`). */
export const USER_TYPE_OPTIONS = [
  'Producer',
  'Compliance scheme operator',
  'Local authority',
  'Waste carrier',
  'Reprocessor',
  'Exporter',
  'Regulator',
  'Consumers',
  'Waste receivers (MRFs)',
] as const;

export const PRODUCT_TEAM_OPTIONS = [
  'RPD team',
  'RPD platform team',
  'Manage liabilities team',
  'Approve and monitor compliance team',
  'Obligations team',
  'Third party',
  'Submit data team',
  'Registration and enrolment team',
  'RREPW (ReEx)',
  'MI and Reporting team',
  'DWT Team A',
  'DWT Team B',
  'DWT Collection of waste team',
  'DWT Service-wide team',
  'FSS (Accenture)',
  'LAPS (Accenture)',
  'CBD / CaT',
] as const;

const THIRD_PARTY_NORMALIZED = 'third party';

/** True when product team matches the preset "Third party" (case-insensitive trim). */
export function isThirdPartyProductTeam(value: string | undefined | null): boolean {
  return (value ?? '').trim().toLowerCase() === THIRD_PARTY_NORMALIZED;
}
