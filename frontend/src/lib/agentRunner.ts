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
import { isCancelled, parseIntent, planApprove } from './agentApi';
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
import { t } from './i18n';

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

export interface RunOptions {
  /** Cancels the run between steps; a pending wallet signature is bounded by agentApi's timeout. */
  signal?: AbortSignal;
  /** The first model call asks for a wallet sign-in signature; say so instead of spinning silently. */
  awaitingSignIn?: boolean;
}

function ensureActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

function createSteps(): AgentStep[] {
  return [
    { id: 'parse', label: t('demo.step.parse.label'), status: 'pending' },
    { id: 'risk', label: t('demo.step.risk.label'), status: 'pending' },
    { id: 'receipt', label: t('demo.step.receipt.label'), status: 'pending' },
    { id: 'plan', label: t('demo.step.plan.label'), status: 'pending' },
    { id: 'execute', label: t('demo.step.execute.label'), status: 'pending' },
    { id: 'verify', label: t('demo.step.verify.label'), status: 'pending' },
    { id: 'link', label: t('demo.step.link.label'), status: 'pending' },
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
  onStepChange: OnStepChange,
  options: RunOptions = {}
): Promise<AgentDemoResult> {
  let steps = createSteps();
  onStepChange(steps);

  try {
    // --- Step 1: Parse Intent ---
    steps = updateStep(steps, 'parse', { status: 'running' }, onStepChange);
    if (options.awaitingSignIn) {
      steps = updateStep(
        steps,
        'parse',
        { status: 'running', detail: t('demo.step.parse.waiting') },
        onStepChange,
      );
    }

    const parsed = await parseIntent(signer, scenario.input, options.signal);
    ensureActive(options.signal);
    if (parsed.actionType !== 'APPROVE') throw new Error(t('demo.step.batchError'));
    const intent: ApproveIntent = { token: parsed.token, spender: parsed.spender, amount: parsed.amount };

    steps = updateStep(steps, 'parse', {
      status: 'done',
      detail: t('demo.step.parse.detail', {
        model: parsed.model,
        token: shorten(intent.token),
        spender: shorten(intent.spender),
        amount: intent.amount,
      }),
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
      detail: t('demo.step.risk.detail', { score: riskResult.riskScore, level: riskLevel(riskResult.riskScore) }),
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
    ensureActive(options.signal);

    saveDigest(receiptId, digest);
    addReceiptToUser(address, receiptId);
    recordApproval(intent.token, intent.spender, address, intent.amount);

    steps = updateStep(steps, 'receipt', {
      status: 'done',
      detail: t('demo.step.receipt.detail', { id: receiptId }),
      result: { receiptId, txHash: createTxHash },
    }, onStepChange);

    // --- Step 4: The model plans the tx after reading the token metadata ---
    steps = updateStep(steps, 'plan', { status: 'running' }, onStepChange);
    const plan = await planApprove(signer, scenario.id, intent, options.signal);
    ensureActive(options.signal);
    const deviated =
      plan.call.amount !== intent.amount ||
      plan.call.spender.toLowerCase() !== normalizedIntent.spender ||
      plan.call.token.toLowerCase() !== normalizedIntent.token;
    steps = updateStep(steps, 'plan', {
      status: 'done',
      detail: t('demo.step.plan.detail', {
        amount: plan.call.amount,
        diff: deviated ? t('demo.step.plan.differs') : '',
        note: plan.note,
      }),
      result: plan,
    }, onStepChange);

    // --- Step 5: Execute exactly what the model planned ---
    steps = updateStep(steps, 'execute', { status: 'running', detail: t('demo.step.execute.waiting') }, onStepChange);

    const executionTxHash = await executeApprove(signer, plan.call.token, plan.call.spender, plan.call.amount);
    ensureActive(options.signal);

    steps = updateStep(steps, 'execute', {
      status: 'done',
      detail: t('demo.step.execute.detail', { hash: shorten(executionTxHash) }),
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
      detail: verified ? t('demo.step.verify.match') : mismatchDetail,
      result: check,
    }, onStepChange);

    // --- Step 7: Record the verdict on-chain ---
    ensureActive(options.signal);
    steps = updateStep(steps, 'link', { status: 'running' }, onStepChange);
    if (isMock) {
      await sleep(800);
    } else {
      await contract.linkExecution(receiptId, executionTxHash, verified);
    }
    const status = verified ? 'VERIFIED' : 'MISMATCH';
    updateDigestStatus(receiptId, status, executionTxHash);
    steps = updateStep(steps, 'link', { status: 'done', detail: t('demo.step.link.detail', { id: receiptId, status }) }, onStepChange);

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
    if (options.signal?.aborted || isCancelled(error)) {
      steps = steps.map(s => (s.status === 'running' ? { ...s, status: 'pending' as const, detail: undefined } : s));
      onStepChange(steps);
      return { success: false, error: t('demo.step.cancelled'), steps };
    }

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
