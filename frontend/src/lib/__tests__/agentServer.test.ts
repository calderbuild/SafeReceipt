// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Wallet } from 'ethers';
import type { HDNodeWallet } from 'ethers';
import { signInMessage as clientMessage } from '../agentApi';
import { checkAuth, handle, rateLimit, resetRateLimits, signInMessage, validateApprove, HttpError } from '../../../api/agent';

const DEMO_USD = '0x5a3b52260c44cd1ec70c7157131bc15913cd835f';
const PERMIT2 = '0x000000000022d473030f116ddee9f6b43ac78ba3';

async function signIn(wallet: HDNodeWallet, issuedAt = new Date().toISOString()) {
  const signature = await wallet.signMessage(signInMessage(wallet.address, issuedAt));
  return { address: wallet.address, issuedAt, signature };
}

function post(body: unknown, ip = '1.2.3.4') {
  return new Request('https://x/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify(body),
  });
}

function status(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
  return undefined;
}

describe('agent api', () => {
  const wallet = Wallet.createRandom();

  beforeEach(() => {
    resetRateLimits();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('accepts a fresh sign-in and returns the signer', async () => {
    const auth = await signIn(wallet);
    expect(checkAuth(auth)).toBe(wallet.address.toLowerCase());
  });

  it('rejects a signature made for another address', async () => {
    const auth = { ...(await signIn(wallet)), address: Wallet.createRandom().address };
    expect(status(() => checkAuth(auth))).toBe(401);
  });

  it('rejects an expired sign-in', async () => {
    const auth = await signIn(wallet, new Date(Date.now() - 31 * 60_000).toISOString());
    expect(status(() => checkAuth(auth))).toBe(401);
  });

  it('client and server sign the same message', () => {
    expect(clientMessage('0xAbC', '2026-09-26T00:00:00Z')).toBe(signInMessage('0xAbC', '2026-09-26T00:00:00Z'));
  });

  it('rejects missing auth', () => {
    expect(status(() => checkAuth(undefined))).toBe(401);
  });

  it('validates model output as untrusted', () => {
    expect(validateApprove({ token: DEMO_USD, spender: PERMIT2, amount: '100' })).toEqual({ token: DEMO_USD, spender: PERMIT2, amount: '100' });
    expect(status(() => validateApprove({ token: '0x12', spender: PERMIT2, amount: '1' }))).toBe(422);
    expect(status(() => validateApprove({ token: DEMO_USD, spender: PERMIT2, amount: '1e6' }))).toBe(422);
    expect(status(() => validateApprove({ token: DEMO_USD, spender: PERMIT2, amount: 100 }))).toBe(422);
    expect(status(() => validateApprove({ token: DEMO_USD, spender: PERMIT2, amount: (2n ** 256n).toString() }))).toBe(422);
  });

  it('rate-limits per key', () => {
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000, 1000);
    expect(status(() => rateLimit('k', 3, 60_000, 1000))).toBe(429);
    expect(status(() => rateLimit('k', 3, 60_000, 70_000))).toBeUndefined();
  });

  it('reports availability from the server env only', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    const res = await handle(new Request('https://x/api/agent'));
    expect(await res.json()).toEqual({ available: false, model: 'deepseek-flash' });
  });

  it('refuses unsigned calls before touching the model', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'parse', input: 'Approve 100 DemoUSD to Permit2' }));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('plan returns the model call, validated, plus the metadata it read', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    const modelReply = JSON.stringify({ token: DEMO_USD, spender: PERMIT2, amount: '10000000000', note: 'raised to the minimum' });
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: modelReply } }] }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({
      op: 'plan',
      scenarioId: 'rogue',
      intent: { token: DEMO_USD, spender: PERMIT2, amount: '100000000' },
      auth: await signIn(wallet),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.call).toEqual({ token: DEMO_USD, spender: PERMIT2, amount: '10000000000' });
    expect(body.metadata).toContain('Minimum allowance');
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sent.messages[1].content).toContain('amount 100000000');
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('rejects free-form ops', async () => {
    const res = await handle(post({ op: 'chat', input: 'hi', auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
  });
});
