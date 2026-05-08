import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Display label for system condition codes stored as SYS-NN (e.g. SYS-06 → SYSTEM-06). */
export function formatSystemOutcomeCode(code: string): string {
  if (code.startsWith('SYS-')) return `SYSTEM-${code.slice(4)}`
  return code
}

/** Display label for behaviour outcome codes stored as BEH-NN (e.g. BEH-06 → BEHAVIOUR-06). */
export function formatBehaviourOutcomeCode(code: string): string {
  if (code.startsWith('BEH-')) return `BEHAVIOUR-${code.slice(4)}`
  return code
}

/** Display label for service outcome codes stored as SO-NN (e.g. SO-06 → SERVICE-06). */
export function formatServiceOutcomeCode(code: string): string {
  if (code.startsWith('SO-')) return `SERVICE-${code.slice(3)}`
  return code
}
