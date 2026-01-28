import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDigest,
  getDigest,
  deleteDigest,
  addReceiptToUser,
  getUserReceipts,
  removeReceiptFromUser,
  clearUserReceipts,
  exportUserData,
  exportUserDataAsJSON,
  importUserData,
  clearAllData,
  getStorageStats,
} from '../storage';
import type { CanonicalDigest } from '../canonicalize';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    _getStore: () => store, // Helper for testing
  };
})();

// Replace global localStorage with mock
global.localStorage = localStorageMock as any;

describe('Storage', () => {
  const mockDigest: CanonicalDigest = {
    version: '1.0',
    actionType: 'APPROVE',
    chainId: 10143,
    normalizedIntent: { token: '0x1234', spender: '0x5678', amount: '1000' },
    riskScore: 65,
    rulesTriggered: ['UNLIMITED_ALLOWANCE'],
    liabilityNotice: 'User acknowledged: UNLIMITED_ALLOWANCE',
    createdAt: 1704067200,
  };

  const testAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
  const testReceiptId = '1';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveDigest and getDigest', () => {
    it('should save and retrieve digest', () => {
      saveDigest(testReceiptId, mockDigest);
      const retrieved = getDigest(testReceiptId);

      expect(retrieved).toEqual(mockDigest);
    });

    it('should return null for non-existent digest', () => {
      const result = getDigest('999');
      expect(result).toBeNull();
    });

    it('should overwrite existing digest', () => {
      saveDigest(testReceiptId, mockDigest);

      const updatedDigest = { ...mockDigest, riskScore: 80 };
      saveDigest(testReceiptId, updatedDigest);

      const retrieved = getDigest(testReceiptId);
      expect(retrieved?.riskScore).toBe(80);
    });
  });

  describe('deleteDigest', () => {
    it('should delete digest', () => {
      saveDigest(testReceiptId, mockDigest);
      expect(getDigest(testReceiptId)).not.toBeNull();

      deleteDigest(testReceiptId);
      expect(getDigest(testReceiptId)).toBeNull();
    });

    it('should not throw when deleting non-existent digest', () => {
      expect(() => deleteDigest('999')).not.toThrow();
    });
  });

  describe('addReceiptToUser and getUserReceipts', () => {
    it('should add receipt to user', () => {
      addReceiptToUser(testAddress, testReceiptId);
      const receipts = getUserReceipts(testAddress);

      expect(receipts).toEqual([testReceiptId]);
    });

    it('should add multiple receipts', () => {
      addReceiptToUser(testAddress, '1');
      addReceiptToUser(testAddress, '2');
      addReceiptToUser(testAddress, '3');

      const receipts = getUserReceipts(testAddress);
      expect(receipts).toEqual(['1', '2', '3']);
    });

    it('should not add duplicate receipts', () => {
      addReceiptToUser(testAddress, testReceiptId);
      addReceiptToUser(testAddress, testReceiptId);

      const receipts = getUserReceipts(testAddress);
      expect(receipts).toEqual([testReceiptId]);
    });

    it('should return empty array for new user', () => {
      const receipts = getUserReceipts('0xnewuser');
      expect(receipts).toEqual([]);
    });

    it('should be case-insensitive for addresses', () => {
      addReceiptToUser(testAddress.toUpperCase(), '1');
      const receipts = getUserReceipts(testAddress.toLowerCase());
      expect(receipts).toEqual(['1']);
    });
  });

  describe('removeReceiptFromUser', () => {
    it('should remove receipt from user', () => {
      addReceiptToUser(testAddress, '1');
      addReceiptToUser(testAddress, '2');
      addReceiptToUser(testAddress, '3');

      removeReceiptFromUser(testAddress, '2');

      const receipts = getUserReceipts(testAddress);
      expect(receipts).toEqual(['1', '3']);
    });

    it('should not throw when removing non-existent receipt', () => {
      expect(() => removeReceiptFromUser(testAddress, '999')).not.toThrow();
    });
  });

  describe('clearUserReceipts', () => {
    it('should clear all receipts for user', () => {
      addReceiptToUser(testAddress, '1');
      addReceiptToUser(testAddress, '2');

      clearUserReceipts(testAddress);

      const receipts = getUserReceipts(testAddress);
      expect(receipts).toEqual([]);
    });
  });

  describe('exportUserData', () => {
    it('should export all user data', () => {
      saveDigest('1', mockDigest);
      saveDigest('2', { ...mockDigest, riskScore: 80 });
      addReceiptToUser(testAddress, '1');
      addReceiptToUser(testAddress, '2');

      const exported = exportUserData(testAddress);

      expect(exported).toHaveLength(2);
      expect(exported[0].receiptId).toBe('1');
      expect(exported[0].digest).toEqual(mockDigest);
      expect(exported[1].receiptId).toBe('2');
      expect(exported[1].digest.riskScore).toBe(80);
    });

    it('should skip receipts without digests', () => {
      addReceiptToUser(testAddress, '1');
      addReceiptToUser(testAddress, '2');
      saveDigest('1', mockDigest);
      // No digest for '2'

      const exported = exportUserData(testAddress);

      expect(exported).toHaveLength(1);
      expect(exported[0].receiptId).toBe('1');
    });
  });

  describe('exportUserDataAsJSON', () => {
    it('should export as JSON string', () => {
      saveDigest('1', mockDigest);
      addReceiptToUser(testAddress, '1');

      const json = exportUserDataAsJSON(testAddress);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].receiptId).toBe('1');
      expect(parsed[0].digest).toEqual(mockDigest);
    });
  });

  describe('importUserData', () => {
    it('should import user data from JSON', () => {
      const data = [
        { receiptId: '1', digest: mockDigest },
        { receiptId: '2', digest: { ...mockDigest, riskScore: 80 } },
      ];
      const json = JSON.stringify(data);

      const imported = importUserData(testAddress, json);

      expect(imported).toBe(2);
      expect(getDigest('1')).toEqual(mockDigest);
      expect(getDigest('2')?.riskScore).toBe(80);
      expect(getUserReceipts(testAddress)).toEqual(['1', '2']);
    });

    it('should throw on invalid JSON', () => {
      expect(() => importUserData(testAddress, 'invalid json')).toThrow();
    });
  });

  describe('clearAllData', () => {
    it('should clear all SafeReceipt data', () => {
      saveDigest('1', mockDigest);
      saveDigest('2', mockDigest);
      addReceiptToUser(testAddress, '1');
      addReceiptToUser(testAddress, '2');

      clearAllData();

      expect(getDigest('1')).toBeNull();
      expect(getDigest('2')).toBeNull();
      expect(getUserReceipts(testAddress)).toEqual([]);
    });
  });

  describe('getStorageStats', () => {
    it('should return storage statistics', () => {
      saveDigest('1', mockDigest);
      saveDigest('2', mockDigest);
      addReceiptToUser(testAddress, '1');

      const stats = getStorageStats();

      expect(stats.totalDigests).toBe(2);
      expect(stats.totalUsers).toBe(1);
      expect(stats.estimatedSize).toBeGreaterThan(0);
    });

    it('should return zero stats for empty storage', () => {
      const stats = getStorageStats();

      expect(stats.totalDigests).toBe(0);
      expect(stats.totalUsers).toBe(0);
      expect(stats.estimatedSize).toBe(0);
    });
  });
});
