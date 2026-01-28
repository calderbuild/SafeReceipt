import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

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

const MONAD_TESTNET = {
  chainId: '0x279F', // 10143 in hex
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadscan.com'],
};

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

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && window.ethereum?.isMetaMask;
  }, []);

  // Initialize provider and signer
  const initializeProvider = useCallback(async () => {
    if (!isMetaMaskInstalled() || !window.ethereum) return null;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return { provider, signer };
    } catch (error) {
      console.error('Failed to initialize provider:', error);
      return null;
    }
  }, [isMetaMaskInstalled]);

  // Connect wallet
  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled() || !window.ethereum) {
      setError({
        code: 'METAMASK_NOT_INSTALLED',
        message: 'MetaMask is not installed. Please install MetaMask to continue.',
      });
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true }));
    setError(null);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
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

      // Auto-switch to Monad testnet if not already connected
      if (Number(network.chainId) !== 10143) {
        await switchToMonadTestnet();
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
      }

      setError({ code: errorCode, message: errorMessage });
      setState(prev => ({ ...prev, isConnecting: false }));
    }
  }, [isMetaMaskInstalled, initializeProvider]);

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

  // Switch to Monad testnet
  const switchToMonadTestnet = useCallback(async () => {
    if (!isMetaMaskInstalled() || !window.ethereum) return;

    try {
      // Try to switch to Monad testnet
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MONAD_TESTNET.chainId }],
      });
    } catch (error: any) {
      // If the chain doesn't exist, add it
      if (error.code === 4902 && window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [MONAD_TESTNET],
          });
        } catch (addError) {
          console.error('Failed to add Monad testnet:', addError);
          setError({
            code: 'NETWORK_ADD_FAILED',
            message: 'Failed to add Monad testnet to MetaMask',
          });
        }
      } else {
        console.error('Failed to switch network:', error);
        setError({
          code: 'NETWORK_SWITCH_FAILED',
          message: 'Failed to switch to Monad testnet',
        });
      }
    }
  }, [isMetaMaskInstalled]);

  // Check if connected to correct network
  const isCorrectNetwork = useCallback(() => {
    return state.chainId === 10143;
  }, [state.chainId]);

  // Handle account changes
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== state.address) {
        // Reconnect with new account
        connect();
      }
    };

    const handleChainChanged = (chainId: string) => {
      setState(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));

      // If switched away from Monad testnet, show warning
      if (parseInt(chainId, 16) !== 10143) {
        setError({
          code: 'WRONG_NETWORK',
          message: 'Please switch to Monad testnet to use SafeReceipt',
        });
      } else {
        setError(null);
      }
    };

    const ethereum = window.ethereum;
    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (ethereum) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isMetaMaskInstalled, disconnect, connect, state.address]);

  // Auto-connect on page load if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      if (!isMetaMaskInstalled() || !window.ethereum) return;

      try {
        const accounts = await window.ethereum.request({
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

            // Check if on correct network
            if (Number(network.chainId) !== 10143) {
              setError({
                code: 'WRONG_NETWORK',
                message: 'Please switch to Monad testnet to use SafeReceipt',
              });
            }
          }
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    };

    autoConnect();
  }, [isMetaMaskInstalled, initializeProvider]);

  return {
    // State
    ...state,
    error,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    isCorrectNetwork: isCorrectNetwork(),

    // Actions
    connect,
    disconnect,
    switchToMonadTestnet,
    clearError: () => setError(null),
  };
};

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}
