import React, { useState } from 'react';
import { Modal } from './Modal';
import { useVerify } from '../hooks/useVerify';
import { getDigest } from '../lib/storage';
import type { CanonicalDigest } from '../lib/canonicalize';

interface VerifyProofModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VerifyProofModal: React.FC<VerifyProofModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { verifyProof, isVerifying, lastResult, error } = useVerify();

  const [receiptId, setReceiptId] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [localDigest, setLocalDigest] = useState<CanonicalDigest | null>(null);

  const handleVerify = async () => {
    setInputError(null);

    if (!receiptId.trim()) {
      setInputError('Receipt ID is required');
      return;
    }

    // First check if we have the digest locally
    const digest = getDigest(receiptId.trim());
    setLocalDigest(digest);

    if (!digest) {
      setInputError('No local data found for this receipt. Verification requires the original receipt data stored in your browser.');
      return;
    }

    await verifyProof(receiptId.trim());
  };

  const handleClose = () => {
    setReceiptId('');
    setInputError(null);
    setLocalDigest(null);
    onClose();
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const truncateHash = (hash: string, length = 12) => {
    if (hash.length <= length * 2) return hash;
    return `${hash.slice(0, length)}...${hash.slice(-length)}`;
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verify Proof">
      <div className="space-y-6">
        {/* Receipt ID Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Receipt ID</label>
          <div className="flex space-x-3">
            <input
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              placeholder="Enter receipt ID"
              className="input-field font-mono text-sm flex-1"
              disabled={isVerifying}
            />
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="btn-primary px-6"
            >
              {isVerifying ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Verify'
              )}
            </button>
          </div>
          {inputError && (
            <p className="text-crypto-red text-sm mt-2">{inputError}</p>
          )}
        </div>

        {/* Verification Result */}
        {lastResult && !inputError && (
          <div className="space-y-4">
            {/* Status Banner */}
            <div className={`p-4 rounded-xl border ${
              lastResult.isValid
                ? 'bg-crypto-green/10 border-crypto-green/20'
                : 'bg-crypto-red/10 border-crypto-red/20'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  lastResult.isValid ? 'bg-crypto-green/20' : 'bg-crypto-red/20'
                }`}>
                  {lastResult.isValid ? (
                    <svg className="w-5 h-5 text-crypto-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-crypto-red" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-semibold ${lastResult.isValid ? 'text-crypto-green' : 'text-crypto-red'}`}>
                    {lastResult.isValid ? 'Proof Valid' : 'Proof Invalid'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {lastResult.isValid
                      ? 'The on-chain proof matches the local digest'
                      : lastResult.error || 'Hash mismatch detected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Hash Comparison */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">Hash Comparison</p>

              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">On-Chain Proof Hash</p>
                <p className="font-mono text-sm text-white break-all">
                  {lastResult.onChainProofHash || 'N/A'}
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Local Proof Hash</p>
                <p className="font-mono text-sm text-white break-all">
                  {lastResult.localProofHash || 'N/A'}
                </p>
              </div>

              {lastResult.isValid && (
                <div className="flex items-center justify-center space-x-2 text-crypto-green">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm">Hashes match</span>
                </div>
              )}
            </div>

            {/* Digest Details */}
            {lastResult.digest && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-300">Receipt Details</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Version</p>
                    <p className="text-sm text-white">{lastResult.digest.version}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Action Type</p>
                    <p className="text-sm text-white">{lastResult.digest.actionType}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Chain ID</p>
                    <p className="text-sm text-white">{lastResult.digest.chainId}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Risk Score</p>
                    <p className={`text-sm font-bold ${
                      lastResult.digest.riskScore >= 50
                        ? 'text-crypto-red'
                        : lastResult.digest.riskScore >= 25
                        ? 'text-accent'
                        : 'text-crypto-green'
                    }`}>
                      {lastResult.digest.riskScore}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Created At</p>
                  <p className="text-sm text-white">{formatTimestamp(lastResult.digest.createdAt)}</p>
                </div>

                {lastResult.digest.rulesTriggered.length > 0 && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-2">Rules Triggered</p>
                    <div className="flex flex-wrap gap-2">
                      {lastResult.digest.rulesTriggered.map((rule, i) => (
                        <span key={i} className="px-2 py-1 text-xs bg-crypto-red/20 text-crypto-red rounded">
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl">
                  <p className="text-xs text-accent mb-1">Liability Notice</p>
                  <p className="text-sm text-slate-300">{lastResult.digest.liabilityNotice}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && !lastResult?.isValid && lastResult && (
          <div className="p-4 bg-crypto-red/10 border border-crypto-red/20 rounded-xl">
            <p className="text-sm text-crypto-red">{error}</p>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="btn-secondary w-full"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};
