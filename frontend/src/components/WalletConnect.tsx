import React from 'react';
import { useWallet } from '../hooks/useWallet';

interface WalletConnectProps {
  className?: string;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ className = '' }) => {
  const {
    address,
    isConnected,
    isConnecting,
    chainId,
    error,
    isMetaMaskInstalled,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToMonadTestnet,
    clearError,
  } = useWallet();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getNetworkName = (id: number | null) => {
    switch (id) {
      case 10143:
        return 'Monad Testnet';
      case 1:
        return 'Ethereum Mainnet';
      case 11155111:
        return 'Sepolia';
      default:
        return 'Unknown Network';
    }
  };

  if (!isMetaMaskInstalled) {
    return (
      <div className={`bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl p-6 border border-purple-500/20 ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">MetaMask Required</h3>
            <p className="text-gray-300 text-sm">Install MetaMask to connect your wallet</p>
          </div>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Install MetaMask
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gradient-to-br from-red-900/50 via-red-800/30 to-red-900/50 rounded-2xl p-6 border border-red-500/30 ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-red-200 font-semibold text-lg">Connection Error</h3>
            <p className="text-red-300 text-sm">{error.message}</p>
          </div>
          <div className="flex space-x-2">
            {error.code === 'WRONG_NETWORK' && (
              <button
                onClick={switchToMonadTestnet}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Switch Network
              </button>
            )}
            <button
              onClick={clearError}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={`bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-2xl p-6 border border-blue-500/20 ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">Connect Wallet</h3>
            <p className="text-gray-300 text-sm">Connect your MetaMask wallet to start using SafeReceipt</p>
          </div>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center space-x-2"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span>Connect Wallet</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-emerald-900/50 via-green-800/30 to-emerald-900/50 rounded-2xl p-6 border border-emerald-500/30 ${className}`}>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-emerald-200 font-semibold text-lg">Connected</h3>
            {!isCorrectNetwork && (
              <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg text-xs font-medium border border-yellow-500/30">
                Wrong Network
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-emerald-300 text-sm font-mono">{truncateAddress(address!)}</p>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                isCorrectNetwork ? 'bg-green-400' : 'bg-yellow-400'
              }`}></div>
              <span className="text-gray-300 text-xs">{getNetworkName(chainId)}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          {!isCorrectNetwork && (
            <button
              onClick={switchToMonadTestnet}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg text-sm"
            >
              Switch to Monad
            </button>
          )}
          <button
            onClick={disconnect}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg text-sm"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};
