/**
 * Agent Runner
 *
 * Pure async orchestrator that chains the full SafeReceipt lifecycle:
 * Parse Intent → Risk Analysis → Create Receipt → Execute Tx → Verify
 *
 * No React dependency. Communicates progress via onStepChange callback.
 */

import { ethers } from 'ethers';
import { parseNaturalLanguageIntent, isLLMConfigured } from './llm';
import { evaluateApprove, recordApproval, riskLevel } from './riskEngine';
import { createCanonicalDigest, computeIntentHash, computeProofHash } from './canonicalize';
import { createReceiptRegistryContract, getReadOnlyProvider, CONTRACT_CONFIG } from './contract';
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
  error?: string;
  steps: AgentStep[];
}

type OnStepChange = (steps: AgentStep[]) => void;

function createSteps(): AgentStep[] {
  return [
    { id: 'parse', label: 'Parsing Intent', status: 'pending' },
    { id: 'risk', label: 'Risk Analysis', status: 'pending' },
    { id: 'receipt', label: 'Creating Receipt', status: 'pending' },
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

    let intent: ApproveIntent;

    if (isLLMConfigured()) {
      const parsed = await parseNaturalLanguageIntent(scenario.input);
      if (parsed.success && parsed.intent && parsed.intent.actionType === 'APPROVE') {
        intent = {
          token: parsed.intent.token,
          spender: parsed.intent.spender,
          amount: parsed.intent.amount,
        };
      } else {
        // LLM failed or returned unexpected type, use fallback
        intent = scenario.fallbackIntent;
      }
    } else {
      // No LLM configured, use fallback
      await sleep(1200);
      intent = scenario.fallbackIntent;
    }

    steps = updateStep(steps, 'parse', {
      status: 'done',
      detail: `Token: ${shorten(intent.token)}, Spender: ${shorten(intent.spender)}`,
      result: intent,
    }, onStepChange);

    // --- Step 2: Risk Analysis ---
    steps = updateStep(steps, 'risk', { status: 'running' }, onStepChange);
    await sleep(800);

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

    const isMock = CONTRACT_CONFIG.address === '0x0000000000000000000000000000000000000000';
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

    // --- Step 4: Execute Transaction ---
    // The rogue scenario really sends a different amount than it declared.
    steps = updateStep(steps, 'execute', { status: 'running' }, onStepChange);

    const executionTxHash = await executeApprove(
      signer,
      intent.token,
      intent.spender,
      scenario.executedAmount ?? intent.amount
    );

    steps = updateStep(steps, 'execute', {
      status: 'done',
      detail: `Tx: ${shorten(executionTxHash)}`,
      result: { txHash: executionTxHash },
    }, onStepChange);

    // --- Step 5: Verify Execution against the declared intent ---
    steps = updateStep(steps, 'verify', { status: 'running' }, onStepChange);

    let check: ExecutionCheck;
    if (isMock) {
      await sleep(1200);
      check = scenario.executedAmount
        ? { isVerified: false, mismatchReasons: [`Amount mismatch: declared ${intent.amount}, executed ${scenario.executedAmount}`] }
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

    // --- Step 6: Record the verdict on-chain ---
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
