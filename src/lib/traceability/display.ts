const TRACEABILITY_CODE_PATTERN = /\b[A-Z]{1,5}-\d{3,}\b/g;
const LEADING_CODE_PATTERN = /^\s*([A-Z]{1,5}-\d{3,})(?:\s*[:\-]\s*|\s+)/;
const EVIDENCE_PATTERN = /\s*Evidence(?:\s+includes|:)[^.]*\b[A-Z]{1,5}-\d{3,}\b[^.]*\.?/gi;
const ROLLS_UP_PATTERN = /\s*\[\s*Rolls up\b[^\]]*\]\s*/gi;

export function stripTraceabilityForDisplay(value: string) {
  return value
    .replace(LEADING_CODE_PATTERN, '')
    .replace(EVIDENCE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function stripRollupsForCardDisplay(value: string) {
  return value
    .replace(ROLLS_UP_PATTERN, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getTraceabilityCodesFromText(value: string) {
  return Array.from(new Set(value.match(TRACEABILITY_CODE_PATTERN) ?? []));
}

export function getEvidenceCodesFromText(value: string) {
  const codes: string[] = [];

  for (const match of value.matchAll(EVIDENCE_PATTERN)) {
    codes.push(...getTraceabilityCodesFromText(match[0] ?? ''));
  }

  return Array.from(new Set(codes));
}
