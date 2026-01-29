/**
 * Demo Scenarios
 *
 * Pre-configured scenarios for one-click agent demo.
 * Each scenario includes both natural language input and
 * a hardcoded fallback intent (used when LLM is unavailable).
 */

import type { ApproveIntent } from './intentParser';

export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  input: string;
  actionType: 'APPROVE';
  fallbackIntent: ApproveIntent;
  expectedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'dangerous',
    label: 'Dangerous Approval',
    description: 'Unlimited USDT approval to an unknown contract',
    input: 'Approve unlimited USDT to 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
    actionType: 'APPROVE',
    fallbackIntent: {
      token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      spender: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      amount: '115792089237316195423570985008687907853269984665640564039457584007913129639935', // MaxUint256
    },
    expectedRiskLevel: 'HIGH',
  },
  {
    id: 'safe',
    label: 'Safe Approval',
    description: '100 USDC to Uniswap Router (known contract)',
    input: 'Approve Uniswap to use 100 USDC',
    actionType: 'APPROVE',
    fallbackIntent: {
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      spender: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      amount: '100000000', // 100 USDC (6 decimals)
    },
    expectedRiskLevel: 'LOW',
  },
];
