import { describe, it, expect, afterEach, vi } from 'vitest';
import { hashTrace, checkTrace, verifyIndependently, type V2Receipt } from '../v2';
import { computeIntentHash } from '../canonicalize';
import { evaluateTrace } from '../tracePolicy';
// @ts-expect-error plain JS module shared with the wrapper; parity is the point of importing it
import { evaluatePolicy } from '../../../../wrapper/policy.mjs';
import trace1 from './fixtures/trace-1.json';
import trace2 from './fixtures/trace-2.json';

// Real receipts from ActionRegistry V2.1 on Monad Testnet (0x975bD215...), read 2026-09-25.
const ACTOR = '0x636011edE26fCe9cb675Ac42543d69f3b9CcA9Dc';
const ONCHAIN = {
  1: {
    agentId: 2,
    status: 'VERIFIED' as const,
    outcomeHash: '0x0e7da537652c2e618907030dabe14a85caf066d4474a8701b7d3364e1cffed8f',
    intentHash: '0x360741739a7bb864265472cbdfbc7d033d9dc3667e5dbf19a4c8e3a078bbb2c1',
  },
  2: {
    agentId: 3,
    status: 'MISMATCH' as const,
    outcomeHash: '0x11cfe35facd5e1ea6c3f6322387bd6744aa34cb0580adec8c763a707cdf75c4a',
    intentHash: '0xba2cbe105928513305747ae1ea7b19aed943c56761b569d95326acfc1b1dbbd9',
  },
};

const receipt = (id: 1 | 2): V2Receipt => ({
  id,
  actor: ACTOR,
  actionType: 'OFF_CHAIN_ACTION',
  riskScore: 0,
  timestamp: 0,
  proofHash: ONCHAIN[id].intentHash,
  evidenceURI: `https://example.test/traces/${id}.json`,
  ...ONCHAIN[id],
});

afterEach(() => vi.unstubAllGlobals());

describe('hashTrace', () => {
  it('reproduces the on-chain outcomeHash and intentHash of both published traces', () => {
    expect(hashTrace(trace1)).toBe(ONCHAIN[1].outcomeHash);
    expect(hashTrace(trace2)).toBe(ONCHAIN[2].outcomeHash);
    expect(computeIntentHash(trace1.declaredIntent)).toBe(ONCHAIN[1].intentHash);
    expect(computeIntentHash(trace2.declaredIntent)).toBe(ONCHAIN[2].intentHash);
  });

  it('ignores key order and runtime-only fields', () => {
    const reordered = Object.fromEntries(Object.entries(trace1).reverse());
    expect(hashTrace({ ...reordered, status: 'VERIFIED', outcomeHash: '0x00' })).toBe(ONCHAIN[1].outcomeHash);
  });

  it('changes when a single value in the trace changes', () => {
    const tampered = structuredClone(trace2);
    tampered.events[0].progress = 1;
    expect(hashTrace(tampered)).not.toBe(ONCHAIN[2].outcomeHash);
  });
});

describe('checkTrace', () => {
  it('passes every check for the untouched traces', () => {
    for (const [id, trace] of [[1, trace1], [2, trace2]] as const) {
      const v = checkTrace(receipt(id), trace, ACTOR);
      expect(v).toMatchObject({ outcomeMatches: true, intentMatches: true, idsMatch: true, actorOwnsAgent: true, policyAgrees: true });
    }
  });

  it('recomputes SCOPE_CREEP on receipt #2 from the real file paths it read', () => {
    const v = checkTrace(receipt(2), trace2, ACTOR);
    expect(v.policy.rulesTriggered).toEqual(['SCOPE_CREEP']);
    expect(v.policy.outOfScope.every((p) => p.startsWith('test/'))).toBe(true);
  });

  it('flags a valid trace copied onto a different receipt', () => {
    expect(checkTrace({ ...receipt(2), id: 9 }, trace2, ACTOR).idsMatch).toBe(false);
  });

  it('flags a trace edited after it was committed', () => {
    const tampered = structuredClone(trace2);
    tampered.declaredIntent.declaredScope = ['docs/', 'test/'];
    const v = checkTrace(receipt(2), tampered, ACTOR);
    expect(v).toMatchObject({ outcomeMatches: false, intentMatches: false, policyAgrees: false });
  });

  it('flags a filer who does not own the agent', () => {
    expect(checkTrace(receipt(1), trace1, '0x1234567890123456789012345678901234567890').actorOwnsAgent).toBe(false);
  });
});

describe('tracePolicy parity with wrapper/policy.mjs', () => {
  const variants = [
    trace1,
    trace2,
    { ...trace1, events: [] },
    { ...trace1, durationMs: 10 ** 9 },
    { ...trace1, events: [{ stage: 'error', data: { error: true } }] },
    { ...trace2, declaredIntent: { ...trace2.declaredIntent, declaredScope: [] } },
  ];
  it('gives the same verdict and rules on every variant', () => {
    for (const t of variants) {
      const w = evaluatePolicy(t);
      const f = evaluateTrace(t);
      expect([f.verified, f.score, f.rulesTriggered]).toEqual([w.verified, w.score, w.rulesTriggered]);
    }
  });
});

describe('verifyIndependently', () => {
  it('throws when the published trace cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => null }));
    await expect(verifyIndependently(receipt(1))).rejects.toThrow('HTTP 404');
  });
});
