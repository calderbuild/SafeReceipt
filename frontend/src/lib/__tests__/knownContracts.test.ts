import { describe, it, expect } from 'vitest';
import { KNOWN_SAFE_CONTRACTS, isKnownSafeContract, getContractName, PERMIT2, DEMO_USD } from '../knownContracts';

describe('knownContracts', () => {
  it('stores valid, lowercase, unique addresses', () => {
    for (const a of KNOWN_SAFE_CONTRACTS) expect(a).toMatch(/^0x[0-9a-f]{40}$/);
    expect(new Set(KNOWN_SAFE_CONTRACTS).size).toBe(KNOWN_SAFE_CONTRACTS.length);
  });

  it('matches known addresses case-insensitively', () => {
    expect(isKnownSafeContract(PERMIT2.toUpperCase().replace('0X', '0x'))).toBe(true);
    expect(isKnownSafeContract('0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF')).toBe(false);
  });

  it('names known contracts and passes unknown addresses through', () => {
    expect(getContractName(DEMO_USD)).toBe('SafeReceipt DemoUSD');
    expect(getContractName('0x000000000022D473030F116dDEE9F6B43aC78BA3')).toBe('Permit2');
    const unknown = '0x1234567890123456789012345678901234567890';
    expect(getContractName(unknown)).toBe(unknown);
  });
});
