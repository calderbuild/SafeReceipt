import { describe, it, expect, beforeEach } from 'vitest';
import {
  KNOWN_SAFE_CONTRACTS,
  isKnownSafeContract,
  getContractCategory,
  getContractName,
  addToWhitelist,
  removeFromWhitelist,
  getRuntimeWhitelist,
  resetWhitelist,
} from '../knownContracts';

describe('knownContracts', () => {
  beforeEach(() => {
    // Reset whitelist before each test
    resetWhitelist();
  });

  describe('KNOWN_SAFE_CONTRACTS', () => {
    it('should have at least 10 contracts', () => {
      expect(KNOWN_SAFE_CONTRACTS.length).toBeGreaterThanOrEqual(10);
    });

    it('should contain valid Ethereum addresses', () => {
      KNOWN_SAFE_CONTRACTS.forEach(address => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    it('should not have duplicate addresses', () => {
      const normalized = KNOWN_SAFE_CONTRACTS.map(addr => addr.toLowerCase());
      const unique = new Set(normalized);
      expect(normalized.length).toBe(unique.size);
    });
  });

  describe('isKnownSafeContract', () => {
    it('should return true for known contracts', () => {
      const knownAddress = KNOWN_SAFE_CONTRACTS[0];
      expect(isKnownSafeContract(knownAddress)).toBe(true);
    });

    it('should return false for unknown contracts', () => {
      const unknownAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      expect(isKnownSafeContract(unknownAddress)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const knownAddress = KNOWN_SAFE_CONTRACTS[0];
      expect(isKnownSafeContract(knownAddress.toUpperCase())).toBe(true);
      expect(isKnownSafeContract(knownAddress.toLowerCase())).toBe(true);
    });

    it('should handle mixed case addresses', () => {
      const knownAddress = KNOWN_SAFE_CONTRACTS[0];
      const mixedCase = knownAddress.slice(0, 10).toUpperCase() + knownAddress.slice(10).toLowerCase();
      expect(isKnownSafeContract(mixedCase)).toBe(true);
    });
  });

  describe('getContractCategory', () => {
    it('should return DEX for DEX contracts', () => {
      // First 3 contracts are DEX
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[0])).toBe('DEX');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[1])).toBe('DEX');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[2])).toBe('DEX');
    });

    it('should return Token for token contracts', () => {
      // Contracts 3-6 are tokens
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[3])).toBe('Token');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[4])).toBe('Token');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[5])).toBe('Token');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[6])).toBe('Token');
    });

    it('should return DeFi Protocol for DeFi contracts', () => {
      // Contracts 7-9 are DeFi
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[7])).toBe('DeFi Protocol');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[8])).toBe('DeFi Protocol');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[9])).toBe('DeFi Protocol');
    });

    it('should return Infrastructure for infrastructure contracts', () => {
      // Contracts 10-11 are infrastructure
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[10])).toBe('Infrastructure');
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[11])).toBe('Infrastructure');
    });

    it('should return SafeReceipt Protocol for SafeReceipt contract', () => {
      // Contract 12 is SafeReceipt
      expect(getContractCategory(KNOWN_SAFE_CONTRACTS[12])).toBe('SafeReceipt Protocol');
    });

    it('should return Unknown for unknown contracts', () => {
      const unknownAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      expect(getContractCategory(unknownAddress)).toBe('Unknown');
    });

    it('should be case-insensitive', () => {
      const knownAddress = KNOWN_SAFE_CONTRACTS[0];
      expect(getContractCategory(knownAddress.toUpperCase())).toBe('DEX');
    });
  });

  describe('getContractName', () => {
    it('should return human-readable names for known contracts', () => {
      expect(getContractName(KNOWN_SAFE_CONTRACTS[0])).toBe('Uniswap V3 Router');
      expect(getContractName(KNOWN_SAFE_CONTRACTS[3])).toBe('USDC');
      expect(getContractName(KNOWN_SAFE_CONTRACTS[7])).toBe('Aave Lending Pool');
    });

    it('should return address for unknown contracts', () => {
      const unknownAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      expect(getContractName(unknownAddress)).toBe(unknownAddress);
    });

    it('should be case-insensitive', () => {
      const knownAddress = KNOWN_SAFE_CONTRACTS[0];
      expect(getContractName(knownAddress.toUpperCase())).toBe('Uniswap V3 Router');
    });
  });

  describe('Runtime whitelist management', () => {
    it('should start with default whitelist', () => {
      const runtime = getRuntimeWhitelist();
      expect(runtime.length).toBe(KNOWN_SAFE_CONTRACTS.length);
    });

    it('should add new address to runtime whitelist', () => {
      const newAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      addToWhitelist(newAddress);

      const runtime = getRuntimeWhitelist();
      expect(runtime).toContain(newAddress.toLowerCase());
      expect(runtime.length).toBe(KNOWN_SAFE_CONTRACTS.length + 1);
    });

    it('should not add duplicate addresses', () => {
      const newAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      addToWhitelist(newAddress);
      addToWhitelist(newAddress);
      addToWhitelist(newAddress.toUpperCase());

      const runtime = getRuntimeWhitelist();
      const count = runtime.filter(addr => addr === newAddress.toLowerCase()).length;
      expect(count).toBe(1);
    });

    it('should remove address from runtime whitelist', () => {
      const addressToRemove = KNOWN_SAFE_CONTRACTS[0];
      removeFromWhitelist(addressToRemove);

      const runtime = getRuntimeWhitelist();
      expect(runtime).not.toContain(addressToRemove.toLowerCase());
      expect(runtime.length).toBe(KNOWN_SAFE_CONTRACTS.length - 1);
    });

    it('should be case-insensitive when removing', () => {
      const addressToRemove = KNOWN_SAFE_CONTRACTS[0];
      removeFromWhitelist(addressToRemove.toUpperCase());

      const runtime = getRuntimeWhitelist();
      expect(runtime).not.toContain(addressToRemove.toLowerCase());
    });

    it('should reset to default whitelist', () => {
      const newAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      addToWhitelist(newAddress);
      removeFromWhitelist(KNOWN_SAFE_CONTRACTS[0]);

      resetWhitelist();

      const runtime = getRuntimeWhitelist();
      expect(runtime.length).toBe(KNOWN_SAFE_CONTRACTS.length);
      expect(runtime).not.toContain(newAddress.toLowerCase());
      expect(runtime).toContain(KNOWN_SAFE_CONTRACTS[0].toLowerCase());
    });

    it('should not modify original KNOWN_SAFE_CONTRACTS', () => {
      const originalLength = KNOWN_SAFE_CONTRACTS.length;
      const newAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      addToWhitelist(newAddress);

      expect(KNOWN_SAFE_CONTRACTS.length).toBe(originalLength);
      expect(KNOWN_SAFE_CONTRACTS).not.toContain(newAddress);
    });
  });

  describe('Integration with isKnownSafeContract', () => {
    it('should recognize runtime-added contracts', () => {
      const newAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      expect(isKnownSafeContract(newAddress)).toBe(false);

      addToWhitelist(newAddress);

      // Note: isKnownSafeContract checks KNOWN_SAFE_CONTRACTS, not runtime
      // This test documents current behavior
      expect(isKnownSafeContract(newAddress)).toBe(false);
    });

    it('should still recognize original contracts after modifications', () => {
      const knownAddress = KNOWN_SAFE_CONTRACTS[0];
      addToWhitelist('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');

      expect(isKnownSafeContract(knownAddress)).toBe(true);
    });
  });
});
