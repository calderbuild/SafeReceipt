// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Wallet, ZeroHash } from 'ethers';
import {
  ACTION_REGISTRY,
  AlreadyStoredError,
  CHAIN_ID,
  DAILY_UPLOADS_PER_FILER,
  HOSTED_CHAINS,
  MAX_BODY_BYTES,
  MONTHLY_UPLOAD_CAP,
  handle,
  hashIntent,
  hashTrace,
  monthPrefix,
  resetRateLimits,
  traceUploadMessage,
  tracePath,
  type OnChainReceipt,
  type StoredBlob,
  type TraceDeps,
} from '../../../api/traces';
// @ts-expect-error plain JS modules shared with the client package; parity is the point of importing them
import { hashTrace as wrapperHashTrace, hashIntent as wrapperHashIntent } from '../../../../wrapper/canonicalize.mjs';
// @ts-expect-error see above
import { HOSTED_TRACES, hostedPublisher, receiptURL, traceUploadMessage as clientMessage } from '../../../../wrapper/hosted.mjs';
import deployments from '../../../../wrapper/deployments.json';
import trace1 from './fixtures/trace-1.json';

const filer = Wallet.createRandom();
const stranger = Wallet.createRandom();
const NOW = Date.UTC(2026, 9, 10, 12); // 2026-10-10 12:00 UTC
const FILED = NOW / 1000 - 600;

function makeTrace(receiptId: number) {
  return { ...trace1, receiptId, chainId: CHAIN_ID } as Record<string, unknown>;
}

function fakeDeps(receipt: Partial<OnChainReceipt> = {}, existing: StoredBlob[] = []) {
  const blobs = new Map<string, string>();
  const onChain: OnChainReceipt = {
    actor: filer.address,
    agentId: trace1.agentId,
    status: 0,
    timestamp: FILED,
    intentHash: hashIntent(trace1.declaredIntent),
    outcomeHash: ZeroHash,
    ...receipt,
  };
  const deps: TraceDeps = {
    readReceipt: async () => onChain,
    listMonth: async (prefix) => [
      ...existing,
      ...[...blobs.keys()].filter((p) => p.startsWith(prefix)).map((pathname) => ({ pathname, uploadedAt: new Date(NOW) })),
    ],
    exists: async (path) => blobs.has(path),
    store: async (path, body) => {
      if (blobs.has(path)) throw new AlreadyStoredError(path);
      blobs.set(path, body);
    },
    load: async (path) => blobs.get(path) ?? null,
    now: () => NOW,
  };
  return { deps, blobs, onChain };
}

async function upload(
  deps: TraceDeps,
  { receiptId = 7, signer = filer, trace = makeTrace(7), signedHash }: {
    receiptId?: number;
    signer?: Wallet | ReturnType<typeof Wallet.createRandom>;
    trace?: Record<string, unknown>;
    signedHash?: string;
  } = {}
) {
  const signature = await signer.signMessage(traceUploadMessage(CHAIN_ID, receiptId, signedHash ?? hashTrace(trace)));
  return handle(
    new Request('https://x.test/api/traces', {
      method: 'POST',
      body: JSON.stringify({ chainId: CHAIN_ID, receiptId, trace, signature }),
    }),
    deps
  );
}

const getTrace = (deps: TraceDeps, file = '7.json', chain = 'monad') =>
  handle(new Request(`https://x.test/api/traces?chain=${chain}&file=${file}`), deps);

beforeEach(() => resetRateLimits());

describe('traces api: parity with the client package', () => {
  it('hashes a trace and an intent exactly like wrapper/canonicalize.mjs', () => {
    expect(hashTrace(trace1)).toBe(wrapperHashTrace(trace1));
    expect(hashIntent(trace1.declaredIntent)).toBe(wrapperHashIntent(trace1.declaredIntent));
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
    const { deps, blobs, onChain } = fakeDeps();
    const res = await upload(deps);
    expect(res.status).toBe(201);
    expect(blobs.has(tracePath(7, onChain))).toBe(true);

    const got = await getTrace(deps);
    expect(got.status).toBe(200);
    expect(got.headers.get('access-control-allow-origin')).toBe('*');
    expect(hashTrace(await got.json())).toBe(hashTrace(makeTrace(7)));
  });

  it('rejects a signature from anyone but the filer', async () => {
    const { deps, blobs } = fakeDeps();
    expect((await upload(deps, { signer: stranger })).status).toBe(403);
    expect(blobs.size).toBe(0);
  });

  it('rejects a trace that differs from the one signed', async () => {
    const { deps, blobs } = fakeDeps();
    // the recovered address is some other key, so it fails the filer check
    expect((await upload(deps, { signedHash: hashTrace({ ...makeTrace(7), events: [] }) })).status).toBe(403);
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

  it('rejects a receipt filed more than 24 hours ago', async () => {
    const { deps } = fakeDeps({ timestamp: NOW / 1000 - 25 * 3600 });
    expect((await upload(deps)).status).toBe(409);
  });

  it("rejects a trace whose declared intent is not the receipt's committed intent", async () => {
    const { deps, blobs } = fakeDeps({ intentHash: hashIntent({ goal: 'something else' }) });
    expect((await upload(deps)).status).toBe(422);
    expect(blobs.size).toBe(0);
  });

  it('rejects a trace naming another agent', async () => {
    const { deps } = fakeDeps({ agentId: trace1.agentId + 1 });
    expect((await upload(deps)).status).toBe(422);
  });

  it('never overwrites a stored trace', async () => {
    const { deps, blobs, onChain } = fakeDeps();
    expect((await upload(deps)).status).toBe(201);
    const first = blobs.get(tracePath(7, onChain));
    expect((await upload(deps, { trace: { ...makeTrace(7), durationMs: 1 } })).status).toBe(409);
    expect(blobs.get(tracePath(7, onChain))).toBe(first);
  });

  it('accepts the same trace again (a retry after a failed link) with 200', async () => {
    const { deps, blobs } = fakeDeps();
    expect((await upload(deps)).status).toBe(201);
    expect((await upload(deps)).status).toBe(200);
    expect(blobs.size).toBe(1);
  });

  it('answers a lost race on the same path with 409, not 500', async () => {
    const { deps, blobs, onChain } = fakeDeps();
    // the existence check misses, then the put collides with a different trace
    deps.exists = async () => false;
    blobs.set(tracePath(7, onChain), JSON.stringify({ ...makeTrace(7), durationMs: 1 }));
    expect((await upload(deps)).status).toBe(409);
  });

  it('answers a lost race with the same trace as a retry (200)', async () => {
    const { deps, blobs, onChain } = fakeDeps();
    deps.exists = async () => false;
    blobs.set(tracePath(7, onChain), JSON.stringify(makeTrace(7)));
    expect((await upload(deps)).status).toBe(200);
  });

  it('stores the trace without the fields outside its hash', async () => {
    const { deps, blobs, onChain } = fakeDeps();
    const withRuntime = { ...makeTrace(7), status: 'VERIFIED', linkedTxHash: '0xdead', outcomeHash: '0xbeef' };
    expect((await upload(deps, { trace: withRuntime })).status).toBe(201);
    const stored = JSON.parse(blobs.get(tracePath(7, onChain))!);
    expect(stored).not.toHaveProperty('status');
    expect(stored).not.toHaveProperty('linkedTxHash');
    expect(stored).not.toHaveProperty('outcomeHash');
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

describe('traces api: quotas', () => {
  it('junk requests do not use up the global budget honest uploads need', async () => {
    const { deps } = fakeDeps();
    for (let i = 0; i < 250; i++) {
      const junk = new Request('https://x.test/api/traces', {
        method: 'POST',
        headers: { 'x-real-ip': `10.0.${Math.floor(i / 200)}.${i % 200}` },
        body: '{"chainId":10143,"receiptId":1,"trace":{},"signature":"0x00"}',
      });
      await handle(junk, deps);
    }
    expect((await upload(deps)).status).toBe(201);
  });

  it('refuses uploads once the month holds the monthly cap', async () => {
    const full = Array.from({ length: MONTHLY_UPLOAD_CAP }, (_, i) => ({
      pathname: `${monthPrefix(FILED)}0x${'a'.repeat(40)}/${1000 + i}.json`,
      uploadedAt: new Date(NOW - 3 * 86_400_000),
    }));
    const { deps, blobs } = fakeDeps({}, full);
    expect((await upload(deps)).status).toBe(429);
    expect(blobs.size).toBe(0);
  });

  it('refuses a wallet past its daily cap, and counts only its own last 24 hours', async () => {
    const own = (n: number, ageMs: number) =>
      Array.from({ length: n }, (_, i) => ({
        pathname: `${monthPrefix(FILED)}${filer.address.toLowerCase()}/${2000 + i + ageMs}.json`,
        uploadedAt: new Date(NOW - ageMs),
      }));
    expect((await upload(fakeDeps({}, own(DAILY_UPLOADS_PER_FILER, 3_600_000)).deps)).status).toBe(429);
    expect((await upload(fakeDeps({}, own(DAILY_UPLOADS_PER_FILER, 2 * 86_400_000)).deps)).status).toBe(201);
  });
});

describe('traces api: GET', () => {
  it('404s for a receipt with no hosted trace', async () => {
    const { deps } = fakeDeps();
    expect((await getTrace(deps, '9.json')).status).toBe(404);
  });

  it('404s for other chains and malformed names', async () => {
    const { deps } = fakeDeps();
    expect((await getTrace(deps, '1.json', 'bohr')).status).toBe(404);
    expect((await getTrace(deps, '..%2Fx.json')).status).toBe(404);
  });

  it('serves traces as inert JSON', async () => {
    const { deps } = fakeDeps();
    await upload(deps);
    const got = await getTrace(deps);
    expect(got.headers.get('x-content-type-options')).toBe('nosniff');
    expect(got.headers.get('content-security-policy')).toBe("default-src 'none'");
  });
});

describe('traces api: BOT Chain mainnet', () => {
  const BOT = HOSTED_CHAINS.bot;
  const botTrace = (receiptId: number) => ({ ...trace1, receiptId, chainId: BOT.chainId }) as Record<string, unknown>;

  function botDeps(receipt: Partial<OnChainReceipt> = {}, existing: StoredBlob[] = []) {
    const made = fakeDeps(receipt);
    const asked: { chain: string; receiptId: number }[] = [];
    made.deps.readReceipt = async (receiptId, chain) => {
      asked.push({ chain: chain?.name ?? 'monad', receiptId });
      return made.onChain;
    };
    // A real listMonth only returns what sits under the prefix; the fake must too
    const stored = made.deps.listMonth;
    made.deps.listMonth = async (prefix) => [...(await stored(prefix)), ...existing].filter((b) => b.pathname.startsWith(prefix));
    return { ...made, asked };
  }

  async function uploadBot(
    deps: TraceDeps,
    { receiptId = 7, signer = filer, trace = botTrace(7), bodyChainId = BOT.chainId, signedChainId = BOT.chainId }: {
      receiptId?: number;
      signer?: Wallet | ReturnType<typeof Wallet.createRandom>;
      trace?: Record<string, unknown>;
      bodyChainId?: number;
      signedChainId?: number;
    } = {}
  ) {
    const signature = await signer.signMessage(traceUploadMessage(signedChainId, receiptId, hashTrace(trace)));
    return handle(new Request('https://x.test/api/traces', { method: 'POST', body: JSON.stringify({ chainId: bodyChainId, receiptId, trace, signature }) }), deps);
  }

  it('mirrors the BOT Chain entry of wrapper/deployments.json', () => {
    expect(BOT.chainId).toBe(deployments.bot.chainId);
    expect(BOT.actionRegistry).toBe(deployments.bot.actionRegistry);
    expect(BOT.rpcUrl).toBe('https://rpc.botchain.ai');
  });

  it('stores the filer\'s trace under traces/bot, reads the receipt from BOT Chain, and serves it back', async () => {
    const { deps, blobs, onChain, asked } = botDeps();
    const res = await uploadBot(deps);
    expect(res.status).toBe(201);
    expect(asked).toEqual([{ chain: 'bot', receiptId: 7 }]);
    const path = tracePath(7, onChain, 'bot');
    expect(path.startsWith('traces/bot/2026-10/')).toBe(true);
    expect(blobs.has(path)).toBe(true);
    const got = await getTrace(deps, '7.json', 'bot');
    expect(got.status).toBe(200);
    expect(hashTrace(await got.json())).toBe(hashTrace(botTrace(7)));
  });

  it('keeps the same receipt id and filer on the two chains in different places', () => {
    const r = { actor: filer.address, timestamp: FILED };
    expect(tracePath(7, r, 'bot')).not.toBe(tracePath(7, r, 'monad'));
    expect(tracePath(7, r)).toBe(tracePath(7, r, 'monad'));
  });

  it('refuses a signature made for the Monad upload when it is sent as a BOT upload', async () => {
    const { deps, blobs } = botDeps();
    expect((await uploadBot(deps, { signedChainId: CHAIN_ID })).status).toBe(403);
    expect(blobs.size).toBe(0);
  });

  it('rejects a trace whose chainId is not the chain it is uploaded to', async () => {
    const { deps, blobs } = botDeps();
    expect((await uploadBot(deps, { trace: makeTrace(7) })).status).toBe(400);
    expect(blobs.size).toBe(0);
  });

  it('rejects a chain that is not hosted', async () => {
    const { deps } = botDeps();
    expect((await uploadBot(deps, { bodyChainId: 1, signedChainId: 1 })).status).toBe(400);
    expect((await getTrace(deps, '7.json', 'base')).status).toBe(404);
  });

  it('applies the BOT monthly cap to BOT uploads only', async () => {
    const at = (chain: 'monad' | 'bot', n: number) =>
      Array.from({ length: n }, (_, i) => ({ pathname: `${monthPrefix(FILED, chain)}0x${i}/${i}.json`, uploadedAt: new Date(NOW - 7 * 24 * 3_600_000) }));
    expect((await uploadBot(botDeps({}, at('bot', BOT.monthlyCap)).deps)).status).toBe(429);
    expect((await uploadBot(botDeps({}, at('monad', MONTHLY_UPLOAD_CAP)).deps)).status).toBe(201);
  });

  it('keeps the two caps inside the Hobby Blob budget of 2,000 operations (two per upload)', () => {
    expect((MONTHLY_UPLOAD_CAP + BOT.monthlyCap) * 2).toBeLessThanOrEqual(2000);
  });
});

describe('client package: BOT Chain hosted store', () => {
  it('has a hosted base URL for bot and builds the BOT receipt page', () => {
    expect(HOSTED_TRACES.bot.endsWith('/api/traces/bot')).toBe(true);
    expect(receiptURL(3, 'bot').endsWith('/fleet/bot/receipt/3')).toBe(true);
    expect(receiptURL(3).endsWith('/fleet/receipt/3')).toBe(true);
    expect(typeof hostedPublisher(filer, { network: 'bot' })).toBe('function');
  });
});

describe('client package against the server: BOT Chain', () => {
  afterEach(() => vi.unstubAllGlobals());

  // The real hostedPublisher talks to the real handler; only the network and the chain are faked.
  // vercel.json rewrites /api/traces/<chain>/<file> to /api/traces?chain=&file=, so the stub does too.
  async function publishThroughHandler(network: 'monad' | 'bot', signer: Wallet, filedBy: Wallet = signer) {
    const chainId = HOSTED_CHAINS[network].chainId;
    const trace = { ...trace1, receiptId: 7, chainId } as Record<string, unknown>;
    const { deps, blobs } = fakeDeps({ actor: filedBy.address });
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      const m = new URL(url).pathname.match(/^\/api\/traces\/([a-z]+)\/(.+)$/);
      return handle(new Request(m ? `https://x.test/api/traces?chain=${m[1]}&file=${m[2]}` : url, init), deps);
    });
    await hostedPublisher(signer, { network })(trace, 7);
    return blobs;
  }

  it('uploads and reads back a BOT Chain trace signed for chain 677', async () => {
    const blobs = await publishThroughHandler('bot', filer);
    expect([...blobs.keys()].every((p) => p.startsWith('traces/bot/'))).toBe(true);
    expect(blobs.size).toBe(1);
  });

  it('still uploads a Monad trace the same way', async () => {
    const blobs = await publishThroughHandler('monad', filer);
    expect([...blobs.keys()].every((p) => p.startsWith('traces/monad/'))).toBe(true);
    expect(blobs.size).toBe(1);
  });

  it('is refused when the signer is not the wallet that filed the receipt', async () => {
    await expect(publishThroughHandler('bot', stranger, filer)).rejects.toThrow(/403/);
  });
});
