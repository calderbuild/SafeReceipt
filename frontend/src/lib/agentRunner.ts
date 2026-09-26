/**
 * Agent Runner
 *
 * Pure async orchestrator that chains the full SafeReceipt lifecycle:
 * Parse Intent (model) → Risk Analysis → Create Receipt → Plan Tx (model,
 * reads token metadata) → Execute exactly what the model planned → Verify
 * against the receipt → Record the verdict on-chain.
 *
 * No React dependency. Communicates progress via onStepChange callback.
 */

import { ethers } from 'ethers';
import { parseIntent, planApprove } from './agentApi';
import type { ApprovePlan } from './agentApi';
import { evaluateApprove, recordApproval, riskLevel } from './riskEngine';
import { createCanonicalDigest, computeIntentHash, computeProofHash } from './canonicalize';
import { createReceiptRegistryContract, getReadOnlyProvider, IS_MOCK } from './contract';
import { fetchApproveExecution } from './verifyExecution';
import type { ExecutionCheck } from './verifyExecution';
import { saveDigest, addReceiptToUser, updateDigestStatus } from './storage';
import { executeApprove } from './executeIntent';
import { KNOWN_SAFE_CONTRACTS } from './knownContracts';
import type { DemoScenario } from './demoScenarios';
import type { ApproveIntent } from './intentParser';
import type { RiskResult } from './riskEngine';
import type { CanonicalDigest } from './canonicalize';
import { messageOf } from './errors';

// Step definition
export interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
  result?: unknown;
}

// Final result
export interface AgentDemoResult {
  success: boolean;
  receiptId?: string;
  riskScore?: number;
  executionTxHash?: string;
  verified?: boolean;
  mismatchDetail?: string;
  /** What the agent read and decided in the plan step. */
  plan?: ApprovePlan;
  /** The model planned something other than the committed intent. */
  deviated?: boolean;
  error?: string;
  steps: AgentStep[];
}

type OnStepChange = (steps: AgentStep[]) => void;

function createSteps(): AgentStep[] {
  return [
    { id: 'parse', label: 'Model parses your request', status: 'pending' },
    { id: 'risk', label: 'Risk Analysis', status: 'pending' },
    { id: 'receipt', label: 'Creating Receipt', status: 'pending' },
    { id: 'plan', label: 'Model reads token metadata and plans the tx', status: 'pending' },
    { id: 'execute', label: 'Executing Transaction', status: 'pending' },
    { id: 'verify', label: 'Verifying Execution', status: 'pending' },
    { id: 'link', label: 'Recording Verdict', status: 'pending' },
  ];
}

function updateStep(
  steps: AgentStep[],
  id: string,
  update: Partial<AgentStep>,
  onChange: OnStepChange
): AgentStep[] {
  const updated = steps.map(s => (s.id === id ? { ...s, ...update } : s));
  onChange(updated);
  return updated;
}

/**
 * Run the full agent demo lifecycle
 */
export async function runAgentDemo(
  scenario: DemoScenario,
  signer: ethers.JsonRpcSigner,
  address: string,
  onStepChange: OnStepChange
): Promise<AgentDemoResult> {
  let steps = createSteps();
  onStepChange(steps);

  try {
    // --- Step 1: Parse Intent ---
    steps = updateStep(steps, 'parse', { status: 'running' }, onStepChange);

    const parsed = await parseIntent(signer, scenario.input);
    if (parsed.actionType !== 'APPROVE') throw new Error('The model read this as a batch payment, not an approval');
    const intent: ApproveIntent = { token: parsed.token, spender: parsed.spender, amount: parsed.amount };

    steps = updateStep(steps, 'parse', {
      status: 'done',
      detail: `${parsed.model}: token ${shorten(intent.token)}, spender ${shorten(intent.spender)}, amount ${intent.amount}`,
      result: parsed,
    }, onStepChange);

    // --- Step 2: Risk Analysis ---
    steps = updateStep(steps, 'risk', { status: 'running' }, onStepChange);

    const knownContracts = [...KNOWN_SAFE_CONTRACTS];
    const riskResult: RiskResult = evaluateApprove(intent, {
      knownContracts,
      userAddress: address,
    });


    steps = updateStep(steps, 'risk', {
      status: 'done',
      detail: `Score: ${riskResult.riskScore}/100 -- ${riskLevel(riskResult.riskScore)}`,
      result: riskResult,
    }, onStepChange);

    // --- Step 3: Create Receipt ---
    steps = updateStep(steps, 'receipt', { status: 'running' }, onStepChange);

    const normalizedIntent = {
      amount: intent.amount,
      spender: intent.spender.toLowerCase(),
      token: intent.token.toLowerCase(),
    };

    const digest: CanonicalDigest = createCanonicalDigest({
      actionType: 'APPROVE',
      normalizedIntent,
      riskScore: riskResult.riskScore,
      rulesTriggered: riskResult.rulesTriggered,
      liabilityNotice: riskResult.liabilityNotice,
    });

    const intentHash = computeIntentHash(normalizedIntent);
    const proofHash = computeProofHash(digest);

    let receiptId: string;
    let createTxHash: string;

    const isMock = IS_MOCK;
    const provider = signer.provider;
    const contract = createReceiptRegistryContract(provider, signer);

    if (isMock) {
      await sleep(1500);
      receiptId = String(Math.floor(Math.random() * 100000));
      createTxHash = ethers.hexlify(ethers.randomBytes(32));
    } else {
      const result = await contract.createReceipt(1, intentHash, proofHash, riskResult.riskScore);
      receiptId = result.receiptId;
      createTxHash = result.txHash;
    }

    saveDigest(receiptId, digest);
    addReceiptToUser(address, receiptId);
    recordApproval(intent.token, intent.spender, address, intent.amount);

    steps = updateStep(steps, 'receipt', {
      status: 'done',
      detail: `Receipt #${receiptId} created`,
      result: { receiptId, txHash: createTxHash },
    }, onStepChange);

    // --- Step 4: The model plans the tx after reading the token metadata ---
    steps = updateStep(steps, 'plan', { status: 'running' }, onStepChange);
    const plan = await planApprove(signer, scenario.id, intent);
    const deviated =
      plan.call.amount !== intent.amount ||
      plan.call.spender.toLowerCase() !== normalizedIntent.spender ||
      plan.call.token.toLowerCase() !== normalizedIntent.token;
    steps = updateStep(steps, 'plan', {
      status: 'done',
      detail: `Plans amount ${plan.call.amount}${deviated ? ' (differs from the receipt)' : ''}. "${plan.note}"`,
      result: plan,
    }, onStepChange);

    // --- Step 5: Execute exactly what the model planned ---
    steps = updateStep(steps, 'execute', { status: 'running' }, onStepChange);

    const executionTxHash = await executeApprove(signer, plan.call.token, plan.call.spender, plan.call.amount);

    steps = updateStep(steps, 'execute', {
      status: 'done',
      detail: `Tx: ${shorten(executionTxHash)}`,
      result: { txHash: executionTxHash },
    }, onStepChange);

    // --- Step 6: Verify Execution against the declared intent ---
    steps = updateStep(steps, 'verify', { status: 'running' }, onStepChange);

    let check: ExecutionCheck;
    if (isMock) {
      await sleep(1200);
      check = deviated
        ? { isVerified: false, mismatchReasons: [`Planned ${plan.call.amount}, receipt says ${intent.amount}`] }
        : { isVerified: true, mismatchReasons: [] };
    } else {
      const onChain = await contract.getReceipt(receiptId);
      check = await fetchApproveExecution(getReadOnlyProvider(), executionTxHash, normalizedIntent, onChain.actor, onChain.timestamp);
    }
    const verified = check.isVerified;
    const mismatchDetail = verified ? undefined : check.mismatchReasons.join('; ');

    steps = updateStep(steps, 'verify', {
      status: 'done',
      detail: verified ? 'Execution matches declared intent' : mismatchDetail,
      result: check,
    }, onStepChange);

    // --- Step 7: Record the verdict on-chain ---
    steps = updateStep(steps, 'link', { status: 'running' }, onStepChange);
    if (isMock) {
      await sleep(800);
    } else {
      await contract.linkExecution(receiptId, executionTxHash, verified);
    }
    const status = verified ? 'VERIFIED' : 'MISMATCH';
    updateDigestStatus(receiptId, status, executionTxHash);
    steps = updateStep(steps, 'link', { status: 'done', detail: `Receipt #${receiptId} marked ${status} on-chain` }, onStepChange);

    return {
      success: true,
      receiptId,
      riskScore: riskResult.riskScore,
      executionTxHash,
      verified,
      mismatchDetail,
      plan,
      deviated,
      steps,
    };
  } catch (error) {
    // Mark current running step as error
    steps = steps.map(s =>
      s.status === 'running' ? { ...s, status: 'error' as const, detail: messageOf(error) } : s
    );
    onStepChange(steps);

    return {
      success: false,
      error: messageOf(error),
      steps,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shorten(hex: string): string {
  if (hex.length <= 14) return hex;
  return `${hex.slice(0, 8)}...${hex.slice(-6)}`;
}
