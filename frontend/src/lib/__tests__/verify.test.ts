// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashTrace as browserHashTrace, DEPLOYER } from '../v2';
import { computeIntentHash } from '../canonicalize';
// @ts-expect-error plain JS module shared with @safereceipt/client
import { canonicalize, hashTrace, hashIntent } from '../../../../wrapper/canonicalize.mjs';
// @ts-expect-error plain JS module shared with @safereceipt/client
import { checkReceipt } from '../../../../wrapper/verify.mjs';
import vectors from '../../../../wrapper/test-vectors.json';
import trace1 from './fixtures/trace-1.json';

type Trace = Record<string, unknown> & { receiptId: number; agentId: number; chainId: number; declaredIntent: object };
type Check = { id: string; ok: boolean };
type Note = { id: string };

describe('hashing test vectors', () => {
  it.each(vectors.traces)('trace $name: wrapper and browser give the published canonical string and hash', (v) => {
    expect(canonicalize(v.input)).toBe(v.canonical);
    expect(hashTrace(v.input)).toBe(v.hash);
    expect(browserHashTrace(v.input as Record<string, unknown>)).toBe(v.hash);
  });

  it.each(vectors.intents)('intent $name: wrapper and browser give the published hash', (v) => {
    expect(hashIntent(v.input)).toBe(v.hash);
    expect(computeIntentHash(v.input)).toBe(v.hash);
  });

  it('the real Monad receipt #1 trace reproduces both hashes stored on-chain', () => {
    const [v] = vectors.onChain;
    expect(v.traceFixture).toBe('frontend/src/lib/__tests__/fixtures/trace-1.json');
    expect(hashTrace(trace1)).toBe(v.outcomeHash);
    expect(hashIntent(trace1.declaredIntent)).toBe(v.intentHash);
  });
});

/** A receipt whose stored hashes match `trace`, as the chain would hold after an honest link. */
function receiptFor(trace: Trace, status = 'VERIFIED') {
  return {
    id: trace.receiptId,
    actor: DEPLOYER,
    agentId: trace.agentId,
    chainId: trace.chainId,
    status,
    intentHash: hashIntent(trace.declaredIntent),
    outcomeHash: hashTrace(trace),
  };
}
const failed = (r: { checks: Check[] }) => r.checks.filter((c) => !c.ok).map((c) => c.id);
const noteIds = (r: { notes: Note[] }) => r.notes.map((n) => n.id);
const ACTIVE = { owner: DEPLOYER, revoked: false };

describe('checkReceipt', () => {
  it('passes every check for the real receipt #1 and adds no agent notes', () => {
    const [v] = vectors.onChain;
    const receipt = { ...receiptFor(trace1), outcomeHash: v.outcomeHash, intentHash: v.intentHash };
    const r = checkReceipt(receipt, trace1, ACTIVE);
    expect(r.intact).toBe(true);
    expect(noteIds(r)).toEqual(['STATUS_IS_A_CLAIM']);
  });

  it('fails OUTCOME_HASH when one byte of the trace changes after linking', () => {
    const receipt = receiptFor(trace1);
    const edited = { ...trace1, durationMs: trace1.durationMs + 1 };
    expect(failed(checkReceipt(receipt, edited, ACTIVE))).toEqual(['OUTCOME_HASH']);
  });

  it('fails IDS for an honest trace copied onto another receipt', () => {
    const receipt = { ...receiptFor(trace1), id: 99 };
    expect(failed(checkReceipt(receipt, trace1, ACTIVE))).toEqual(['IDS']);
  });

  it('fails POLICY when the filer records VERIFIED on a trace the rules reject', () => {
    const errored = { ...trace1, events: [{ stage: 'error', data: { error: true } }] };
    const r = checkReceipt(receiptFor(errored, 'VERIFIED'), errored, ACTIVE);
    expect(failed(r)).toEqual(['POLICY']);
  });

  it('labels agent id 0 as anonymous without needing an agent record', () => {
    const anon = { ...trace1, agentId: 0 };
    const r = checkReceipt(receiptFor(anon), anon, null);
    expect(r.intact).toBe(true);
    expect(noteIds(r)).toContain('ANONYMOUS');
  });

  it('notes a revoked agent and a changed owner, without failing the integrity checks', () => {
    const r = checkReceipt(receiptFor(trace1), trace1, { owner: '0x000000000000000000000000000000000000dEaD', revoked: true });
    expect(r.intact).toBe(true);
    expect(noteIds(r)).toEqual(expect.arrayContaining(['AGENT_REVOKED', 'OWNER_CHANGED']));
  });
});
