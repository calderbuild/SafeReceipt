/// <reference types="node" />
/**
 * Hosted trace storage for agents that use @safereceipt/client without a
 * place of their own to publish traces.
 *
 *   POST /api/traces                      store the trace of an open receipt
 *   GET  /api/traces/monad/<id>.json      read it back (vercel.json rewrites to ?chain=&file=)
 *
 * A POST is accepted only from the wallet that filed the receipt on Monad's
 * ActionRegistry, only before an outcome is linked, and only once: a stored
 * trace is referenced by an on-chain hash, so it is never overwritten. The
 * signature covers the trace hash, so what gets stored is exactly what the
 * filer signed.
 *
 * Self-contained like api/agent.ts: Vercel runs this file as ESM, and relative
 * imports into src/ would need file extensions the Vite code doesn't use.
 */

import { Contract, JsonRpcProvider, ZeroHash, keccak256, toUtf8Bytes, verifyMessage } from 'ethers';
import { BlobNotFoundError, get, head, put } from '@vercel/blob';

export const CHAIN_ID = 10143;
const RPC_URL = 'https://testnet-rpc.monad.xyz';
// Mirrors wrapper/deployments.json (monad); tracesServer.test.ts fails if they drift
export const ACTION_REGISTRY = '0x975bD215C549F315A066306B161119cec480c927';
export const MAX_BODY_BYTES = 256 * 1024;
const STATUS_CREATED = 0;

// ---------------------------------------------------------------------------
// Hashing (mirrors wrapper/canonicalize.mjs hashTrace; tested for parity)

function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortObjectKeys(obj[k])]));
}

const RUNTIME_FIELDS = new Set(['status', 'linkedTxHash', 'outcomeHash']);

export function hashTrace(trace: Record<string, unknown>): string {
  const stripped = Object.fromEntries(Object.entries(trace).filter(([k]) => !RUNTIME_FIELDS.has(k)));
  return keccak256(toUtf8Bytes(JSON.stringify(sortObjectKeys(stripped))));
}

/** The exact text the filer signs. Must match wrapper/hosted.mjs traceUploadMessage. */
export function traceUploadMessage(chainId: number, receiptId: number, traceHash: string): string {
  return `SafeReceipt trace upload\nChain: ${chainId}\nReceipt: ${receiptId}\nTrace hash: ${traceHash.toLowerCase()}`;
}

export const tracePath = (receiptId: number) => `traces/monad/${receiptId}.json`;

// ---------------------------------------------------------------------------
// Dependencies (injected in tests)

export interface OnChainReceipt {
  actor: string;
  status: number;
  outcomeHash: string;
}

export interface TraceDeps {
  readReceipt(receiptId: number): Promise<OnChainReceipt>;
  exists(path: string): Promise<boolean>;
  store(path: string, body: string): Promise<void>;
  load(path: string): Promise<string | null>;
}

const RECEIPT_ABI = [
  'function getReceipt(uint256 receiptId) view returns (tuple(address actor, uint256 agentId, uint8 actionType, uint8 riskScore, uint40 timestamp, bytes32 intentHash, bytes32 proofHash, bytes32 outcomeHash, string evidenceURI, uint8 status))',
];

export const liveDeps: TraceDeps = {
  async readReceipt(receiptId) {
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
    const r = await new Contract(ACTION_REGISTRY, RECEIPT_ABI, provider).getReceipt(receiptId);
    return { actor: r.actor, status: Number(r.status), outcomeHash: r.outcomeHash };
  },
  async exists(path) {
    try {
      await head(path);
      return true;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false;
      throw error;
    }
  },
  async store(path, body) {
    // allowOverwrite defaults to false: a second put of the same path throws
    await put(path, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false });
  },
  async load(path) {
    const result = await get(path, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream).text();
  },
};

// ---------------------------------------------------------------------------
// Rate limit

// ponytail: in-memory per function instance, resets on cold start. The Blob
// Hobby quota (2,000 uploads a month, then Blob pauses, no charge) is the hard cap.
const hits = new Map<string, number[]>();

function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) throw new HttpError(429, 'Too many uploads, try again later');
  recent.push(now);
  hits.set(key, recent);
}

export function resetRateLimits(): void {
  hits.clear();
}

// ---------------------------------------------------------------------------
// Handler

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

function receiptIdOf(value: unknown): number {
  const n = typeof value === 'string' && /^[0-9]{1,9}$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1) throw new HttpError(400, 'receiptId must be a positive integer');
  return n;
}

async function readTrace(url: URL, deps: TraceDeps): Promise<Response> {
  if (url.searchParams.get('chain') !== 'monad') throw new HttpError(404, 'Only monad traces are hosted');
  const file = url.searchParams.get('file')?.match(/^([0-9]{1,9})\.json$/);
  if (!file) throw new HttpError(404, 'Expected /api/traces/monad/<receiptId>.json');
  const id = receiptIdOf(file[1]);
  const body = await deps.load(tracePath(id));
  if (body === null) throw new HttpError(404, `No hosted trace for receipt #${id}`);
  // Stored once, never overwritten, so the CDN may keep it forever
  return new Response(body, {
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}

async function storeTrace(request: Request, deps: TraceDeps): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Trace is larger than 256 KB');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new HttpError(413, 'Trace is larger than 256 KB');

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
  if (body.chainId !== CHAIN_ID) throw new HttpError(400, `Only chain ${CHAIN_ID} (Monad testnet) is hosted`);
  const receiptId = receiptIdOf(body.receiptId);
  const trace = body.trace;
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) throw new HttpError(400, 'trace must be an object');
  const t = trace as Record<string, unknown>;
  if (t.receiptId !== receiptId || t.chainId !== CHAIN_ID) throw new HttpError(400, 'trace.receiptId and trace.chainId must match the upload');
  if (typeof body.signature !== 'string') throw new HttpError(401, 'signature is required');

  const traceHash = hashTrace(t);
  let signer: string;
  try {
    signer = verifyMessage(traceUploadMessage(CHAIN_ID, receiptId, traceHash), body.signature);
  } catch {
    throw new HttpError(401, 'Invalid signature');
  }

  const onChain = await deps.readReceipt(receiptId);
  if (/^0x0{40}$/i.test(onChain.actor)) throw new HttpError(404, `Receipt #${receiptId} does not exist`);
  if (onChain.actor.toLowerCase() !== signer.toLowerCase()) throw new HttpError(403, 'Only the wallet that filed the receipt can upload its trace');
  if (onChain.status !== STATUS_CREATED || onChain.outcomeHash !== ZeroHash) throw new HttpError(409, 'This receipt already has an outcome linked');

  const path = tracePath(receiptId);
  if (await deps.exists(path)) throw new HttpError(409, 'A trace is already stored for this receipt');
  await deps.store(path, JSON.stringify(trace, null, 2) + '\n');
  return Response.json({ receiptId, traceHash, path }, { status: 201, headers: CORS });
}

export async function handle(request: Request, deps: TraceDeps = liveDeps): Promise<Response> {
  try {
    if (request.method === 'GET') return await readTrace(new URL(request.url), deps);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    // Vercel sets these and overwrites client-supplied values
    const ip = request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
    rateLimit(`ip:${ip}`, 20, 60 * 60_000);
    rateLimit('all', 200, 60 * 60_000);
    return await storeTrace(request, deps);
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status, headers: CORS });
    console.error('traces api error', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Trace request failed' }, { status: 500, headers: CORS });
  }
}

export default { fetch: (request: Request) => handle(request) };
