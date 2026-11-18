// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Wallet } from 'ethers';
import type { HDNodeWallet } from 'ethers';
import { signInMessage as clientMessage } from '../agentApi';
import { RISK_RULES } from '../riskEngine';
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

  afterEach(() => vi.restoreAllMocks());

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

  it('explain only forwards rule ids, not arbitrary text', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'explain', score: 40, context: 'Approve', rules: ['x'.repeat(5000)], auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([null, [], 'parse', 1, true].map((value) => [value]))('rejects a non-object request body: %j', async (body) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await handle(post(body))).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-string operation without coercing it', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: ['parse'], input: 'Approve', auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an inherited operation as unknown', async () => {
    const res = await handle(post({ op: 'toString', auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Unknown op' });
  });

  it('rejects an inherited scenario before calling the model', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'plan', scenarioId: 'toString', intent: { token: DEMO_USD, spender: PERMIT2, amount: '100' }, auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Unknown scenario' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([null, 42, true, [], {}].map((value) => [value]))('rejects non-string parse input: %j', async (input) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'parse', input, auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([null, 42, true, ['safe'], {}].map((value) => [value]))('rejects a non-string plan scenario: %j', async (scenarioId) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'plan', scenarioId, intent: { token: DEMO_USD, spender: PERMIT2, amount: '100' }, auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['token', 'spender', 'amount'])('rejects non-string plan intent %s values', async (field) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const auth = await signIn(wallet);
    for (const value of [null, 42, true, [], {}]) {
      const intent = { token: DEMO_USD, spender: PERMIT2, amount: '100', [field]: value };
      const res = await handle(post({ op: 'plan', scenarioId: 'safe', intent, auth }));
      expect(res.status).toBe(422);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([null, '40', 'NaN', 'Infinity', '', true, [], {}].map((value) => [value]))('rejects invalid scores without calling the model: %j', async (score) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'explain', score, context: 'Approve', rules: ['UNLIMITED_ALLOWANCE'], auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['1e400', '-1e400'])('rejects a non-finite JSON score: %s', async (score) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const body = JSON.stringify({ op: 'explain', score: 'overflow', context: 'Approve', rules: ['UNLIMITED_ALLOWANCE'], auth: await signIn(wallet) });
    const res = await handle(new Request('https://x/api/agent', { method: 'POST', body: body.replace('"overflow"', score) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([null, 42, true, [], {}].map((value) => [value]))('rejects non-string explanation context: %j', async (context) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'explain', score: 40, context, rules: ['UNLIMITED_ALLOWANCE'], auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([null, 42, true, [], {}].map((value) => [value]))('rejects non-string rule entries: %j', async (rule) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'explain', score: 40, context: 'Approve', rules: ['UNLIMITED_ALLOWANCE', rule], auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('ignores unknown rules and forwards all six supported rules with the existing response shape', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    const fetchSpy = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'Check the allowance' } }] }));
    vi.stubGlobal('fetch', fetchSpy);
    const rules = Object.keys(RISK_RULES);
    const res = await handle(post({ op: 'explain', score: 100, context: 'Approve', rules: [...Array(6).fill('NOT_A_REAL_RULE'), ...rules], auth: await signIn(wallet) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ explanation: 'Check the allowance', model: 'deepseek-flash' });
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(sent.messages[1].content).toBe(`Transaction: Approve\nRisk score: 100/100\nFlags: ${rules.join(', ')}`);
  });

  it('rejects an explanation with only unknown rules before calling the model', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await handle(post({ op: 'explain', score: 40, context: 'Approve', rules: ['NOT_A_REAL_RULE'], auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['parse', 'plan', 'explain'].flatMap((op) =>
    [{ unexpected: true }, [], 42, true, false, null].map((content) => ({ op, content }))
  ))('returns 422 for non-string model content in $op: $content', async ({ op, content }) => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content } }] })));
    const res = await handle(post({
      op,
      input: 'Approve',
      scenarioId: 'safe',
      intent: { token: DEMO_USD, spender: PERMIT2, amount: '100' },
      rules: ['UNLIMITED_ALLOWANCE'],
      score: 40,
      context: 'Approve',
      auth: await signIn(wallet),
    }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Model returned non-string content' });
  });

  it('still returns the existing parse response for a string model answer', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    const intent = { actionType: 'APPROVE', token: DEMO_USD, spender: PERMIT2, amount: '100', reasoning: 'Requested approval' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(intent) } }] })));
    const res = await handle(post({ op: 'parse', input: 'Approve', auth: await signIn(wallet) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...intent, model: 'deepseek-flash' });
  });

  it('keeps an empty string model answer as a 502 error', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '' } }] })));
    const res = await handle(post({ op: 'parse', input: 'Approve', auth: await signIn(wallet) }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Model returned an empty answer' });
  });

  it('does not log raw upstream response bodies when model JSON parsing fails', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    const marker = 'RAW_BODY';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(marker)));
    const res = await handle(post({ op: 'parse', input: 'Approve', auth: await signIn(wallet) }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Agent request failed' });
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(marker);
    expect(JSON.stringify(log.mock.calls)).not.toContain('test-key');
  });

  it('caps total calls per instance across addresses', async () => {
    for (let i = 0; i < 300; i++) rateLimit('all', 300, 3_600_000);
    const res = await handle(post({ op: 'parse', input: 'Approve 100 DemoUSD', auth: await signIn(Wallet.createRandom()) }, '9.9.9.9'));
    expect(res.status).toBe(429);
  });

  it('rejects free-form ops', async () => {
    const res = await handle(post({ op: 'chat', input: 'hi', auth: await signIn(wallet) }));
    expect(res.status).toBe(400);
  });
});
