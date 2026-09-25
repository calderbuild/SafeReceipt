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
];

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

async function fetchMetadata(uri: string): Promise<AgentMetadata | null> {
  try {
    const res = await fetch(uri);
    return res.ok ? ((await res.json()) as AgentMetadata) : null;
  } catch {
    return null;
  }
}

export async function listAgents(): Promise<AgentProfile[]> {
  const { identity } = registries();
  const ids = range(await identity.nextAgentId());
  return Promise.all(
    ids.map(async (id) => {
      const [tokenURI, active] = await Promise.all([
        identity.tokenURI(id) as Promise<string>,
        identity.isActive(id) as Promise<boolean>,
      ]);
      return { id, tokenURI, active, metadata: await fetchMetadata(tokenURI) };
    })
  );
}

/** Newest first. A receipt whose read fails comes back as `{ id, error }` instead of failing the page. */
export async function listReceipts(): Promise<(V2Receipt | { id: number; error: string })[]> {
  const { actions } = registries();
  const ids = range(await actions.nextReceiptId()).reverse();
  const settled = await Promise.allSettled(
    ids.map(async (id): Promise<V2Receipt> => {
      const r = await withRetry(() => actions.getReceipt(id));
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
    })
  );
  return settled.map((s, i) =>
    s.status === 'fulfilled' ? s.value : { id: ids[i], error: s.reason instanceof Error ? s.reason.message : String(s.reason) }
  );
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
