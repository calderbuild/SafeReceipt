/**
 * Known Safe Contracts Whitelist
 *
 * This file contains a curated list of known safe contract addresses on Monad Testnet.
 * These contracts are considered trusted and won't trigger the SPENDER_IS_UNKNOWN_CONTRACT rule.
 *
 * MVP: Hardcoded list of 10-20 addresses
 * Future: Could be fetched from a registry or updated via governance
 */

/**
 * Known safe contract addresses on Monad Testnet (Chain ID: 10143)
 *
 * Categories:
 * - DEX: Decentralized exchanges (Uniswap, etc.)
 * - Tokens: Major token contracts (USDC, USDT, WETH, etc.)
 * - DeFi: Lending protocols, yield aggregators
 * - Infrastructure: Bridges, oracles
 */
export const KNOWN_SAFE_CONTRACTS: readonly string[] = [
  // DEX Contracts
  '0x1111111111111111111111111111111111111111', // Uniswap V3 Router (placeholder)
  '0x2222222222222222222222222222222222222222', // Uniswap V3 Factory (placeholder)
  '0x3333333333333333333333333333333333333333', // SushiSwap Router (placeholder)

  // Major Token Contracts
  '0x4444444444444444444444444444444444444444', // USDC (placeholder)
  '0x5555555555555555555555555555555555555555', // USDT (placeholder)
  '0x6666666666666666666666666666666666666666', // WETH (placeholder)
  '0x7777777777777777777777777777777777777777', // DAI (placeholder)

  // DeFi Protocols
  '0x8888888888888888888888888888888888888888', // Aave Lending Pool (placeholder)
  '0x9999999999999999999999999999999999999999', // Compound cToken (placeholder)
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // Yearn Vault (placeholder)

  // Infrastructure
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', // Chainlink Oracle (placeholder)
  '0xcccccccccccccccccccccccccccccccccccccccc', // Bridge Contract (placeholder)

  // SafeReceipt Protocol (self-reference)
  '0xdddddddddddddddddddddddddddddddddddddddd', // ReceiptRegistry (placeholder - update after deployment)
];

/**
 * Check if an address is in the known safe contracts list
 * @param address - Contract address to check
 * @returns true if address is known safe
 */
export function isKnownSafeContract(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  return KNOWN_SAFE_CONTRACTS.some(
    contract => contract.toLowerCase() === normalizedAddress
  );
}

/**
 * Get contract category by address
 * @param address - Contract address
 * @returns Category name or 'Unknown'
 */
export function getContractCategory(address: string): string {
  const normalizedAddress = address.toLowerCase();
  const index = KNOWN_SAFE_CONTRACTS.findIndex(
    contract => contract.toLowerCase() === normalizedAddress
  );

  if (index === -1) {
    return 'Unknown';
  }

  // Map index ranges to categories
  if (index >= 0 && index <= 2) return 'DEX';
  if (index >= 3 && index <= 6) return 'Token';
  if (index >= 7 && index <= 9) return 'DeFi Protocol';
  if (index >= 10 && index <= 11) return 'Infrastructure';
  if (index === 12) return 'SafeReceipt Protocol';

  return 'Other';
}

/**
 * Get human-readable name for a known contract
 * @param address - Contract address
 * @returns Contract name or address if unknown
 */
export function getContractName(address: string): string {
  const normalizedAddress = address.toLowerCase();
  const index = KNOWN_SAFE_CONTRACTS.findIndex(
    contract => contract.toLowerCase() === normalizedAddress
  );

  if (index === -1) {
    return address;
  }

  // Map to human-readable names
  const names = [
    'Uniswap V3 Router',
    'Uniswap V3 Factory',
    'SushiSwap Router',
    'USDC',
    'USDT',
    'WETH',
    'DAI',
    'Aave Lending Pool',
    'Compound cToken',
    'Yearn Vault',
    'Chainlink Oracle',
    'Bridge Contract',
    'SafeReceipt Registry',
  ];

  return names[index] || address;
}

/**
 * Add a contract to the runtime whitelist (for testing/development)
 * Note: This modifies a runtime copy, not the const array
 */
let runtimeWhitelist: string[] = [...KNOWN_SAFE_CONTRACTS];

export function addToWhitelist(address: string): void {
  if (!runtimeWhitelist.includes(address.toLowerCase())) {
    runtimeWhitelist.push(address.toLowerCase());
  }
}

export function removeFromWhitelist(address: string): void {
  runtimeWhitelist = runtimeWhitelist.filter(
    addr => addr.toLowerCase() !== address.toLowerCase()
  );
}

export function getRuntimeWhitelist(): readonly string[] {
  return runtimeWhitelist;
}

export function resetWhitelist(): void {
  runtimeWhitelist = [...KNOWN_SAFE_CONTRACTS];
}
