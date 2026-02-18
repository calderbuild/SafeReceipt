import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { ACTIVE_CHAIN } from '../lib/contract';

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

  const providers = (window.ethereum as any).providers as EthereumProvider[] | undefined;
  if (providers?.length) {
    // Prefer real MetaMask (has isMetaMask but NOT isTrustWallet)
    const realMetaMask = providers.find(
      (p: any) => p.isMetaMask && !p.isTrust && !p.isTrustWallet
    );
    if (realMetaMask) return realMetaMask;
    // Fallback to first provider
    return providers[0];
  }

  // Single provider - use it directly
  return window.ethereum;
}

export const useWallet = () => {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    provider: null,
    signer: null,
  });

  const [error, setError] = useState<WalletError | null>(null);

  const isWalletAvailable = useCallback(() => {
    return getWalletProvider() !== null;
  }, []);

  // Initialize provider and signer
  const initializeProvider = useCallback(async () => {
    const wallet = getWalletProvider();
    if (!wallet) return null;

    try {
      const provider = new ethers.BrowserProvider(wallet);
      const signer = await provider.getSigner();
      return { provider, signer };
    } catch (error) {
      console.error('Failed to initialize provider:', error);
      return null;
    }
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    const wallet = getWalletProvider();
    if (!wallet) {
      setError({
        code: 'WALLET_NOT_FOUND',
        message: 'No EVM wallet found. Please install MetaMask or another wallet.',
      });
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true }));
    setError(null);

    try {
      const accounts = await wallet.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const providerData = await initializeProvider();
      if (!providerData) {
        throw new Error('Failed to initialize provider');
      }

      const { provider, signer } = providerData;
      const network = await provider.getNetwork();
      const address = await signer.getAddress();

      setState({
        address,
        isConnected: true,
        isConnecting: false,
        chainId: Number(network.chainId),
        provider,
        signer,
      });

      // Auto-switch to correct network if not already connected
      if (Number(network.chainId) !== ACTIVE_CHAIN.chainId) {
        try {
          await switchNetwork();
        } catch {
          setError({
            code: 'WRONG_NETWORK',
            message: `Please switch to ${ACTIVE_CHAIN.name} to use SafeReceipt`,
          });
        }
      }
    } catch (error: any) {
      console.error('Connection failed:', error);

      let errorMessage = 'Failed to connect wallet';
      let errorCode = 'CONNECTION_FAILED';

      if (error.code === 4001) {
        errorMessage = 'Connection rejected by user';
        errorCode = 'USER_REJECTED';
      } else if (error.code === -32002) {
        errorMessage = 'Connection request already pending';
        errorCode = 'REQUEST_PENDING';
      } else if (error.code === -32603) {
        errorMessage = 'Wallet has no active account. Please unlock or set up your wallet.';
        errorCode = 'NO_ACTIVE_WALLET';
      }

      setError({ code: errorCode, message: errorMessage });
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  }, [initializeProvider]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      chainId: null,
      provider: null,
      signer: null,
    });
    setError(null);
  }, []);

  // Switch to the active network
  const switchNetwork = useCallback(async () => {
    const wallet = getWalletProvider();
    if (!wallet) return;

    try {
      await wallet.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: WALLET_CHAIN_PARAMS.chainId }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await wallet.request({
            method: 'wallet_addEthereumChain',
            params: [WALLET_CHAIN_PARAMS],
          });
        } catch (addError) {
          console.error(`Failed to add ${ACTIVE_CHAIN.name}:`, addError);
          setError({
            code: 'NETWORK_ADD_FAILED',
            message: `Failed to add ${ACTIVE_CHAIN.name}`,
          });
        }
      } else {
        console.error('Failed to switch network:', error);
        setError({
          code: 'NETWORK_SWITCH_FAILED',
          message: `Failed to switch to ${ACTIVE_CHAIN.name}`,
        });
      }
    }
  }, []);

  // Check if connected to correct network
  const isCorrectNetwork = useCallback(() => {
    return state.chainId === ACTIVE_CHAIN.chainId;
  }, [state.chainId]);

  // Handle account changes
  useEffect(() => {
    const wallet = getWalletProvider();
    if (!wallet) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== state.address) {
        connect();
      }
    };

    const handleChainChanged = (chainId: string) => {
      setState(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));

      if (parseInt(chainId, 16) !== ACTIVE_CHAIN.chainId) {
        setError({
          code: 'WRONG_NETWORK',
          message: `Please switch to ${ACTIVE_CHAIN.name} to use SafeReceipt`,
        });
      } else {
        setError(null);
      }
    };

    wallet.on('accountsChanged', handleAccountsChanged);
    wallet.on('chainChanged', handleChainChanged);

    return () => {
      wallet.removeListener('accountsChanged', handleAccountsChanged);
      wallet.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect, connect, state.address]);

  // Auto-connect on page load if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      const wallet = getWalletProvider();
      if (!wallet) return;

      try {
        const accounts = await wallet.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          const providerData = await initializeProvider();
          if (providerData) {
            const { provider, signer } = providerData;
            const network = await provider.getNetwork();
            const address = await signer.getAddress();

            setState({
              address,
              isConnected: true,
              isConnecting: false,
              chainId: Number(network.chainId),
              provider,
              signer,
            });

            if (Number(network.chainId) !== ACTIVE_CHAIN.chainId) {
              setError({
                code: 'WRONG_NETWORK',
                message: `Please switch to ${ACTIVE_CHAIN.name} to use SafeReceipt`,
              });
            }
          }
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    };

    autoConnect();
  }, [initializeProvider]);

  return {
    ...state,
    error,
    isMetaMaskInstalled: isWalletAvailable(),
    isCorrectNetwork: isCorrectNetwork(),
    connect,
    disconnect,
    switchNetwork,
    clearError: () => setError(null),
  };
};

type EthereumProvider = {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  removeListener: (event: string, callback: (...args: any[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
