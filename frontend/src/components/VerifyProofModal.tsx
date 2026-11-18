import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { useVerify } from '../hooks/useVerify';
import { getDigest, getUserReceipts } from '../lib/storage';
import { useWallet } from '../hooks/useWallet';
import { riskLevel } from '../lib/riskEngine';
import { localeOf, useLang, useT } from '../lib/i18n';

interface VerifyProofModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VerifyProofModal: React.FC<VerifyProofModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { verifyProof, isVerifying, lastResult, error } = useVerify();
  const { address, isConnected } = useWallet();
  const t = useT();
  const lang = useLang();

  const [receiptId, setReceiptId] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const userReceipts = useMemo(
    () => (isOpen && isConnected && address ? getUserReceipts(address) : []),
    [isOpen, isConnected, address]
  );

  const handleVerify = async () => {
    setInputError(null);

    if (!receiptId.trim()) {
      setInputError(t('verify.required'));
      return;
    }

    // First check if we have the digest locally
    const digest = getDigest(receiptId.trim());

    if (!digest) {
      setInputError(t('verify.notLocal'));
      return;
    }

    await verifyProof(receiptId.trim());
  };

  const handleClose = () => {
    setReceiptId('');
    setInputError(null);
    onClose();
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString(localeOf(lang));
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('verify.title')}>
      <div className="space-y-6">
        {/* Receipt ID Input */}
        <div>
          <label htmlFor="vp-receipt-id" className="block text-sm font-medium text-slate-300 mb-2">{t('verify.receiptId')}</label>
          <div className="flex space-x-3">
            <input
              id="vp-receipt-id"
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              placeholder={t('verify.placeholder')}
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
                t('verify.button')
              )}
            </button>
          </div>
          {inputError && (
            <p className="text-crypto-red text-sm mt-2">{inputError}</p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {t('verify.idHint')}
          </p>
        </div>

        {/* User's Receipt History */}
        {userReceipts.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-300 mb-2">{t('verify.myReceipts')}</p>
            <div className="flex flex-wrap gap-2">
              {userReceipts.slice(0, 10).map((id) => (
                <button
                  key={id}
                  onClick={() => setReceiptId(id)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                    receiptId === id
                      ? 'bg-primary-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  #{id}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t('verify.clickToFill')}
            </p>
          </div>
        )}

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
                    {lastResult.isValid ? t('verify.proofValid') : t('verify.proofInvalid')}
                  </p>
                  <p className="text-sm text-slate-400">
                    {lastResult.isValid
                      ? t('verify.proofValidBody')
                      : lastResult.error || t('verify.hashMismatch')}
                  </p>
                </div>
              </div>
            </div>

            {/* Hash Comparison */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">{t('verify.hashComparison')}</p>

              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">{t('verify.onChainHash')}</p>
                <p className="font-mono text-sm text-white break-all">
                  {lastResult.onChainProofHash || 'N/A'}
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">{t('verify.localHash')}</p>
                <p className="font-mono text-sm text-white break-all">
                  {lastResult.localProofHash || 'N/A'}
                </p>
              </div>

              {lastResult.isValid && (
                <div className="flex items-center justify-center space-x-2 text-crypto-green">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm">{t('verify.hashesMatch')}</span>
                </div>
              )}
            </div>

            {/* Digest Details */}
            {lastResult.digest && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-300">{t('verify.details')}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">{t('detail.version')}</p>
                    <p className="text-sm text-white">{lastResult.digest.version}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">{t('verify.actionType')}</p>
                    <p className="text-sm text-white">{lastResult.digest.actionType}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">{t('verify.chainId')}</p>
                    <p className="text-sm text-white">{lastResult.digest.chainId}</p>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">{t('verify.riskScore')}</p>
                    <p className={`text-sm font-bold ${
                      riskLevel(lastResult.digest.riskScore) === 'HIGH'
                        ? 'text-crypto-red'
                        : riskLevel(lastResult.digest.riskScore) === 'MEDIUM'
                        ? 'text-accent'
                        : 'text-crypto-green'
                    }`}>
                      {lastResult.digest.riskScore}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">{t('verify.createdAt')}</p>
                  <p className="text-sm text-white">{formatTimestamp(lastResult.digest.createdAt)}</p>
                </div>

                {lastResult.digest.rulesTriggered.length > 0 && (
                  <div className="p-3 bg-white/5 rounded-xl">
                    <p className="text-xs text-slate-500 mb-2">{t('verify.rulesTriggered')}</p>
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
                  <p className="text-xs text-accent mb-1">{t('verify.liabilityNotice')}</p>
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
          {t('verify.close')}
        </button>
      </div>
    </Modal>
  );
};
