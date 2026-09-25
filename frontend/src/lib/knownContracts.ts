/**
 * Known contracts on Monad Testnet (chain 10143).
 *
 * Spenders on this list don't trigger SPENDER_IS_UNKNOWN_CONTRACT. Canonical
 * addresses come from https://docs.monad.xyz/developer-essentials/testnets;
 * each one was checked to have bytecode on Monad testnet. DemoUSD is
 * SafeReceipt's own test token (public mint) used by the agent demo.
 */

export const KNOWN_CONTRACTS = [
  { address: '0x000000000022d473030f116ddee9f6b43ac78ba3', name: 'Permit2' },
  { address: '0xfb8bf4c1cc7a94c73d209a149ea2abea852bc541', name: 'Wrapped MON' },
  { address: '0xca11bde05977b3631167028862be2a173976ca11', name: 'Multicall3' },
  { address: '0x5a3b52260c44cd1ec70c7157131bc15913cd835f', name: 'SafeReceipt DemoUSD' },
] as const;

export const KNOWN_SAFE_CONTRACTS: readonly string[] = KNOWN_CONTRACTS.map((c) => c.address);

export const PERMIT2 = KNOWN_CONTRACTS[0].address;
export const DEMO_USD = KNOWN_CONTRACTS[3].address;

export function isKnownSafeContract(address: string): boolean {
  return KNOWN_SAFE_CONTRACTS.includes(address.toLowerCase());
}

/** Human-readable name for a known contract, or the address itself. */
export function getContractName(address: string): string {
  return KNOWN_CONTRACTS.find((c) => c.address === address.toLowerCase())?.name ?? address;
}
