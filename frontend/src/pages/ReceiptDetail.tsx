import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useVerify } from '../hooks/useVerify';
import { useExecutionVerifier } from '../hooks/useExecutionVerifier';
import { getDigest, updateDigestStatus } from '../lib/storage';
import { exportAndDownload } from '../lib/exportEvidence';
import { RiskCard } from '../components/RiskCard';
import { LiabilityNotice } from '../components/LiabilityNotice';
import { MONAD_TESTNET } from '../lib/contract';
import type { CanonicalDigest } from '../lib/canonicalize';

// Heroicons
const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const ShieldExclamationIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatIntent(intent: object): { label: string; value: string }[] {
  const entries: { label: string; value: string }[] = [];

  const formatValue = (_key: string, value: unknown): string => {
    if (typeof value === 'string' && value.startsWith('0x')) {
      return `${value.slice(0, 10)}...${value.slice(-8)}`;
    }
    if (typeof value === 'string' && value.length > 20) {
      return value.length > 40 ? `${value.slice(0, 40)}...` : value;
    }
    return String(value);
  };

  Object.entries(intent).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      entries.push({ label: key, value: `${value.length} items` });
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([k, v]) => {
        entries.push({ label: `${key}.${k}`, value: formatValue(k, v) });
      });
    } else {
      entries.push({ label: key, value: formatValue(key, value) });
    }
  });

  return entries;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'VERIFIED':
      return { color: 'bg-emerald-500/20 text-emerald-400', label: 'Verified' };
    case 'MISMATCH':
      return { color: 'bg-red-500/20 text-red-400', label: 'Mismatch' };
    case 'EXECUTED':
      return { color: 'bg-blue-500/20 text-blue-400', label: 'Executed' };
    default:
      return { color: 'bg-slate-500/20 text-slate-400', label: 'Created' };
  }
}

export function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const { address } = useWallet();
  const { verifyProof, isVerifying, lastResult } = useVerify();
  const { verifyExecution, isVerifying: isVerifyingExecution, lastResult: executionResult } = useExecutionVerifier();
  const [digest, setDigest] = useState<CanonicalDigest | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      const d = getDigest(id);
      setDigest(d);
    }
  }, [id]);

  const handleVerify = async () => {
    if (!id) return;
    const result = await verifyProof(id);
    setVerified(result.isValid);
  };

  const handleExport = () => {
    if (!id || !digest || !address) return;
    exportAndDownload(id, digest, address);
  };

  const handleLinkTransaction = async () => {
    if (!id || !txHashInput) return;
    setLinkError(null);

    // Validate tx hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHashInput)) {
      setLinkError('Invalid transaction hash format');
      return;
    }

    const result = await verifyExecution(id, txHashInput);

    // Update local storage with verification result
    if (digest) {
      const status = result.isVerified ? 'VERIFIED' : 'MISMATCH';
      updateDigestStatus(id, status, txHashInput);
      setDigest({ ...digest, status, linkedTxHash: txHashInput });
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-12 text-center">
            <p className="text-slate-400">Invalid receipt ID</p>
            <Link to="/receipts" className="btn-secondary mt-4 inline-block">
              Back to Receipts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!digest) {
    return (
      <div className="min-h-screen pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-12 text-center">
            <p className="text-slate-400 mb-4">Receipt #{id} not found in local storage</p>
            <p className="text-slate-500 text-sm mb-6">
              This receipt may exist on-chain but the local data is missing.
            </p>
            <Link to="/receipts" className="btn-secondary inline-block">
              Back to Receipts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const intentEntries = formatIntent(digest.normalizedIntent);
  const statusBadge = getStatusBadge(digest.status || 'CREATED');

  return (
    <div className="min-h-screen pt-28 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/receipts"
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeftIcon />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-white flex items-center space-x-3">
                <span>Receipt #{id}</span>
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  digest.actionType === 'APPROVE'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {digest.actionType}
                </span>
                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
              </h1>
              <p className="text-slate-400 text-sm">{formatDate(digest.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="btn-secondary flex items-center space-x-2"
            >
              <ShieldCheckIcon />
              <span>{isVerifying ? 'Verifying...' : 'Verify Proof'}</span>
            </button>
            <button
              onClick={handleExport}
              className="btn-primary flex items-center space-x-2"
            >
              <DownloadIcon />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Proof Verification Result */}
        {verified !== null && (
          <div className={`glass-card p-4 mb-6 flex items-center space-x-3 ${
            verified
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}>
            {verified ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheckIcon />
                </div>
                <div>
                  <p className="text-emerald-400 font-medium">Proof Verification Passed</p>
                  <p className="text-slate-400 text-sm">On-chain proof matches local digest</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                  <ShieldExclamationIcon />
                </div>
                <div>
                  <p className="text-red-400 font-medium">Proof Verification Failed</p>
                  <p className="text-slate-400 text-sm">
                    {lastResult?.error || 'Hash mismatch or receipt not found on-chain'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Link Execution Section */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <LinkIcon />
            <h3 className="text-lg font-semibold text-white">Link Execution</h3>
          </div>

          {digest.linkedTxHash ? (
            // Already linked
            <div className={`p-4 rounded-lg ${
              digest.status === 'VERIFIED'
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={digest.status === 'VERIFIED' ? 'text-emerald-400' : 'text-red-400'}>
                  {digest.status === 'VERIFIED' ? 'Transaction Verified' : 'Transaction Mismatch'}
                </span>
                <a
                  href={`${MONAD_TESTNET.blockExplorer}/tx/${digest.linkedTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-400 hover:text-blue-300"
                >
                  <span className="font-mono text-sm">
                    {digest.linkedTxHash.slice(0, 10)}...{digest.linkedTxHash.slice(-8)}
                  </span>
                  <ExternalLinkIcon />
                </a>
              </div>
              <p className="text-slate-400 text-sm">
                {digest.status === 'VERIFIED'
                  ? 'The executed transaction matches the declared intent.'
                  : 'The executed transaction does NOT match the declared intent.'}
              </p>
            </div>
          ) : (
            // Not linked yet
            <>
              <p className="text-slate-400 text-sm mb-4">
                Link the actual transaction to verify it matches your declared intent.
                This proves the execution matches what you said you would do.
              </p>

              <div className="flex space-x-3">
                <input
                  type="text"
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  placeholder="0x... transaction hash"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  onClick={handleLinkTransaction}
                  disabled={isVerifyingExecution || !txHashInput}
                  className="btn-primary flex items-center space-x-2"
                >
                  <LinkIcon />
                  <span>{isVerifyingExecution ? 'Verifying...' : 'Link & Verify'}</span>
                </button>
              </div>

              {linkError && (
                <p className="text-red-400 text-sm mt-2">{linkError}</p>
              )}

              {executionResult && !executionResult.isVerified && executionResult.mismatchReasons.length > 0 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 font-medium mb-2">Verification Failed</p>
                  <ul className="text-slate-400 text-sm space-y-1">
                    {executionResult.mismatchReasons.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Risk Assessment */}
        <div className="mb-6">
          <RiskCard
            result={{
              riskScore: digest.riskScore,
              rulesTriggered: digest.rulesTriggered,
              ruleDetails: digest.rulesTriggered.map(rule => ({
                ruleName: rule,
                triggered: true,
                weight: 0,
                description: rule,
              })),
              recommendations: [],
              liabilityNotice: digest.liabilityNotice,
            }}
          />
        </div>

        {/* Liability Notice */}
        <div className="mb-6">
          <LiabilityNotice
            notice={digest.liabilityNotice}
            riskScore={digest.riskScore}
            rulesTriggered={digest.rulesTriggered}
          />
        </div>

        {/* Intent Details */}
        <div className="glass-card p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Transaction Intent</h3>
          <div className="space-y-3">
            {intentEntries.map(({ label, value }, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-slate-400 text-sm">{label}</span>
                <span className="text-white font-mono text-sm">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Details */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Technical Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Version</span>
              <span className="text-white font-mono">{digest.version}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Chain ID</span>
              <span className="text-white font-mono">{digest.chainId}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-slate-400">Created At</span>
              <span className="text-white font-mono">{digest.createdAt}</span>
            </div>
            <div className="flex items-start justify-between py-2">
              <span className="text-slate-400">Rules Triggered</span>
              <div className="flex flex-wrap justify-end gap-1">
                {digest.rulesTriggered.length > 0 ? (
                  digest.rulesTriggered.map((rule, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                      {rule}
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-400">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
