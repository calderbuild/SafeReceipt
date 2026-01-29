/**
 * Export Evidence - Complete dispute arbitration evidence
 *
 * Generates a JSON file containing all necessary info for:
 * 1. On-chain verification
 * 2. Dispute arbitration
 * 3. Audit trail
 */

import type { CanonicalDigest } from './canonicalize';
import { computeIntentHash, computeProofHash } from './canonicalize';

export interface ExportedEvidence {
  // Version info
  version: string;
  exportedAt: string;

  // Receipt ID
  receiptId: string;
  chainId: number;

  // Participant info
  actor: string;

  // Hash proofs
  intentHash: string;
  proofHash: string;

  // Original data
  normalizedIntent: object;
  riskScore: number;
  rulesTriggered: string[];
  liabilityNotice: string;

  // Timestamps
  createdAt: number;
  createdAtISO: string;

  // On-chain info
  transactionHash?: string;
  blockNumber?: number;

  // Verification guide
  verificationInstructions: string;

  // Links
  links: {
    explorer?: string;
    verifyUrl?: string;
  };
}

/**
 * Create export evidence object
 */
export function createExportEvidence(
  receiptId: string,
  digest: CanonicalDigest,
  actor: string,
  txHash?: string,
  blockNumber?: number
): ExportedEvidence {
  const intentHash = computeIntentHash(digest.normalizedIntent);
  const proofHash = computeProofHash(digest);

  const evidence: ExportedEvidence = {
    version: '1.0',
    exportedAt: new Date().toISOString(),

    receiptId,
    chainId: digest.chainId,

    actor,

    intentHash,
    proofHash,

    normalizedIntent: digest.normalizedIntent,
    riskScore: digest.riskScore,
    rulesTriggered: digest.rulesTriggered,
    liabilityNotice: digest.liabilityNotice,

    createdAt: digest.createdAt,
    createdAtISO: new Date(digest.createdAt * 1000).toISOString(),

    transactionHash: txHash,
    blockNumber,

    verificationInstructions: generateVerificationInstructions(receiptId, digest.chainId),

    links: {
      explorer: txHash
        ? `https://testnet.monadscan.com/tx/${txHash}`
        : undefined,
    },
  };

  return evidence;
}

/**
 * Generate verification instructions
 */
function generateVerificationInstructions(receiptId: string, chainId: number): string {
  return `
Verification Steps:

1. Fetch On-Chain Data
   - Access the SafeReceipt contract
   - Call getReceipt(${receiptId})
   - Retrieve the stored proofHash

2. Local Verification
   - Use normalizedIntent and other fields from this file
   - Recompute hash following CanonicalDigest format
   - Field order: version, actionType, chainId, normalizedIntent, riskScore, rulesTriggered, liabilityNotice, createdAt
   - Compute proofHash using keccak256

3. Compare
   - Compare on-chain proofHash with locally computed hash
   - If they match, data integrity is proven
   - If they don't match, data may have been tampered with

Chain Info:
- Chain ID: ${chainId}
- Network: Monad Testnet
- RPC: https://testnet-rpc.monad.xyz

This evidence file can be used for dispute arbitration, proving the user's true intent before transaction execution.
`.trim();
}

/**
 * Export as JSON file
 */
export function exportAsJSON(evidence: ExportedEvidence): string {
  return JSON.stringify(evidence, null, 2);
}

/**
 * Download evidence file
 */
export function downloadEvidence(evidence: ExportedEvidence): void {
  const json = exportAsJSON(evidence);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `safereceipt-evidence-${evidence.receiptId}-${Date.now()}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Quick export function
 */
export function exportAndDownload(
  receiptId: string,
  digest: CanonicalDigest,
  actor: string,
  txHash?: string,
  blockNumber?: number
): void {
  const evidence = createExportEvidence(receiptId, digest, actor, txHash, blockNumber);
  downloadEvidence(evidence);
}
