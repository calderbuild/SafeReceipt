import { readFileSync } from "node:fs";

// Minimal ABIs for the deployed V2 contracts (BUIDL_QUESTS 2026 build).

export const AGENT_IDENTITY_ABI = [
  "function registerAgent(string agentTokenURI) returns (uint256 agentId)",
  "function nextAgentId() view returns (uint256)",
  "function tokenURI(uint256 agentId) view returns (string)",
  "function ownerOf(uint256 agentId) view returns (address)",
  "function isActive(uint256 agentId) view returns (bool)",
  "function revoked(uint256 agentId) view returns (bool)",
  "function revokeAgent(uint256 agentId)",
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, string tokenURI)",
];

export const ACTION_REGISTRY_ABI = [
  "function createReceipt(uint256 agentId, uint8 actionType, bytes32 intentHash, bytes32 proofHash, uint8 riskScore) returns (uint256 receiptId)",
  "function linkOffChainOutcome(uint256 receiptId, bytes32 outcomeHash, bool verified, string evidenceURI)",
  "function linkExecution(uint256 receiptId, bytes32 txHash, bool verified, string evidenceURI)",
  "function getReceipt(uint256 receiptId) view returns (tuple(address actor, uint256 agentId, uint8 actionType, uint8 riskScore, uint40 timestamp, bytes32 intentHash, bytes32 proofHash, bytes32 outcomeHash, string evidenceURI, uint8 status))",
  "function getAgentReceipts(uint256 agentId) view returns (uint256[])",
  "function getUserReceipts(address user) view returns (uint256[])",
  "function nextReceiptId() view returns (uint256)",
  "event ReceiptCreated(uint256 indexed receiptId, uint256 indexed agentId, uint8 indexed actionType, address actor, bytes32 intentHash, bytes32 proofHash, uint8 riskScore, uint256 timestamp)",
  "event OutcomeLinked(uint256 indexed receiptId, uint256 indexed agentId, uint8 indexed status, bytes32 outcomeHash, string evidenceURI)",
];

// Contract addresses come from deployments.json, written by scripts/deploy-v2.ts.
// Only the network metadata lives here. RPC_URL overrides the public endpoint.
const NETWORKS = {
  monad: { chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", explorer: "https://testnet.monadscan.com" },
  baseSepolia: { chainId: 84532, rpc: "https://base-sepolia-rpc.publicnode.com", explorer: "https://sepolia.basescan.org" },
  localhost: { chainId: 31337, rpc: "http://127.0.0.1:8545", explorer: "(local)" },
};
const deployed = JSON.parse(readFileSync(new URL("./deployments.json", import.meta.url), "utf8"));

export const DEPLOYMENTS = Object.fromEntries(
  Object.entries(NETWORKS).map(([name, net]) => [
    name,
    { ...net, rpc: process.env.RPC_URL || net.rpc, ...deployed[name] },
  ]),
);

// Action types (must match ActionRegistry.sol constants).
export const ACTION_TYPE = {
  ON_CHAIN_APPROVE: 0,
  ON_CHAIN_TRANSFER: 1,
  OFF_CHAIN_ACTION: 2,
};

// Status enum (must match ActionRegistry.sol).
export const STATUS = ["CREATED", "EXECUTED", "VERIFIED", "MISMATCH"];
