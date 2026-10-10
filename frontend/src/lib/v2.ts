import { ethers } from 'ethers';
import { sortObjectKeys, computeIntentHash } from './canonicalize';
import { NETWORKS } from './contract';
import { evaluateTrace } from './tracePolicy';
import type { OffChainTrace, PolicyVerdict } from './tracePolicy';

// V2.1 (2026-09-25). The V2.0 registries (0x89FF…e133 / 0x8aee…cFA6) are listed in DEPLOYMENTS.md.
export const V2_NETWORK = NETWORKS.monad;
export const V2_ADDRESSES = {
  agentIdentityRegistry: '0x65F4A584E88b7a9831dbC187E75EF7247c47fe6d',
  actionRegistry: '0x975bD215C549F315A066306B161119cec480c927',
} as const;

const AGENT_IDENTITY_ABI = [
  'function nextAgentId() view returns (uint256)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function isActive(uint256 agentId) view returns (bool)',
  'function ownerOf(uint256 agentId) view returns (address)',
];

const ACTION_REGISTRY_ABI = [
  'function nextReceiptId() view returns (uint256)',
  'function getReceipt(uint256 receiptId) view returns (tuple(address actor, uint256 agentId, uint8 actionType, uint8 riskScore, uint40 timestamp, bytes32 intentHash, bytes32 proofHash, bytes32 outcomeHash, string evidenceURI, uint8 status))',
  'function getAgentReceipts(uint256 agentId) view returns (uint256[])',
];

/** The wallet that deployed the registries and runs the fleet's own agents (doc-researcher, code-reviewer, security-scanner). */
export const DEPLOYER = '0x636011edE26fCe9cb675Ac42543d69f3b9CcA9Dc';

/** /fleet reads at most this many of the newest agents and receipts; each one also has its own page. */
export const FLEET_PAGE_LIMIT = 50;

export const V2_STATUS = ['CREATED', 'EXECUTED', 'VERIFIED', 'MISMATCH'] as const;
export type V2Status = (typeof V2_STATUS)[number];

export const V2_ACTION_TYPES = ['ON_CHAIN_APPROVE', 'ON_CHAIN_TRANSFER', 'OFF_CHAIN_ACTION'] as const;

export interface AgentMetadata {
  name?: string;
  role?: string;
  model?: string;
  capabilities?: string[];
  controllerNote?: string;
}

export interface AgentProfile {
  id: number;
  tokenURI: string;
  active: boolean;
  owner: string;
  metadata: AgentMetadata | null;
}

export interface V2Receipt {
  id: number;
  actor: string;
  agentId: number;
  actionType: string;
  riskScore: number;
  timestamp: number;
  intentHash: string;
  proofHash: string;
  outcomeHash: string;
  evidenceURI: string;
  status: V2Status;
}

export interface IndependentVerification {
  trace: Record<string, unknown>;
  recomputedOutcomeHash: string;
  outcomeMatches: boolean;
  recomputedIntentHash: string;
  intentMatches: boolean;
  /** The trace names this receipt and agent (a valid trace copied from another receipt fails here). */
  idsMatch: boolean;
  /** The address that filed the receipt still owns the agent NFT. */
  actorOwnsAgent: boolean;
  /** Policy rules re-run on the trace in this browser, and whether they agree with the recorded status. */
  policy: PolicyVerdict;
  policyAgrees: boolean;
}

export const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

const RUNTIME_FIELDS = ['status', 'linkedTxHash', 'outcomeHash'];

export function hashTrace(trace: Record<string, unknown>): string {
  const stripped = Object.fromEntries(Object.entries(trace).filter(([k]) => !RUNTIME_FIELDS.includes(k)));
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(sortObjectKeys(stripped))));
}

function registries() {
  const provider = new ethers.JsonRpcProvider(V2_NETWORK.rpcUrl, V2_NETWORK.chainId, { staticNetwork: true });
  return {
    identity: new ethers.Contract(V2_ADDRESSES.agentIdentityRegistry, AGENT_IDENTITY_ABI, provider),
    actions: new ethers.Contract(V2_ADDRESSES.actionRegistry, ACTION_REGISTRY_ABI, provider),
  };
}

// The public Monad RPC now and then fails a single eth_call with an empty revert; a short retry clears it.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts) throw error;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

const range = (n: bigint) => Array.from({ length: Number(n) - 1 }, (_, i) => i + 1);
/** Ids 1..next-1, newest first, capped at FLEET_PAGE_LIMIT. */
const newest = (next: bigint) => range(next).reverse().slice(0, FLEET_PAGE_LIMIT);

async function fetchMetadata(uri: string): Promise<AgentMetadata | null> {
  try {
    const res = await fetch(uri);
    return res.ok ? ((await res.json()) as AgentMetadata) : null;
  } catch {
    return null;
  }
}

export async function readAgent(id: number): Promise<AgentProfile> {
  const { identity } = registries();
  const [tokenURI, active, owner] = await Promise.all([
    withRetry(() => identity.tokenURI(id) as Promise<string>),
    withRetry(() => identity.isActive(id) as Promise<boolean>),
    withRetry(() => identity.ownerOf(id) as Promise<string>),
  ]);
  return { id, tokenURI, active, owner, metadata: await fetchMetadata(tokenURI) };
}

/** Newest first, at most FLEET_PAGE_LIMIT. */
export async function listAgents(): Promise<{ agents: AgentProfile[]; total: number }> {
  const { identity } = registries();
  const next = await identity.nextAgentId();
  return { agents: await Promise.all(newest(next).map(readAgent)), total: Number(next) - 1 };
}

export async function readReceipt(id: number): Promise<V2Receipt> {
  const r = await withRetry(() => registries().actions.getReceipt(id));
  if (/^0x0{40}$/i.test(r.actor)) throw new Error(`Receipt #${id} does not exist on ${V2_NETWORK.name}`);
  return {
    id,
    actor: r.actor,
    agentId: Number(r.agentId),
    actionType: V2_ACTION_TYPES[Number(r.actionType)] ?? `TYPE_${r.actionType}`,
    riskScore: Number(r.riskScore),
    timestamp: Number(r.timestamp),
    intentHash: r.intentHash,
    proofHash: r.proofHash,
    outcomeHash: r.outcomeHash,
    evidenceURI: r.evidenceURI,
    status: V2_STATUS[Number(r.status)],
  };
}

type ReceiptOrError = V2Receipt | { id: number; error: string };

/** A receipt whose read fails comes back as `{ id, error }` instead of failing the page. */
async function readMany(ids: number[]): Promise<ReceiptOrError[]> {
  const settled = await Promise.allSettled(ids.map(readReceipt));
  return settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : { id: ids[i], error: s.reason instanceof Error ? s.reason.message : String(s.reason) }
  );
}

/** Newest first, at most FLEET_PAGE_LIMIT. */
export async function listReceipts(): Promise<{ receipts: ReceiptOrError[]; total: number }> {
  const next = await registries().actions.nextReceiptId();
  return { receipts: await readMany(newest(next)), total: Number(next) - 1 };
}

/** One agent's receipts, newest first, at most FLEET_PAGE_LIMIT. */
export async function listAgentReceipts(agentId: number): Promise<{ receipts: ReceiptOrError[]; total: number }> {
  const ids = ((await withRetry(() => registries().actions.getAgentReceipts(agentId))) as bigint[]).map(Number);
  return { receipts: await readMany(ids.reverse().slice(0, FLEET_PAGE_LIMIT)), total: ids.length };
}

export async function verifyIndependently(receipt: V2Receipt): Promise<IndependentVerification> {
  const res = await fetch(receipt.evidenceURI, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not fetch the published trace (HTTP ${res.status})`);
  const trace = (await res.json()) as Record<string, unknown>;
  const owner = (await registries().identity.ownerOf(receipt.agentId)) as string;
  return checkTrace(receipt, trace, owner);
}

/** Every comparison the Verify button makes, given the fetched trace and the agent's current owner. */
export function checkTrace(receipt: V2Receipt, trace: Record<string, unknown>, agentOwner: string): IndependentVerification {
  const recomputedOutcomeHash = hashTrace(trace);
  const recomputedIntentHash = computeIntentHash((trace.declaredIntent ?? {}) as object);
  const policy = evaluateTrace(trace as OffChainTrace);
  return {
    trace,
    recomputedOutcomeHash,
    outcomeMatches: recomputedOutcomeHash.toLowerCase() === receipt.outcomeHash.toLowerCase(),
    recomputedIntentHash,
    intentMatches: recomputedIntentHash.toLowerCase() === receipt.intentHash.toLowerCase(),
    idsMatch: trace.receiptId === receipt.id && trace.agentId === receipt.agentId,
    actorOwnsAgent: agentOwner.toLowerCase() === receipt.actor.toLowerCase(),
    policy,
    policyAgrees: (policy.verified ? 'VERIFIED' : 'MISMATCH') === receipt.status,
  };
}
