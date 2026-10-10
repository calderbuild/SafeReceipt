// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { Wallet, ZeroHash } from 'ethers';
import {
  ACTION_REGISTRY,
  CHAIN_ID,
  MAX_BODY_BYTES,
  handle,
  hashTrace,
  resetRateLimits,
  traceUploadMessage,
  tracePath,
  type OnChainReceipt,
  type TraceDeps,
} from '../../../api/traces';
// @ts-expect-error plain JS modules shared with the client package; parity is the point of importing them
import { hashTrace as wrapperHashTrace } from '../../../../wrapper/canonicalize.mjs';
// @ts-expect-error see above
import { traceUploadMessage as clientMessage } from '../../../../wrapper/hosted.mjs';
import deployments from '../../../../wrapper/deployments.json';
import trace1 from './fixtures/trace-1.json';

const filer = Wallet.createRandom();
const stranger = Wallet.createRandom();

function makeTrace(receiptId: number) {
  return { ...trace1, receiptId, chainId: CHAIN_ID };
}

function fakeDeps(receipt: Partial<OnChainReceipt> = {}) {
  const blobs = new Map<string, string>();
  const onChain: OnChainReceipt = { actor: filer.address, status: 0, outcomeHash: ZeroHash, ...receipt };
  const deps: TraceDeps = {
    readReceipt: async () => onChain,
    exists: async (path) => blobs.has(path),
    store: async (path, body) => {
      if (blobs.has(path)) throw new Error('overwrite');
      blobs.set(path, body);
    },
    load: async (path) => blobs.get(path) ?? null,
  };
  return { deps, blobs };
}

async function upload(deps: TraceDeps, { receiptId = 7, signer = filer, trace = makeTrace(7) as Record<string, unknown>, signedHash }: {
  receiptId?: number;
  signer?: Wallet | ReturnType<typeof Wallet.createRandom>;
  trace?: Record<string, unknown>;
  signedHash?: string;
} = {}) {
  const signature = await signer.signMessage(traceUploadMessage(CHAIN_ID, receiptId, signedHash ?? hashTrace(trace)));
  return handle(
    new Request('https://x.test/api/traces', {
      method: 'POST',
      body: JSON.stringify({ chainId: CHAIN_ID, receiptId, trace, signature }),
    }),
    deps
  );
}

beforeEach(() => resetRateLimits());

describe('traces api: parity with the client package', () => {
  it('hashes a trace exactly like wrapper/canonicalize.mjs', () => {
    expect(hashTrace(trace1)).toBe(wrapperHashTrace(trace1));
  });

  it('signs the same message the client signs', () => {
    expect(traceUploadMessage(CHAIN_ID, 3, '0xABC')).toBe(clientMessage(CHAIN_ID, 3, '0xABC'));
  });

  it('points at the deployed monad ActionRegistry', () => {
    expect(ACTION_REGISTRY).toBe(deployments.monad.actionRegistry);
  });
});

describe('traces api: POST', () => {
  it('stores the trace signed by the receipt filer, then serves it', async () => {
    const { deps, blobs } = fakeDeps();
    const res = await upload(deps);
    expect(res.status).toBe(201);
    expect(blobs.has(tracePath(7))).toBe(true);

    const got = await handle(new Request('https://x.test/api/traces?chain=monad&file=7.json'), deps);
    expect(got.status).toBe(200);
    expect(got.headers.get('access-control-allow-origin')).toBe('*');
    expect(hashTrace(await got.json())).toBe(hashTrace(makeTrace(7)));
  });

  it('rejects a signature from anyone but the filer', async () => {
    const { deps, blobs } = fakeDeps();
    const res = await upload(deps, { signer: stranger });
    expect(res.status).toBe(403);
    expect(blobs.size).toBe(0);
  });

  it('rejects a trace that differs from the one signed', async () => {
    const { deps, blobs } = fakeDeps();
    const res = await upload(deps, { signedHash: hashTrace({ ...makeTrace(7), events: [] }) });
    // the recovered address is some other key, so it fails the filer check
    expect(res.status).toBe(403);
    expect(blobs.size).toBe(0);
  });

  it('rejects a receipt that already has an outcome linked', async () => {
    const { deps } = fakeDeps({ status: 2, outcomeHash: '0x' + '11'.repeat(32) });
    expect((await upload(deps)).status).toBe(409);
  });

  it('rejects a receipt that does not exist', async () => {
    const { deps } = fakeDeps({ actor: '0x' + '0'.repeat(40) });
    expect((await upload(deps)).status).toBe(404);
  });

  it('never overwrites a stored trace', async () => {
    const { deps, blobs } = fakeDeps();
    expect((await upload(deps)).status).toBe(201);
    const first = blobs.get(tracePath(7));
    const second = await upload(deps, { trace: { ...makeTrace(7), durationMs: 1 } });
    expect(second.status).toBe(409);
    expect(blobs.get(tracePath(7))).toBe(first);
  });

  it('rejects a trace naming another receipt', async () => {
    const { deps } = fakeDeps();
    expect((await upload(deps, { trace: makeTrace(8) })).status).toBe(400);
  });

  it('rejects a body over 256 KB', async () => {
    const { deps, blobs } = fakeDeps();
    const big = { ...makeTrace(7), padding: 'x'.repeat(MAX_BODY_BYTES) };
    expect((await upload(deps, { trace: big })).status).toBe(413);
    expect(blobs.size).toBe(0);
  });
});

describe('traces api: GET', () => {
  it('404s for a receipt with no hosted trace', async () => {
    const { deps } = fakeDeps();
    expect((await handle(new Request('https://x.test/api/traces?chain=monad&file=9.json'), deps)).status).toBe(404);
  });

  it('404s for other chains and malformed names', async () => {
    const { deps } = fakeDeps();
    expect((await handle(new Request('https://x.test/api/traces?chain=bohr&file=1.json'), deps)).status).toBe(404);
    expect((await handle(new Request('https://x.test/api/traces?chain=monad&file=..%2Fx.json'), deps)).status).toBe(404);
  });
});
