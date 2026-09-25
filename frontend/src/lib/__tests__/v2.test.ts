import { describe, it, expect, afterEach, vi } from 'vitest';
import { hashTrace, verifyIndependently, type V2Receipt } from '../v2';
import { computeIntentHash } from '../canonicalize';
import trace1 from './fixtures/trace-1.json';
import trace2 from './fixtures/trace-2.json';

// Real receipts from ActionRegistry on Monad Testnet (0x8aeee534...), read 2026-09-25.
const ONCHAIN = {
  1: {
    outcomeHash: '0xad13ac56077d77834c58ae497a1092a564fcd0b90cec82daa2117084c50458e4',
    intentHash: '0xd4d6df3bd3b5f3ab108de548a3487a5710dcf5087bef2a0b27f7e825c55602fc',
  },
  2: {
    outcomeHash: '0x4e934be3b86ccc182c75c7e945d1ca884fba9a649ba204e49dacd512d20dbae5',
    intentHash: '0xba2cbe105928513305747ae1ea7b19aed943c56761b569d95326acfc1b1dbbd9',
  },
};

const receipt = (id: 1 | 2): V2Receipt => ({
  id,
  actor: '0x636011edE26fCe9cb675Ac42543d69f3b9CcA9Dc',
  agentId: id + 1,
  actionType: 'OFF_CHAIN_ACTION',
  riskScore: 0,
  timestamp: 0,
  proofHash: ONCHAIN[id].intentHash,
  evidenceURI: `https://example.test/traces/${id}.json`,
  status: id === 1 ? 'VERIFIED' : 'MISMATCH',
  ...ONCHAIN[id],
});

const mockFetch = (body: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: async () => body }));

afterEach(() => vi.unstubAllGlobals());

describe('hashTrace', () => {
  it('reproduces the on-chain outcomeHash of both published traces', () => {
    expect(hashTrace(trace1)).toBe(ONCHAIN[1].outcomeHash);
    expect(hashTrace(trace2)).toBe(ONCHAIN[2].outcomeHash);
  });

  it('reproduces the on-chain intentHash from declaredIntent', () => {
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

describe('verifyIndependently', () => {
  it('confirms an untouched trace matches the chain', async () => {
    mockFetch(trace1);
    const v = await verifyIndependently(receipt(1));
    expect(v.outcomeMatches).toBe(true);
    expect(v.intentMatches).toBe(true);
  });

  it('flags a trace that was edited after it was committed', async () => {
    const tampered = structuredClone(trace2);
    tampered.declaredIntent.declaredScope = ['docs/', 'src/'];
    mockFetch(tampered);
    const v = await verifyIndependently(receipt(2));
    expect(v.outcomeMatches).toBe(false);
    expect(v.intentMatches).toBe(false);
  });

  it('throws when the published trace cannot be fetched', async () => {
    mockFetch(null, false);
    await expect(verifyIndependently(receipt(1))).rejects.toThrow('HTTP 404');
  });
});
