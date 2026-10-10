import type { ContractRunner, Signer } from "ethers";

export type NetworkName = "monad" | "baseSepolia" | "bohr" | "localhost";

export interface NetworkDeployment {
  chainId: number;
  rpc: string;
  explorer: string;
  agentIdentityRegistry?: string;
  actionRegistry?: string;
  demoUSD?: string;
  version?: string;
  deployedAt?: string;
}

export declare const DEPLOYMENTS: Record<NetworkName, NetworkDeployment>;
export declare const ACTION_TYPE: { ON_CHAIN_APPROVE: 0; ON_CHAIN_TRANSFER: 1; OFF_CHAIN_ACTION: 2 };
export declare const STATUS: ["CREATED", "EXECUTED", "VERIFIED", "MISMATCH"];
export declare const ACTION_REGISTRY_ABI: string[];
export declare const AGENT_IDENTITY_ABI: string[];

/** What the agent says it will do. `declaredScope` prefixes drive the SCOPE_CREEP rule. */
export interface DeclaredIntent {
  goal?: string;
  declaredScope?: string[];
  budgetMs?: number;
  [key: string]: unknown;
}

export interface PipelineEvent {
  stage: string;
  message: string;
  progress: number;
  /** `touched` (string or string[]) lists resources the step used; `error: true` marks a failure. */
  data: Record<string, unknown> | null;
  timestamp: number;
}

export interface PolicyFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  detail?: Record<string, unknown>;
}

export interface PolicyResult {
  score: number;
  verified: boolean;
  rulesTriggered: string[];
  findings: PolicyFinding[];
  riskLevel: "low" | "medium" | "high";
}

export interface Trace {
  version: string;
  schema: string;
  receiptId: number | null;
  agentId: number | null;
  actionType: "OFF_CHAIN_ACTION";
  chainId: number;
  declaredIntent: DeclaredIntent | null;
  events: PipelineEvent[];
  durationMs: number;
  policy: PolicyResult | null;
  createdAt: number;
}

/** Must make the trace readable at `${evidenceBaseURL}/${receiptId}.json` before it resolves. */
export type PublishHook = (trace: Trace, receiptId: number) => Promise<void>;

export interface ClientOptions {
  network?: NetworkName;
  /** A signer that owns the agent identity. */
  signer: ContractRunner;
  /**
   * Public base URL the traces are published under; written on-chain. Leave it
   * out on monad to use SafeReceipt's hosted store, and `publish` becomes optional.
   */
  evidenceBaseURL?: string;
}

export declare class AccountabilityClient {
  constructor(options: ClientOptions);
  readonly cfg: NetworkDeployment;
  receiptId: number | null;
  events: PipelineEvent[];
  emit(stage: string, message: string, progress?: number, data?: Record<string, unknown> | null): void;
  beginAction(args: { agentId: number | bigint; declaredIntent: DeclaredIntent; riskScore?: number }): Promise<{
    receiptId: number;
    intentHash: string;
    txHash: string;
  }>;
  buildTrace(policyResult: PolicyResult | null): Trace;
  endAction(args: { policyResult: PolicyResult; publish?: PublishHook }): Promise<{
    trace: Trace;
    outcomeHash: string;
    evidenceURI: string;
    verified: boolean;
    status: (typeof STATUS)[number];
    txHash: string;
  }>;
}

export declare function evaluatePolicy(trace: Partial<Trace>): PolicyResult;
export declare function sortObjectKeys<T>(obj: T): T;
export declare function canonicalize(trace: Record<string, unknown>): string;
export declare function hashTrace(trace: Record<string, unknown>): string;
export declare function hashIntent(intent: DeclaredIntent): string;

/** Re-fetch the published trace, re-hash it and compare with the outcome hash on-chain. */
export declare function verifyAgainstChain(
  client: AccountabilityClient,
  receiptId: number,
  evidenceURI: string,
): Promise<boolean>;

/** SafeReceipt's site origin. `SAFERECEIPT_SITE_URL` overrides it (a preview or a dev server). */
export declare const SITE_URL: string;

/** Base URL of SafeReceipt's hosted trace store per network (monad only). */
export declare const HOSTED_TRACES: { monad: string };

/** The text the filer signs to upload a trace: chain id, receipt id and trace hash. */
export declare function traceUploadMessage(chainId: number, receiptId: number, traceHash: string): string;

/** publish() hook that uploads the trace to the hosted store, signed by the wallet that filed the receipt. */
export declare function hostedPublisher(signer: Signer, options?: { network?: "monad" }): PublishHook;

export interface AgentMetadata {
  name: string;
  role?: string;
  model?: string;
  [key: string]: unknown;
}

/** Agent metadata as a data: URI, so registering needs no hosting. */
export declare function metadataURI(metadata: AgentMetadata): string;

/** Register an agent identity owned by `signer`: inline metadata, or a tokenURI you host. */
export declare function registerAgent(
  signer: Signer,
  metadata: AgentMetadata | string,
  options?: { network?: NetworkName },
): Promise<{ agentId: number; txHash: string }>;

/** The shareable page of a Monad receipt, e.g. https://safereceipt.vercel.app/fleet/receipt/5 */
export declare function receiptURL(receiptId: number): string;
