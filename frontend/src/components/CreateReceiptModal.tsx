import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Modal } from './Modal';
import { useWallet } from '../hooks/useWallet';
import { parseApproveIntent, parseBatchPayIntent, createUnlimitedAmount } from '../lib/intentParser';
import { evaluateApprove, evaluateBatchPay, recordApproval } from '../lib/riskEngine';
import { createCanonicalDigest, computeIntentHash, computeProofHash } from '../lib/canonicalize';
import { saveDigest, addReceiptToUser } from '../lib/storage';
import { createReceiptRegistryContract, ActionType } from '../lib/contract';
import { KNOWN_SAFE_CONTRACTS } from '../lib/knownContracts';
import { parseNaturalLanguageIntent, explainRisks, isLLMConfigured } from '../lib/llm';
import type { RiskResult } from '../lib/riskEngine';

interface CreateReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (receiptId: string, txHash: string) => void;
}

type ActionTypeOption = 'APPROVE' | 'BATCH_PAY';
type InputMode = 'ai' | 'manual';

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

  // Input mode state
  const [inputMode, setInputMode] = useState<InputMode>(isLLMConfigured() ? 'ai' : 'manual');
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiParseError, setAiParseError] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiRiskExplanation, setAiRiskExplanation] = useState<string | null>(null);

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
    setInputMode(isLLMConfigured() ? 'ai' : 'manual');
    setNaturalLanguageInput('');
    setIsParsingAI(false);
    setAiParseError(null);
    setAiConfidence(null);
    setAiReasoning(null);
    setAiRiskExplanation(null);
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

  // AI natural language parsing
  const handleAIParse = async () => {
    if (!naturalLanguageInput.trim()) {
      setAiParseError('请输入交易描述');
      return;
    }

    setIsParsingAI(true);
    setAiParseError(null);
    setAiConfidence(null);
    setAiReasoning(null);

    try {
      const result = await parseNaturalLanguageIntent(naturalLanguageInput);

      if (!result.success) {
        setAiParseError(result.error || '解析失败');
        setIsParsingAI(false);
        return;
      }

      const intent = result.intent!;
      setAiConfidence(intent.confidence);
      setAiReasoning(intent.reasoning);

      // Fill form with parsed data
      if (intent.actionType === 'APPROVE') {
        setActionType('APPROVE');
        setToken(intent.token);
        setSpender(intent.spender);
        setAmount(intent.amount);
        setIsUnlimited(intent.isUnlimited);
      } else if (intent.actionType === 'BATCH_PAY') {
        setActionType('BATCH_PAY');
        const csvLines = intent.recipients
          .map(r => `${r.address},${r.amount}`)
          .join('\n');
        setCsvText(csvLines);
      }

      // Switch to manual mode to show parsed results
      setInputMode('manual');
      setIsParsingAI(false);
    } catch (error: any) {
      setAiParseError(error.message || '解析失败');
      setIsParsingAI(false);
    }
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

      // Generate AI risk explanation if LLM is configured
      if (isLLMConfigured() && result.rulesTriggered.length > 0) {
        const intentContext = `Approve ${isUnlimited ? 'unlimited' : amount} tokens to ${spender}`;
        const explanation = await explainRisks(
          result.rulesTriggered,
          result.riskScore,
          intentContext
        );
        if (explanation.success) {
          setAiRiskExplanation(explanation.explanation || null);
        }
      }

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

      // Generate AI risk explanation if LLM is configured
      if (isLLMConfigured() && result.rulesTriggered.length > 0) {
        const intentContext = `Batch pay to ${parseResult.data!.recipients.length} recipients`;
        const explanation = await explainRisks(
          result.rulesTriggered,
          result.riskScore,
          intentContext
        );
        if (explanation.success) {
          setAiRiskExplanation(explanation.explanation || null);
        }
      }

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
          {/* Input Mode Toggle - only show if LLM is configured */}
          {isLLMConfigured() && (
            <div className="flex items-center justify-center space-x-2 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setInputMode('ai')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium transition-all cursor-pointer ${
                  inputMode === 'ai'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                <span>AI 解析</span>
              </button>
              <button
                onClick={() => setInputMode('manual')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg font-medium transition-all cursor-pointer ${
                  inputMode === 'manual'
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>手动输入</span>
              </button>
            </div>
          )}

          {/* AI Natural Language Input */}
          {inputMode === 'ai' && isLLMConfigured() && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  用自然语言描述你的交易意图
                </label>
                <textarea
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  placeholder="用日常语言描述，例如：&#10;授权 Uniswap 使用 1000 USDC&#10;给 Uniswap 无限授权我的 USDT"
                  rows={3}
                  className="input-field text-sm resize-none"
                  disabled={isParsingAI}
                />
              <div className="mt-2 p-3 bg-white/5 rounded-lg">
                <p className="text-xs text-slate-400 mb-2">支持的代币和协议：</p>
                <div className="flex flex-wrap gap-2">
                  {['USDC', 'USDT', 'WETH', 'DAI'].map(t => (
                    <span key={t} className="px-2 py-0.5 text-xs bg-primary-500/20 text-primary-300 rounded">
                      {t}
                    </span>
                  ))}
                  {['Uniswap', '1inch', 'OpenSea'].map(p => (
                    <span key={p} className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-300 rounded">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              </div>

              {aiParseError && (
                <div className="p-3 bg-crypto-red/10 border border-crypto-red/20 rounded-xl">
                  <p className="text-sm text-crypto-red">
                    {aiParseError.includes('Missing information')
                      ? '无法识别您的描述，请尝试更具体的表达，例如「授权 Uniswap 使用 1000 USDC」'
                      : aiParseError}
                  </p>
                </div>
              )}

              {aiConfidence !== null && aiReasoning && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-purple-400">AI 解析结果</span>
                    <span className={`text-xs font-mono ${
                      aiConfidence >= 0.8 ? 'text-crypto-green' :
                      aiConfidence >= 0.5 ? 'text-accent' : 'text-crypto-red'
                    }`}>
                      置信度: {(aiConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{aiReasoning}</p>
                </div>
              )}

              <button
                onClick={handleAIParse}
                disabled={isParsingAI || !naturalLanguageInput.trim()}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                {isParsingAI ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>AI 解析中...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span>AI 智能解析</span>
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center">
                AI 会自动识别代币和协议名称，解析后你可以确认
              </p>
            </div>
          )}

          {/* Manual Input Form */}
          {inputMode === 'manual' && (
            <>
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
            </>
          )}
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

          {/* AI Risk Explanation */}
          {aiRiskExplanation && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <p className="text-sm font-medium text-purple-400">AI 风险解读</p>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-line">{aiRiskExplanation}</p>
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
