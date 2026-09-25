import { useSyncExternalStore } from 'react';
import { ethers } from 'ethers';
import { ACTIVE_CHAIN } from '../lib/contract';
import { codeOf } from '../lib/errors';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
}

interface WalletError {
  code: string;
  message: string;
}

// MetaMask wallet_addEthereumChain params derived from ACTIVE_CHAIN
const WALLET_CHAIN_PARAMS = {
  chainId: '0x' + ACTIVE_CHAIN.chainId.toString(16),
  chainName: ACTIVE_CHAIN.name,
  nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
  rpcUrls: [ACTIVE_CHAIN.rpcUrl],
  blockExplorerUrls: [ACTIVE_CHAIN.blockExplorer],
};

// Get usable EVM wallet provider.
// Priority: real MetaMask > any provider from providers array > window.ethereum fallback
function getWalletProvider(): EthereumProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) return null;

  const providers = window.ethereum.providers;
  if (providers?.length) {
    // Prefer real MetaMask (has isMetaMask but NOT isTrustWallet)
    const realMetaMask = providers.find(
      (p) => p.isMetaMask && !p.isTrust && !p.isTrustWallet
    );
    if (realMetaMask) return realMetaMask;
    // Fallback to first provider
    return providers[0];
  }

  // Single provider - use it directly
  return window.ethereum;
}

/*
 * One wallet state for the whole app. Every useWallet() reads the same store,
 * so connecting in the navbar is seen immediately by the demo, the receipt
 * page and the modals. Wallet events are subscribed once.
 */

interface WalletSnapshot extends WalletState {
  error: WalletError | null;
}

const DISCONNECTED: WalletState = {
  address: null,
  isConnected: false,
  isConnecting: false,
  chainId: null,
  provider: null,
  signer: null,
};

let snapshot: WalletSnapshot = { ...DISCONNECTED, error: null };
const listeners = new Set<() => void>();

function update(patch: Partial<WalletSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

const wrongNetwork = (): WalletError => ({
  code: 'WRONG_NETWORK',
  message: `Please switch to ${ACTIVE_CHAIN.name} to use SafeReceipt`,
});

/** Read the wallet's current account and chain; a fresh BrowserProvider each time so a chain switch never leaves a stale one. */
async function loadAccount(wallet: EthereumProvider, method: 'eth_accounts' | 'eth_requestAccounts') {
  const accounts = await wallet.request<string[]>({ method });
  if (accounts.length === 0) {
    update({ ...DISCONNECTED });
    return;
  }
  const provider = new ethers.BrowserProvider(wallet);
  const signer = await provider.getSigner();
  const chainId = Number((await provider.getNetwork()).chainId);
  update({
    address: await signer.getAddress(),
    isConnected: true,
    isConnecting: false,
    chainId,
    provider,
    signer,
    error: chainId === ACTIVE_CHAIN.chainId ? null : wrongNetwork(),
  });
}

async function switchNetwork() {
  const wallet = getWalletProvider();
  if (!wallet) return;
  try {
    await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: WALLET_CHAIN_PARAMS.chainId }] });
  } catch (error) {
    if (codeOf(error) !== 4902) {
      update({ error: { code: 'NETWORK_SWITCH_FAILED', message: `Failed to switch to ${ACTIVE_CHAIN.name}` } });
      return;
    }
    try {
      await wallet.request({ method: 'wallet_addEthereumChain', params: [WALLET_CHAIN_PARAMS] });
    } catch {
      update({ error: { code: 'NETWORK_ADD_FAILED', message: `Failed to add ${ACTIVE_CHAIN.name}` } });
    }
  }
}

function connectErrorOf(error: unknown): WalletError {
  switch (codeOf(error)) {
    case 4001:
      return { code: 'USER_REJECTED', message: 'Connection rejected by user' };
    case -32002:
      return { code: 'REQUEST_PENDING', message: 'Connection request already pending' };
    case -32603:
      return { code: 'NO_ACTIVE_WALLET', message: 'Wallet has no active account. Please unlock or set up your wallet.' };
    default:
      return { code: 'CONNECTION_FAILED', message: 'Failed to connect wallet' };
  }
}

async function connect() {
  const wallet = getWalletProvider();
  if (!wallet) {
    update({ error: { code: 'WALLET_NOT_FOUND', message: 'No EVM wallet found. Please install MetaMask or another wallet.' } });
    return;
  }
  update({ isConnecting: true, error: null });
  try {
    await loadAccount(wallet, 'eth_requestAccounts');
    if (snapshot.isConnected && snapshot.chainId !== ACTIVE_CHAIN.chainId) await switchNetwork();
  } catch (error) {
    console.error('Connection failed:', error);
    update({ isConnecting: false, error: connectErrorOf(error) });
  }
}

// In-app only: the wallet keeps its permission, so a reload reconnects.
function disconnect() {
  update({ ...DISCONNECTED, error: null });
}

let started = false;
function start() {
  if (started) return;
  started = true;
  const wallet = getWalletProvider();
  if (!wallet) return;
  const reload = () =>
    loadAccount(wallet, 'eth_accounts').catch((error) => console.error('Wallet refresh failed:', error));
  wallet.on('accountsChanged', reload);
  wallet.on('chainChanged', reload);
  reload(); // auto-connect if the site already has permission
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

export const useWallet = () => {
  const s = useSyncExternalStore(subscribe, getSnapshot);
  return {
    ...s,
    isMetaMaskInstalled: getWalletProvider() !== null,
    isCorrectNetwork: s.chainId === ACTIVE_CHAIN.chainId,
    connect,
    disconnect,
    switchNetwork,
    clearError: () => update({ error: null }),
  };
};

type EthereumProvider = {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthereumProvider[];
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  on: (event: string, callback: (...args: never[]) => void) => void;
  removeListener: (event: string, callback: (...args: never[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
