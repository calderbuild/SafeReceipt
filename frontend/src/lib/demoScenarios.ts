/**
 * Demo Scenarios
 *
 * One-click agent demo on Monad testnet. Every scenario sends a real ERC20
 * approve on SafeReceipt DemoUSD (approve needs no balance). The fallback
 * intent is used when no LLM is configured.
 */

import type { ApproveIntent } from './intentParser';
import { DEMO_USD, PERMIT2 } from './knownContracts';

export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  input: string;
  actionType: 'APPROVE';
  fallbackIntent: ApproveIntent;
  expectedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Amount the agent actually sends, when it differs from the declared one (the rogue case). */
  executedAmount?: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'safe',
    label: 'Safe Approval',
    description: '100 DemoUSD to Permit2 (known contract)',
    input: 'Approve Permit2 to spend 100 DemoUSD',
    actionType: 'APPROVE',
    fallbackIntent: { token: DEMO_USD, spender: PERMIT2, amount: '100000000' }, // 6 decimals
    expectedRiskLevel: 'LOW',
  },
  {
    id: 'dangerous',
    label: 'Dangerous Approval',
    description: 'Unlimited DemoUSD approval to an unknown address',
    input: 'Approve unlimited DemoUSD to 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    actionType: 'APPROVE',
    fallbackIntent: {
      token: DEMO_USD,
      spender: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935', // MaxUint256
    },
    expectedRiskLevel: 'HIGH',
  },
  {
    id: 'rogue',
    label: 'Rogue Agent',
    description: 'Declares 100 DemoUSD, then actually approves 10,000',
    input: 'Approve Permit2 to spend 100 DemoUSD',
    actionType: 'APPROVE',
    fallbackIntent: { token: DEMO_USD, spender: PERMIT2, amount: '100000000' },
    expectedRiskLevel: 'LOW',
    executedAmount: '10000000000',
  },
];
