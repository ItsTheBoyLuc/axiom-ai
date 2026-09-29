import { describe, expect, it } from 'vitest';
import {
  NOT_DISCLOSED,
  VERIFICATION_STATUSES,
  orNotDisclosed,
  outranks,
  trustRank,
  verificationLabel,
} from '@/lib/verification';

describe('verification status logic', () => {
  it('has a label and rank for every status', () => {
    for (const s of VERIFICATION_STATUSES) {
      expect(verificationLabel[s]).toBeTruthy();
      expect(trustRank[s]).toBeTypeOf('number');
    }
  });

  it('orders statuses from most to least trusted', () => {
    const ranks = VERIFICATION_STATUSES.map((s) => trustRank[s]);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it('outranks is strict and never lets a lower status win', () => {
    expect(outranks('OFFICIALLY_VERIFIED', 'PROVIDER_REPORTED')).toBe(true);
    expect(outranks('UNVERIFIED', 'OFFICIALLY_VERIFIED')).toBe(false);
    expect(outranks('UNVERIFIED', 'UNVERIFIED')).toBe(false);
  });

  it('renders missing values as "Not publicly disclosed"', () => {
    expect(orNotDisclosed(null)).toBe(NOT_DISCLOSED);
    expect(orNotDisclosed(undefined)).toBe(NOT_DISCLOSED);
    expect(orNotDisclosed('')).toBe(NOT_DISCLOSED);
    expect(orNotDisclosed(0)).toBe('0');
  });
});
