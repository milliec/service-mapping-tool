import { describe, expect, it } from 'vitest';
import { L2_LANE_KEYS, L3_LANE_KEYS } from '@/lib/lane-definitions';

describe('lane definitions', () => {
  it('shows opportunities and ideas at the bottom of L2 and L3', () => {
    expect(L2_LANE_KEYS.slice(-2)).toEqual(['opportunities', 'ideas']);
    expect(L3_LANE_KEYS.slice(-2)).toEqual(['opportunities', 'ideas']);
  });
});
