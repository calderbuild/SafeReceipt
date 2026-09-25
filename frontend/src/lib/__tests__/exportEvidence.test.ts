import { describe, it, expect } from 'vitest';
import { createExportEvidence } from '../exportEvidence';
import { computeProofHash, createCanonicalDigest } from '../canonicalize';

describe('createExportEvidence', () => {
  it('carries every field needed to recompute the proof hash from the file alone', () => {
    const digest = createCanonicalDigest({
      actionType: 'APPROVE',
      normalizedIntent: { token: '0xabc', spender: '0xdef', amount: '100' },
      riskScore: 25,
      rulesTriggered: ['SPENDER_IS_UNKNOWN_CONTRACT'],
      liabilityNotice: 'Rules triggered: SPENDER_IS_UNKNOWN_CONTRACT',
      createdAt: 1758800000,
    });
    const e = createExportEvidence('7', { ...digest, status: 'MISMATCH', linkedTxHash: '0x01' }, '0xactor');

    const rebuilt = {
      version: e.digestVersion,
      actionType: e.actionType,
      chainId: e.chainId,
      normalizedIntent: e.normalizedIntent,
      riskScore: e.riskScore,
      rulesTriggered: e.rulesTriggered,
      liabilityNotice: e.liabilityNotice,
      createdAt: e.createdAt,
    };
    expect(computeProofHash(rebuilt)).toBe(e.proofHash);
    expect(e.status).toBe('MISMATCH');
    expect(e.contractAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
