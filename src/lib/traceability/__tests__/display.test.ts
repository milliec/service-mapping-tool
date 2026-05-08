import { describe, expect, it } from 'vitest';
import {
  getTraceabilityCodesFromText,
  stripRollupsForCardDisplay,
} from '../display';

describe('traceability display helpers', () => {
  it('hides roll-up code lists from card display while preserving parseable codes', () => {
    const text = 'Need clearer guidance [Rolls up E-037, E-046, E-053, E-056, E-063, E-094]';

    expect(stripRollupsForCardDisplay(text)).toBe('Need clearer guidance');
    expect(getTraceabilityCodesFromText(text)).toEqual([
      'E-037',
      'E-046',
      'E-053',
      'E-056',
      'E-063',
      'E-094',
    ]);
  });

  it('does not fall back to displaying a standalone roll-up list', () => {
    expect(stripRollupsForCardDisplay('[Rolls up E-037, E-046]')).toBe('');
  });
});
