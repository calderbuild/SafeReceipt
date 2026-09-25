import { ethers } from 'ethers';
import { sortObjectKeys, computeIntentHash } from './canonicalize';
import { NETWORKS } from './contract';

// V2 is also deployed on Base Sepolia, but no agents are registered there yet.
export const V2_NETWORK = NETWORKS.monad;
export const V2_ADDRESSES = {
  agentIdentityRegistry: '0x89FFce2796909addf5C8E4A924247d2F2715e133',
  actionRegistry: '0x8aeee534f7C954fC1Fcb942c4DA8E58f779fcFA6',
} as const;

const AGENT_IDENTITY_ABI = [
  'function nextAgentId() view returns (uint256)',
  'function tokenURI(uint256 agentId) view returns (string)',
  'function isActive(uint256 agentId) view returns (bool)',
];

const ACTION_REGISTRY_ABI = [
  'function nextReceiptId() view returns (uint256)',
  'function getAgentReceipts(uint256 agentId) view returns (uint256[])',
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
  receiptIds: number[];
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
}

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
  const { identity, actions } = registries();
  const ids = range(await identity.nextAgentId());
  return Promise.all(
    ids.map(async (id) => {
      const [tokenURI, active, receiptIds] = await Promise.all([
        identity.tokenURI(id) as Promise<string>,
        identity.isActive(id) as Promise<boolean>,
        actions.getAgentReceipts(id) as Promise<bigint[]>,
      ]);
      return { id, tokenURI, active, receiptIds: receiptIds.map(Number), metadata: await fetchMetadata(tokenURI) };
    })
  );
}

export async function listReceipts(): Promise<V2Receipt[]> {
  const { actions } = registries();
  const ids = range(await actions.nextReceiptId());
  return Promise.all(
    ids.map(async (id) => {
      const r = await actions.getReceipt(id);
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
}

export async function verifyIndependently(receipt: V2Receipt): Promise<IndependentVerification> {
  const res = await fetch(receipt.evidenceURI, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not fetch the published trace (HTTP ${res.status})`);
  const trace = (await res.json()) as Record<string, unknown>;
  const recomputedOutcomeHash = hashTrace(trace);
  const recomputedIntentHash = computeIntentHash((trace.declaredIntent ?? {}) as object);
  return {
    trace,
    recomputedOutcomeHash,
    outcomeMatches: recomputedOutcomeHash.toLowerCase() === receipt.outcomeHash.toLowerCase(),
    recomputedIntentHash,
    intentMatches: recomputedIntentHash.toLowerCase() === receipt.intentHash.toLowerCase(),
  };
}
