import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';
import {
  evaluateApprove,
  evaluateBatchPay,
  calculateScore,
  recordApproval,
  RISK_RULES,
  type ApproveIntent,
  type BatchPayRecipient,
} from '../riskEngine';

describe('riskEngine', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('calculateScore', () => {
    it('should return 0 for no triggered rules', () => {
      expect(calculateScore([])).toBe(0);
    });

    it('should sum weights of triggered rules', () => {
      const rules = ['UNLIMITED_ALLOWANCE', 'SPENDER_IS_UNKNOWN_CONTRACT'];
      const expected = 40 + 25; // 65
      expect(calculateScore(rules)).toBe(expected);
    });

    it('should cap score at 100', () => {
      const allRules = Object.values(RISK_RULES).map(r => r.name);
      const score = calculateScore(allRules);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should ignore unknown rule names', () => {
      const rules = ['UNLIMITED_ALLOWANCE', 'UNKNOWN_RULE'];
      expect(calculateScore(rules)).toBe(40);
    });
  });

  describe('evaluateApprove', () => {
    it('should trigger UNLIMITED_ALLOWANCE for max uint256', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: ethers.MaxUint256.toString(),
      };

      // Include spender in whitelist to isolate UNLIMITED_ALLOWANCE rule
      const knownContracts = ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'];

      const result = evaluateApprove(intent, { knownContracts });

      expect(result.rulesTriggered).toContain('UNLIMITED_ALLOWANCE');
      expect(result.riskScore).toBe(40);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.liabilityNotice).toContain('UNLIMITED_ALLOWANCE');
    });

    it('should not trigger UNLIMITED_ALLOWANCE for normal amount', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000000000000000000', // 1 token
      };

      const result = evaluateApprove(intent);

      expect(result.rulesTriggered).not.toContain('UNLIMITED_ALLOWANCE');
    });

    it('should trigger SPENDER_IS_UNKNOWN_CONTRACT when not in whitelist', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000',
      };

      const knownContracts = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ];

      const result = evaluateApprove(intent, { knownContracts });

      expect(result.rulesTriggered).toContain('SPENDER_IS_UNKNOWN_CONTRACT');
      expect(result.riskScore).toBe(25);
    });

    it('should not trigger SPENDER_IS_UNKNOWN_CONTRACT when in whitelist', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000',
      };

      const knownContracts = [
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', // Same as spender
      ];

      const result = evaluateApprove(intent, { knownContracts });

      expect(result.rulesTriggered).not.toContain('SPENDER_IS_UNKNOWN_CONTRACT');
    });

    it('should handle case-insensitive address matching', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD', // Uppercase
        amount: '1000',
      };

      const knownContracts = [
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', // Lowercase
      ];

      const result = evaluateApprove(intent, { knownContracts });

      expect(result.rulesTriggered).not.toContain('SPENDER_IS_UNKNOWN_CONTRACT');
    });

    it('should trigger REPEAT_APPROVE_PATTERN for recent approval', () => {
      const userAddress = '0x9999999999999999999999999999999999999999';
      const token = '0x1234567890123456789012345678901234567890';
      const spender = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      // Record a recent approval
      recordApproval(token, spender, userAddress);

      const intent: ApproveIntent = {
        token,
        spender,
        amount: '1000',
      };

      const result = evaluateApprove(intent, { userAddress });

      expect(result.rulesTriggered).toContain('REPEAT_APPROVE_PATTERN');
      expect(result.riskScore).toBeGreaterThanOrEqual(15);
    });

    it('should not trigger REPEAT_APPROVE_PATTERN for first approval', () => {
      const userAddress = '0x9999999999999999999999999999999999999999';
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000',
      };

      const result = evaluateApprove(intent, { userAddress });

      expect(result.rulesTriggered).not.toContain('REPEAT_APPROVE_PATTERN');
    });

    it('should trigger OUTLIER_AMOUNT when amount exceeds threshold', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '10000000000000000000000', // 10,000 tokens
      };

      const historicalMedian = '100000000000000000000'; // 100 tokens

      const result = evaluateApprove(intent, { historicalMedian });

      expect(result.rulesTriggered).toContain('OUTLIER_AMOUNT');
      expect(result.riskScore).toBeGreaterThanOrEqual(5);
    });

    it('should not trigger OUTLIER_AMOUNT when amount is normal', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '500000000000000000000', // 500 tokens
      };

      const historicalMedian = '100000000000000000000'; // 100 tokens

      const result = evaluateApprove(intent, { historicalMedian });

      expect(result.rulesTriggered).not.toContain('OUTLIER_AMOUNT');
    });

    it('should trigger multiple rules simultaneously', () => {
      const userAddress = '0x9999999999999999999999999999999999999999';
      const token = '0x1234567890123456789012345678901234567890';
      const spender = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      // Record a recent approval
      recordApproval(token, spender, userAddress);

      const intent: ApproveIntent = {
        token,
        spender,
        amount: ethers.MaxUint256.toString(), // Unlimited
      };

      const result = evaluateApprove(intent, { userAddress });

      // Should trigger both UNLIMITED_ALLOWANCE and REPEAT_APPROVE_PATTERN
      expect(result.rulesTriggered).toContain('UNLIMITED_ALLOWANCE');
      expect(result.rulesTriggered).toContain('REPEAT_APPROVE_PATTERN');
      expect(result.rulesTriggered).toContain('SPENDER_IS_UNKNOWN_CONTRACT');
      expect(result.riskScore).toBe(40 + 15 + 25); // 80
    });

    it('should include all rule details in result', () => {
      const intent: ApproveIntent = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000',
      };

      const result = evaluateApprove(intent);

      // Should have details for all Approve-related rules
      expect(result.ruleDetails.length).toBeGreaterThan(0);
      expect(result.ruleDetails.every(d => d.ruleName)).toBe(true);
      expect(result.ruleDetails.every(d => d.description)).toBe(true);
    });
  });

  describe('evaluateBatchPay', () => {
    it('should trigger DUPLICATE_RECIPIENTS for duplicate addresses', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '100' },
        { address: '0x2222222222222222222222222222222222222222', amount: '200' },
        { address: '0x1111111111111111111111111111111111111111', amount: '300' }, // Duplicate
      ];

      const result = await evaluateBatchPay(recipients);

      expect(result.rulesTriggered).toContain('DUPLICATE_RECIPIENTS');
      expect(result.riskScore).toBe(10);
    });

    it('should not trigger DUPLICATE_RECIPIENTS for unique addresses', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '100' },
        { address: '0x2222222222222222222222222222222222222222', amount: '200' },
        { address: '0x3333333333333333333333333333333333333333', amount: '300' },
      ];

      const result = await evaluateBatchPay(recipients);

      expect(result.rulesTriggered).not.toContain('DUPLICATE_RECIPIENTS');
    });

    it('should handle case-insensitive duplicate detection', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '100' },
        { address: '0x1111111111111111111111111111111111111111'.toUpperCase(), amount: '200' },
      ];

      const result = await evaluateBatchPay(recipients);

      expect(result.rulesTriggered).toContain('DUPLICATE_RECIPIENTS');
    });

    it('should trigger RECIPIENT_IS_CONTRACT when recipient is contract', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '100' },
      ];

      // Mock provider that returns contract code
      const mockProvider = {
        getCode: vi.fn().mockResolvedValue('0x6080604052'), // Contract bytecode
      } as any;

      const result = await evaluateBatchPay(recipients, { provider: mockProvider });

      expect(result.rulesTriggered).toContain('RECIPIENT_IS_CONTRACT');
      expect(result.riskScore).toBeGreaterThanOrEqual(5);
    });

    it('should not trigger RECIPIENT_IS_CONTRACT for EOA', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '100' },
      ];

      // Mock provider that returns no code (EOA)
      const mockProvider = {
        getCode: vi.fn().mockResolvedValue('0x'),
      } as any;

      const result = await evaluateBatchPay(recipients, { provider: mockProvider });

      expect(result.rulesTriggered).not.toContain('RECIPIENT_IS_CONTRACT');
    });

    it('should trigger OUTLIER_AMOUNT for large total', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '5000000000000000000000' },
        { address: '0x2222222222222222222222222222222222222222', amount: '5000000000000000000000' },
      ];

      const historicalMedian = '100000000000000000000'; // 100 tokens

      const result = await evaluateBatchPay(recipients, { historicalMedian });

      expect(result.rulesTriggered).toContain('OUTLIER_AMOUNT');
    });

    it('should handle empty recipients array', async () => {
      const recipients: BatchPayRecipient[] = [];

      const result = await evaluateBatchPay(recipients);

      expect(result.riskScore).toBe(0);
      expect(result.rulesTriggered).toHaveLength(0);
    });

    it('should trigger multiple rules simultaneously', async () => {
      const recipients: BatchPayRecipient[] = [
        { address: '0x1111111111111111111111111111111111111111', amount: '5000000000000000000000' },
        { address: '0x1111111111111111111111111111111111111111', amount: '5000000000000000000000' }, // Duplicate
      ];

      const historicalMedian = '100000000000000000000';

      const result = await evaluateBatchPay(recipients, { historicalMedian });

      // Should trigger both DUPLICATE_RECIPIENTS and OUTLIER_AMOUNT
      expect(result.rulesTriggered).toContain('DUPLICATE_RECIPIENTS');
      expect(result.rulesTriggered).toContain('OUTLIER_AMOUNT');
      expect(result.riskScore).toBe(10 + 5); // 15
    });
  });

  describe('recordApproval', () => {
    it('should store approval in localStorage', () => {
      const userAddress = '0x9999999999999999999999999999999999999999';
      const token = '0x1234567890123456789012345678901234567890';
      const spender = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

      recordApproval(token, spender, userAddress);

      const key = `safereceipt:approvals:${userAddress}`;
      const stored = localStorage.getItem(key);

      expect(stored).toBeTruthy();

      const approvals = JSON.parse(stored!);
      expect(approvals).toHaveLength(1);
      expect(approvals[0].token).toBe(token);
      expect(approvals[0].spender).toBe(spender);
      expect(approvals[0].timestamp).toBeGreaterThan(0);
    });

    it('should append to existing approvals', () => {
      const userAddress = '0x9999999999999999999999999999999999999999';

      recordApproval('0x1111', '0xaaaa', userAddress);
      recordApproval('0x2222', '0xbbbb', userAddress);

      const key = `safereceipt:approvals:${userAddress}`;
      const stored = localStorage.getItem(key);
      const approvals = JSON.parse(stored!);

      expect(approvals).toHaveLength(2);
    });

    it('should filter out approvals older than 30 days', () => {
      const userAddress = '0x9999999999999999999999999999999999999999';
      const key = `safereceipt:approvals:${userAddress}`;

      // Manually add an old approval
      const oldApproval = {
        token: '0x1111',
        spender: '0xaaaa',
        timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
      };

      localStorage.setItem(key, JSON.stringify([oldApproval]));

      // Record a new approval
      recordApproval('0x2222', '0xbbbb', userAddress);

      const stored = localStorage.getItem(key);
      const approvals = JSON.parse(stored!);

      // Old approval should be filtered out
      expect(approvals).toHaveLength(1);
      expect(approvals[0].token).toBe('0x2222');
    });
  });

  describe('RISK_RULES', () => {
    it('should have all 6 MVP rules defined', () => {
      const ruleNames = Object.keys(RISK_RULES);
      expect(ruleNames).toHaveLength(6);
      expect(ruleNames).toContain('UNLIMITED_ALLOWANCE');
      expect(ruleNames).toContain('SPENDER_IS_UNKNOWN_CONTRACT');
      expect(ruleNames).toContain('REPEAT_APPROVE_PATTERN');
      expect(ruleNames).toContain('DUPLICATE_RECIPIENTS');
      expect(ruleNames).toContain('RECIPIENT_IS_CONTRACT');
      expect(ruleNames).toContain('OUTLIER_AMOUNT');
    });

    it('should have correct weights', () => {
      expect(RISK_RULES.UNLIMITED_ALLOWANCE.weight).toBe(40);
      expect(RISK_RULES.SPENDER_IS_UNKNOWN_CONTRACT.weight).toBe(25);
      expect(RISK_RULES.REPEAT_APPROVE_PATTERN.weight).toBe(15);
      expect(RISK_RULES.DUPLICATE_RECIPIENTS.weight).toBe(10);
      expect(RISK_RULES.RECIPIENT_IS_CONTRACT.weight).toBe(5);
      expect(RISK_RULES.OUTLIER_AMOUNT.weight).toBe(5);
    });

    it('should have descriptions and recommendations', () => {
      Object.values(RISK_RULES).forEach(rule => {
        expect(rule.description).toBeTruthy();
        expect(rule.recommendation).toBeTruthy();
      });
    });
  });
});
