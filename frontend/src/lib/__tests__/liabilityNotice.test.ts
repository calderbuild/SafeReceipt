import { describe, it, expect } from 'vitest';
import {
  generateLiabilityNotice,
  generateDetailedLiabilityNotice,
  parseLiabilityNotice,
  isValidLiabilityNotice,
} from '../liabilityNotice';

describe('generateLiabilityNotice', () => {
  it('should generate notice for single rule', () => {
    const result = generateLiabilityNotice(['UNLIMITED_ALLOWANCE']);
    expect(result).toBe('User acknowledged: UNLIMITED_ALLOWANCE');
  });

  it('should generate notice for multiple rules', () => {
    const result = generateLiabilityNotice([
      'UNLIMITED_ALLOWANCE',
      'SPENDER_IS_UNKNOWN_CONTRACT',
    ]);
    expect(result).toBe('User acknowledged: SPENDER_IS_UNKNOWN_CONTRACT, UNLIMITED_ALLOWANCE');
  });

  it('should sort rules alphabetically', () => {
    const result = generateLiabilityNotice([
      'RULE_C',
      'RULE_A',
      'RULE_B',
    ]);
    expect(result).toBe('User acknowledged: RULE_A, RULE_B, RULE_C');
  });

  it('should produce deterministic output', () => {
    const rules = ['RULE_B', 'RULE_A'];
    const result1 = generateLiabilityNotice(rules);
    const result2 = generateLiabilityNotice(rules);
    expect(result1).toBe(result2);
  });

  it('should produce same output regardless of input order', () => {
    const result1 = generateLiabilityNotice(['RULE_B', 'RULE_A']);
    const result2 = generateLiabilityNotice(['RULE_A', 'RULE_B']);
    expect(result1).toBe(result2);
  });

  it('should handle empty array', () => {
    const result = generateLiabilityNotice([]);
    expect(result).toBe('User acknowledged: No risk rules triggered');
  });

  it('should handle null/undefined', () => {
    const result1 = generateLiabilityNotice(null as any);
    const result2 = generateLiabilityNotice(undefined as any);
    expect(result1).toBe('User acknowledged: No risk rules triggered');
    expect(result2).toBe('User acknowledged: No risk rules triggered');
  });
});

describe('generateDetailedLiabilityNotice', () => {
  it('should include risk score', () => {
    const result = generateDetailedLiabilityNotice(['UNLIMITED_ALLOWANCE'], 65);
    expect(result).toContain('Risk Score: 65/100');
  });

  it('should include warning text for triggered rules', () => {
    const result = generateDetailedLiabilityNotice(['UNLIMITED_ALLOWANCE'], 65);
    expect(result).toContain('User proceeded despite warnings');
  });

  it('should not include warning text for no rules', () => {
    const result = generateDetailedLiabilityNotice([], 0);
    expect(result).not.toContain('User proceeded despite warnings');
    expect(result).toBe('User acknowledged: No risk rules triggered. Risk Score: 0/100');
  });
});

describe('parseLiabilityNotice', () => {
  it('should parse single rule', () => {
    const notice = 'User acknowledged: UNLIMITED_ALLOWANCE';
    const result = parseLiabilityNotice(notice);
    expect(result).toEqual(['UNLIMITED_ALLOWANCE']);
  });

  it('should parse multiple rules', () => {
    const notice = 'User acknowledged: RULE_A, RULE_B, RULE_C';
    const result = parseLiabilityNotice(notice);
    expect(result).toEqual(['RULE_A', 'RULE_B', 'RULE_C']);
  });

  it('should handle notice with period', () => {
    const notice = 'User acknowledged: RULE_A, RULE_B. Risk Score: 50/100';
    const result = parseLiabilityNotice(notice);
    expect(result).toEqual(['RULE_A', 'RULE_B']);
  });

  it('should return empty array for no rules', () => {
    const notice = 'User acknowledged: No risk rules triggered';
    const result = parseLiabilityNotice(notice);
    expect(result).toEqual([]);
  });

  it('should handle whitespace', () => {
    const notice = 'User acknowledged: RULE_A,  RULE_B  ,RULE_C';
    const result = parseLiabilityNotice(notice);
    expect(result).toEqual(['RULE_A', 'RULE_B', 'RULE_C']);
  });
});

describe('isValidLiabilityNotice', () => {
  it('should validate correct format', () => {
    expect(isValidLiabilityNotice('User acknowledged: RULE_A')).toBe(true);
    expect(isValidLiabilityNotice('User acknowledged: No risk rules triggered')).toBe(true);
  });

  it('should reject invalid format', () => {
    expect(isValidLiabilityNotice('Invalid notice')).toBe(false);
    expect(isValidLiabilityNotice('User acknowledged: ')).toBe(false);
    expect(isValidLiabilityNotice('')).toBe(false);
  });
});

describe('Round-trip test', () => {
  it('should generate and parse correctly', () => {
    const rules = ['RULE_C', 'RULE_A', 'RULE_B'];
    const notice = generateLiabilityNotice(rules);
    const parsed = parseLiabilityNotice(notice);

    // Parsed rules should be sorted
    expect(parsed).toEqual(['RULE_A', 'RULE_B', 'RULE_C']);
  });
});
