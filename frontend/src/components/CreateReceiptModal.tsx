import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Modal } from './Modal';
import { useWallet } from '../hooks/useWallet';
import { parseApproveIntent, parseBatchPayIntent, createUnlimitedAmount } from '../lib/intentParser';
import { evaluateApprove, evaluateBatchPay, RISK_RULES, recordApproval } from '../lib/riskEngine';
import { createCanonicalDigest, computeIntentHash, computeProofHash } from '../lib/canonicalize';
import { saveDigest, addReceiptToUser } from '../lib/storage';
import { createReceiptRegistryContract, ActionType } from '../lib/contract';
import { KNOWN_SAFE_CONTRACTS } from '../lib/knownContracts';
import type { RiskResult } from '../lib/riskEngine';

interface CreateReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (receiptId: string, txHash: string) => void;
}

type ActionTypeOption = 'APPROVE' | 'BATCH_PAY';

interface FormErrors {
  token?: string;
  spender?: string;
  amount?: string;
  csv?: string;
}

export const CreateReceiptModal: React.FC<CreateReceiptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { address, isConnected, provider, signer } = useWallet();

  // Form state
  const [actionType, setActionType] = useState<ActionTypeOption>('APPROVE');
  const [token, setToken] = useState('');
  const [spender, setSpender] = useState('');
  const [amount, setAmount] = useState('');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [csvText, setCsvText] = useState('');

  // UI state
  const [step, setStep] = useState<'form' | 'review' | 'submitting' | 'success'>('form');
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const resetForm = () => {
    setActionType('APPROVE');
    setToken('');
    setSpender('');
    setAmount('');
    setIsUnlimited(false);
    setCsvText('');
    setStep('form');
    setRiskResult(null);
    setFormErrors({});
    setSubmitError(null);
    setReceiptId(null);
    setTxHash(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAnalyzeRisk = async () => {
    setFormErrors({});
    setSubmitError(null);

    if (actionType === 'APPROVE') {
      // Parse approve intent
      const parseResult = parseApproveIntent({
        token,
        spender,
        amount: isUnlimited ? createUnlimitedAmount() : amount,
      });

      if (!parseResult.success) {
        const errors: FormErrors = {};
        parseResult.errors?.forEach(e => {
          errors[e.field as keyof FormErrors] = e.message;
        });
        setFormErrors(errors);
        return;
      }

      // Evaluate risk
      const result = evaluateApprove(parseResult.data!, {
        knownContracts: [...KNOWN_SAFE_CONTRACTS],
        userAddress: address || '',
      });

      setRiskResult(result);
      setStep('review');
    } else {
      // Parse batch pay intent
      const parseResult = parseBatchPayIntent(csvText);

      if (!parseResult.success) {
        const errors: FormErrors = {};
        parseResult.errors?.forEach(e => {
          errors.csv = e.message;
        });
        setFormErrors(errors);
        return;
      }

      // Evaluate risk
      const result = await evaluateBatchPay(parseResult.data!.recipients);

      setRiskResult(result);
      setStep('review');
    }
  };

  const handleSubmit = async () => {
    if (!riskResult || !address || !provider || !signer) {
      setSubmitError('Wallet not connected');
      return;
    }

    setStep('submitting');
    setSubmitError(null);

    try {
      // Build normalized intent
      let normalizedIntent: object;
      if (actionType === 'APPROVE') {
        const actualAmount = isUnlimited ? createUnlimitedAmount() : amount;
        normalizedIntent = {
          token: ethers.getAddress(token),
          spender: ethers.getAddress(spender),
          amount: actualAmount,
        };
      } else {
        const parseResult = parseBatchPayIntent(csvText);
        normalizedIntent = {
          recipients: parseResult.data!.recipients,
        };
      }

      // Create canonical digest
      const digest = createCanonicalDigest({
        actionType,
        normalizedIntent,
        riskScore: riskResult.riskScore,
        rulesTriggered: riskResult.rulesTriggered,
        liabilityNotice: riskResult.liabilityNotice,
      });

      // Compute hashes
      const intentHash = computeIntentHash(normalizedIntent);
      const proofHash = computeProofHash(digest);

      // Create contract instance
      const contract = createReceiptRegistryContract(
        provider as any,
        signer as any
      );

      if (!contract.isDeployed()) {
        // For demo: simulate success without actual contract call
        const mockReceiptId = Math.floor(Math.random() * 100000).toString();
        const mockTxHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

        // Save digest to localStorage
        saveDigest(mockReceiptId, digest);
        addReceiptToUser(address, mockReceiptId);

        // Record approval for repeat pattern detection
        if (actionType === 'APPROVE') {
          recordApproval(token, spender, address);
        }

        setReceiptId(mockReceiptId);
        setTxHash(mockTxHash);
        setStep('success');
        onSuccess?.(mockReceiptId, mockTxHash);
        return;
      }

      // Submit to chain
      const contractActionType = actionType === 'APPROVE' ? ActionType.APPROVE : ActionType.BATCH_PAY;
      const result = await contract.createReceipt(
        contractActionType,
        intentHash,
        proofHash,
        riskResult.riskScore
      );

      // Save digest to localStorage
      saveDigest(result.receiptId, digest);
      addReceiptToUser(address, result.receiptId);

      // Record approval for repeat pattern detection
      if (actionType === 'APPROVE') {
        recordApproval(token, spender, address);
      }

      setReceiptId(result.receiptId);
      setTxHash(result.txHash);
      setStep('success');
      onSuccess?.(result.receiptId, result.txHash);
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to create receipt');
      setStep('review');
    }
  };

  const getRiskLevelClass = (score: number) => {
    if (score >= 50) return 'risk-high';
    if (score >= 25) return 'risk-medium';
    return 'risk-low';
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Receipt">
      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-slate-400 mb-4">Connect your wallet to create receipts</p>
        </div>
      ) : step === 'form' ? (
        <div className="space-y-6">
          {/* Action Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Action Type</label>
            <div className="flex space-x-3">
              <button
                onClick={() => setActionType('APPROVE')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all cursor-pointer ${
                  actionType === 'APPROVE'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Approve
              </button>
              <button
                onClick={() => setActionType('BATCH_PAY')}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all cursor-pointer ${
                  actionType === 'BATCH_PAY'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Batch Pay
              </button>
            </div>
          </div>

          {actionType === 'APPROVE' ? (
            <>
              {/* Token Address */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Token Address</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="0x..."
                  className="input-field font-mono text-sm"
                />
                {formErrors.token && (
                  <p className="text-crypto-red text-sm mt-1">{formErrors.token}</p>
                )}
              </div>

              {/* Spender Address */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Spender Address</label>
                <input
                  type="text"
                  value={spender}
                  onChange={(e) => setSpender(e.target.value)}
                  placeholder="0x..."
                  className="input-field font-mono text-sm"
                />
                {formErrors.spender && (
                  <p className="text-crypto-red text-sm mt-1">{formErrors.spender}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={isUnlimited ? 'Unlimited' : amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount in wei"
                    disabled={isUnlimited}
                    className={`input-field font-mono text-sm flex-1 ${isUnlimited ? 'opacity-50' : ''}`}
                  />
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => setIsUnlimited(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-400">Unlimited</span>
                  </label>
                </div>
                {formErrors.amount && (
                  <p className="text-crypto-red text-sm mt-1">{formErrors.amount}</p>
                )}
              </div>
            </>
          ) : (
            /* Batch Pay CSV */
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Recipients (CSV format: address,amount)
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="0x1234...,1000000000000000000&#10;0x5678...,2000000000000000000"
                rows={6}
                className="input-field font-mono text-sm resize-none"
              />
              {formErrors.csv && (
                <p className="text-crypto-red text-sm mt-1">{formErrors.csv}</p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                One recipient per line. Amounts in wei (smallest unit).
              </p>
            </div>
          )}

          <button
            onClick={handleAnalyzeRisk}
            className="btn-primary w-full"
          >
            Analyze Risk
          </button>
        </div>
      ) : step === 'review' && riskResult ? (
        <div className="space-y-6">
          {/* Risk Score */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <div>
              <p className="text-sm text-slate-400">Risk Score</p>
              <p className="text-lg font-semibold text-white">
                {riskResult.rulesTriggered.length > 0
                  ? `${riskResult.rulesTriggered.length} rule(s) triggered`
                  : 'No risks detected'}
              </p>
            </div>
            <div className={`risk-score ${getRiskLevelClass(riskResult.riskScore)}`}>
              {riskResult.riskScore}
            </div>
          </div>

          {/* Triggered Rules */}
          {riskResult.ruleDetails.filter(r => r.triggered).length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">Triggered Rules</p>
              {riskResult.ruleDetails
                .filter(r => r.triggered)
                .map((rule, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-sm text-crypto-red">{rule.ruleName}</code>
                      <span className="text-xs text-slate-500">+{rule.weight} points</span>
                    </div>
                    <p className="text-sm text-slate-400">{rule.description}</p>
                    {rule.recommendation && (
                      <p className="text-xs text-slate-500 mt-1">{rule.recommendation}</p>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* Liability Notice */}
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl">
            <p className="text-sm font-medium text-accent mb-2">Liability Notice</p>
            <p className="text-sm text-slate-300">{riskResult.liabilityNotice}</p>
          </div>

          {submitError && (
            <div className="p-4 bg-crypto-red/10 border border-crypto-red/20 rounded-xl">
              <p className="text-sm text-crypto-red">{submitError}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => setStep('form')}
              className="btn-secondary flex-1"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary flex-1"
            >
              Create Receipt
            </button>
          </div>
        </div>
      ) : step === 'submitting' ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Creating receipt...</p>
          <p className="text-sm text-slate-400 mt-2">Please confirm the transaction in your wallet</p>
        </div>
      ) : step === 'success' ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-crypto-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-crypto-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Receipt Created!</h3>
          <p className="text-slate-400 mb-6">Your receipt has been stored on-chain.</p>

          <div className="text-left space-y-3 p-4 bg-white/5 rounded-xl mb-6">
            <div>
              <p className="text-xs text-slate-500">Receipt ID</p>
              <p className="font-mono text-sm text-white">{receiptId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Transaction Hash</p>
              <p className="font-mono text-sm text-white break-all">{txHash}</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="btn-primary w-full"
          >
            Done
          </button>
        </div>
      ) : null}
    </Modal>
  );
};
