import { describe, it, expect } from 'vitest';
import { generateLiabilityNotice } from '../liabilityNotice';

describe('generateLiabilityNotice', () => {
  it('lists a single rule', () => {
    expect(generateLiabilityNotice(['UNLIMITED_ALLOWANCE'])).toBe('Rules triggered: UNLIMITED_ALLOWANCE');
  });

  it('sorts rules so the text (and the proof hash) is deterministic', () => {
    expect(generateLiabilityNotice(['UNLIMITED_ALLOWANCE', 'SPENDER_IS_UNKNOWN_CONTRACT'])).toBe(
      'Rules triggered: SPENDER_IS_UNKNOWN_CONTRACT, UNLIMITED_ALLOWANCE'
    );
  });

  it('does not mutate the input', () => {
    const rules = ['RULE_C', 'RULE_A'];
    generateLiabilityNotice(rules);
    expect(rules).toEqual(['RULE_C', 'RULE_A']);
  });

  it('says none when no rule fired', () => {
    expect(generateLiabilityNotice([])).toBe('Rules triggered: none');
  });
});
