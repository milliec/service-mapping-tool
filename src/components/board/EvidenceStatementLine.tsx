'use client';

import evidenceLogJson from '@/data/evidence-log.json';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type EvidenceLogEntry = {
  evidence_id: string;
  evidenceType: string;
  rawExcerpt: string;
  insightSummary: string;
  confidenceLevel: string;
  evidenceStrength: string;
};

const EVIDENCE_BY_ID = evidenceLogJson as Record<string, EvidenceLogEntry>;

/** Split on evidence ids like E-042 (capturing) so we can interleave tooltips. */
const EVIDENCE_CODE_SPLIT_RE = /(E-\d+)/g;

function EvidenceCodeTooltip({ code }: { code: string }) {
  const entry = EVIDENCE_BY_ID[code];
  if (!entry) {
    return <span>{code}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              'cursor-help underline decoration-dotted decoration-neutral-400 underline-offset-[2px]',
              'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1',
            )}
          />
        }
      >
        {code}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-sm text-left">
        <span className="block font-mono text-[11px] font-bold tracking-tight text-background">{entry.evidence_id}</span>
        {entry.evidenceType ? (
          <span className="mt-0.5 block text-[11px] font-medium text-background/85">{entry.evidenceType}</span>
        ) : null}
        {entry.insightSummary ? (
          <p className="mt-2 text-[12px] font-normal leading-snug text-background">{entry.insightSummary}</p>
        ) : null}
        {entry.rawExcerpt ? (
          <p className="mt-2 border-t border-background/20 pt-2 text-[11px] italic leading-snug text-background/90">
            &ldquo;{entry.rawExcerpt}&rdquo;
          </p>
        ) : null}
        {entry.confidenceLevel || entry.evidenceStrength ? (
          <p className="mt-2 border-t border-background/20 pt-2 text-[10px] text-background/70">
            {[
              entry.confidenceLevel ? `Confidence: ${entry.confidenceLevel}` : '',
              entry.evidenceStrength ? `Strength: ${entry.evidenceStrength}` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function EvidenceStatementLine({ statement, className }: { statement: string; className?: string }) {
  const parts = statement.split(EVIDENCE_CODE_SPLIT_RE);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        /^(E-\d+)$/.test(part) ? (
          <EvidenceCodeTooltip key={`${part}-${i}`} code={part} />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}
