/// <reference types="node" />
/**
 * Hosted trace storage for agents that use @safereceipt/client without a
 * place of their own to publish traces.
 *
 *   POST /api/traces                      store the trace of an open receipt
 *   GET  /api/traces/monad/<id>.json      read it back (vercel.json rewrites to ?chain=&file=)
 *
 * A POST is accepted only from the wallet that filed the receipt on Monad's
 * ActionRegistry, only for a receipt filed in the last 24 hours with no
 * outcome linked, only for the trace whose declared intent hashes to the
 * receipt's on-chain intent hash, and only once: a stored trace is referenced
 * by an on-chain hash, so it is never overwritten. Re-sending the same trace
 * returns 200, so a client whose linkOffChainOutcome failed can retry.
 *
 * Self-contained like api/agent.ts: Vercel runs this file as ESM, and relative
 * imports into src/ would need file extensions the Vite code doesn't use.
 */

import { Contract, JsonRpcProvider, ZeroHash, keccak256, toUtf8Bytes, verifyMessage } from 'ethers';
import { BlobNotFoundError, get, head, list, put } from '@vercel/blob';

export const CHAIN_ID = 10143;
const RPC_URL = 'https://testnet-rpc.monad.xyz';
// Mirrors wrapper/deployments.json (monad); tracesServer.test.ts fails if they drift
export const ACTION_REGISTRY = '0x975bD215C549F315A066306B161119cec480c927';
export const MAX_BODY_BYTES = 256 * 1024;
const STATUS_CREATED = 0;
/** Traces are uploaded right after the run; older open receipts are not accepted. */
export const MAX_RECEIPT_AGE_S = 24 * 60 * 60;

// Durable quota, counted from the store itself so it survives cold starts.
// Hobby Blob allows 2,000 advanced operations a month; each upload costs two
// (one list to count, one put), so the monthly cap leaves headroom under 1,000.
export const MONTHLY_UPLOAD_CAP = 900;
export const DAILY_UPLOADS_PER_FILER = 20;

// ---------------------------------------------------------------------------
// Hashing (mirrors wrapper/canonicalize.mjs; tested for parity)

function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortObjectKeys(obj[k])]));
}

const RUNTIME_FIELDS = new Set(['status', 'linkedTxHash', 'outcomeHash']);

/** The trace without the fields that sit outside its hash. This is what gets stored. */
export function stripRuntimeFields(trace: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(trace).filter(([k]) => !RUNTIME_FIELDS.has(k)));
}

export function hashTrace(trace: Record<string, unknown>): string {
  return keccak256(toUtf8Bytes(JSON.stringify(sortObjectKeys(stripRuntimeFields(trace)))));
}

export function hashIntent(intent: unknown): string {
  return keccak256(toUtf8Bytes(JSON.stringify(sortObjectKeys(intent))));
}

/** The exact text the filer signs. Must match wrapper/hosted.mjs traceUploadMessage. */
export function traceUploadMessage(chainId: number, receiptId: number, traceHash: string): string {
  return `SafeReceipt trace upload\nChain: ${chainId}\nReceipt: ${receiptId}\nTrace hash: ${traceHash.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Where a trace lives: bucketed by the month the receipt was filed and by filer,
// so one list() of a month counts both quotas. GET derives the path from chain data.

export interface OnChainReceipt {
  actor: string;
  agentId: number;
  status: number;
  timestamp: number;
  intentHash: string;
  outcomeHash: string;
}

export const monthOf = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 7);
export const monthPrefix = (unix: number) => `traces/monad/${monthOf(unix)}/`;
export const tracePath = (receiptId: number, r: Pick<OnChainReceipt, 'actor' | 'timestamp'>) =>
  `${monthPrefix(r.timestamp)}${r.actor.toLowerCase()}/${receiptId}.json`;

// ---------------------------------------------------------------------------
// Dependencies (injected in tests)

export interface StoredBlob {
  pathname: string;
  uploadedAt: Date;
}

export interface TraceDeps {
  readReceipt(receiptId: number): Promise<OnChainReceipt>;
  listMonth(prefix: string): Promise<StoredBlob[]>;
  exists(path: string): Promise<boolean>;
  /** Throws AlreadyStoredError when the path is taken. */
  store(path: string, body: string): Promise<void>;
  load(path: string): Promise<string | null>;
  now(): number;
}

export class AlreadyStoredError extends Error {}

const RECEIPT_ABI = [
  'function getReceipt(uint256 receiptId) view returns (tuple(address actor, uint256 agentId, uint8 actionType, uint8 riskScore, uint40 timestamp, bytes32 intentHash, bytes32 proofHash, bytes32 outcomeHash, string evidenceURI, uint8 status))',
];

export const liveDeps: TraceDeps = {
  async readReceipt(receiptId) {
    const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
    const r = await new Contract(ACTION_REGISTRY, RECEIPT_ABI, provider).getReceipt(receiptId);
    return {
      actor: r.actor,
      agentId: Number(r.agentId),
      status: Number(r.status),
      timestamp: Number(r.timestamp),
      intentHash: r.intentHash,
      outcomeHash: r.outcomeHash,
    };
  },
  async listMonth(prefix) {
    // One page holds the whole month: the cap is below list()'s 1,000 limit
    const { blobs } = await list({ prefix, limit: 1000 });
    return blobs.map((b) => ({ pathname: b.pathname, uploadedAt: b.uploadedAt }));
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
    try {
      // allowOverwrite defaults to false: a second put of the same path throws
      await put(path, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false });
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) throw new AlreadyStoredError(path);
      throw error;
    }
  },
  async load(path) {
    const result = await get(path, { access: 'private' });
    if (!result || result.statusCode !== 200) return null;
    return new Response(result.stream).text();
  },
  now: () => Date.now(),
};

// ---------------------------------------------------------------------------
// Rate limit

// ponytail: in-memory per function instance, resets on cold start; it only
// slows bursts. The durable caps above are what bound Blob usage.
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
const ZERO_ADDRESS = /^0x0{40}$/i;

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
  const receipt = await deps.readReceipt(id);
  const body = ZERO_ADDRESS.test(receipt.actor) ? null : await deps.load(tracePath(id, receipt));
  if (body === null) throw new HttpError(404, `No hosted trace for receipt #${id}`);
  // Stored once, never overwritten, so the CDN may keep it forever
  return new Response(body, {
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}

/** The stored trace for this path matches the signed hash: a retry, not a conflict. */
async function sameTraceStored(deps: TraceDeps, path: string, traceHash: string): Promise<boolean> {
  const existing = await deps.load(path);
  return existing !== null && hashTrace(JSON.parse(existing)) === traceHash;
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
  const t = stripRuntimeFields(trace as Record<string, unknown>);
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
  if (ZERO_ADDRESS.test(onChain.actor)) throw new HttpError(404, `Receipt #${receiptId} does not exist`);
  if (onChain.actor.toLowerCase() !== signer.toLowerCase()) throw new HttpError(403, 'Only the wallet that filed the receipt can upload its trace');
  // Counted only for signed uploads from a real filer, so junk requests can't use it up
  rateLimit('all', 200, 60 * 60_000, deps.now());

  const path = tracePath(receiptId, onChain);
  if (await deps.exists(path)) {
    if (await sameTraceStored(deps, path, traceHash)) return Response.json({ receiptId, traceHash, stored: 'already' }, { status: 200, headers: CORS });
    throw new HttpError(409, 'A different trace is already stored for this receipt');
  }
  if (onChain.status !== STATUS_CREATED || onChain.outcomeHash !== ZeroHash) throw new HttpError(409, 'This receipt already has an outcome linked');
  if (deps.now() / 1000 - onChain.timestamp > MAX_RECEIPT_AGE_S) throw new HttpError(409, 'Traces are accepted only within 24 hours of filing the receipt');
  if (t.agentId !== onChain.agentId || hashIntent(t.declaredIntent ?? null) !== onChain.intentHash.toLowerCase()) {
    throw new HttpError(422, "trace.declaredIntent and trace.agentId must match the receipt's on-chain commitment");
  }

  const month = await deps.listMonth(monthPrefix(onChain.timestamp));
  if (month.length >= MONTHLY_UPLOAD_CAP) throw new HttpError(429, 'The hosted store is full for this month; publish the trace yourself with a publish() hook');
  const dayAgo = deps.now() - 24 * 60 * 60 * 1000;
  const mine = month.filter((b) => b.pathname.includes(`/${signer.toLowerCase()}/`) && b.uploadedAt.getTime() > dayAgo);
  if (mine.length >= DAILY_UPLOADS_PER_FILER) throw new HttpError(429, `At most ${DAILY_UPLOADS_PER_FILER} hosted traces per wallet per day`);

  try {
    await deps.store(path, JSON.stringify(t, null, 2) + '\n');
  } catch (error) {
    if (!(error instanceof AlreadyStoredError)) throw error;
    // Lost a race with a concurrent upload
    if (await sameTraceStored(deps, path, traceHash)) return Response.json({ receiptId, traceHash, stored: 'already' }, { status: 200, headers: CORS });
    throw new HttpError(409, 'A different trace is already stored for this receipt');
  }
  return Response.json({ receiptId, traceHash, stored: 'new' }, { status: 201, headers: CORS });
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
    rateLimit(`ip:${ip}`, 20, 60 * 60_000, deps.now());
    return await storeTrace(request, deps);
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status, headers: CORS });
    console.error('traces api error', error instanceof Error ? error.message : 'unknown');
    return Response.json({ error: 'Trace request failed' }, { status: 500, headers: CORS });
  }
}

export default { fetch: (request: Request) => handle(request) };
