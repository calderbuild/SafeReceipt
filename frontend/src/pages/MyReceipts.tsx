import { Link } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { getUserReceipts, getDigest } from '../lib/storage';
import type { CanonicalDigest } from '../lib/canonicalize';

// Heroicons
const DocumentCheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-12M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

interface ReceiptSummary {
  receiptId: string;
  digest: CanonicalDigest;
}

function getRiskColor(score: number): string {
  if (score >= 60) return 'text-red-400 bg-red-500/20';
  if (score >= 30) return 'text-amber-400 bg-amber-500/20';
  return 'text-emerald-400 bg-emerald-500/20';
}

function getStatusBadge(status?: string): { color: string; label: string } | null {
  switch (status) {
    case 'VERIFIED':
      return { color: 'bg-emerald-500/20 text-emerald-400', label: 'Verified' };
    case 'MISMATCH':
      return { color: 'bg-red-500/20 text-red-400', label: 'Mismatch' };
    case 'EXECUTED':
      return { color: 'bg-blue-500/20 text-blue-400', label: 'Executed' };
    default:
      return null; // Don't show badge for CREATED status
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MyReceipts() {
  const { address, isConnected } = useWallet();

  // Get user's receipts
  const receiptIds = isConnected && address ? getUserReceipts(address) : [];
  const receipts: ReceiptSummary[] = receiptIds
    .map(id => {
      const digest = getDigest(id);
      return digest ? { receiptId: id, digest } : null;
    })
    .filter((r): r is ReceiptSummary => r !== null)
    .sort((a, b) => b.digest.createdAt - a.digest.createdAt); // newest first

  return (
    <div className="min-h-screen pt-28 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeftIcon />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">My Receipts</h1>
              <p className="text-slate-400 text-sm">
                {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} stored locally
              </p>
            </div>
          </div>
          <Link to="/" className="btn-primary flex items-center space-x-2">
            <DocumentCheckIcon />
            <span>Create New</span>
          </Link>
        </div>

        {/* Content */}
        {!isConnected ? (
          <div className="glass-card p-12 text-center">
            <p className="text-slate-400 mb-4">Connect your wallet to view receipts</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <DocumentCheckIcon />
            <p className="text-slate-400 mt-4 mb-6">No receipts yet</p>
            <Link to="/" className="btn-primary inline-flex items-center space-x-2">
              <span>Create Your First Receipt</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map(({ receiptId, digest }) => (
              <Link
                key={receiptId}
                to={`/receipt/${receiptId}`}
                className="glass-card-hover p-5 flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${getRiskColor(digest.riskScore)}`}>
                    {digest.riskScore}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-mono text-white">#{receiptId}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        digest.actionType === 'APPROVE'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {digest.actionType}
                      </span>
                      {getStatusBadge(digest.status) && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(digest.status)!.color}`}>
                          {getStatusBadge(digest.status)!.label}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">{formatDate(digest.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-slate-500 group-hover:text-white transition-colors">
                  <span className="text-sm hidden sm:block">View Details</span>
                  <ChevronRightIcon />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
