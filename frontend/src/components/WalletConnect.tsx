import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { ACTIVE_CHAIN } from '../lib/contract';

interface WalletConnectProps {
  className?: string;
  compact?: boolean;
}

// Wallet Icon
const WalletIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

// Chevron Down
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export const WalletConnect: React.FC<WalletConnectProps> = ({ className = '', compact = true }) => {
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
    switchNetwork,
    clearError,
  } = useWallet();

  const [showDropdown, setShowDropdown] = React.useState(false);

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Compact navbar version
  if (compact) {
    if (!isMetaMaskInstalled) {
      return (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className={`btn-primary text-sm ${className}`}
        >
          Install MetaMask
        </a>
      );
    }

    if (error) {
      return (
        <div className="flex items-center space-x-2">
          {error.code === 'WRONG_NETWORK' && (
            <button
              onClick={switchNetwork}
              className="px-3 py-2 bg-accent/20 hover:bg-accent/30 text-accent text-sm font-medium rounded-xl border border-accent/30 transition-colors cursor-pointer"
            >
              Switch Network
            </button>
          )}
          <button
            onClick={clearError}
            className="px-3 py-2 bg-crypto-red/20 hover:bg-crypto-red/30 text-crypto-red text-sm font-medium rounded-xl border border-crypto-red/30 transition-colors cursor-pointer"
          >
            {error.message.slice(0, 20)}...
          </button>
        </div>
      );
    }

    if (!isConnected) {
      return (
        <button
          onClick={connect}
          disabled={isConnecting}
          className={`btn-primary text-sm flex items-center space-x-2 ${className}`}
        >
          {isConnecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <WalletIcon />
              <span>Connect</span>
            </>
          )}
        </button>
      );
    }

    // Connected state - dropdown
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 px-3 py-2 bg-crypto-green/10 hover:bg-crypto-green/20 border border-crypto-green/30 rounded-xl transition-colors cursor-pointer"
        >
          <div className="w-2 h-2 bg-crypto-green rounded-full animate-pulse"></div>
          <span className="text-sm font-mono text-white">{truncateAddress(address!)}</span>
          <ChevronDownIcon />
        </button>

        {showDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
            <div className="absolute right-0 top-full mt-2 w-64 glass-card p-4 z-50">
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1">Connected Address</p>
                <p className="text-sm font-mono text-white break-all">{address}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1">Network</p>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-crypto-green' : 'bg-accent'}`}></div>
                  <span className="text-sm text-white">
                    {isCorrectNetwork ? ACTIVE_CHAIN.name : `Chain ${chainId}`}
                  </span>
                </div>
              </div>

              {!isCorrectNetwork && (
                <button
                  onClick={() => { switchNetwork(); setShowDropdown(false); }}
                  className="w-full mb-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Switch Network
                </button>
              )}

              <button
                onClick={() => { disconnect(); setShowDropdown(false); }}
                className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full-size card version (original)
  if (!isMetaMaskInstalled) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-white">
            <WalletIcon />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">MetaMask Required</h3>
            <p className="text-slate-400 text-sm">Install MetaMask to connect your wallet</p>
          </div>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent"
          >
            Install MetaMask
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`glass-card p-6 border-crypto-red/30 ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-crypto-red/20 rounded-xl flex items-center justify-center text-crypto-red">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-crypto-red font-semibold text-lg">Connection Error</h3>
            <p className="text-slate-400 text-sm">{error.message}</p>
          </div>
          <div className="flex space-x-2">
            {error.code === 'WRONG_NETWORK' && (
              <button onClick={switchNetwork} className="btn-primary text-sm">
                Switch Network
              </button>
            )}
            <button onClick={clearError} className="btn-secondary text-sm">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={`glass-card p-6 ${className}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-crypto-blue rounded-xl flex items-center justify-center text-white">
            <WalletIcon />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">Connect Wallet</h3>
            <p className="text-slate-400 text-sm">Connect your MetaMask wallet to start using SafeReceipt</p>
          </div>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="btn-primary flex items-center space-x-2"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <WalletIcon />
                <span>Connect Wallet</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 border-crypto-green/30 ${className}`}>
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-br from-crypto-green to-crypto-cyan rounded-xl flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-crypto-green rounded-full border-2 border-slate-900 animate-pulse"></div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-crypto-green font-semibold text-lg">Connected</h3>
            {!isCorrectNetwork && (
              <span className="badge-warning">Wrong Network</span>
            )}
          </div>
          <div className="flex items-center space-x-4 mt-1">
            <p className="text-white text-sm font-mono">{truncateAddress(address!)}</p>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isCorrectNetwork ? 'bg-crypto-green' : 'bg-accent'}`}></div>
              <span className="text-slate-400 text-xs">
                {isCorrectNetwork ? ACTIVE_CHAIN.name : `Chain ${chainId}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          {!isCorrectNetwork && (
            <button onClick={switchNetwork} className="btn-primary text-sm">
              Switch Network
            </button>
          )}
          <button onClick={disconnect} className="btn-secondary text-sm">
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};
