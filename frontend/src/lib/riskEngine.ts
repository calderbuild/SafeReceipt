/**
 * Risk Engine for SafeReceipt
 *
 * Evaluates transaction intents and calculates risk scores based on 6 MVP rules.
 * Each rule has a weight that contributes to the total risk score (0-100).
 */

import { ethers } from 'ethers';
import { generateLiabilityNotice } from './liabilityNotice';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface RuleDetail {
  ruleName: string;
  weight: number;
  triggered: boolean;
  description: string;
  recommendation?: string;
}

export interface RiskResult {
  riskScore: number;           // 0-100
  rulesTriggered: string[];    // ["UNLIMITED_ALLOWANCE", ...]
  ruleDetails: RuleDetail[];   // Detailed info for each rule
  recommendations: string[];   // List of recommendations
  liabilityNotice: string;     // Liability statement
}

export interface ApproveIntent {
  token: string;      // Token contract address
  spender: string;    // Spender contract address
  amount: string;     // Amount as string (supports large numbers)
}

export interface BatchPayRecipient {
  address: string;
  amount: string;
}

// ============================================================================
// Risk Rule Definitions
// ============================================================================

export const RISK_RULES = {
  UNLIMITED_ALLOWANCE: {
    name: 'UNLIMITED_ALLOWANCE',
    weight: 40,
    description: 'Approval amount is unlimited (max uint256)',
    recommendation: 'Consider approving only the exact amount needed',
  },
  SPENDER_IS_UNKNOWN_CONTRACT: {
    name: 'SPENDER_IS_UNKNOWN_CONTRACT',
    weight: 25,
    description: 'Spender contract is not in the known safe contracts list',
    recommendation: 'Verify the contract is legitimate before approving',
  },
  REPEAT_APPROVE_PATTERN: {
    name: 'REPEAT_APPROVE_PATTERN',
    weight: 15,
    description: 'Multiple approvals to same token+spender within 24 hours',
    recommendation: 'Check if previous approval is still active',
  },
  DUPLICATE_RECIPIENTS: {
    name: 'DUPLICATE_RECIPIENTS',
    weight: 10,
    description: 'Batch payment contains duplicate recipient addresses',
    recommendation: 'Review recipient list for duplicates',
  },
  RECIPIENT_IS_CONTRACT: {
    name: 'RECIPIENT_IS_CONTRACT',
    weight: 5,
    description: 'Payment recipient is a contract address',
    recommendation: 'Verify the contract can receive payments',
  },
  OUTLIER_AMOUNT: {
    name: 'OUTLIER_AMOUNT',
    weight: 5,
    description: 'Amount is significantly higher than historical median',
    recommendation: 'Double-check the amount is correct',
  },
} as const;

// ============================================================================
// Rule Evaluation Functions
// ============================================================================

/**
 * Check if amount is unlimited (max uint256)
 */
function checkUnlimitedAllowance(amount: string): boolean {
  try {
    const maxUint256 = ethers.MaxUint256;
    const amountBigInt = BigInt(amount);
    return amountBigInt === maxUint256;
  } catch {
    return false;
  }
}

/**
 * Check if spender is in known contracts whitelist
 */
function checkSpenderIsUnknown(spender: string, knownContracts: string[]): boolean {
  const normalizedSpender = spender.toLowerCase();
  const normalizedKnown = knownContracts.map(addr => addr.toLowerCase());
  return !normalizedKnown.includes(normalizedSpender);
}

/**
 * Check for repeat approve pattern in localStorage
 * Looks for approvals to same token+spender within 24 hours
 */
function checkRepeatApprovePattern(
  token: string,
  spender: string,
  userAddress: string
): boolean {
  try {
    const key = `safereceipt:approvals:${userAddress}`;
    const stored = localStorage.getItem(key);

    if (!stored) {
      return false;
    }

    const approvals = JSON.parse(stored) as Array<{
      token: string;
      spender: string;
      timestamp: number;
    }>;

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Check if there's a recent approval to same token+spender
    const recentApproval = approvals.find(
      approval =>
        approval.token.toLowerCase() === token.toLowerCase() &&
        approval.spender.toLowerCase() === spender.toLowerCase() &&
        approval.timestamp > oneDayAgo
    );

    return !!recentApproval;
  } catch {
    return false;
  }
}

/**
 * Check for duplicate recipients in batch payment
 */
function checkDuplicateRecipients(recipients: BatchPayRecipient[]): boolean {
  const addresses = recipients.map(r => r.address.toLowerCase());
  const uniqueAddresses = new Set(addresses);
  return addresses.length !== uniqueAddresses.size;
}

/**
 * Check if address is a contract (requires provider)
 * For MVP, this is a placeholder that returns false
 * In production, would call provider.getCode(address)
 */
async function checkIsContract(
  address: string,
  provider?: ethers.Provider
): Promise<boolean> {
  if (!provider) {
    return false;
  }

  try {
    const code = await provider.getCode(address);
    // If code length > 2 (more than "0x"), it's a contract
    return code.length > 2;
  } catch {
    return false;
  }
}

/**
 * Check if amount is an outlier compared to historical median
 * For MVP, this is a placeholder that returns false
 * In production, would fetch user's historical transactions
 */
function checkOutlierAmount(
  amount: string,
  historicalMedian?: string
): boolean {
  if (!historicalMedian) {
    return false;
  }

  try {
    const amountBigInt = BigInt(amount);
    const medianBigInt = BigInt(historicalMedian);
    const threshold = medianBigInt * BigInt(10);
    return amountBigInt > threshold;
  } catch {
    return false;
  }
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate total risk score from triggered rules
 * @param triggeredRules - Array of triggered rule names
 * @returns Risk score (0-100)
 */
export function calculateScore(triggeredRules: string[]): number {
  let score = 0;

  for (const ruleName of triggeredRules) {
    const rule = Object.values(RISK_RULES).find(r => r.name === ruleName);
    if (rule) {
      score += rule.weight;
    }
  }

  // Cap at 100
  return Math.min(score, 100);
}

// ============================================================================
// Main Evaluation Functions
// ============================================================================

/**
 * Evaluate an Approve intent
 * @param intent - Approve intent with token, spender, amount
 * @param options - Optional parameters (knownContracts, userAddress)
 * @returns Risk evaluation result
 */
export function evaluateApprove(
  intent: ApproveIntent,
  options?: {
    knownContracts?: string[];
    userAddress?: string;
    historicalMedian?: string;
  }
): RiskResult {
  const knownContracts = options?.knownContracts || [];
  const userAddress = options?.userAddress || '';
  const historicalMedian = options?.historicalMedian;

  const ruleDetails: RuleDetail[] = [];
  const triggeredRules: string[] = [];
  const recommendations: string[] = [];

  // Rule 1: UNLIMITED_ALLOWANCE
  const isUnlimited = checkUnlimitedAllowance(intent.amount);
  ruleDetails.push({
    ruleName: RISK_RULES.UNLIMITED_ALLOWANCE.name,
    weight: RISK_RULES.UNLIMITED_ALLOWANCE.weight,
    triggered: isUnlimited,
    description: RISK_RULES.UNLIMITED_ALLOWANCE.description,
    recommendation: RISK_RULES.UNLIMITED_ALLOWANCE.recommendation,
  });
  if (isUnlimited) {
    triggeredRules.push(RISK_RULES.UNLIMITED_ALLOWANCE.name);
    recommendations.push(RISK_RULES.UNLIMITED_ALLOWANCE.recommendation);
  }

  // Rule 2: SPENDER_IS_UNKNOWN_CONTRACT
  const isUnknown = checkSpenderIsUnknown(intent.spender, knownContracts);
  ruleDetails.push({
    ruleName: RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.name,
    weight: RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.weight,
    triggered: isUnknown,
    description: RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.description,
    recommendation: RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.recommendation,
  });
  if (isUnknown) {
    triggeredRules.push(RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.name);
    recommendations.push(RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.recommendation);
  }

  // Rule 3: REPEAT_APPROVE_PATTERN
  const isRepeat = userAddress
    ? checkRepeatApprovePattern(intent.token, intent.spender, userAddress)
    : false;
  ruleDetails.push({
    ruleName: RISK_RULES.REPEAT_APPROVE_PATTERN.name,
    weight: RISK_RULES.REPEAT_APPROVE_PATTERN.weight,
    triggered: isRepeat,
    description: RISK_RULES.REPEAT_APPROVE_PATTERN.description,
    recommendation: RISK_RULES.REPEAT_APPROVE_PATTERN.recommendation,
  });
  if (isRepeat) {
    triggeredRules.push(RISK_RULES.REPEAT_APPROVE_PATTERN.name);
    recommendations.push(RISK_RULES.REPEAT_APPROVE_PATTERN.recommendation);
  }

  // Rule 6: OUTLIER_AMOUNT
  const isOutlier = checkOutlierAmount(intent.amount, historicalMedian);
  ruleDetails.push({
    ruleName: RISK_RULES.OUTLIER_AMOUNT.name,
    weight: RISK_RULES.OUTLIER_AMOUNT.weight,
    triggered: isOutlier,
    description: RISK_RULES.OUTLIER_AMOUNT.description,
    recommendation: RISK_RULES.OUTLIER_AMOUNT.recommendation,
  });
  if (isOutlier) {
    triggeredRules.push(RISK_RULES.OUTLIER_AMOUNT.name);
    recommendations.push(RISK_RULES.OUTLIER_AMOUNT.recommendation);
  }

  // Calculate score
  const riskScore = calculateScore(triggeredRules);

  // Generate liability notice
  const liabilityNotice = generateLiabilityNotice(triggeredRules);

  return {
    riskScore,
    rulesTriggered: triggeredRules,
    ruleDetails,
    recommendations,
    liabilityNotice,
  };
}

/**
 * Evaluate a BatchPay intent
 * @param recipients - Array of recipient addresses and amounts
 * @param options - Optional parameters (provider, historicalMedian)
 * @returns Risk evaluation result
 */
export async function evaluateBatchPay(
  recipients: BatchPayRecipient[],
  options?: {
    provider?: ethers.Provider;
    historicalMedian?: string;
  }
): Promise<RiskResult> {
  const provider = options?.provider;
  const historicalMedian = options?.historicalMedian;

  const ruleDetails: RuleDetail[] = [];
  const triggeredRules: string[] = [];
  const recommendations: string[] = [];

  // Rule 4: DUPLICATE_RECIPIENTS
  const hasDuplicates = checkDuplicateRecipients(recipients);
  ruleDetails.push({
    ruleName: RISK_RULES.DUPLICATE_RECIPIENTS.name,
    weight: RISK_RULES.DUPLICATE_RECIPIENTS.weight,
    triggered: hasDuplicates,
    description: RISK_RULES.DUPLICATE_RECIPIENTS.description,
    recommendation: RISK_RULES.DUPLICATE_RECIPIENTS.recommendation,
  });
  if (hasDuplicates) {
    triggeredRules.push(RISK_RULES.DUPLICATE_RECIPIENTS.name);
    recommendations.push(RISK_RULES.DUPLICATE_RECIPIENTS.recommendation);
  }

  // Rule 5: RECIPIENT_IS_CONTRACT (check first recipient only for MVP)
  if (recipients.length > 0 && provider) {
    const isContract = await checkIsContract(recipients[0].address, provider);
    ruleDetails.push({
      ruleName: RISK_RULES.RECIPIENT_IS_CONTRACT.name,
      weight: RISK_RULES.RECIPIENT_IS_CONTRACT.weight,
      triggered: isContract,
      description: RISK_RULES.RECIPIENT_IS_CONTRACT.description,
      recommendation: RISK_RULES.RECIPIENT_IS_CONTRACT.recommendation,
    });
    if (isContract) {
      triggeredRules.push(RISK_RULES.RECIPIENT_IS_CONTRACT.name);
      recommendations.push(RISK_RULES.RECIPIENT_IS_CONTRACT.recommendation);
    }
  }

  // Rule 6: OUTLIER_AMOUNT (check total amount)
  if (recipients.length > 0) {
    const totalAmount = recipients.reduce((sum, r) => {
      try {
        return sum + BigInt(r.amount);
      } catch {
        return sum;
      }
    }, BigInt(0));

    const isOutlier = checkOutlierAmount(
      totalAmount.toString(),
      historicalMedian
    );
    ruleDetails.push({
      ruleName: RISK_RULES.OUTLIER_AMOUNT.name,
      weight: RISK_RULES.OUTLIER_AMOUNT.weight,
      triggered: isOutlier,
      description: RISK_RULES.OUTLIER_AMOUNT.description,
      recommendation: RISK_RULES.OUTLIER_AMOUNT.recommendation,
    });
    if (isOutlier) {
      triggeredRules.push(RISK_RULES.OUTLIER_AMOUNT.name);
      recommendations.push(RISK_RULES.OUTLIER_AMOUNT.recommendation);
    }
  }

  // Calculate score
  const riskScore = calculateScore(triggeredRules);

  // Generate liability notice
  const liabilityNotice = generateLiabilityNotice(triggeredRules);

  return {
    riskScore,
    rulesTriggered: triggeredRules,
    ruleDetails,
    recommendations,
    liabilityNotice,
  };
}

/**
 * Record an approval in localStorage for repeat pattern detection
 */
export function recordApproval(
  token: string,
  spender: string,
  userAddress: string
): void {
  try {
    const key = `safereceipt:approvals:${userAddress}`;
    const stored = localStorage.getItem(key);

    const approvals = stored ? JSON.parse(stored) : [];

    // Add new approval
    approvals.push({
      token,
      spender,
      timestamp: Date.now(),
    });

    // Keep only last 30 days of approvals
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filtered = approvals.filter(
      (a: any) => a.timestamp > thirtyDaysAgo
    );

    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to record approval:', error);
  }
}
