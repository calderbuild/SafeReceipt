/**
 * Browser client for /api/agent, the server function that holds the model key.
 *
 * The first call per session asks the wallet for one sign-in signature (no
 * gas). It is kept in memory only and reused until it is close to expiring.
 */

import type { ethers } from 'ethers';
import type { ApproveIntent } from './intentParser';

export const AGENT_ENDPOINT = '/api/agent';
const REUSE_MS = 25 * 60 * 1000; // server accepts 30 min
const SIGN_TIMEOUT_MS = 90_000;
const CALL_TIMEOUT_MS = 60_000;

/** A wallet signature prompt cannot be cancelled; fail with a clear message instead of spinning forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface Auth {
  address: string;
  issuedAt: string;
  signature: string;
}

let session: Auth | null = null;

// Must match signInMessage in api/agent.ts
export function signInMessage(address: string, issuedAt: string): string {
  return `SafeReceipt sign-in\nAddress: ${address.toLowerCase()}\nIssued at: ${issuedAt}\n\nThis lets the SafeReceipt agent use its language model for you. It costs no gas.`;
}

async function auth(signer: ethers.Signer): Promise<Auth> {
  const address = (await signer.getAddress()).toLowerCase();
  const fresh = session && session.address === address && Date.now() - Date.parse(session.issuedAt) < REUSE_MS;
  if (fresh && session) return session;
  const issuedAt = new Date().toISOString();
  const signature = await withTimeout(
    signer.signMessage(signInMessage(address, issuedAt)),
    SIGN_TIMEOUT_MS,
    'Your wallet is still waiting for the sign-in signature. Open MetaMask, approve "SafeReceipt sign-in" (no gas), then run the demo again.',
  );
  session = { address, issuedAt, signature };
  return session;
}

/** True when a sign-in is cached for this address, so the next call won't prompt. */
export function isSignedIn(address: string | null): boolean {
  return !!session && !!address && session.address === address.toLowerCase() && Date.now() - Date.parse(session.issuedAt) < REUSE_MS;
}

async function call<T>(signer: ethers.Signer, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const authBody = await auth(signer);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('The agent API took too long to answer. Try again.', 'TimeoutError')),
    CALL_TIMEOUT_MS,
  );
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(AGENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, auth: authBody }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({ error: `Agent API returned ${res.status}` }));
    if (res.status === 401) session = null;
    if (!res.ok) throw new Error(data.error ?? `Agent API returned ${res.status}`);
    return data as T;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('The agent API took too long to answer. Try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Whether the server has a model configured. Never throws. */
export async function agentAvailable(): Promise<boolean> {
  try {
    const res = await fetch(AGENT_ENDPOINT);
    return res.ok && (await res.json()).available === true;
  } catch {
    return false;
  }
}

export type ParsedIntent =
  | ({ actionType: 'APPROVE'; reasoning: string; model: string } & ApproveIntent)
  | { actionType: 'BATCH_PAY'; recipients: { address: string; amount: string }[]; reasoning: string; model: string };

export function parseIntent(signer: ethers.Signer, input: string, signal?: AbortSignal): Promise<ParsedIntent> {
  return call(signer, { op: 'parse', input }, signal);
}

export interface ApprovePlan {
  call: ApproveIntent;
  note: string;
  metadata: string;
  model: string;
}

/** The agent reads the token metadata for this scenario and decides what to send. */
export function planApprove(signer: ethers.Signer, scenarioId: string, intent: ApproveIntent, signal?: AbortSignal): Promise<ApprovePlan> {
  return call(signer, { op: 'plan', scenarioId, intent }, signal);
}

export async function explainRisks(signer: ethers.Signer, rules: string[], score: number, context: string): Promise<string> {
  return (await call<{ explanation: string }>(signer, { op: 'explain', rules, score, context })).explanation;
}
