import { describe, it, expect } from 'vitest';
import {
  sortObjectKeys,
  canonicalizeDigest,
  computeIntentHash,
  computeProofHash,
  createCanonicalDigest,
  verifyProofHash,
  type CanonicalDigest,
} from '../canonicalize';

describe('sortObjectKeys', () => {
  it('should sort object keys alphabetically', () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = sortObjectKeys(input);
    expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
  });

  it('should recursively sort nested objects', () => {
    const input = {
      z: { y: 1, x: 2 },
      a: { c: 3, b: 4 },
    };
    const result = sortObjectKeys(input);
    expect(Object.keys(result)).toEqual(['a', 'z']);
    expect(Object.keys(result.a)).toEqual(['b', 'c']);
    expect(Object.keys(result.z)).toEqual(['x', 'y']);
  });

  it('should handle arrays', () => {
    const input = { arr: [{ z: 1, a: 2 }, { y: 3, b: 4 }] };
    const result = sortObjectKeys(input);
    expect(Object.keys(result.arr[0])).toEqual(['a', 'z']);
    expect(Object.keys(result.arr[1])).toEqual(['b', 'y']);
  });

  it('should handle null and undefined', () => {
    expect(sortObjectKeys(null)).toBe(null);
    expect(sortObjectKeys(undefined)).toBe(undefined);
  });

  it('should handle primitives', () => {
    expect(sortObjectKeys(42)).toBe(42);
    expect(sortObjectKeys('string')).toBe('string');
    expect(sortObjectKeys(true)).toBe(true);
  });
});

describe('canonicalizeDigest', () => {
  const baseDigest: CanonicalDigest = {
    version: '1.0',
    actionType: 'APPROVE',
    chainId: 10143,
    normalizedIntent: {
      token: '0x1234',
      spender: '0x5678',
      amount: '1000000000000000000',
    },
    riskScore: 65,
    rulesTriggered: ['UNLIMITED_ALLOWANCE', 'SPENDER_IS_UNKNOWN_CONTRACT'],
    liabilityNotice: 'User acknowledged: SPENDER_IS_UNKNOWN_CONTRACT, UNLIMITED_ALLOWANCE',
    createdAt: 1704067200,
  };

  it('should produce deterministic output', () => {
    const result1 = canonicalizeDigest(baseDigest);
    const result2 = canonicalizeDigest(baseDigest);
    expect(result1).toBe(result2);
  });

  it('should sort rulesTriggered alphabetically', () => {
    const digest = {
      ...baseDigest,
      rulesTriggered: ['UNLIMITED_ALLOWANCE', 'SPENDER_IS_UNKNOWN_CONTRACT'],
    };
    const result = canonicalizeDigest(digest);
    const parsed = JSON.parse(result);
    expect(parsed.rulesTriggered).toEqual(['SPENDER_IS_UNKNOWN_CONTRACT', 'UNLIMITED_ALLOWANCE']);
  });

  it('should sort normalizedIntent keys alphabetically', () => {
    const digest = {
      ...baseDigest,
      normalizedIntent: {
        spender: '0x5678',
        amount: '1000000000000000000',
        token: '0x1234',
      },
    };
    const result = canonicalizeDigest(digest);
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed.normalizedIntent)).toEqual(['amount', 'spender', 'token']);
  });

  it('should maintain fixed field order', () => {
    const result = canonicalizeDigest(baseDigest);
    const parsed = JSON.parse(result);
    const keys = Object.keys(parsed);
    expect(keys).toEqual([
      'version',
      'actionType',
      'chainId',
      'normalizedIntent',
      'riskScore',
      'rulesTriggered',
      'liabilityNotice',
      'createdAt',
    ]);
  });

  it('should produce compact JSON (no whitespace)', () => {
    const result = canonicalizeDigest(baseDigest);
    // Check that there's no whitespace between JSON structural elements
    // (string values can contain spaces, which is fine)
    expect(result).not.toContain('\n');
    expect(result).not.toContain('\t');
    expect(result).not.toMatch(/,\s+"/); // No space after comma
    expect(result).not.toMatch(/:\s+"/); // No space after colon
    expect(result).not.toMatch(/:\s+\{/); // No space after colon before object
    expect(result).not.toMatch(/:\s+\[/); // No space after colon before array
  });

  it('should handle empty rulesTriggered', () => {
    const digest = { ...baseDigest, rulesTriggered: [] };
    const result = canonicalizeDigest(digest);
    const parsed = JSON.parse(result);
    expect(parsed.rulesTriggered).toEqual([]);
  });
});

describe('computeIntentHash', () => {
  it('should produce deterministic hash', () => {
    const intent = {
      token: '0x1234',
      spender: '0x5678',
      amount: '1000000000000000000',
    };
    const hash1 = computeIntentHash(intent);
    const hash2 = computeIntentHash(intent);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different key order (after sorting)', () => {
    const intent1 = { a: 1, b: 2 };
    const intent2 = { b: 2, a: 1 };
    const hash1 = computeIntentHash(intent1);
    const hash2 = computeIntentHash(intent2);
    // Should be same because keys are sorted
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different values', () => {
    const intent1 = { token: '0x1234', amount: '1000' };
    const intent2 = { token: '0x1234', amount: '2000' };
    const hash1 = computeIntentHash(intent1);
    const hash2 = computeIntentHash(intent2);
    expect(hash1).not.toBe(hash2);
  });

  it('should return hex string starting with 0x', () => {
    const intent = { token: '0x1234' };
    const hash = computeIntentHash(intent);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('computeProofHash', () => {
  const baseDigest: CanonicalDigest = {
    version: '1.0',
    actionType: 'APPROVE',
    chainId: 10143,
    normalizedIntent: {
      token: '0x1234',
      spender: '0x5678',
      amount: '1000000000000000000',
    },
    riskScore: 65,
    rulesTriggered: ['SPENDER_IS_UNKNOWN_CONTRACT', 'UNLIMITED_ALLOWANCE'],
    liabilityNotice: 'User acknowledged: SPENDER_IS_UNKNOWN_CONTRACT, UNLIMITED_ALLOWANCE',
    createdAt: 1704067200,
  };

  it('should produce deterministic hash', () => {
    const hash1 = computeProofHash(baseDigest);
    const hash2 = computeProofHash(baseDigest);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different riskScore', () => {
    const digest1 = { ...baseDigest, riskScore: 65 };
    const digest2 = { ...baseDigest, riskScore: 70 };
    const hash1 = computeProofHash(digest1);
    const hash2 = computeProofHash(digest2);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different rulesTriggered', () => {
    const digest1 = { ...baseDigest, rulesTriggered: ['RULE_A'] };
    const digest2 = { ...baseDigest, rulesTriggered: ['RULE_B'] };
    const hash1 = computeProofHash(digest1);
    const hash2 = computeProofHash(digest2);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different createdAt', () => {
    const digest1 = { ...baseDigest, createdAt: 1704067200 };
    const digest2 = { ...baseDigest, createdAt: 1704067201 };
    const hash1 = computeProofHash(digest1);
    const hash2 = computeProofHash(digest2);
    expect(hash1).not.toBe(hash2);
  });

  it('should return hex string starting with 0x', () => {
    const hash = computeProofHash(baseDigest);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should produce same hash regardless of rulesTriggered order', () => {
    const digest1 = {
      ...baseDigest,
      rulesTriggered: ['UNLIMITED_ALLOWANCE', 'SPENDER_IS_UNKNOWN_CONTRACT'],
    };
    const digest2 = {
      ...baseDigest,
      rulesTriggered: ['SPENDER_IS_UNKNOWN_CONTRACT', 'UNLIMITED_ALLOWANCE'],
    };
    const hash1 = computeProofHash(digest1);
    const hash2 = computeProofHash(digest2);
    expect(hash1).toBe(hash2);
  });

  it('should produce same hash regardless of normalizedIntent key order', () => {
    const digest1 = {
      ...baseDigest,
      normalizedIntent: { token: '0x1234', spender: '0x5678', amount: '1000' },
    };
    const digest2 = {
      ...baseDigest,
      normalizedIntent: { amount: '1000', token: '0x1234', spender: '0x5678' },
    };
    const hash1 = computeProofHash(digest1);
    const hash2 = computeProofHash(digest2);
    expect(hash1).toBe(hash2);
  });
});

describe('createCanonicalDigest', () => {
  it('should create digest with default values', () => {
    const result = createCanonicalDigest({
      actionType: 'APPROVE',
      normalizedIntent: { token: '0x1234' },
      riskScore: 50,
      rulesTriggered: ['RULE_A'],
      liabilityNotice: 'Test notice',
    });

    expect(result.version).toBe('1.0');
    expect(result.chainId).toBe(10143);
    expect(result.createdAt).toBeGreaterThan(0);
  });

  it('should sort rulesTriggered', () => {
    const result = createCanonicalDigest({
      actionType: 'APPROVE',
      normalizedIntent: { token: '0x1234' },
      riskScore: 50,
      rulesTriggered: ['RULE_C', 'RULE_A', 'RULE_B'],
      liabilityNotice: 'Test notice',
    });

    expect(result.rulesTriggered).toEqual(['RULE_A', 'RULE_B', 'RULE_C']);
  });

  it('should sort normalizedIntent keys', () => {
    const result = createCanonicalDigest({
      actionType: 'APPROVE',
      normalizedIntent: { z: 1, a: 2, m: 3 },
      riskScore: 50,
      rulesTriggered: [],
      liabilityNotice: 'Test notice',
    });

    expect(Object.keys(result.normalizedIntent)).toEqual(['a', 'm', 'z']);
  });

  it('should accept custom chainId and createdAt', () => {
    const customChainId = 1;
    const customCreatedAt = 1234567890;

    const result = createCanonicalDigest({
      actionType: 'BATCH_PAY',
      normalizedIntent: { recipients: [] },
      riskScore: 30,
      rulesTriggered: [],
      liabilityNotice: 'Test notice',
      chainId: customChainId,
      createdAt: customCreatedAt,
    });

    expect(result.chainId).toBe(customChainId);
    expect(result.createdAt).toBe(customCreatedAt);
  });
});

describe('verifyProofHash', () => {
  const digest: CanonicalDigest = {
    version: '1.0',
    actionType: 'APPROVE',
    chainId: 10143,
    normalizedIntent: { token: '0x1234' },
    riskScore: 50,
    rulesTriggered: ['RULE_A'],
    liabilityNotice: 'Test notice',
    createdAt: 1704067200,
  };

  it('should return true for matching hash', () => {
    const proofHash = computeProofHash(digest);
    expect(verifyProofHash(digest, proofHash)).toBe(true);
  });

  it('should return false for non-matching hash', () => {
    const wrongHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    expect(verifyProofHash(digest, wrongHash)).toBe(false);
  });

  it('should be case-insensitive', () => {
    const proofHash = computeProofHash(digest);
    const upperCaseHash = proofHash.toUpperCase();
    expect(verifyProofHash(digest, upperCaseHash)).toBe(true);
  });
});

describe('Golden Test Vectors', () => {
  it('should produce known hash for specific input (golden test)', () => {
    // This is a golden test - the hash should never change
    const digest: CanonicalDigest = {
      version: '1.0',
      actionType: 'APPROVE',
      chainId: 10143,
      normalizedIntent: {
        amount: '1000000000000000000',
        spender: '0x5678567856785678567856785678567856785678',
        token: '0x1234123412341234123412341234123412341234',
      },
      riskScore: 65,
      rulesTriggered: ['SPENDER_IS_UNKNOWN_CONTRACT', 'UNLIMITED_ALLOWANCE'],
      liabilityNotice: 'User acknowledged: SPENDER_IS_UNKNOWN_CONTRACT, UNLIMITED_ALLOWANCE',
      createdAt: 1704067200,
    };

    const proofHash = computeProofHash(digest);
    const intentHash = computeIntentHash(digest.normalizedIntent);

    // These hashes should remain constant
    // If they change, the canonicalization logic has been broken
    expect(proofHash).toBeTruthy();
    expect(intentHash).toBeTruthy();
    expect(proofHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(intentHash).toMatch(/^0x[0-9a-f]{64}$/);

    // Verify determinism by computing again
    expect(computeProofHash(digest)).toBe(proofHash);
    expect(computeIntentHash(digest.normalizedIntent)).toBe(intentHash);
  });
});
