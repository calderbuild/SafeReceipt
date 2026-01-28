import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  parseApproveIntent,
  parseBatchPayIntent,
  isValidAddress,
  isValidAmount,
  normalizeAddress,
  createUnlimitedAmount,
  parseHumanAmount,
  formatHumanAmount,
  isUnlimitedAmount,
  type ApproveFormData,
} from '../intentParser';

describe('intentParser', () => {
  describe('isValidAddress', () => {
    it('should validate correct addresses', () => {
      expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
      expect(isValidAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('not an address')).toBe(false);
      expect(isValidAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
    });
  });

  describe('isValidAmount', () => {
    it('should validate correct amounts', () => {
      expect(isValidAmount('0')).toBe(true);
      expect(isValidAmount('1')).toBe(true);
      expect(isValidAmount('1000000000000000000')).toBe(true);
      expect(isValidAmount(ethers.MaxUint256.toString())).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(isValidAmount('')).toBe(false);
      expect(isValidAmount('-1')).toBe(false);
      expect(isValidAmount('abc')).toBe(false);
      expect(isValidAmount('1.5')).toBe(false); // Decimals not allowed in raw amount
    });
  });

  describe('normalizeAddress', () => {
    it('should convert to checksum format', () => {
      const lowercase = '0x1234567890123456789012345678901234567890';
      const normalized = normalizeAddress(lowercase);
      expect(normalized).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should handle already checksummed addresses', () => {
      const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
      const normalized = normalizeAddress(checksummed);
      expect(normalized).toBe(checksummed);
    });

    it('should return original for invalid addresses', () => {
      const invalid = 'not an address';
      expect(normalizeAddress(invalid)).toBe(invalid);
    });
  });

  describe('parseApproveIntent', () => {
    it('should parse valid approve intent', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000000000000000000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.token).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.data?.spender).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.data?.amount).toBe('1000000000000000000');
    });

    it('should normalize addresses to checksum format', () => {
      const formData: ApproveFormData = {
        token: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
        spender: '0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359',
        amount: '1000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(true);
      expect(result.data?.token).not.toBe(formData.token); // Should be checksummed
      expect(result.data?.spender).not.toBe(formData.spender); // Should be checksummed
    });

    it('should reject empty token', () => {
      const formData: ApproveFormData = {
        token: '',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.field === 'token')).toBe(true);
    });

    it('should reject invalid token address', () => {
      const formData: ApproveFormData = {
        token: 'invalid',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '1000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'token')).toBe(true);
    });

    it('should reject empty spender', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '',
        amount: '1000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'spender')).toBe(true);
    });

    it('should reject invalid spender address', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: 'invalid',
        amount: '1000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'spender')).toBe(true);
    });

    it('should reject empty amount', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject invalid amount', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: 'invalid',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject negative amount', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: '-1000',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.field === 'amount')).toBe(true);
    });

    it('should collect multiple errors', () => {
      const formData: ApproveFormData = {
        token: 'invalid',
        spender: 'invalid',
        amount: 'invalid',
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBe(3);
    });

    it('should handle unlimited amount', () => {
      const formData: ApproveFormData = {
        token: '0x1234567890123456789012345678901234567890',
        spender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: ethers.MaxUint256.toString(),
      };

      const result = parseApproveIntent(formData);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(ethers.MaxUint256.toString());
    });
  });

  describe('parseBatchPayIntent', () => {
    it('should parse valid CSV', () => {
      const csv = `0x1111111111111111111111111111111111111111,100
0x2222222222222222222222222222222222222222,200
0x3333333333333333333333333333333333333333,300`;

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(true);
      expect(result.data?.recipients).toHaveLength(3);
      expect(result.data?.recipients[0].amount).toBe('100');
      expect(result.data?.recipients[1].amount).toBe('200');
      expect(result.data?.recipients[2].amount).toBe('300');
    });

    it('should normalize addresses', () => {
      const csv = '0x1111111111111111111111111111111111111111,100';

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(true);
      expect(result.data?.recipients[0].address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should skip empty lines', () => {
      const csv = `0x1111111111111111111111111111111111111111,100

0x2222222222222222222222222222222222222222,200

`;

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(true);
      expect(result.data?.recipients).toHaveLength(2);
    });

    it('should handle whitespace', () => {
      const csv = `  0x1111111111111111111111111111111111111111  ,  100
0x2222222222222222222222222222222222222222,200`;

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(true);
      expect(result.data?.recipients).toHaveLength(2);
      expect(result.data?.recipients[0].amount).toBe('100');
    });

    it('should reject empty CSV', () => {
      const result = parseBatchPayIntent('');

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.message.includes('required'))).toBe(true);
    });

    it('should reject CSV with no valid recipients', () => {
      const csv = '\n\n\n';

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.message.includes('No valid recipients found'))).toBe(true);
    });

    it('should reject invalid address format', () => {
      const csv = 'invalid,100';

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.message.includes('Invalid address'))).toBe(true);
      expect(result.errors?.[0].line).toBe(1);
    });

    it('should reject invalid amount', () => {
      const csv = '0x1111111111111111111111111111111111111111,invalid';

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.message.includes('Invalid amount'))).toBe(true);
    });

    it('should reject wrong format', () => {
      const csv = '0x1111111111111111111111111111111111111111';

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.message.includes('Expected format'))).toBe(true);
    });

    it('should collect errors from multiple lines', () => {
      const csv = `invalid,100
0x1111111111111111111111111111111111111111,invalid
wrong format`;

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBe(3);
      expect(result.errors?.[0].line).toBe(1);
      expect(result.errors?.[1].line).toBe(2);
      expect(result.errors?.[2].line).toBe(3);
    });

    it('should handle large amounts', () => {
      const csv = `0x1111111111111111111111111111111111111111,${ethers.MaxUint256.toString()}`;

      const result = parseBatchPayIntent(csv);

      expect(result.success).toBe(true);
      expect(result.data?.recipients[0].amount).toBe(ethers.MaxUint256.toString());
    });
  });

  describe('Convenience functions', () => {
    describe('createUnlimitedAmount', () => {
      it('should return max uint256', () => {
        const unlimited = createUnlimitedAmount();
        expect(unlimited).toBe(ethers.MaxUint256.toString());
      });
    });

    describe('parseHumanAmount', () => {
      it('should parse human-readable amount', () => {
        const amount = parseHumanAmount('1.5', 18);
        expect(amount).toBe('1500000000000000000');
      });

      it('should handle different decimals', () => {
        const amount = parseHumanAmount('100', 6); // USDC has 6 decimals
        expect(amount).toBe('100000000');
      });

      it('should handle zero', () => {
        const amount = parseHumanAmount('0', 18);
        expect(amount).toBe('0');
      });

      it('should throw on invalid format', () => {
        expect(() => parseHumanAmount('invalid', 18)).toThrow();
      });
    });

    describe('formatHumanAmount', () => {
      it('should format to human-readable', () => {
        const formatted = formatHumanAmount('1500000000000000000', 18);
        expect(formatted).toBe('1.5');
      });

      it('should handle different decimals', () => {
        const formatted = formatHumanAmount('100000000', 6);
        expect(formatted).toBe('100.0');
      });

      it('should handle zero', () => {
        const formatted = formatHumanAmount('0', 18);
        expect(formatted).toBe('0.0');
      });

      it('should throw on invalid amount', () => {
        expect(() => formatHumanAmount('invalid', 18)).toThrow();
      });
    });

    describe('isUnlimitedAmount', () => {
      it('should detect unlimited amount', () => {
        expect(isUnlimitedAmount(ethers.MaxUint256.toString())).toBe(true);
      });

      it('should return false for normal amounts', () => {
        expect(isUnlimitedAmount('1000')).toBe(false);
        expect(isUnlimitedAmount('0')).toBe(false);
      });

      it('should return false for invalid amounts', () => {
        expect(isUnlimitedAmount('invalid')).toBe(false);
      });
    });
  });
});
